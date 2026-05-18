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
  public static probeRemotePage(url: string): Promise<IProbeResult> {
    // Implementation lands in Tasks 3–4.
    void url; // skeleton — used in later tasks
    return Promise.resolve({ ok: false, error: 'unknown', message: 'not implemented' });
  }
}

// Silence unused-const warnings for skeleton constants — used in later tasks
void READY_TIMEOUT_MS;
void REFRESH_MIN_SEC;
void CHROME_SELECTORS;
