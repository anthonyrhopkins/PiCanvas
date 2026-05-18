# Remote Page Content Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new `'remote'` PiCanvas tab content type that surfaces sections, webparts, or whole pages from another SharePoint page on the same tenant, with two render modes (live iframe / snapshot clone).

**Architecture:** New service `RemoteContentService` owns the iframe lifecycle, DOM probing, CSS injection, and clone logic. A new `RemotePagePicker` dialog drives configuration. `TabBuilderSection` adds a content-type card and config fields. `PiCanvasWebPart` dispatches to the service. Same-tenant only in v1.

**Tech Stack:** TypeScript, SPFx 1.22, no React (vanilla DOM + existing PiCanvas control classes), no test framework (matches existing codebase — verification is manual in the SP workbench).

**Spec:** `docs/superpowers/specs/2026-05-18-remote-page-content-design.md`

---

## Conventions for every task

- **Build & dev**: `npx heft start` (workbench at `https://localhost:4321`) for iterative testing. `npx heft build --clean` before committing risky changes.
- **Test environment**: `https://sap.sharepoint.com/sites/213644/SitePages/UnderTheHood.aspx` — has PiCanvas already and is editable. Source pages for remote-content testing can be any other page in the same site (or another site in the same tenant).
- **Debug URL pattern**: append `?loadSPFX=true&debugManifestsFile=https://localhost:4321/temp/build/manifests.js` and click "Load debug scripts".
- **Commit message style**: lowercase prefix (`feat:`, `fix:`, `refactor:`) per existing log.
- **No automated tests**: codebase has none for content types; every task ends with a manual verification step.

---

## Task 1: Add `'remote'` to type system and tab property suffixes

**Files:**
- Modify: `src/webparts/piCanvas/models/TemplateModels.ts:17`
- Modify: `src/webparts/piCanvas/PiCanvasWebPart.ts:216-310` (`TAB_PROPERTY_SUFFIXES` array)

- [ ] **Step 1: Extend `TabContentType`**

Edit `src/webparts/piCanvas/models/TemplateModels.ts:17`:

```ts
export type TabContentType =
  | 'webpart'
  | 'section'
  | 'markdown'
  | 'html'
  | 'mermaid'
  | 'embed'
  | 'file'
  | 'remote';
```

- [ ] **Step 2: Add remote property suffixes**

In `src/webparts/piCanvas/PiCanvasWebPart.ts`, locate `TAB_PROPERTY_SUFFIXES` (starts at line 216). Append four entries just before the closing `];`:

```ts
    // Remote page content (v3.2)
    'RemoteUrl',           // Source SharePoint page URL
    'RemoteMode',          // 'live' | 'snapshot'
    'RemoteSelections',    // JSON: Array<{ kind, id, label }>
    'RemoteRefreshSec',    // Snapshot auto-refresh (seconds); 0 = off; min non-zero = 30
```

- [ ] **Step 3: Build to catch typos**

Run: `npx heft build --clean`
Expected: build succeeds (no new errors related to these files).

- [ ] **Step 4: Commit**

```bash
git add src/webparts/piCanvas/models/TemplateModels.ts src/webparts/piCanvas/PiCanvasWebPart.ts
git commit -m "feat: scaffold remote content type and tab properties"
```

---

## Task 2: Create `RemoteContentService` skeleton

**Files:**
- Create: `src/webparts/piCanvas/services/RemoteContentService.ts`

- [ ] **Step 1: Create the file with public API surface only**

Create `src/webparts/piCanvas/services/RemoteContentService.ts`:

```ts
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
    host.innerHTML = '<div class="picanvas-remote-loading">Loading remote content…</div>';
    // Implementation lands in Tasks 3–7.
    return {
      destroy: () => { host.innerHTML = ''; },
      refresh: () => { /* no-op until snapshot mode lands */ },
    };
  }

  /**
   * Probe a remote SharePoint page for sections + webparts.
   * Used by RemotePagePicker.
   */
  public static probeRemotePage(url: string): Promise<IProbeResult> {
    // Implementation lands in Tasks 3–4.
    return Promise.resolve({ ok: false, error: 'unknown', message: 'not implemented' });
  }
}
```

- [ ] **Step 2: Build to verify the file compiles**

Run: `npx heft build --clean`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/webparts/piCanvas/services/RemoteContentService.ts
git commit -m "feat: add RemoteContentService skeleton"
```

---

## Task 3: Implement same-tenant validation + readiness probe

**Files:**
- Modify: `src/webparts/piCanvas/services/RemoteContentService.ts`

- [ ] **Step 1: Add private iframe loader helpers**

Inside `RemoteContentService`, add these two static methods (after `probeRemotePage`):

```ts
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
          if (!doc) return;  // null check (doc is set in outer scope)
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
    // SP renders an error page with this specific automation id, or a generic title.
    if (doc.querySelector('[data-automation-id="accessDeniedPage"]')) return true;
    const title = (doc.title || '').toLowerCase();
    return title.includes('access denied') || title.includes('sign in');
  }
```

- [ ] **Step 2: Wire `probeRemotePage` to use the loader (partial — items list still empty for now)**

Replace the existing `probeRemotePage` body with:

```ts
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

    // DOM probing implemented in Task 4. For now, return empty success.
    const items: IProbedItem[] = [];
    try { document.body.removeChild(frame); } catch { /* gone */ }
    return { ok: true, items };
  }
```

- [ ] **Step 3: Verify build**

Run: `npx heft build --clean`
Expected: build succeeds.

- [ ] **Step 4: Smoke-test the loader in the browser console**

Start `npx heft start`, open the workbench, then in DevTools console (after the bundle loads) run:

```js
const { RemoteContentService } = await import('https://localhost:4321/temp/build/picanvas-webpart_…js');
// Or import via window registration if available — alternative: paste loadHiddenFrame inline.
```

If module import is awkward, instead temporarily expose the service for smoke-test: in `PiCanvasWebPart.ts`'s `onInit()`, add `(window as any).__piCanvasRemote = RemoteContentService;` (revert before commit). Then:

```js
await window.__piCanvasRemote.probeRemotePage('/sites/213644/SitePages/UnderTheHood.aspx')
await window.__piCanvasRemote.probeRemotePage('https://www.bing.com/')
```

Expected: first call resolves to `{ ok: true, items: [] }`. Second resolves to `{ ok: false, error: 'cross-tenant', ... }`.

- [ ] **Step 5: Remove smoke-test wiring if added, then commit**

```bash
git add src/webparts/piCanvas/services/RemoteContentService.ts
git commit -m "feat: remote service loads same-tenant frames with timeout"
```

---

## Task 4: Implement DOM probing (sections + webparts)

**Files:**
- Modify: `src/webparts/piCanvas/services/RemoteContentService.ts`

- [ ] **Step 1: Add a private DOM probe**

Add this static method to `RemoteContentService`:

```ts
  /** Extract section + webpart inventory from a fully-rendered SP page document. */
  private static collectItems(doc: Document): IProbedItem[] {
    const items: IProbedItem[] = [
      { kind: 'page', id: 'page', label: 'Whole page' },
    ];

    const sectionEls = Array.from(doc.querySelectorAll<HTMLElement>('.CanvasSection[data-section-id]'));
    sectionEls.forEach((sec, idx) => {
      const id = sec.getAttribute('data-section-id') || '';
      if (!id) return;
      // Approximate column count from child column elements.
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
        // Heuristic: webparts containing IFRAMEs, react roots, or known dynamic class names.
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
```

- [ ] **Step 2: Wire `probeRemotePage` to return real items**

Replace the placeholder `items: IProbedItem[] = [];` in `probeRemotePage` with:

```ts
    const items = this.collectItems(doc);
    try { document.body.removeChild(frame); } catch { /* gone */ }
    if (items.length <= 1) {  // only the synthetic "Whole page" entry
      return { ok: false, error: 'no-items', message: 'This page has no detectable sections or webparts.' };
    }
    return { ok: true, items };
```

(Delete the old `try { document.body.removeChild(frame); }` line that was just above; the replacement includes it.)

- [ ] **Step 3: Verify build**

Run: `npx heft build --clean`
Expected: success.

- [ ] **Step 4: Smoke-test in browser**

Restart `npx heft start`, reload workbench. With smoke-test wiring re-added (and removed afterward):

```js
await window.__piCanvasRemote.probeRemotePage('/sites/213644/SitePages/UnderTheHood.aspx')
```

Expected: `{ ok: true, items: [{ kind: 'page', ... }, { kind: 'section', ... }, { kind: 'webpart', ... }, ...] }`. Open the source page in another tab to cross-check section/webpart counts.

- [ ] **Step 5: Commit**

```bash
git add src/webparts/piCanvas/services/RemoteContentService.ts
git commit -m "feat: probe remote pages for sections and webparts"
```

---

## Task 5: Implement live mode renderer

**Files:**
- Modify: `src/webparts/piCanvas/services/RemoteContentService.ts`

- [ ] **Step 1: Add live-mode helpers**

Add inside `RemoteContentService`:

```ts
  /** Build CSS for the live-mode stylesheet given the selections. */
  private static buildLiveStyles(selections: IRemoteSelection[]): string {
    const hasWholePage = selections.some(s => s.kind === 'page');

    const css: string[] = [];
    // Always hide chrome.
    css.push(`${CHROME_SELECTORS} { display: none !important; }`);
    css.push('html, body { background: transparent !important; margin: 0 !important; padding: 0 !important; }');

    if (hasWholePage) return css.join('\n');

    const sectionSelections = selections.filter(s => s.kind === 'section').map(s => s.id);
    const webpartSelections = selections.filter(s => s.kind === 'webpart');

    // Compute "keep" set: explicitly selected sections plus sections containing selected webparts.
    // We don't have the containing-section map at render time, so we keep ALL sections that have
    // either an explicit selection OR contain a selected webpart (checked by attribute selector).
    const keepIds = new Set<string>(sectionSelections);
    // For webpart-only selections without a containing section, fall back to keeping their parent section
    // via :has() — supported in modern Chromium/Edge.
    const webpartIds = webpartSelections.map(w => w.id);

    if (webpartIds.length === 0 && sectionSelections.length > 0) {
      // Section-only mode: hide every section that isn't selected.
      const notSelectors = Array.from(keepIds).map(id => `:not([data-section-id="${cssEscape(id)}"])`).join('');
      css.push(`.CanvasSection${notSelectors} { display: none !important; }`);
    } else if (webpartIds.length > 0) {
      // Build keep-section selector using :has() for sections containing any selected webpart, OR the section is explicitly selected.
      const hasClauses = webpartIds.map(id => `:has([data-sp-feature-instance-id="${cssEscape(id)}"])`).join(', .CanvasSection');
      const sectionKeepers = Array.from(keepIds).map(id => `.CanvasSection[data-section-id="${cssEscape(id)}"]`);
      // Hide any section that is NOT in keepers AND does NOT have a selected webpart.
      const notKeeper = Array.from(keepIds).map(id => `:not([data-section-id="${cssEscape(id)}"])`).join('');
      const notHas = webpartIds.map(id => `:not(:has([data-sp-feature-instance-id="${cssEscape(id)}"]))`).join('');
      css.push(`.CanvasSection${notKeeper}${notHas} { display: none !important; }`);

      // Within sections kept because of webpart selections (not in explicit keepers),
      // hide non-selected webparts.
      const wpNotSelectors = webpartIds.map(id => `:not([data-sp-feature-instance-id="${cssEscape(id)}"])`).join('');
      const explicitSectionsList = Array.from(keepIds).map(id => `[data-section-id="${cssEscape(id)}"]`).join(', ');
      // Apply webpart filtering inside sections NOT explicitly selected.
      const notExplicitSection = Array.from(keepIds).map(id => `:not([data-section-id="${cssEscape(id)}"])`).join('');
      css.push(`.CanvasSection${notExplicitSection} [data-sp-feature-instance-id]${wpNotSelectors} { display: none !important; }`);
      // Silence "unused var" lint:
      void hasClauses; void sectionKeepers; void explicitSectionsList;
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

  /** Auto-size iframe to the rendered content height. */
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
```

Also add this helper at module top (just below the imports area, outside the class):

```ts
/** CSS.escape polyfill (SP supports modern browsers — but be defensive). */
function cssEscape(value: string): string {
  if (typeof (window as any).CSS?.escape === 'function') {
    return (window as any).CSS.escape(value);
  }
  return value.replace(/["\\]/g, '\\$&');
}
```

- [ ] **Step 2: Implement live mode in `mount`**

Replace the body of `mount` with:

```ts
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

      let timeoutHandle: number | undefined = window.setTimeout(() => {
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
        // Wait for canvas to actually render.
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
          frame.src = frame.src;  // reload
        },
      };
    }

    // Snapshot mode lands in Task 6.
    showError('Snapshot mode is not implemented yet.');
    return { destroy: () => { destroyed = true; }, refresh: () => { /* no-op */ } };
  }
```

Add this helper at the bottom of the file (or near `cssEscape`):

```ts
function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c
  ));
}
```

- [ ] **Step 3: Verify build**

Run: `npx heft build --clean`
Expected: success.

- [ ] **Step 4: Manual smoke test from browser console**

Re-add the temporary `(window as any).__piCanvasRemote = RemoteContentService;` line in `onInit()`. Restart `npx heft start`. In the workbench:

```js
const host = document.createElement('div');
host.style.cssText = 'position:fixed;top:80px;left:80px;width:800px;background:#fff;border:1px solid #000;z-index:99999;';
document.body.appendChild(host);
const mount = window.__piCanvasRemote.mount(host, {
  url: '/sites/213644/SitePages/UnderTheHood.aspx',
  mode: 'live',
  selections: [{ kind: 'page', id: 'page', label: 'Whole page' }],
});
```

Expected: source page renders inside the host without SP chrome. Verify:
1. Replace selection with one section id (e.g. `{ kind: 'section', id: '<real-id>', label: '...' }`) — only that section visible.
2. Two section selections — both visible, others hidden.
3. One webpart selection — only that webpart visible within its section.
4. `mount.destroy()` — host empties.

- [ ] **Step 5: Remove smoke wiring, commit**

```bash
git add src/webparts/piCanvas/services/RemoteContentService.ts
git commit -m "feat: live-mode renderer with CSS clipping and auto-size"
```

---

## Task 6: Implement snapshot mode renderer (with refresh)

**Files:**
- Modify: `src/webparts/piCanvas/services/RemoteContentService.ts`

- [ ] **Step 1: Add snapshot helpers**

Add inside `RemoteContentService`:

```ts
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
      // <link> hrefs are absolute or root-relative; clone preserves them.
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
```

- [ ] **Step 2: Implement snapshot path in `mount`**

Inside `mount`, replace the snapshot-mode placeholder block (the `showError('Snapshot mode is not implemented yet.')` line at the end) with:

```ts
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
        try { document.body.removeChild(snapshotFrame!); } catch { /* gone */ }
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

      // Atomic swap: clear status + previous wrapper, append new one.
      Array.from(host.querySelectorAll('.picanvas-remote-snapshot, .picanvas-remote-status, .picanvas-remote-error')).forEach(n => n.remove());
      host.appendChild(wrapper);
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
```

(Make sure the function still ends with a closing `}` for the `mount` method.)

- [ ] **Step 3: Verify build**

Run: `npx heft build --clean`
Expected: success.

- [ ] **Step 4: Manual smoke test**

With the same temporary smoke wiring:

```js
const host = document.createElement('div');
host.style.cssText = 'position:fixed;top:80px;left:80px;width:800px;max-height:600px;overflow:auto;background:#fff;border:1px solid #000;z-index:99999;';
document.body.appendChild(host);
const mount = window.__piCanvasRemote.mount(host, {
  url: '/sites/213644/SitePages/UnderTheHood.aspx',
  mode: 'snapshot',
  selections: [{ kind: 'section', id: '<real-section-id>', label: 'Section 1' }],
  refreshSec: 0,
});
```

Expected: cloned section appears inside host (static — interactive webparts won't work, that's by design). Test `mount.refresh()` — content re-loads. Test with `refreshSec: 30` — content re-loads every 30s (watch network tab).

Test selection drift: pass an invalid section id — error message about missing content.

- [ ] **Step 5: Remove smoke wiring, commit**

```bash
git add src/webparts/piCanvas/services/RemoteContentService.ts
git commit -m "feat: snapshot-mode renderer with refresh"
```

---

## Task 7: Build the `RemotePagePicker` dialog

**Files:**
- Create: `src/webparts/piCanvas/configPanel/RemotePagePicker.ts`

- [ ] **Step 1: Create the picker module**

Create `src/webparts/piCanvas/configPanel/RemotePagePicker.ts`:

```ts
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
        // Detect previously-saved selections that no longer exist on the source page.
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
        // Drop missing selections from the saved set so Save doesn't preserve them.
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
        // If picker was re-opened with prior selections but user didn't re-probe, keep them.
        if (selections.length === 0 && initial.selections) {
          selections.push(...initial.selections);
        }
        onSave({ url, mode: currentMode, selections, refreshSec: currentRefresh });
        document.body.removeChild(overlay);
      });

      // Auto-probe if URL pre-filled.
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
```

- [ ] **Step 2: Verify build**

Run: `npx heft build --clean`
Expected: success.

- [ ] **Step 3: Smoke-test picker in workbench**

Add a temporary global in `onInit()`:

```ts
import { RemotePagePicker } from './configPanel/RemotePagePicker';
// ...
(window as any).__piCanvasPicker = RemotePagePicker;
```

Reload workbench. In console:

```js
window.__piCanvasPicker.open(
  { url: '/sites/213644/SitePages/UnderTheHood.aspx' },
  (r) => console.log('saved', r)
);
```

Expected: dialog appears, auto-probes, lists sections + webparts grouped by section, "Whole page" at top. Check several, toggle mode to snapshot (refresh dropdown appears), Save — console logs the result with `url`, `mode`, `selections`, `refreshSec`.

- [ ] **Step 4: Remove smoke wiring, commit**

```bash
git add src/webparts/piCanvas/configPanel/RemotePagePicker.ts
git commit -m "feat: remote page picker dialog"
```

---

## Task 8: Register `'remote'` content type in config panel

**Files:**
- Modify: `src/webparts/piCanvas/configPanel/sections/TabBuilderSection.ts`

- [ ] **Step 1: Add `'remote'` to the `CONTENT_TYPES` registry**

In `src/webparts/piCanvas/configPanel/sections/TabBuilderSection.ts:35-48`, append a new entry to `CONTENT_TYPES`:

```ts
const CONTENT_TYPES: IContentTypeInfo[] = [
  { key: 'webpart', icon: '&#9635;', label: 'Web Part' },
  { key: 'section', icon: '&#9638;', label: 'Section' },
  { key: 'markdown', icon: '&#119872;', label: 'Markdown' },
  { key: 'html', icon: '&lt;/&gt;', label: 'HTML' },
  { key: 'mermaid', icon: '&#9670;', label: 'Mermaid' },
  { key: 'embed', icon: '&#9655;', label: 'Embed' },
  { key: 'rss', icon: '&#128225;', label: 'RSS' },
  { key: 'file', icon: '&#128196;', label: 'File' },
  { key: 'javascript', icon: 'JS', label: 'JavaScript' },
  { key: 'toc', icon: '&#9776;', label: 'TOC' },
  { key: 'profilereport', icon: '&#128200;', label: 'Profile Report' },
  { key: 'github', icon: '&#128025;', label: 'GitHub Repo' },
  { key: 'remote', icon: '&#127760;', label: 'Remote Page' },
];
```

- [ ] **Step 2: Add an import for the picker**

Near the top of `TabBuilderSection.ts` (after the existing imports), add:

```ts
import { RemotePagePicker, IRemotePickerResult } from '../RemotePagePicker';
import { IRemoteSelection, RemoteMode } from '../../services/RemoteContentService';
```

- [ ] **Step 3: Add a `'remote'` branch in `_renderContentFields`**

In `_renderContentFields` (starts at line 290), add a new branch after the last `else if (contentType === 'github')` block. Find that block (search for `contentType === 'github'`) and add this after it (still inside the same method):

```ts
    } else if (contentType === 'remote') {
      const opts = this._options;
      const url = (opts.getProperty(`tab${tabIndex}RemoteUrl`) as string) || '';
      const mode = ((opts.getProperty(`tab${tabIndex}RemoteMode`) as string) || 'live') as RemoteMode;
      const refreshSec = (opts.getProperty(`tab${tabIndex}RemoteRefreshSec`) as number) || 0;
      let selections: IRemoteSelection[] = [];
      try {
        const raw = (opts.getProperty(`tab${tabIndex}RemoteSelections`) as string) || '';
        selections = raw ? JSON.parse(raw) : [];
      } catch {
        selections = [];
      }

      const summary = document.createElement('div');
      summary.style.cssText = 'font:13px sans-serif;color:#444;padding:8px;background:#f8f8f8;border-radius:4px;margin-bottom:10px;';
      const refreshLabel = mode === 'snapshot' && refreshSec > 0 ? `, refresh every ${refreshSec}s` : '';
      summary.innerHTML = url
        ? `<div><strong>${escapeHtmlLocal(url)}</strong></div>
           <div>${escapeHtmlLocal(mode)}${escapeHtmlLocal(refreshLabel)} · ${selections.length} selection${selections.length === 1 ? '' : 's'}</div>`
        : '<em>Not configured. Click "Configure source" to begin.</em>';
      accordion.body.appendChild(summary);

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = url ? 'Reconfigure source' : 'Configure source';
      btn.style.cssText = 'padding:6px 14px;background:#0078d4;color:#fff;border:0;border-radius:4px;cursor:pointer;font:14px sans-serif;';
      btn.addEventListener('click', () => {
        RemotePagePicker.open(
          { url, mode, selections, refreshSec },
          (r: IRemotePickerResult) => {
            opts.setProperty(`tab${tabIndex}RemoteUrl`, r.url);
            opts.setProperty(`tab${tabIndex}RemoteMode`, r.mode);
            opts.setProperty(`tab${tabIndex}RemoteSelections`, JSON.stringify(r.selections));
            opts.setProperty(`tab${tabIndex}RemoteRefreshSec`, r.refreshSec);
            this._renderTabBody(tabIndex);
            opts.onChanged();
          }
        );
      });
      accordion.body.appendChild(btn);
    }
```

Then add this helper at the bottom of the file (after the class, or as a module-private function near the top):

```ts
function escapeHtmlLocal(s: string): string {
  return s.replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c
  ));
}
```

- [ ] **Step 4: Verify build**

Run: `npx heft build --clean`
Expected: success.

- [ ] **Step 5: Manual test in workbench**

Start `npx heft start`, deploy to dev workbench. Add a PiCanvas, open the config panel, add a tab. Click the **Remote Page** content type card. Verify:
1. A summary block says "Not configured" and a "Configure source" button appears.
2. Click button — picker opens. Configure a source + selections + save.
3. Summary updates to show URL, mode, selection count.
4. Re-open picker — prior values pre-filled, selections pre-checked.

- [ ] **Step 6: Commit**

```bash
git add src/webparts/piCanvas/configPanel/sections/TabBuilderSection.ts
git commit -m "feat: remote content type in tab config panel"
```

---

## Task 9: Dispatch `'remote'` in `PiCanvasWebPart` render path

**Files:**
- Modify: `src/webparts/piCanvas/PiCanvasWebPart.ts`

- [ ] **Step 1: Import the service**

Near the top of `PiCanvasWebPart.ts` with the other service imports, add:

```ts
import { RemoteContentService, IRemoteMount, IRemoteSelection, RemoteMode } from './services/RemoteContentService';
```

- [ ] **Step 2: Add a private map for active remote mounts**

In the class body (near other private fields around line 215), add:

```ts
  private _remoteMounts: Map<number, IRemoteMount> = new Map();
```

- [ ] **Step 3: Mark `'remote'` as valid content**

In the loop near line 6990 (`for (let i = 1; i <= numTabs; i++)`), after the `else if (contentType === 'rss')` branch, add:

```ts
      } else if (contentType === 'remote') {
        // Remote content — always considered valid; service shows its own empty/error states.
        hasValidContent = true;
```

- [ ] **Step 4: Add the render dispatch**

The surrounding render code uses jQuery — the `github` branch builds a `tabContentContainer` jQuery element, wraps it via `attachLockElements()` into a `$contentHost`, and writes content into `$contentHost`. Mirror that pattern. Find the `github` branch (line ~6285) and add this immediately after it (before the `else { // Default: webpart or section content type` block):

```ts
            } else if (contentType === 'remote') {
              const lazyAttr = enableLazy ? `data-lazy="true" data-lazy-loaded="false"` : '';
              tabContentContainer = $(`<div class='picanvas-tab-content picanvas-remote-content' ${lazyAttr}></div>`);
              $contentHost = this.attachLockElements(tabContentContainer, tabIndex, tabLabelForLock, lockState);

              const url = safeString(this.properties[`tab${tabIndex}RemoteUrl`]);
              const mode = (safeString(this.properties[`tab${tabIndex}RemoteMode`]) || 'live') as RemoteMode;
              const refreshSec = (this.properties[`tab${tabIndex}RemoteRefreshSec`] as number) || 0;
              let selections: IRemoteSelection[] = [];
              try {
                const raw = safeString(this.properties[`tab${tabIndex}RemoteSelections`]);
                selections = raw ? JSON.parse(raw) : [];
              } catch {
                selections = [];
              }

              // Destroy any prior mount for this tab (re-render path).
              const prior = this._remoteMounts.get(tabIndex);
              if (prior) { prior.destroy(); this._remoteMounts.delete(tabIndex); }

              if (!url) {
                $contentHost.html('<div class="picanvas-remote-error" style="padding:24px;text-align:center;color:#656d76">No source URL configured. Open tab settings to configure.</div>');
              } else {
                const mount = RemoteContentService.mount($contentHost[0], {
                  url,
                  mode,
                  selections,
                  refreshSec,
                  isEditMode: this.displayMode === DisplayMode.Edit,
                });
                this._remoteMounts.set(tabIndex, mount);
              }
```

Notes:
- `enableLazy`, `tabLabelForLock`, `lockState`, `tabContentContainer`, `$contentHost`, `safeString` are all in scope where the github branch lives — copy the destructuring shape.
- `DisplayMode` is imported from `@microsoft/sp-core-library` higher in the file.
- The `tabContentContainer` is appended to the page by code further down the same loop — no additional append needed in this branch.

- [ ] **Step 5: Tear down mounts in `onDispose`**

Find `onDispose` (or equivalent — search `protected onDispose`). Inside it, add:

```ts
    this._remoteMounts.forEach(m => m.destroy());
    this._remoteMounts.clear();
```

If no `onDispose` override exists, add one:

```ts
  protected onDispose(): void {
    this._remoteMounts.forEach(m => m.destroy());
    this._remoteMounts.clear();
    super.onDispose();
  }
```

- [ ] **Step 6: Verify build**

Run: `npx heft build --clean`
Expected: success.

- [ ] **Step 7: End-to-end manual test in workbench**

`npx heft start`, deploy to dev page. Add a PiCanvas, configure a Remote Page tab pointing at another page on the same site (use the picker). Save. Switch to view mode. Verify:
1. **Live mode**: source page renders inside the tab without SP chrome; selected sections/webparts visible, others hidden.
2. **Snapshot mode**: cloned static content appears, dynamic webparts inert.
3. **Snapshot with refresh**: edit the source page in another tab, wait for refresh interval, verify the change appears.
4. **Tab switching**: live iframe persists across tab switches (no reload flash).
5. **Re-save config**: prior mount destroyed cleanly (no duplicate iframes in DOM — check DevTools).
6. **Bad URL**: configure with a cross-tenant URL — error message in tab.

- [ ] **Step 8: Commit**

```bash
git add src/webparts/piCanvas/PiCanvasWebPart.ts
git commit -m "feat: wire remote content type into webpart render path"
```

---

## Task 10: Edit-mode outline, error polish, README mention

**Files:**
- Modify: `src/webparts/piCanvas/services/RemoteContentService.ts`
- Modify: `README.md`

- [ ] **Step 1: Add edit-mode outline in the service**

In `RemoteContentService.mount`, after the success path of live mode (after `status.remove()` and CSS injection) and snapshot mode (after the wrapper is appended), add an outline if `config.isEditMode`:

For live mode (just before the `cleanup = ...` line):

```ts
            if (config.isEditMode) {
              frame.style.outline = '2px dashed #0078d4';
              frame.style.outlineOffset = '2px';
              const banner = document.createElement('div');
              banner.style.cssText = 'font:600 11px sans-serif;background:#0078d4;color:#fff;padding:2px 8px;display:inline-block;margin-bottom:4px;border-radius:3px;';
              banner.textContent = `Remote: ${config.url} · ${config.selections.length} selection${config.selections.length === 1 ? '' : 's'} · Live`;
              host.insertBefore(banner, frame);
            }
```

For snapshot mode (inside `runSnapshot`, just after the atomic swap where `host.appendChild(wrapper)` happens):

```ts
      if (config.isEditMode) {
        wrapper.style.outline = '2px dashed #0078d4';
        wrapper.style.outlineOffset = '2px';
        const banner = document.createElement('div');
        banner.style.cssText = 'font:600 11px sans-serif;background:#0078d4;color:#fff;padding:2px 8px;display:inline-block;margin-bottom:4px;border-radius:3px;';
        const refreshNote = (config.refreshSec || 0) > 0 ? ` · refresh ${config.refreshSec}s` : '';
        banner.textContent = `Remote: ${config.url} · ${config.selections.length} selection${config.selections.length === 1 ? '' : 's'} · Snapshot${refreshNote}`;
        host.insertBefore(banner, wrapper);
      }
```

- [ ] **Step 2: Add a small refresh button in edit mode (snapshot only)**

Still inside `runSnapshot`, after the edit-mode banner block, add:

```ts
      if (config.isEditMode && config.mode === 'snapshot') {
        const refreshBtn = document.createElement('button');
        refreshBtn.type = 'button';
        refreshBtn.textContent = 'Refresh now';
        refreshBtn.style.cssText = 'margin-left:8px;font:600 11px sans-serif;background:#fff;color:#0078d4;border:1px solid #0078d4;padding:2px 8px;border-radius:3px;cursor:pointer;';
        refreshBtn.addEventListener('click', () => runSnapshot());
        host.insertBefore(refreshBtn, wrapper);
      }
```

- [ ] **Step 3: Add a brief mention in the README content type table**

In `README.md`, locate the "12 Content Types" table (search for `| **Web Part** |`). Update the heading to "13 Content Types" and add a new row at the end:

```md
| **Remote Page** | Sections, webparts, or whole pages from another SharePoint page on the same tenant (live iframe or snapshot clone) |
```

- [ ] **Step 4: Verify build**

Run: `npx heft build --clean`
Expected: success.

- [ ] **Step 5: Final end-to-end manual test**

`npx heft start`, deploy. Run through the full happy-path checklist one more time:
1. Configure a remote tab via picker.
2. Both modes visible in edit mode with the blue dashed outline + label.
3. Snapshot mode shows the "Refresh now" button in edit mode.
4. Switching to view mode hides outline + buttons; content displays cleanly.
5. Cross-tenant URL shows correct error.
6. Permission-denied source (test by URL to a page you can't access if available) shows access-denied message.
7. Deleting the tab while a remote mount is active does not leave orphaned iframes in `document.body` (check DevTools Elements panel).

- [ ] **Step 6: Commit**

```bash
git add src/webparts/piCanvas/services/RemoteContentService.ts README.md
git commit -m "feat: edit-mode outline + refresh button for remote tabs"
```

---

## Done criteria

- [ ] All 10 tasks committed.
- [ ] Building cleanly: `npx heft build --clean` reports no errors.
- [ ] Manual test pass: live mode + snapshot mode + auto-refresh + cross-tenant rejection + access-denied detection + tab destroy.
- [ ] No orphan iframes in `document.body` after destroying mounts (DevTools spot-check).
- [ ] README lists "Remote Page" as a content type.
