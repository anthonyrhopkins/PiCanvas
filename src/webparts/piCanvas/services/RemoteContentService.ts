/**
 * RemoteContentService — loads another SharePoint page (same tenant) and
 * renders selected sections / webparts inside a PiCanvas tab.
 *
 * Two modes:
 *   - 'live'     — keep an iframe mounted, hide non-selected content via CSS
 *   - 'snapshot' — clone selected DOM into the host, optional auto-refresh
 *
 * Same-tenant only in v1 (cross-origin iframes block both modes).
 *
 * Selectors / identity model
 * --------------------------
 * Modern SP doesn't put a stable `data-section-id` on `.CanvasSection`.
 * We address sections by ordinal index (id = "sec:0", "sec:1", …). Webparts
 * have a stable `data-sp-feature-instance-id` (matched on the inner element).
 * The page chrome itself carries `data-sp-feature-instance-id="_Page Chrome"`
 * (or similar) — those are filtered out everywhere.
 */

export type RemoteSelectionKind = 'section' | 'webpart' | 'page';

export interface IRemoteSelection {
  kind: RemoteSelectionKind;
  id: string;       // "sec:N" for sections, webpart instance id, or "page" sentinel
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
  '[data-automation-id="sp-appBar"]',
].join(', ');

/** Selector that matches a real SP canvas section regardless of build hash. */
const SECTION_SELECTOR = '.CanvasSection';

/** Webparts whose feature tag matches this regex are page chrome — never list/clone them. */
const CHROME_FEATURE_TAG_RE = /chrome|page chrome/i;

/** Heuristic for "page chrome" webpart instance ids that SP emits. */
function isChromeWebpartId(id: string): boolean {
  return id.startsWith('_') || id === '_Page Chrome';
}

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
          if (doc.readyState === 'complete' && RemoteContentService.isPageReady(doc)) {
            window.clearTimeout(timeoutHandle);
            status.remove();
            RemoteContentService.markTargets(doc, config.selections);
            RemoteContentService.injectStyles(doc, RemoteContentService.buildLiveStyles(config.selections));
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
          try { frame.contentWindow?.location.reload(); } catch { /* cross-origin or gone */ }
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

  /**
   * Probe a remote SharePoint page for sections + webparts.
   * Used by RemotePagePicker.
   */
  public static async probeRemotePage(url: string): Promise<IProbeResult> {
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

  /** True when the canvas has rendered at least one section or known content root. */
  private static isPageReady(doc: Document): boolean {
    return doc.querySelector(SECTION_SELECTOR) !== null
      || doc.querySelector('[data-automation-id="canvasContent"]') !== null
      || doc.querySelector('[data-automation-id="CanvasLayout"]') !== null;
  }

  /** Resolve selections against a loaded document into target elements. */
  private static resolveTargets(doc: Document, selections: IRemoteSelection[]): HTMLElement[] {
    const sections = Array.from(doc.querySelectorAll<HTMLElement>(SECTION_SELECTOR));
    const targets: HTMLElement[] = [];
    const seen = new Set<HTMLElement>();
    const push = (el: HTMLElement | null) => {
      if (el && !seen.has(el)) { seen.add(el); targets.push(el); }
    };
    for (const sel of selections) {
      if (sel.kind === 'page') {
        push(doc.querySelector<HTMLElement>('[data-automation-id="canvasContent"]')
          || doc.querySelector<HTMLElement>('[data-automation-id="CanvasLayout"]')
          || doc.querySelector<HTMLElement>('#spPageCanvasContent')
          || doc.body);
      } else if (sel.kind === 'section') {
        const idx = parseSectionIndex(sel.id);
        if (idx !== null && idx >= 0 && idx < sections.length) {
          push(sections[idx]);
        }
      } else if (sel.kind === 'webpart') {
        push(doc.querySelector<HTMLElement>(`[data-sp-feature-instance-id="${cssEscape(sel.id)}"]`));
      }
    }
    return targets;
  }

  /**
   * Tag the iframe's DOM so live-mode CSS can target sections/webparts to keep.
   * We can't use `data-section-id` because modern SP doesn't emit one.
   */
  private static markTargets(doc: Document, selections: IRemoteSelection[]): void {
    const hasWholePage = selections.some(s => s.kind === 'page');
    // Clear any prior marks (idempotent on refresh).
    Array.from(doc.querySelectorAll('[data-picanvas-keep]')).forEach(el => el.removeAttribute('data-picanvas-keep'));
    Array.from(doc.querySelectorAll('[data-picanvas-section-idx]')).forEach(el => el.removeAttribute('data-picanvas-section-idx'));

    const sections = Array.from(doc.querySelectorAll<HTMLElement>(SECTION_SELECTOR));
    sections.forEach((sec, idx) => { sec.setAttribute('data-picanvas-section-idx', String(idx)); });

    if (hasWholePage) {
      sections.forEach(sec => sec.setAttribute('data-picanvas-keep', '1'));
      return;
    }

    const sectionIdxs = new Set<number>();
    const webpartIds = new Set<string>();
    for (const sel of selections) {
      if (sel.kind === 'section') {
        const idx = parseSectionIndex(sel.id);
        if (idx !== null) sectionIdxs.add(idx);
      } else if (sel.kind === 'webpart') {
        webpartIds.add(sel.id);
      }
    }

    // Mark explicitly-selected sections (keep wholly).
    sectionIdxs.forEach(idx => {
      const sec = sections[idx];
      if (sec) sec.setAttribute('data-picanvas-keep', '1');
    });

    // Mark selected webparts and the sections that contain them (keep section partial).
    webpartIds.forEach(wpId => {
      const wp = doc.querySelector<HTMLElement>(`[data-sp-feature-instance-id="${cssEscape(wpId)}"]`);
      if (!wp) return;
      wp.setAttribute('data-picanvas-keep', '1');
      const containingSection = wp.closest<HTMLElement>(SECTION_SELECTOR);
      if (containingSection && !containingSection.hasAttribute('data-picanvas-keep')) {
        containingSection.setAttribute('data-picanvas-keep', 'partial');
      }
    });
  }

  /** Build the snapshot DOM: clone targets, copy stylesheets into a scoped wrapper. */
  private static buildSnapshot(doc: Document, selections: IRemoteSelection[]): { wrapper: HTMLElement; missingCount: number; selectionCount: number } {
    const wrapper = document.createElement('div');
    wrapper.className = 'picanvas-remote-snapshot';
    wrapper.style.cssText = 'display: block; width: 100%; position: relative;';

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

  /** Extract section + webpart inventory from a fully-rendered SP page document. */
  private static collectItems(doc: Document): IProbedItem[] {
    const items: IProbedItem[] = [
      { kind: 'page', id: 'page', label: 'Whole page' },
    ];

    const sectionEls = Array.from(doc.querySelectorAll<HTMLElement>(SECTION_SELECTOR));
    sectionEls.forEach((sec, idx) => {
      const cols = sec.querySelectorAll('[data-automation-id="CanvasSectionColumn"]').length
        || sec.querySelectorAll('.CanvasColumn').length
        || 1;
      const sectionId = `sec:${idx}`;
      items.push({
        kind: 'section',
        id: sectionId,
        label: `Section ${idx + 1} (${cols} column${cols === 1 ? '' : 's'})`,
      });

      const webparts = Array.from(sec.querySelectorAll<HTMLElement>('[data-sp-feature-instance-id]'));
      webparts.forEach((wp) => {
        const wpId = wp.getAttribute('data-sp-feature-instance-id') || '';
        if (!wpId || isChromeWebpartId(wpId)) return;
        const featureTag = wp.getAttribute('data-sp-feature-tag') || '';
        if (CHROME_FEATURE_TAG_RE.test(featureTag)) return;

        const ariaLabel = wp.getAttribute('aria-label')
          || wp.querySelector('[aria-label]')?.getAttribute('aria-label')
          || '';
        const titleEl = wp.querySelector<HTMLElement>('h2, h3, [role="heading"]');
        const titleText = (titleEl?.textContent || '').trim();
        const featureLabel = featureTag.replace(/web part.*$/i, '').trim();
        const label = ariaLabel || titleText || featureLabel || `Webpart ${wpId.slice(0, 8)}`;
        const isDynamic = !!wp.querySelector('iframe, [data-react-root], [data-automation-id="listViewControl"], [data-automation-id="ChartControl"]');
        items.push({
          kind: 'webpart',
          id: wpId,
          label,
          containingSectionId: sectionId,
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
      // Mark the request as a PiCanvas probe so any nested PiCanvas on the
      // source page skips its own init/render (avoids polluting our parent).
      frame.src = appendProbeParam(url);
      document.body.appendChild(frame);

      const cleanup = () => { try { document.body.removeChild(frame); } catch { /* gone */ } };
      const fail = (reason: string) => { cleanup(); reject(new Error(reason)); };
      const timeout = window.setTimeout(() => fail('timeout'), READY_TIMEOUT_MS);

      frame.addEventListener('load', () => {
        let doc: Document | null = null;
        try { doc = frame.contentDocument; } catch {
          window.clearTimeout(timeout); fail('cross-tenant'); return;
        }
        if (!doc) { window.clearTimeout(timeout); fail('access-denied'); return; }

        const startedAt = Date.now();
        const poll = () => {
          if (!doc) return;
          if (doc.readyState === 'complete' && RemoteContentService.isPageReady(doc)) {
            window.clearTimeout(timeout);
            resolve(frame);
            return;
          }
          if (Date.now() - startedAt > READY_TIMEOUT_MS) {
            window.clearTimeout(timeout); fail('timeout'); return;
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

  /**
   * Build CSS for the live-mode stylesheet. Targets are tagged with
   * `data-picanvas-keep` by markTargets() before this CSS is injected.
   */
  private static buildLiveStyles(selections: IRemoteSelection[]): string {
    const hasWholePage = selections.some(s => s.kind === 'page');

    const css: string[] = [];
    css.push(`${CHROME_SELECTORS} { display: none !important; }`);
    // Let the body grow with its content so the iframe auto-sizes correctly.
    // Modern SP sets body { height: 100vh; overflow: hidden auto } which traps the page inside the viewport.
    css.push('html, body { background: transparent !important; margin: 0 !important; padding: 0 !important; height: auto !important; min-height: 0 !important; overflow: visible !important; }');
    css.push('[data-automation-id="contentScrollRegion"], [role="main"] { height: auto !important; overflow: visible !important; }');

    if (hasWholePage) return css.join('\n');

    const sectionSelected = selections.some(s => s.kind === 'section');
    const webpartSelected = selections.some(s => s.kind === 'webpart');

    if (!sectionSelected && !webpartSelected) {
      // Nothing selected — hide all sections so the iframe shows nothing.
      css.push(`${SECTION_SELECTOR} { display: none !important; }`);
      return css.join('\n');
    }

    // Hide sections that have no keep marker.
    css.push(`${SECTION_SELECTOR}:not([data-picanvas-keep]) { display: none !important; }`);

    if (webpartSelected) {
      // Within sections kept only because of a webpart (data-picanvas-keep="partial"),
      // hide every webpart that isn't itself marked.
      css.push(
        `${SECTION_SELECTOR}[data-picanvas-keep="partial"] [data-sp-feature-instance-id]:not([data-picanvas-keep]) { display: none !important; }`
      );
    }

    return css.join('\n');
  }

  /** Inject a stylesheet into a same-origin iframe document. */
  private static injectStyles(doc: Document, css: string): HTMLStyleElement {
    // Remove any prior PiCanvas-injected stylesheet first (idempotent on refresh).
    Array.from(doc.querySelectorAll('style[data-picanvas-remote]')).forEach(s => s.remove());
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
      // SP's body often has offsetHeight 0 (absolute-positioned children) and
      // documentElement.scrollHeight overshoots (viewport + chrome). The canvas
      // container is the reliable source of truth.
      const canvas = doc.querySelector<HTMLElement>(
        '[data-automation-id="CanvasLayout"], #spPageCanvasContent, .SPCanvas'
      );
      const candidates = [
        canvas?.scrollHeight || 0,
        canvas?.offsetHeight || 0,
        doc.body.scrollHeight,
      ].filter(n => n > 0);
      const h = candidates.length ? Math.max(...candidates) : doc.documentElement.scrollHeight;
      if (h > 0) frame.style.height = `${h}px`;
    };
    measure();

    // Observe both body AND the canvas element (canvas is what actually grows
    // with content; body may have offsetHeight 0 and never trigger).
    const ro = new ResizeObserver(measure);
    ro.observe(doc.body);
    const canvas = doc.querySelector<HTMLElement>(
      '[data-automation-id="CanvasLayout"], #spPageCanvasContent, .SPCanvas'
    );
    if (canvas) ro.observe(canvas);

    // Belt-and-suspenders: re-measure on a short delay (SP webparts may render
    // async after document.readyState=complete).
    const timer1 = window.setTimeout(measure, 500);
    const timer2 = window.setTimeout(measure, 2000);

    return () => {
      ro.disconnect();
      window.clearTimeout(timer1);
      window.clearTimeout(timer2);
    };
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

/** Parse a section id of the form "sec:N" into N. Returns null for malformed input. */
function parseSectionIndex(id: string): number | null {
  if (!id.startsWith('sec:')) return null;
  const n = parseInt(id.slice(4), 10);
  return Number.isFinite(n) ? n : null;
}

/** Append `?_picanvas_probe=1` so a nested PiCanvas on the source page skips its own init. */
function appendProbeParam(url: string): string {
  try {
    const u = new URL(url, window.location.href);
    u.searchParams.set('_picanvas_probe', '1');
    return u.toString();
  } catch {
    return url + (url.includes('?') ? '&' : '?') + '_picanvas_probe=1';
  }
}
