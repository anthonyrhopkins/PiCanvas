/**
 * RemoteContentService — loads another SharePoint page (same tenant) and
 * renders selected sections / webparts inside a PiCanvas tab.
 *
 * Two modes:
 *   - 'live'     — keep an iframe mounted, hide non-selected content via CSS
 *   - 'snapshot' — clone selected DOM into the host, optional auto-refresh
 *
 * Same-tenant only in v1 (cross-origin iframes block both modes).
 */

export type RemoteSelectionKind = 'section' | 'webpart' | 'page';

export interface IRemoteSelection {
  kind: RemoteSelectionKind;
  id: string;       // section data-section-id, webpart instance id, or 'page' sentinel
  label: string;    // user-visible label
}

export type RemoteMode = 'live' | 'snapshot';

export interface IRemoteConfig {
  url: string;
  mode: RemoteMode;
  selections: IRemoteSelection[];
  refreshSec?: number;   // snapshot only; 0 = no auto-refresh
  isEditMode?: boolean;  // adds editor outline + label when true
}

export interface IRemoteMount {
  destroy(): void;
  refresh(): void;
}

export interface IProbedItem {
  kind: RemoteSelectionKind;
  id: string;
  label: string;
  containingSectionId?: string;
  isDynamic?: boolean;
}

export type IProbeResult =
  | { ok: true; items: IProbedItem[] }
  | { ok: false; error: 'cross-tenant' | 'access-denied' | 'timeout' | 'no-items' | 'unknown'; message: string };

const READY_TIMEOUT_MS = 15000;
const REFRESH_MIN_SEC = 30;

const CHROME_SELECTORS = [
  '#SuiteNavWrapper',
  '[data-automation-id="pageHeader"]',
  '.spSiteHeader',
  '#spLeftNav',
  '#spCommandBar',
  '[data-automation-id="pageCommandBar"]',
].join(', ');

export class RemoteContentService {
  /**
   * Mount remote content into a host element.
   * Returns a handle with destroy() + refresh().
   */
  public static mount(host: HTMLElement, config: IRemoteConfig): IRemoteMount {
    host.innerHTML = '';
    const status = document.createElement('div');
    status.className = 'picanvas-remote-status';
    status.textContent = 'Loading remote content…';
    host.appendChild(status);

    let destroyed = false;
    let cleanup: () => void = () => { /* no-op */ };

    const showError = (msg: string) => {
      if (destroyed) return;
      host.innerHTML = `<div class="picanvas-remote-error">${escapeHtml(msg)}</div>`;
    };

    // Origin pre-check.
    try {
      const parsed = new URL(config.url, window.location.href);
      if (parsed.origin !== window.location.origin) {
        showError("Cross-tenant sources aren't supported yet.");
        return { destroy: () => { destroyed = true; }, refresh: () => { /* no-op */ } };
      }
    } catch {
      showError('Invalid source URL.');
      return { destroy: () => { destroyed = true; }, refresh: () => { /* no-op */ } };
    }

    if (config.mode === 'live') {
      const frame = document.createElement('iframe');
      frame.style.cssText = 'width:100%;border:0;display:block;';
      frame.setAttribute('loading', 'eager');
      frame.src = config.url;
      host.appendChild(frame);

      const timeoutHandle: number = window.setTimeout(() => {
        showError("Source page didn't finish loading. Refresh the page to retry.");
      }, READY_TIMEOUT_MS);

      frame.addEventListener('load', () => {
        if (destroyed) return;
        let doc: Document | null = null;
        try { doc = frame.contentDocument; } catch { /* cross-origin */ }
        if (!doc) {
          window.clearTimeout(timeoutHandle);
          showError("Cross-tenant sources aren't supported yet.");
          return;
        }
        if (RemoteContentService.isAccessDenied(doc)) {
          window.clearTimeout(timeoutHandle);
          showError("You don't have access to this page.");
          return;
        }
        const startedAt = Date.now();
        const poll = () => {
          if (destroyed || !doc) return;
          const hasSection = doc.querySelector('.CanvasSection[data-section-id]') !== null;
          if (doc.readyState === 'complete' && hasSection) {
            window.clearTimeout(timeoutHandle);
            status.remove();
            const css = RemoteContentService.buildLiveStyles(config.selections);
            RemoteContentService.injectStyles(doc, css);
            const detachResize = RemoteContentService.attachAutoSize(frame);
            if (config.isEditMode) {
              frame.style.outline = '2px dashed #0078d4';
              frame.style.outlineOffset = '2px';
              const banner = document.createElement('div');
              banner.style.cssText = 'font:600 11px sans-serif;background:#0078d4;color:#fff;padding:2px 8px;display:inline-block;margin-bottom:4px;border-radius:3px;';
              banner.textContent = `Remote: ${config.url} · ${config.selections.length} selection${config.selections.length === 1 ? '' : 's'} · Live`;
              host.insertBefore(banner, frame);
            }
            cleanup = () => { detachResize(); };
            return;
          }
          if (Date.now() - startedAt > READY_TIMEOUT_MS) {
            window.clearTimeout(timeoutHandle);
            showError("Source page didn't finish loading. Refresh the page to retry.");
            return;
          }
          window.setTimeout(poll, 250);
        };
        poll();
      });

      return {
        destroy: () => {
          destroyed = true;
          cleanup();
          try { host.removeChild(frame); } catch { /* gone */ }
        },
        refresh: () => {
          if (destroyed) return;
          frame.contentWindow?.location.reload();
        },
      };
    }

    // ---------- snapshot mode ----------
    let snapshotFrame: HTMLIFrameElement | null = null;
    let refreshTimer: number | undefined;

    const runSnapshot = async () => {
      try {
        snapshotFrame = await RemoteContentService.loadHiddenFrame(config.url);
      } catch (e) {
        const reason = (e as Error).message;
        if (reason === 'cross-tenant') return showError("Cross-tenant sources aren't supported yet.");
        if (reason === 'timeout') return showError("Source page didn't finish loading. Refresh the page to retry.");
        return showError('Could not load the source page.');
      }
      if (destroyed) {
        if (snapshotFrame) { try { document.body.removeChild(snapshotFrame); } catch { /* gone */ } }
        return;
      }
      const doc = snapshotFrame.contentDocument!;
      if (RemoteContentService.isAccessDenied(doc)) {
        try { document.body.removeChild(snapshotFrame); } catch { /* gone */ }
        return showError("You don't have access to this page.");
      }
      const { wrapper, missingCount, selectionCount } = RemoteContentService.buildSnapshot(doc, config.selections);
      try { document.body.removeChild(snapshotFrame); } catch { /* gone */ }
      snapshotFrame = null;

      if (selectionCount > 0 && missingCount === selectionCount) {
        showError('Selected content no longer exists on the source page. Re-pick in tab settings.');
        return;
      }

      // Atomic swap: clear prior content, append new wrapper.
      Array.from(host.querySelectorAll('.picanvas-remote-snapshot, .picanvas-remote-status, .picanvas-remote-error')).forEach(n => n.remove());
      host.appendChild(wrapper);

      if (config.isEditMode) {
        wrapper.style.outline = '2px dashed #0078d4';
        wrapper.style.outlineOffset = '2px';
        const banner = document.createElement('div');
        banner.style.cssText = 'font:600 11px sans-serif;background:#0078d4;color:#fff;padding:2px 8px;display:inline-block;margin-bottom:4px;border-radius:3px;';
        const refreshNote = (config.refreshSec || 0) > 0 ? ` · refresh ${config.refreshSec}s` : '';
        banner.textContent = `Remote: ${config.url} · ${config.selections.length} selection${config.selections.length === 1 ? '' : 's'} · Snapshot${refreshNote}`;
        host.insertBefore(banner, wrapper);
      }

      if (config.isEditMode && config.mode === 'snapshot') {
        const refreshBtn = document.createElement('button');
        refreshBtn.type = 'button';
        refreshBtn.textContent = 'Refresh now';
        refreshBtn.style.cssText = 'margin-left:8px;font:600 11px sans-serif;background:#fff;color:#0078d4;border:1px solid #0078d4;padding:2px 8px;border-radius:3px;cursor:pointer;';
        refreshBtn.addEventListener('click', () => runSnapshot());
        host.insertBefore(refreshBtn, wrapper);
      }
    };

    runSnapshot();

    const refreshSec = Math.max(0, config.refreshSec || 0);
    if (refreshSec > 0) {
      const interval = Math.max(REFRESH_MIN_SEC, refreshSec) * 1000;
      refreshTimer = window.setInterval(runSnapshot, interval);
    }

    return {
      destroy: () => {
        destroyed = true;
        if (refreshTimer) window.clearInterval(refreshTimer);
        if (snapshotFrame) { try { document.body.removeChild(snapshotFrame); } catch { /* gone */ } }
      },
      refresh: () => { if (!destroyed) runSnapshot(); },
    };
  }

  /** Resolve selections against a loaded document into target elements. */
  private static resolveTargets(doc: Document, selections: IRemoteSelection[]): HTMLElement[] {
    const targets: HTMLElement[] = [];
    const seen = new Set<HTMLElement>();
    const push = (el: HTMLElement | null) => {
      if (el && !seen.has(el)) { seen.add(el); targets.push(el); }
    };
    for (const sel of selections) {
      if (sel.kind === 'page') {
        push(doc.querySelector<HTMLElement>('[data-automation-id="canvasContent"]')
          || doc.querySelector<HTMLElement>('#spPageCanvasContent')
          || doc.body);
      } else if (sel.kind === 'section') {
        push(doc.querySelector<HTMLElement>(`.CanvasSection[data-section-id="${cssEscape(sel.id)}"]`));
      } else if (sel.kind === 'webpart') {
        push(doc.querySelector<HTMLElement>(`[data-sp-feature-instance-id="${cssEscape(sel.id)}"]`));
      }
    }
    return targets;
  }

  /** Build the snapshot DOM: clone targets, copy stylesheets into a scoped wrapper. */
  private static buildSnapshot(doc: Document, selections: IRemoteSelection[]): { wrapper: HTMLElement; missingCount: number; selectionCount: number } {
    const wrapper = document.createElement('div');
    wrapper.className = 'picanvas-remote-snapshot';
    wrapper.style.cssText = 'all: initial; display: block; width: 100%;';

    // Copy stylesheets so cloned elements retain layout.
    Array.from(doc.querySelectorAll<HTMLLinkElement | HTMLStyleElement>('link[rel="stylesheet"], style')).forEach(node => {
      wrapper.appendChild(node.cloneNode(true));
    });

    const targets = this.resolveTargets(doc, selections);
    targets.forEach(el => {
      wrapper.appendChild(el.cloneNode(true));
    });

    return {
      wrapper,
      missingCount: selections.length - targets.length,
      selectionCount: selections.length,
    };
  }

  /**
   * Probe a remote SharePoint page for sections + webparts.
   * Used by RemotePagePicker.
   */
  public static async probeRemotePage(url: string): Promise<IProbeResult> {
    // Origin check up front (avoids loading the iframe at all for cross-tenant URLs).
    try {
      const parsed = new URL(url, window.location.href);
      if (parsed.origin !== window.location.origin) {
        return { ok: false, error: 'cross-tenant', message: 'Cross-tenant pages are not supported.' };
      }
    } catch {
      return { ok: false, error: 'unknown', message: 'Invalid URL.' };
    }

    let frame: HTMLIFrameElement;
    try {
      frame = await this.loadHiddenFrame(url);
    } catch (e) {
      const reason = (e as Error).message;
      if (reason === 'cross-tenant') {
        return { ok: false, error: 'cross-tenant', message: 'Cross-tenant pages are not supported.' };
      }
      if (reason === 'timeout') {
        return { ok: false, error: 'timeout', message: "Source page didn't finish loading." };
      }
      return { ok: false, error: 'unknown', message: 'Could not load the source page.' };
    }

    const doc = frame.contentDocument!;
    if (this.isAccessDenied(doc)) {
      try { document.body.removeChild(frame); } catch { /* gone */ }
      return { ok: false, error: 'access-denied', message: "You don't have access to this page." };
    }

    const items = this.collectItems(doc);
    try { document.body.removeChild(frame); } catch { /* gone */ }
    if (items.length <= 1) {
      return { ok: false, error: 'no-items', message: 'This page has no detectable sections or webparts.' };
    }
    return { ok: true, items };
  }

  /** Extract section + webpart inventory from a fully-rendered SP page document. */
  private static collectItems(doc: Document): IProbedItem[] {
    const items: IProbedItem[] = [
      { kind: 'page', id: 'page', label: 'Whole page' },
    ];

    const sectionEls = Array.from(doc.querySelectorAll<HTMLElement>('.CanvasSection[data-section-id]'));
    sectionEls.forEach((sec, idx) => {
      const id = sec.getAttribute('data-section-id') || '';
      if (!id) return;
      const cols = sec.querySelectorAll('[data-automation-id="CanvasSectionColumn"]').length
        || sec.querySelectorAll('.CanvasColumn').length
        || 1;
      items.push({
        kind: 'section',
        id,
        label: `Section ${idx + 1} (${cols} column${cols === 1 ? '' : 's'})`,
      });

      const webparts = Array.from(sec.querySelectorAll<HTMLElement>('[data-sp-feature-instance-id]'));
      webparts.forEach((wp) => {
        const wpId = wp.getAttribute('data-sp-feature-instance-id') || '';
        if (!wpId) return;
        const ariaLabel = wp.getAttribute('aria-label')
          || wp.querySelector('[aria-label]')?.getAttribute('aria-label')
          || '';
        const titleEl = wp.querySelector<HTMLElement>('h2, h3, [role="heading"]');
        const titleText = (titleEl?.textContent || '').trim();
        const label = ariaLabel || titleText || `Webpart ${wpId.slice(0, 8)}`;
        const isDynamic = !!wp.querySelector('iframe, [data-react-root], [data-automation-id="listViewControl"], [data-automation-id="ChartControl"]');
        items.push({
          kind: 'webpart',
          id: wpId,
          label,
          containingSectionId: id,
          isDynamic,
        });
      });
    });

    return items;
  }

  /** Create a hidden iframe and resolve when the SP page has rendered enough to inspect. */
  private static loadHiddenFrame(url: string): Promise<HTMLIFrameElement> {
    return new Promise((resolve, reject) => {
      const frame = document.createElement('iframe');
      frame.style.cssText = 'position:absolute;left:-99999px;top:0;width:1200px;height:2000px;border:0;';
      frame.setAttribute('aria-hidden', 'true');
      frame.src = url;
      document.body.appendChild(frame);

      const cleanup = () => { try { document.body.removeChild(frame); } catch { /* gone */ } };

      const fail = (reason: string) => { cleanup(); reject(new Error(reason)); };

      const timeout = window.setTimeout(() => fail('timeout'), READY_TIMEOUT_MS);

      frame.addEventListener('load', () => {
        // Same-origin check: accessing contentDocument throws cross-origin.
        let doc: Document | null = null;
        try {
          doc = frame.contentDocument;
        } catch {
          window.clearTimeout(timeout);
          fail('cross-tenant');
          return;
        }
        if (!doc) {
          window.clearTimeout(timeout);
          fail('access-denied');
          return;
        }
        // Poll for SP page readiness (presence of any CanvasSection or known content root).
        const startedAt = Date.now();
        const poll = () => {
          if (!doc) return;
          const hasSection = doc.querySelector('.CanvasSection[data-section-id]') !== null;
          const hasContentRoot = doc.querySelector('[data-automation-id="canvasContent"]') !== null;
          if (doc.readyState === 'complete' && (hasSection || hasContentRoot)) {
            window.clearTimeout(timeout);
            resolve(frame);
            return;
          }
          if (Date.now() - startedAt > READY_TIMEOUT_MS) {
            window.clearTimeout(timeout);
            fail('timeout');
            return;
          }
          window.setTimeout(poll, 250);
        };
        poll();
      });

      frame.addEventListener('error', () => fail('unknown'));
    });
  }

  /** Heuristic: detect SharePoint "you don't have permission" page inside the frame. */
  private static isAccessDenied(doc: Document): boolean {
    if (doc.querySelector('[data-automation-id="accessDeniedPage"]')) return true;
    const title = (doc.title || '').toLowerCase();
    return title.includes('access denied') || title.includes('sign in');
  }

  /** Build CSS for the live-mode stylesheet given the selections. */
  private static buildLiveStyles(selections: IRemoteSelection[]): string {
    const hasWholePage = selections.some(s => s.kind === 'page');

    const css: string[] = [];
    css.push(`${CHROME_SELECTORS} { display: none !important; }`);
    css.push('html, body { background: transparent !important; margin: 0 !important; padding: 0 !important; }');

    if (hasWholePage) return css.join('\n');

    const sectionSelections = selections.filter(s => s.kind === 'section').map(s => s.id);
    const webpartSelections = selections.filter(s => s.kind === 'webpart');
    const webpartIds = webpartSelections.map(w => w.id);
    const keepIds = new Set<string>(sectionSelections);

    if (webpartIds.length === 0 && sectionSelections.length > 0) {
      // Section-only: hide every section that isn't selected.
      const notSelectors = Array.from(keepIds).map(id => `:not([data-section-id="${cssEscape(id)}"])`).join('');
      css.push(`.CanvasSection${notSelectors} { display: none !important; }`);
    } else if (webpartIds.length > 0) {
      // Mixed/webpart mode: hide sections that are neither explicitly selected NOR contain a selected webpart.
      const notKeeper = Array.from(keepIds).map(id => `:not([data-section-id="${cssEscape(id)}"])`).join('');
      const notHas = webpartIds.map(id => `:not(:has([data-sp-feature-instance-id="${cssEscape(id)}"]))`).join('');
      css.push(`.CanvasSection${notKeeper}${notHas} { display: none !important; }`);

      // Within sections kept because of a webpart selection (not in explicit keepers), hide non-selected webparts.
      const wpNotSelectors = webpartIds.map(id => `:not([data-sp-feature-instance-id="${cssEscape(id)}"])`).join('');
      const notExplicitSection = Array.from(keepIds).map(id => `:not([data-section-id="${cssEscape(id)}"])`).join('');
      css.push(`.CanvasSection${notExplicitSection} [data-sp-feature-instance-id]${wpNotSelectors} { display: none !important; }`);
    }

    return css.join('\n');
  }

  /** Inject a stylesheet into a same-origin iframe document. */
  private static injectStyles(doc: Document, css: string): HTMLStyleElement {
    const style = doc.createElement('style');
    style.setAttribute('data-picanvas-remote', 'true');
    style.textContent = css;
    doc.head.appendChild(style);
    return style;
  }

  /** Auto-size iframe to the rendered content height. Returns a teardown fn. */
  private static attachAutoSize(frame: HTMLIFrameElement): () => void {
    const doc = frame.contentDocument;
    if (!doc) return () => { /* no-op */ };
    const measure = () => {
      const h = Math.max(
        doc.documentElement.scrollHeight,
        doc.body.scrollHeight,
      );
      frame.style.height = `${h}px`;
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(doc.body);
    return () => ro.disconnect();
  }
}

/** CSS.escape polyfill (SP supports modern browsers — be defensive). */
function cssEscape(value: string): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (typeof (window as any).CSS?.escape === 'function') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (window as any).CSS.escape(value);
  }
  return value.replace(/["\\]/g, '\\$&');
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c
  ));
}
