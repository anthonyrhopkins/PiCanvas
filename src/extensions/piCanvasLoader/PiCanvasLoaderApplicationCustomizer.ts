import { Log } from '@microsoft/sp-core-library';
import { BaseApplicationCustomizer } from '@microsoft/sp-application-base';

const LOG_SOURCE: string = 'PiCanvasLoader';

// LocalStorage key used by PiCanvas to store connected webpart IDs
const PICANVAS_STORAGE_KEY = 'picanvas-connected-webparts';

// CSS class added to hide webparts before PiCanvas moves them
const HIDING_STYLE_ID = 'picanvas-pre-hide-styles';

export interface IPiCanvasLoaderApplicationCustomizerProperties {
  // No configurable properties needed
}

export default class PiCanvasLoaderApplicationCustomizer
  extends BaseApplicationCustomizer<IPiCanvasLoaderApplicationCustomizerProperties> {

  public onInit(): Promise<void> {
    Log.info(LOG_SOURCE, 'Application Customizer initializing...');

    // Inject hiding styles immediately on init (before render cycle)
    this.injectHidingStyles();

    Log.info(LOG_SOURCE, 'Initialization complete');
    return Promise.resolve();
  }

  /**
   * Inject CSS that hides all webparts connected to any PiCanvas instance.
   * This runs BEFORE the page renders, ensuring connected webparts are never
   * visible at their original DOM location.
   */
  private injectHidingStyles(): void {
    try {
      // Read connected webpart IDs from localStorage
      const storedData = localStorage.getItem(PICANVAS_STORAGE_KEY);
      Log.verbose(LOG_SOURCE, `localStorage data: ${storedData}`);

      if (!storedData) {
        Log.verbose(LOG_SOURCE, 'No connected webparts found in localStorage');
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
      const styleContent = `
        /* PiCanvas Pre-Hide Styles - Injected by PiCanvasLoader Application Customizer */
        /* These styles hide connected webparts until PiCanvas moves them into tabs */
        ${selectors.join(',\n        ')} {
          visibility: hidden !important;
          opacity: 0 !important;
          height: 0 !important;
          overflow: hidden !important;
          position: absolute !important;
          pointer-events: none !important;
          z-index: -9999 !important;
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
