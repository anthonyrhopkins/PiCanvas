/**
 * RemotePagePicker — modal dialog for configuring a remote-content tab.
 * URL input → probe → checklist of sections/webparts → mode toggle → save.
 */

import {
  RemoteContentService,
  IRemoteSelection,
  RemoteMode,
  IProbedItem,
} from '../services/RemoteContentService';

export interface IRemotePickerInitial {
  url?: string;
  mode?: RemoteMode;
  selections?: IRemoteSelection[];
  refreshSec?: number;
}

export interface IRemotePickerResult {
  url: string;
  mode: RemoteMode;
  selections: IRemoteSelection[];
  refreshSec: number;
}

export class RemotePagePicker {
  public static open(initial: IRemotePickerInitial, onSave: (r: IRemotePickerResult) => void): void {
    const overlay = document.createElement('div');
    overlay.className = 'picanvas-remote-picker-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:100000;display:flex;align-items:center;justify-content:center;';

    const dialog = document.createElement('div');
    dialog.className = 'picanvas-remote-picker';
    dialog.style.cssText = 'background:#fff;color:#000;width:640px;max-width:90vw;max-height:80vh;overflow:auto;border-radius:6px;padding:20px;box-shadow:0 8px 30px rgba(0,0,0,.3);';
    overlay.appendChild(dialog);

    let currentMode: RemoteMode = initial.mode || 'live';
    let currentRefresh: number = initial.refreshSec ?? 0;
    let detectedItems: IProbedItem[] = [];
    const checkedIds = new Set<string>((initial.selections || []).map(s => `${s.kind}:${s.id}`));

    const render = () => {
      dialog.innerHTML = `
        <h2 style="margin:0 0 12px 0;font:600 18px/1.3 sans-serif;">Configure remote content</h2>
        <label style="display:block;font:600 12px sans-serif;margin-bottom:4px;">Source page URL</label>
        <div style="display:flex;gap:8px;margin-bottom:12px;">
          <input type="text" class="picanvas-remote-url" value="${escapeAttr(initial.url || '')}" style="flex:1;padding:6px 10px;font:14px sans-serif;border:1px solid #ccc;border-radius:4px;" placeholder="/sites/.../SitePages/Foo.aspx" />
          <button type="button" class="picanvas-remote-load" style="padding:6px 14px;background:#0078d4;color:#fff;border:0;border-radius:4px;cursor:pointer;">Load page</button>
        </div>
        <div class="picanvas-remote-probe-status" style="font:14px sans-serif;color:#444;margin-bottom:12px;"></div>
        <div class="picanvas-remote-items" style="margin-bottom:16px;"></div>
        <fieldset style="border:1px solid #ddd;padding:10px 12px;border-radius:4px;margin-bottom:12px;">
          <legend style="font:600 12px sans-serif;padding:0 4px;">Render mode</legend>
          <label style="display:inline-block;margin-right:16px;font:14px sans-serif;">
            <input type="radio" name="picanvas-remote-mode" value="live" ${currentMode === 'live' ? 'checked' : ''}/> Live (iframe)
          </label>
          <label style="display:inline-block;font:14px sans-serif;">
            <input type="radio" name="picanvas-remote-mode" value="snapshot" ${currentMode === 'snapshot' ? 'checked' : ''}/> Snapshot (clone)
          </label>
          <div class="picanvas-remote-refresh" style="margin-top:10px;${currentMode === 'snapshot' ? '' : 'display:none;'}">
            <label style="display:block;font:600 12px sans-serif;margin-bottom:4px;">Auto-refresh</label>
            <select class="picanvas-remote-refresh-sec" style="padding:4px 8px;font:14px sans-serif;">
              <option value="0" ${currentRefresh === 0 ? 'selected' : ''}>Never</option>
              <option value="30" ${currentRefresh === 30 ? 'selected' : ''}>Every 30 seconds</option>
              <option value="60" ${currentRefresh === 60 ? 'selected' : ''}>Every 1 minute</option>
              <option value="300" ${currentRefresh === 300 ? 'selected' : ''}>Every 5 minutes</option>
              <option value="900" ${currentRefresh === 900 ? 'selected' : ''}>Every 15 minutes</option>
            </select>
          </div>
        </fieldset>
        <div style="display:flex;justify-content:flex-end;gap:8px;">
          <button type="button" class="picanvas-remote-cancel" style="padding:6px 14px;background:#eee;color:#000;border:0;border-radius:4px;cursor:pointer;">Cancel</button>
          <button type="button" class="picanvas-remote-save" style="padding:6px 14px;background:#0078d4;color:#fff;border:0;border-radius:4px;cursor:pointer;">Save</button>
        </div>
      `;

      const urlInput = dialog.querySelector<HTMLInputElement>('.picanvas-remote-url')!;
      const loadBtn = dialog.querySelector<HTMLButtonElement>('.picanvas-remote-load')!;
      const statusEl = dialog.querySelector<HTMLElement>('.picanvas-remote-probe-status')!;
      const itemsEl = dialog.querySelector<HTMLElement>('.picanvas-remote-items')!;
      const refreshWrap = dialog.querySelector<HTMLElement>('.picanvas-remote-refresh')!;

      dialog.querySelectorAll<HTMLInputElement>('input[name="picanvas-remote-mode"]').forEach(r => {
        r.addEventListener('change', () => {
          currentMode = r.value as RemoteMode;
          refreshWrap.style.display = currentMode === 'snapshot' ? '' : 'none';
        });
      });

      dialog.querySelector<HTMLSelectElement>('.picanvas-remote-refresh-sec')!.addEventListener('change', e => {
        currentRefresh = parseInt((e.target as HTMLSelectElement).value, 10) || 0;
      });

      const renderItems = () => {
        if (detectedItems.length === 0) {
          itemsEl.innerHTML = '';
          return;
        }
        const detectedKeys = new Set(detectedItems.map(i => `${i.kind}:${i.id}`));
        const missing = (initial.selections || []).filter(s => !detectedKeys.has(`${s.kind}:${s.id}`));

        const grouped = new Map<string, IProbedItem[]>();
        const pageItem = detectedItems.find(i => i.kind === 'page');
        detectedItems.filter(i => i.kind !== 'page').forEach(i => {
          const key = i.kind === 'section' ? i.id : (i.containingSectionId || 'orphan');
          if (!grouped.has(key)) grouped.set(key, []);
          grouped.get(key)!.push(i);
        });

        let html = '<label style="display:block;font:600 12px sans-serif;margin-bottom:6px;">Select content</label>';
        if (pageItem) {
          const key = `${pageItem.kind}:${pageItem.id}`;
          html += `<label style="display:block;padding:6px;background:#f3f3f3;border-radius:4px;margin-bottom:8px;font:14px sans-serif;">
            <input type="checkbox" data-pick="${key}" ${checkedIds.has(key) ? 'checked' : ''}/> ${escapeHtml(pageItem.label)}
          </label>`;
        }
        grouped.forEach((arr) => {
          const section = arr.find(a => a.kind === 'section');
          const webparts = arr.filter(a => a.kind === 'webpart');
          if (section) {
            const key = `${section.kind}:${section.id}`;
            html += `<div style="border:1px solid #e0e0e0;border-radius:4px;padding:8px;margin-bottom:6px;">
              <label style="display:block;font:600 13px sans-serif;">
                <input type="checkbox" data-pick="${key}" ${checkedIds.has(key) ? 'checked' : ''}/> ${escapeHtml(section.label)}
              </label>`;
            webparts.forEach(wp => {
              const wpKey = `${wp.kind}:${wp.id}`;
              const dynamicHint = wp.isDynamic ? ' <span style="color:#a16207;font-size:11px;">(dynamic — prefer Live mode)</span>' : '';
              html += `<label style="display:block;padding:4px 0 4px 18px;font:13px sans-serif;">
                <input type="checkbox" data-pick="${wpKey}" ${checkedIds.has(wpKey) ? 'checked' : ''}/> ${escapeHtml(wp.label)}${dynamicHint}
              </label>`;
            });
            html += '</div>';
          }
        });

        if (missing.length > 0) {
          html += '<div style="margin-top:8px;padding:8px;border:1px dashed #c2410c;border-radius:4px;background:#fff7ed;">';
          html += '<div style="font:600 12px sans-serif;color:#9a3412;margin-bottom:4px;">Previously selected (missing on this page)</div>';
          missing.forEach(m => {
            html += `<div style="padding:2px 0;font:13px sans-serif;color:#9a3412;">— ${escapeHtml(m.label)}</div>`;
          });
          html += '<div style="font:11px sans-serif;color:#9a3412;margin-top:4px;">These will be dropped on save.</div></div>';
        }
        itemsEl.innerHTML = html;
        itemsEl.querySelectorAll<HTMLInputElement>('input[data-pick]').forEach(cb => {
          cb.addEventListener('change', () => {
            const k = cb.getAttribute('data-pick')!;
            if (cb.checked) checkedIds.add(k); else checkedIds.delete(k);
          });
        });
        missing.forEach(m => checkedIds.delete(`${m.kind}:${m.id}`));
      };

      loadBtn.addEventListener('click', async () => {
        const url = urlInput.value.trim();
        if (!url) { statusEl.textContent = 'Enter a URL first.'; return; }
        statusEl.textContent = 'Loading…';
        itemsEl.innerHTML = '';
        const result = await RemoteContentService.probeRemotePage(url);
        if (!result.ok) {
          statusEl.textContent = result.message;
          detectedItems = [];
          return;
        }
        detectedItems = result.items;
        statusEl.textContent = `${result.items.length - 1} section/webpart${result.items.length - 1 === 1 ? '' : 's'} detected.`;
        renderItems();
      });

      dialog.querySelector<HTMLButtonElement>('.picanvas-remote-cancel')!.addEventListener('click', () => {
        document.body.removeChild(overlay);
      });

      dialog.querySelector<HTMLButtonElement>('.picanvas-remote-save')!.addEventListener('click', () => {
        const url = urlInput.value.trim();
        const selections: IRemoteSelection[] = detectedItems
          .filter(i => checkedIds.has(`${i.kind}:${i.id}`))
          .map(i => ({ kind: i.kind, id: i.id, label: i.label }));
        if (selections.length === 0 && initial.selections) {
          selections.push(...initial.selections);
        }
        onSave({ url, mode: currentMode, selections, refreshSec: currentRefresh });
        document.body.removeChild(overlay);
      });

      if (initial.url && detectedItems.length === 0) {
        loadBtn.click();
      }
    };

    render();
    document.body.appendChild(overlay);
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c
  ));
}

function escapeAttr(s: string): string {
  return escapeHtml(s);
}
