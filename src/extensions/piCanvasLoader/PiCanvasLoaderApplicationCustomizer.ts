import { Log } from '@microsoft/sp-core-library';
import { BaseApplicationCustomizer } from '@microsoft/sp-application-base';

const LOG_SOURCE: string = 'PiCanvasLoader';

// LocalStorage key used by PiCanvas to store connected webpart IDs
const PICANVAS_STORAGE_KEY = 'picanvas-connected-webparts';

// CSS class added to hide webparts before PiCanvas moves them
const HIDING_STYLE_ID = 'picanvas-pre-hide-styles';

// CSS for global banner webpart full-width fix
const GLOBAL_BANNER_STYLE_ID = 'picanvas-global-banner-css';

export interface IPiCanvasLoaderApplicationCustomizerProperties {
  // No configurable properties needed
}

export default class PiCanvasLoaderApplicationCustomizer
  extends BaseApplicationCustomizer<IPiCanvasLoaderApplicationCustomizerProperties> {

  /** Track last page URL so we can detect actual page changes */
  private _lastPageUrl: string = '';

  public onInit(): Promise<void> {
    Log.info(LOG_SOURCE, 'Application Customizer initializing...');

    // Inject global banner CSS immediately (makes banner webparts full-width)
    this.injectGlobalBannerStyles();

    // Inject hiding styles immediately on init (before render cycle)
    this._lastPageUrl = this.normalizePageUrl(window.location.pathname);
    this.injectHidingStyles();

    // Re-inject hiding styles on every client-side page navigation.
    // onInit() only runs once for the lifetime of the SPA — without this,
    // navigating between pages leaves stale hiding CSS targeting the wrong
    // webpart IDs, causing content from page A to bleed into page B.
    this.context.application.navigatedEvent.add(this, this._onNavigated);

    Log.info(LOG_SOURCE, 'Initialization complete');
    return Promise.resolve();
  }

  private _onNavigated(): void {
    const currentUrl = this.normalizePageUrl(window.location.pathname);

    // Only re-inject if we actually changed pages
    if (currentUrl === this._lastPageUrl) {
      return;
    }

    Log.info(LOG_SOURCE, `Page navigated: ${this._lastPageUrl} → ${currentUrl}`);
    this._lastPageUrl = currentUrl;

    // Remove stale body classes from the previous page's PiCanvas instance.
    // The new page's PiCanvas webpart will re-add them if needed.
    document.body.classList.remove('picanvas-hiding-active');
    document.body.classList.remove('picanvas-banner-fullwidth');

    // Re-inject hiding styles for the new page's connected webparts
    this.injectHidingStyles();
  }

  /**
   * Inject CSS that makes Banner webparts full-width outside of PiCanvas tabs.
   * This uses viewport-escaping CSS tricks to make banners span the full viewport.
   * Must run BEFORE page renders to prevent layout shift.
   */
  private injectGlobalBannerStyles(): void {
    try {
      // Check if already injected
      if (document.getElementById(GLOBAL_BANNER_STYLE_ID)) {
        Log.verbose(LOG_SOURCE, 'Global banner styles already injected');
        return;
      }

      // Use body class to conditionally apply - PiCanvas adds 'picanvas-banner-fullwidth' class in read mode
      const styleContent = `
        /* PiCanvas Global Banner Fix - Injected by Application Customizer */
        /* Make Banner webparts full-width using viewport-escaping CSS */
        /* ONLY applies when body has 'picanvas-banner-fullwidth' class (set by PiCanvas in Read mode) */
        /* ONLY applies to banners OUTSIDE of .picanvas-tab-content */

        /* Make the banner full-width - target banners NOT inside .picanvas-tab-content */
        body.picanvas-banner-fullwidth [data-automation-id="CanvasControl"]:has([data-automation-id="fullWidthImageLayout"]) [data-automation-id="fullWidthImageLayout"] {
          width: 100vw !important;
          max-width: 100vw !important;
          margin-left: calc(-50vw + 50%) !important;
          margin-right: calc(-50vw + 50%) !important;
          position: relative !important;
        }

        /* UNDO full-width for banners INSIDE tabs */
        body.picanvas-banner-fullwidth .picanvas-tab-content [data-automation-id="fullWidthImageLayout"] {
          width: 100% !important;
          max-width: 100% !important;
          margin-left: 0 !important;
          margin-right: 0 !important;
        }

        /* Constrain sibling (non-banner) webparts in sections with full-width banners - OUTSIDE tabs only */
        body.picanvas-banner-fullwidth [data-automation-id="CanvasSection"]:has([data-automation-id="fullWidthImageLayout"]) [data-automation-id="CanvasControl"]:not(:has([data-automation-id="fullWidthImageLayout"])) {
          max-width: 1236px !important;
          margin-left: auto !important;
          margin-right: auto !important;
        }

        /* UNDO sibling constraints for webparts INSIDE tabs */
        body.picanvas-banner-fullwidth .picanvas-tab-content [data-automation-id="CanvasControl"] {
          max-width: none !important;
          margin-left: unset !important;
          margin-right: unset !important;
        }
      `;

      const styleElement = document.createElement('style');
      styleElement.id = GLOBAL_BANNER_STYLE_ID;
      styleElement.textContent = styleContent;

      // Insert at the TOP of head to apply as early as possible
      const head = document.head || document.getElementsByTagName('head')[0];
      if (head.firstChild) {
        head.insertBefore(styleElement, head.firstChild);
      } else {
        head.appendChild(styleElement);
      }

      Log.info(LOG_SOURCE, 'Global banner styles injected successfully');
    } catch (error) {
      Log.error(LOG_SOURCE, error as Error);
    }
  }

  /**
   * Inject CSS that hides all webparts connected to any PiCanvas instance.
   * This runs BEFORE the page renders, ensuring connected webparts are never
   * visible at their original DOM location.
   *
   * The hiding styles are ALWAYS injected, but they only apply when:
   * - The body has the class 'picanvas-hiding-active' (set by PiCanvas in Read mode)
   * - This allows PiCanvas to control when hiding is active based on display mode
   */
  private injectHidingStyles(): void {
    try {
      // Read connected webpart IDs from localStorage
      const storedData = localStorage.getItem(PICANVAS_STORAGE_KEY);
      Log.verbose(LOG_SOURCE, `localStorage data: ${storedData}`);

      if (!storedData) {
        Log.verbose(LOG_SOURCE, 'No connected webparts found in localStorage');
        this.clearHidingStyles();
        return;
      }

      // Parse the stored data - format: { pageUrl: [webpartId1, webpartId2, ...], ... }
      const allConnections: Record<string, string[]> = JSON.parse(storedData);
      Log.verbose(LOG_SOURCE, `All connections: ${JSON.stringify(allConnections)}`);

      // Get current page URL (normalized)
      const currentPageUrl = this.normalizePageUrl(window.location.pathname);
      Log.verbose(LOG_SOURCE, `Current page URL (normalized): ${currentPageUrl}`);

      // Get webpart IDs for current page
      const webpartIds = allConnections[currentPageUrl];
      if (!webpartIds || webpartIds.length === 0) {
        Log.verbose(LOG_SOURCE, `No connected webparts for page: ${currentPageUrl}`);
        Log.verbose(LOG_SOURCE, `Available pages: ${Object.keys(allConnections).join(', ')}`);
        this.clearHidingStyles();
        return;
      }

      Log.info(LOG_SOURCE, `Found ${webpartIds.length} webparts to hide`);

      // Build CSS selectors to hide these webparts
      // SharePoint webpart IDs are set as element IDs in the DOM
      const selectors = webpartIds
        .filter(id => id && id.trim().length > 0)
        .map(id => {
          // Handle both regular webpart IDs and section/column selectors
          if (id.startsWith('SECTION:') || id.startsWith('COLUMN:')) {
            // Section/column uses data attributes (must match PiCanvasWebPart.ts)
            // SECURITY: Escape the ID to prevent CSS injection from malicious localStorage data
            const parts = id.split(':');
            const escapedId = CSS.escape(parts[1]);
            if (parts[0] === 'SECTION') {
              return `[data-picanvas-section-id="${escapedId}"]`;
            } else {
              return `[data-picanvas-column-id="${escapedId}"]`;
            }
          } else {
            // Regular webpart uses ID attribute
            return `#${CSS.escape(id)}`;
          }
        });

      if (selectors.length === 0) {
        return;
      }

      // Create style element with hiding CSS
      // Use !important and multiple properties to ensure webparts are hidden
      // IMPORTANT: Styles only apply when body has 'picanvas-hiding-active' class
      // This class is added by PiCanvas webpart in Read mode, removed in Edit mode
      // SCOPE: Only target elements inside #spPageCanvasContent (the main page canvas).
      // SharePoint Agents/Copilot panel renders OUTSIDE the canvas and must not be affected.
      const conditionalSelectors = selectors.map(sel => `body.picanvas-hiding-active #spPageCanvasContent ${sel}`);
      // Create override selectors for elements inside tabs (should NOT be hidden)
      // Use higher specificity: body + picanvas-hiding-active + picanvas-tab-content to override the hiding
      const overrideSelectors = selectors.map(sel => `body.picanvas-hiding-active .picanvas-tab-content ${sel}`);
      const styleContent = `
        /* PiCanvas Pre-Hide Styles - Injected by PiCanvasLoader Application Customizer */
        /* These styles hide connected webparts until PiCanvas moves them into tabs */
        /* ONLY applies when body has 'picanvas-hiding-active' class (set by PiCanvas in Read mode) */
        /* Hide connected webparts until PiCanvas moves them into tabs.
           display:none is sufficient because PiCanvas clones/moves content into tab containers. */
        ${conditionalSelectors.join(',\n        ')} {
          display: none !important;
        }

        /* OVERRIDE: Elements inside tabs should be visible (they've been moved into tabs) */
        /* Higher specificity overrides the hiding rules above */
        ${overrideSelectors.join(',\n        ')} {
          display: block !important;
        }
      `;

      // Check if style element already exists (in case of re-init)
      let styleElement = document.getElementById(HIDING_STYLE_ID) as HTMLStyleElement;
      if (styleElement) {
        styleElement.textContent = styleContent;
      } else {
        // Create new style element
        styleElement = document.createElement('style');
        styleElement.id = HIDING_STYLE_ID;
        styleElement.textContent = styleContent;

        // Insert at the TOP of head to apply as early as possible
        const head = document.head || document.getElementsByTagName('head')[0];
        if (head.firstChild) {
          head.insertBefore(styleElement, head.firstChild);
        } else {
          head.appendChild(styleElement);
        }
      }

      Log.info(LOG_SOURCE, 'Pre-hide styles injected successfully');

    } catch (error) {
      // Don't throw - just log the error and continue
      // If hiding fails, the page still works, just with a flash of content
      Log.error(LOG_SOURCE, error as Error);
    }
  }

  /**
   * Remove any existing hiding styles from a previous page.
   * Called when navigating to a page with no PiCanvas connections.
   */
  private clearHidingStyles(): void {
    const styleElement = document.getElementById(HIDING_STYLE_ID);
    if (styleElement) {
      styleElement.remove();
      Log.info(LOG_SOURCE, 'Cleared stale pre-hide styles');
    }
  }

  /**
   * Normalize page URL for consistent localStorage key matching
   */
  private normalizePageUrl(url: string): string {
    // Remove query string and hash
    let normalized = url.split('?')[0].split('#')[0];
    // Remove trailing slash
    if (normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1);
    }
    // Convert to lowercase for case-insensitive matching
    return normalized.toLowerCase();
  }
}
