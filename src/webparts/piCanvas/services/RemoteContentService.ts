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
    void config; // skeleton — used in later tasks
    return {
      destroy: () => { host.innerHTML = ''; },
      refresh: () => { /* no-op until snapshot mode lands */ },
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

    // DOM probing implemented in Task 4. For now, return empty success.
    const items: IProbedItem[] = [];
    try { document.body.removeChild(frame); } catch { /* gone */ }
    return { ok: true, items };
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
}

// Silence unused-const warnings for skeleton constants — used in later tasks
void REFRESH_MIN_SEC;
void CHROME_SELECTORS;
