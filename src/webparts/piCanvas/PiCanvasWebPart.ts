import { DisplayMode, Version } from '@microsoft/sp-core-library';
import {
  IPropertyPaneConfiguration,
  PropertyPaneTextField,
  PropertyPaneDropdown,
  IPropertyPaneDropdownOption,
  PropertyPaneLabel,
  IPropertyPaneField,
  PropertyPaneButton,
  PropertyPaneButtonType,
  PropertyPaneToggle,
  PropertyPaneSlider
} from '@microsoft/sp-property-pane';
import { BaseClientSideWebPart } from '@microsoft/sp-webpart-base';

import styles from './PiCanvasWebPart.module.scss';
import * as strings from 'PiCanvasWebPartStrings';
import { PropertyPaneTabPreview } from './PropertyPaneTabPreview';
import { PropertyPaneContentPreview } from './PropertyPaneContentPreview';
import { PropertyPaneMetadataTokenPicker } from './PropertyPaneMetadataTokenPicker';
import { PropertyPaneConfigButton } from './PropertyPaneConfigButton';
import { ConfigurationPanel } from './configPanel/ConfigurationPanel';

// Load configuration panel styles
require('./configPanel/ConfigurationPanel.css');

import { BUILTIN_TEMPLATES } from './data/BuiltinTemplates';

// Metadata token imports
import { MetadataTokenService } from './services/MetadataTokenService';
import { IResolvedToken, MetadataTokenCategory } from './models/MetadataTokenModels';

import $ from 'jquery';

// Extend Window interface for jQuery globals
interface WindowWithJQuery extends Window {
  jQuery?: typeof $;
  $?: typeof $;
}

// Make jQuery available globally for AddTabs.js which expects jQuery/$ on window
(window as WindowWithJQuery).jQuery = $;
(window as WindowWithJQuery).$ = $;

import PnPTelemetry from '@pnp/telemetry-js';

// Template imports
import { TemplateService } from './services/TemplateService';
import { ITemplateListItem } from './models/TemplateModels';

// Content renderer for custom content types (markdown, html, mermaid, embed, rss, toc, profilereport)
import { ContentRenderer, IRssDisplayConfig, IProfileReportDisplayConfig } from './services/ContentRenderer';

// Profile Report service
import { ProfileReportService, ICompanyEntry } from './services/ProfileReportService';

// Theme service + theme model
import { ThemeService } from './services/ThemeService';
import { IProfileReportTheme, BUILTIN_THEMES } from './models/ProfileReportThemes';

// Table of Contents service
import { TocService, ITocConfig } from './services/TocService';
import { getTocPreset, TocPresetKey } from './data/TocStylePresets';

// RSS Feed services
import { fetchFeedWithProxy, isValidFeedUrl } from './services/rssProxy';
import { parseRSSFeed, IRssFeed } from './services/rssParser';

// Permission imports
import { PermissionService, ITabPermissionConfig, IPermissionCheckResult } from './services/PermissionService';
import { TabLockService } from './services/TabLockService';

// JavaScript template imports
import {
  getJavaScriptTemplate,
  getJavaScriptTemplateOptions,
  IJavaScriptTemplateConfig
} from './models/JavaScriptTemplates';

export interface ITabDataItem {
  WebPartID: string;
  TabLabel: string;
  originalTabIndex?: number; // Track original index for property lookup after filtering
  isPlaceholder?: boolean; // True if this is a permission-restricted placeholder tab
  placeholderText?: string; // Custom message to show on placeholder tabs
}

export interface IPiCanvasWebPartProps {
  description: string;
  sectionClass: string;
  webpartClass: string;
  tabCount: number;
  tabData: ITabDataItem[];
  themeMode: 'auto' | 'light' | 'dark';
  tabStyle: 'default' | 'pills' | 'underline' | 'boxed';
  tabAlignment: 'left' | 'center' | 'right' | 'stretch';

  // Color customization
  accentColor: string;
  tabTextColor: string;
  tabActiveTextColor: string;
  tabBackgroundColor: string;
  tabActiveBackgroundColor: string;
  tabHoverBackgroundColor: string;

  // Typography
  tabFontSize: string;
  tabFontWeight: string;

  // Spacing
  tabPaddingVertical: string;
  tabPaddingHorizontal: string;
  tabGap: string;

  // Borders & Effects
  tabBorderRadius: string;
  activeIndicatorWidth: string;
  tabShadow: string;
  enableTransitions: boolean;

  // Active Indicator & Separators
  showActiveIndicator: boolean;
  activeIndicatorColor: string;
  showTabSeparator: boolean;
  tabSeparatorColor: string;

  // Content Gap
  tabContentGap: string;

  // Tab Layout
  tabOrientation: 'horizontal' | 'vertical';
  verticalTabPosition: 'left' | 'right';
  verticalTabWidth: string;

  // Label Image Settings
  labelImageHeight: string;

  // Features (v3.0.0+)
  enableDeepLinking: boolean;   // URL hash navigation (default: true)
  enableLazyLoading: boolean;   // Lazy load tab content (default: true)
  enableFullWidthFix: boolean;  // Force banners to full-width (default: true) - set false for contained layout

  // Lock defaults (v3.0+)
  lockDefaultTemplateEnabled?: boolean;
  lockDefaultTemplate?: string;
  lockDefaultMessagesEnabled?: boolean;
  lockDefaultMessagePrompt?: string;
  lockDefaultMessageError?: string;
  lockDefaultMessageMissing?: string;
  lockDefaultMessageSuccess?: string;
  lockUnlockTtlMinutes?: number | string;

  // Dynamic properties for tab configuration (tab1WebPartID, tab1Label, tab2WebPartID, tab2Label, etc.)
  // Also supports per-tab images: tab1Image (URL string), tab1ImagePosition, etc.
  // Also supports per-tab dividers: tab1DividerAfter (boolean)
  // Also supports per-tab content types (v3.0): tab1ContentType, tab1CustomContent, tab1EmbedUrl, tab1EmbedHeight
  [key: string]: string | number | boolean | ITabDataItem[] | undefined;
}

// Version info
const PICANVAS_VERSION = '3.0.0';

type LockMessageState = 'prompt' | 'error' | 'missing' | 'success';

interface ILockMessages {
  prompt: string;
  error: string;
  missing: string;
  success: string;
}

interface ITabLockState {
  enabled: boolean;
  hasPassword: boolean;
  isUnlocked: boolean;
  passwordHash: string;
}

export default class PiCanvasWebPart extends BaseClientSideWebPart<IPiCanvasWebPartProps> {
  private static readonly MAX_TABS = 20;
  private static readonly TAB_PROPERTY_SUFFIXES: ReadonlyArray<string> = [
    'WebPartID',
    'Label',
    'ContentType',
    'CustomContent',
    'EmbedUrl',
    'EmbedHeight',
    'EmbedFullPage',
    'EmbedFullWidth',
    'EmbedFullHeight',
    'FileUrl',  // External file (.html, .md) URL
    'FileSourceType',  // 'url' or 'webpart' - source type for file content
    'FileSourceWebPartID',  // ID of Text WebPart to use as content source
    'ContentSourceType',  // 'manual' or 'webpart' - source type for HTML/Markdown content
    'ContentSourceWebPartID',  // ID of Text WebPart to use as HTML/Markdown source
    'ContentFullWidth',  // Full-width toggle for HTML/Markdown content
    'JavaScriptDisplayMode',  // Display mode for JavaScript tabs: contained, fullSection, fullScreen
    'JavaScriptTemplate',  // Template ID for JavaScript tabs
    'JavaScriptTemplateConfig',  // JSON-encoded template configuration
    'LabelType',
    'LabelWebPartID',
    'Icon',
    'Image',
    'ImagePosition',
    'DividerAfter',
    'PermissionEnabled',
    'PermissionGroups',
    'PermissionCustomGroups',
    'PermissionPlaceholder',
    'PermissionPlaceholderText',
    'LockEnabled',
    'LockPasswordHash',
    'LockPassword',
    'LockUseCustomTemplate',
    'LockTemplate',
    'LockCustomizeMessages',
    'LockMessagePrompt',
    'LockMessageError',
    'LockMessageMissing',
    'LockMessageSuccess',
    // RSS Feed properties
    'RssFeedUrl',
    'RssMaxItems',
    'RssLayout',
    'RssShowDate',
    'RssShowDescription',
    'RssShowImage',
    'RssShowAuthor',
    'RssDescriptionLimit',
    'RssDateFormat',
    'RssLinkTarget',
    'RssLoadingMessage',
    // Table of Contents properties
    'TocSearchText',
    'TocSearchMarkdown',
    'TocSearchCollapsible',
    'TocShowH2',
    'TocShowH3',
    'TocShowH4',
    'TocShowH5',
    'TocListStyle',
    'TocStickyMode',
    'TocHideInMobile',
    'TocHideTitle',
    'TocTitleText',
    'TocShowBackLink',
    'TocBackLinkText',
    // TOC Styling properties (v3.8)
    'TocStylePreset',
    'TocFontFamily',
    'TocBaseFontSize',
    'TocTitleFontSize',
    'TocLevelSizeStep',
    'TocTitleFontWeight',
    'TocH2FontWeight',
    'TocSubHeadingFontWeight',
    'TocLineHeight',
    'TocLetterSpacing',
    'TocLinkColor',
    'TocLinkHoverColor',
    'TocActiveColor',
    'TocTitleColor',
    'TocLevelColorDimming',
    'TocBackgroundColor',
    'TocBorderColor',
    'TocContainerPadding',
    'TocItemSpacing',
    'TocIndentPerLevel',
    'TocMaxWidth',
    'TocCustomIcon',
    'TocEnableScrollspy',
    'TocEnableCollapsible',
    'TocEnableHoverBackground',
    'TocHoverBackgroundColor',
    'TocEnableClickRipple',
    // Within-tab TOC properties (for HTML/Markdown tabs)
    'TocEnabled',
    'TocMinHeadings',
    'TocMaxLevel',
    // Profile Report properties
    'ProfileReportLibrary',         // Document library name (default: "Profiles")
    'ProfileReportListName',        // SharePoint list name (default: "Pi_Companies") — data-driven company source
    'ProfileReportLayout',          // 'tabbed' | 'accordion' | 'cards'
    'ProfileReportShowMethodK',     // boolean
    'ProfileReportShowMethodL',     // boolean
    'ProfileReportShowMethodM',     // boolean
    'ProfileReportShowProfileJson', // boolean
    'ProfileReportCompanyLimit',    // number (default: 500)
    'ProfileReportSortBy',          // 'name' | 'date' | 'key'
    'ProfileReportTheme',           // 'light' | 'dark' | 'auto'
    // Profile Report display mode + metadata properties
    'ProfileReportDisplayMode',         // 'contained' | 'fullSection' | 'fullScreen'
    'ProfileReportSidebarWidth',        // CSS value like '280px'
    'ProfileReportEnableMetadata',      // boolean
    'ProfileReportMetadataCompanyCol',  // string (column internal name)
    'ProfileReportMetadataFileCategory' // string (column internal name)
  ];

  private static readonly DEFAULT_LOCK_TEMPLATE = `
    <div class="picanvas-lock-overlay" data-picanvas-lock-overlay="true">
      <div class="picanvas-lock-card" role="dialog" aria-modal="true">
        <div class="picanvas-lock-title">{{lockTitle}}</div>
        <div class="picanvas-lock-message" data-picanvas-lock-message></div>
        <label class="picanvas-lock-field">
          <span class="picanvas-lock-label">{{passwordLabel}}</span>
          <input type="password" data-picanvas-lock-input autocomplete="current-password" />
        </label>
        <div class="picanvas-lock-actions">
          <button type="button" data-picanvas-lock-submit>{{unlockLabel}}</button>
        </div>
      </div>
    </div>
  `;

  // LocalStorage key for PiCanvasLoader Application Customizer communication
  private static readonly PICANVAS_STORAGE_KEY = 'picanvas-connected-webparts';
  // CSS style ID injected by PiCanvasLoader to pre-hide webparts
  private static readonly PREHIDE_STYLE_ID = 'picanvas-pre-hide-styles';

  private _zonesCache: Array<[string, string]> = [];
  private _currentHighlightedElement: HTMLElement | null = null;
  private _isPropertyPaneOpen: boolean = false;
  private _configPanel: ConfigurationPanel | null = null;

  /**
   * GLOBAL REGISTRY: Tracks which webparts are owned by which PiCanvas instance.
   * Key = webpart element key (e.g., "wp-123" or "SECTION:abc")
   * Value = { instanceId: string, $element: JQuery }
   * This allows multiple PiCanvas instances to coordinate webpart ownership.
   */
  private static _globalWebpartRegistry: Map<string, { instanceId: string; $element: JQuery<HTMLElement> }> = new Map();

  /**
   * GLOBAL EVENT SETUP: Ensures cross-instance tab change handling is only set up once
   */
  private static _globalEventHandlerInitialized: boolean = false;

  // Template management
  private _templateService: TemplateService | null = null;
  private _availableTemplates: ITemplateListItem[] = [];
  private _isLoadingTemplates: boolean = false;
  private _hasSiteAssetsAccess: boolean = true;
  private _selectedTemplateId: string = '';

  // Permission management
  private _permissionService: PermissionService | null = null;
  private _permissionData: IPermissionCheckResult | null = null;
  private _permissionDataLoading: boolean = false;

  // Lock management
  private _lockService: TabLockService | null = null;

  // Metadata token management
  private _fullWidthResizeObserver: ResizeObserver | null = null;
  private _fullWidthResizeHandler: (() => void) | null = null;
  private _metadataTokenService: MetadataTokenService | null = null;
  private _resolvedTokensByCategory: Record<MetadataTokenCategory, IResolvedToken[]> | null = null;
  private _tokensLoading: boolean = false;
  private _tokensError: string | null = null;

  // Position warnings: tracks which tabs have webparts positioned above PiCanvas
  // Key = tab index, Value = warning message (empty = no warning)
  private _positionWarnings: Map<number, string> = new Map();

  // TOC intervals for periodic re-scanning of page headings
  private _tocIntervals: Map<number, ReturnType<typeof setInterval>> = new Map();

  // TOC scrollspy cleanup functions
  private _tocScrollspyCleanups: Array<() => void> = [];

  /**
   * Security: Encode HTML entities to prevent XSS attacks
   * @param str - The string to encode
   * @returns HTML-encoded string safe for insertion into HTML
   */
  private encodeHtml(str: string): string {
    if (!str) return '';
    // Safety: ensure we have a string, not an object
    const safeStr = typeof str === 'string' ? str : String(str);
    return safeStr
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Check if a webpart/section is positioned above PiCanvas in the DOM.
   * Elements above PiCanvas may flash briefly before being hidden because
   * they render before PiCanvas can move them into tabs.
   * @param elementId - The webpart/section ID to check
   * @returns 'above' if element is above PiCanvas, 'below' if below, 'unknown' if can't determine
   */
  private checkElementPosition(elementId: string): 'above' | 'below' | 'unknown' {
    if (!elementId) return 'unknown';

    try {
      // Get PiCanvas container element
      const piCanvasElement = this.domElement;
      if (!piCanvasElement) return 'unknown';

      // Find the target element
      let targetElement: HTMLElement | null = null;

      if (elementId.startsWith('SECTION:')) {
        // Section selection - find by data attribute (must match attribute set in render)
        const sectionId = elementId.replace('SECTION:', '');
        targetElement = document.querySelector(`[data-picanvas-section-id="${sectionId}"]`) as HTMLElement;
        if (!targetElement) {
          // Try finding the actual section element
          targetElement = document.querySelector(`.${this.properties.sectionClass || 'CanvasSection'}[data-section-id="${sectionId}"]`) as HTMLElement;
        }
      } else if (elementId.startsWith('COLUMN:')) {
        // Column selection (must match attribute set in render)
        const columnId = elementId.replace('COLUMN:', '');
        targetElement = document.querySelector(`[data-picanvas-column-id="${columnId}"]`) as HTMLElement;
      } else {
        // Regular webpart - find by ID
        targetElement = document.getElementById(elementId);
      }

      if (!targetElement) return 'unknown';

      // Use compareDocumentPosition to determine relative position
      // DOCUMENT_POSITION_PRECEDING (2) = target comes before PiCanvas
      // DOCUMENT_POSITION_FOLLOWING (4) = target comes after PiCanvas
      const position = piCanvasElement.compareDocumentPosition(targetElement);

      if (position & Node.DOCUMENT_POSITION_PRECEDING) {
        return 'above'; // Target element comes before (above) PiCanvas in DOM
      } else if (position & Node.DOCUMENT_POSITION_FOLLOWING) {
        return 'below'; // Target element comes after (below) PiCanvas in DOM
      }

      return 'unknown';
    } catch (error) {
      console.warn('[PiCanvas] Could not determine element position:', error);
      return 'unknown';
    }
  }

  /**
   * Update position warning for a specific tab based on selected webpart position.
   * @param tabIndex - The tab index (1-based)
   * @param elementId - The selected webpart/section ID
   */
  private updatePositionWarning(tabIndex: number, elementId: string): void {
    if (!elementId) {
      this._positionWarnings.delete(tabIndex);
      return;
    }

    const position = this.checkElementPosition(elementId);

    if (position === 'above') {
      this._positionWarnings.set(
        tabIndex,
        '⚠️ This content is positioned above PiCanvas on the page. It may briefly flash at its original location before appearing in the tab. Consider moving PiCanvas higher on the page or moving this content below PiCanvas.'
      );
    } else {
      this._positionWarnings.delete(tabIndex);
    }
  }

  /**
   * Inject CSS to hide connected webparts IMMEDIATELY in onInit().
   * This runs before render() and prevents the flash of webparts at their original position.
   */
  private injectEarlyHidingStyles(): void {
    try {
      // Collect all webpart IDs from properties
      const webpartIds: string[] = [];
      const numTabs = this.properties.tabCount || 2;

      for (let i = 1; i <= numTabs; i++) {
        const webPartID = this.properties[`tab${i}WebPartID`] as string;
        if (webPartID && webPartID.trim().length > 0) {
          webpartIds.push(webPartID.trim());
        }
        // Also check label webpart IDs
        const labelWebPartID = this.properties[`tab${i}LabelWebPartID`] as string;
        if (labelWebPartID && labelWebPartID.trim().length > 0) {
          webpartIds.push(labelWebPartID.trim());
        }
      }

      if (webpartIds.length === 0) {
        return;
      }

      console.log('[PiCanvas] Hiding webparts early:', webpartIds);

      // Check if any webpart IDs are sections or columns - if so, we need to mark DOM elements first
      const hasSectionOrColumn = webpartIds.some(id => id.startsWith('SECTION:') || id.startsWith('COLUMN:'));
      if (hasSectionOrColumn) {
        // Mark DOM elements with data-picanvas-section-id and data-picanvas-column-id
        // so that our CSS selectors can target them
        this.getSections();
      }

      // Build CSS selectors - SharePoint uses these IDs directly on elements
      // SECURITY: All IDs must be escaped to prevent CSS injection
      const selectors = webpartIds.map(id => {
        // Handle section/column references
        if (id.startsWith('SECTION:') || id.startsWith('COLUMN:')) {
          const parts = id.split(':');
          const escapedId = CSS.escape(parts[1]);
          if (parts[0] === 'SECTION') {
            return `[data-picanvas-section-id="${escapedId}"]`;
          } else {
            return `[data-picanvas-column-id="${escapedId}"]`;
          }
        }
        // Regular webpart ID
        return `#${CSS.escape(id)}`;
      });

      // Create hiding CSS - use visibility:hidden to preserve layout space
      // The webpart will be moved to tabs, then this style removed
      const styleId = `picanvas-prehide-${this.instanceId}`;
      let styleElement = document.getElementById(styleId) as HTMLStyleElement;

      const css = `
        /* PiCanvas Pre-Hide: ${this.instanceId} */
        ${selectors.join(',\n        ')} {
          visibility: hidden !important;
          opacity: 0 !important;
        }
      `;

      if (styleElement) {
        styleElement.textContent = css;
      } else {
        styleElement = document.createElement('style');
        styleElement.id = styleId;
        styleElement.textContent = css;
        // Insert at top of head
        const head = document.head || document.getElementsByTagName('head')[0];
        if (head.firstChild) {
          head.insertBefore(styleElement, head.firstChild);
        } else {
          head.appendChild(styleElement);
        }
      }
    } catch (error) {
      console.warn('[PiCanvas] Failed to inject early hiding styles:', error);
    }
  }

  /**
   * Save connected webpart IDs to localStorage for PiCanvasLoader Application Customizer.
   * The customizer reads this on page load to pre-hide webparts before they render.
   * @param webpartIds Array of webpart IDs connected to this PiCanvas instance
   */
  private saveConnectedWebpartsToStorage(webpartIds: string[]): void {
    try {
      const pageUrl = this.normalizePageUrl(window.location.pathname);
      let allConnections: Record<string, string[]> = {};

      // Read existing connections
      const existing = localStorage.getItem(PiCanvasWebPart.PICANVAS_STORAGE_KEY);
      if (existing) {
        try {
          allConnections = JSON.parse(existing);
        } catch {
          // Invalid JSON, reset
          allConnections = {};
        }
      }

      // Update connections for this page
      // Merge with any existing connections from other PiCanvas instances on the same page
      const existingIds = allConnections[pageUrl] || [];
      const mergedIds = [...new Set([...existingIds, ...webpartIds])];
      allConnections[pageUrl] = mergedIds.filter(id => id && id.trim().length > 0);

      // Save back to localStorage
      localStorage.setItem(PiCanvasWebPart.PICANVAS_STORAGE_KEY, JSON.stringify(allConnections));
      console.log('[PiCanvas] Saved connected webparts to localStorage:', allConnections[pageUrl]);
    } catch (error) {
      // LocalStorage might be unavailable (private browsing, quota exceeded, etc.)
      console.warn('[PiCanvas] Could not save connected webparts to localStorage:', error);
    }
  }

  /**
   * Normalize page URL for consistent localStorage key matching
   */
  private normalizePageUrl(url: string): string {
    let normalized = url.split('?')[0].split('#')[0];
    if (normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1);
    }
    return normalized.toLowerCase();
  }

  /**
   * Helper method to save connected webparts from current properties.
   * Called when properties change in Edit mode to ensure localStorage is updated
   * before switching to Preview/Read mode.
   */
  private saveConnectedWebpartsFromProperties(): void {
    try {
      // First, ensure DOM elements are marked with data attributes
      // This is necessary for section/column hiding to work
      this.getSections();

      // Collect all configured webpart/section IDs from properties
      const connectedIds: string[] = [];
      const numTabs = this.properties.tabCount || 2;

      for (let i = 1; i <= numTabs; i++) {
        const webPartID = this.properties[`tab${i}WebPartID`] as string;
        if (webPartID && webPartID.trim().length > 0) {
          connectedIds.push(webPartID);
        }
      }

      if (connectedIds.length > 0) {
        this.saveConnectedWebpartsToStorage(connectedIds);
        console.log('[PiCanvas] Saved connected webparts from Edit mode:', connectedIds);
      }
    } catch (error) {
      console.warn('[PiCanvas] Failed to save connected webparts from properties:', error);
    }
  }

  /**
   * Remove pre-hide styles after webparts have been moved into tabs.
   * This makes the webparts visible in their new location.
   */
  private removePreHideStyles(): void {
    // Remove instance-specific pre-hide styles (from onInit)
    const instanceStyleId = `picanvas-prehide-${this.instanceId}`;
    const instanceStyle = document.getElementById(instanceStyleId);
    if (instanceStyle) {
      instanceStyle.remove();
      console.log('[PiCanvas] Removed pre-hide styles for instance:', this.instanceId);
    }

    // Also remove any Application Customizer styles (if extension is used)
    const extensionStyle = document.getElementById(PiCanvasWebPart.PREHIDE_STYLE_ID);
    if (extensionStyle) {
      extensionStyle.remove();
      console.log('[PiCanvas] Removed extension pre-hide styles');
    }
  }

  /**
   * Security: Validate and sanitize image URLs
   * Only allows http, https, and data URIs (for base64 images)
   * @param url - The URL to validate
   * @returns Sanitized URL or empty string if invalid
   */
  private sanitizeImageUrl(url: string): string {
    if (!url) return '';
    const trimmedUrl = url.trim();
    // Allow only safe protocols
    if (trimmedUrl.startsWith('https://') ||
      trimmedUrl.startsWith('http://') ||
      trimmedUrl.startsWith('data:image/') ||
      trimmedUrl.startsWith('/')) {
      // Encode any special characters in the URL
      return trimmedUrl.replace(/"/g, '%22').replace(/'/g, '%27');
    }
    // Block javascript:, vbscript:, and other potentially dangerous protocols
    return '';
  }

  protected async onInit(): Promise<void> {
    // IMMEDIATELY hide connected webparts before they render visibly
    // This prevents the "flash" of webparts at their original position
    this.injectEarlyHidingStyles();

    // Suppress unhandled promise rejections from SharePoint workbench internal code
    // These are not PiCanvas errors but trigger webpack-dev-server's error overlay
    // Only active in development mode (DEBUG flag is set by build process)
    if (DEBUG) {
      // Helper function to check if error is from SharePoint internal code
      const isSharePointInternalError = (reason: unknown): boolean => {
        if (reason === undefined || reason === null) {
          return true; // SharePoint often rejects with undefined/null
        }
        const errorStack = (reason as Error)?.stack || '';
        const errorMessage = (reason as Error)?.message || String(reason);
        return (
          errorStack.includes('sp-webpart-workbench') ||
          errorStack.includes('sp-canvas') ||
          errorStack.includes('sp-mysitecache') ||
          errorStack.includes('spserviceworker') ||
          errorStack.includes('PersonalCache') ||
          errorMessage.includes('PersonalCache') ||
          errorMessage === '' ||
          errorMessage === 'undefined'
        );
      };

      // Method 1: Add handler in capture phase (runs before bubble phase handlers)
      window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
        if (isSharePointInternalError(event.reason)) {
          event.preventDefault();
          event.stopImmediatePropagation(); // Prevent other handlers from running
          console.warn('[PiCanvas] Suppressed SharePoint internal error:', event.reason);
          return false;
        }
      }, { capture: true });

      // Method 2: Override window.onunhandledrejection property
      // This catches cases where webpack-dev-server uses the property directly
      const originalHandler = window.onunhandledrejection;
      Object.defineProperty(window, 'onunhandledrejection', {
        get: () => originalHandler,
        set: (handler) => {
          // Wrap any handler that gets set to filter SharePoint errors
          if (handler && typeof handler === 'function') {
            const wrappedHandler = (event: PromiseRejectionEvent) => {
              if (isSharePointInternalError(event.reason)) {
                event.preventDefault();
                console.warn('[PiCanvas] Suppressed SharePoint error (property handler):', event.reason);
                return;
              }
              return handler.call(window, event);
            };
            // Store wrapped handler but don't call the original setter
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (window as any)._wrappedUnhandledRejection = wrappedHandler;
          }
        },
        configurable: true
      });

      // Method 3: Also suppress via error event (some overlays use this)
      window.addEventListener('error', (event: ErrorEvent) => {
        const errorStack = event.error?.stack || '';
        const errorMessage = event.message || '';
        if (
          errorStack.includes('sp-webpart-workbench') ||
          errorStack.includes('PersonalCache') ||
          errorMessage.includes('Unknown') ||
          errorMessage === ''
        ) {
          event.preventDefault();
          event.stopImmediatePropagation();
          console.warn('[PiCanvas] Suppressed SharePoint internal error (error event):', event.error);
          return false;
        }
      }, { capture: true });

      // Method 4: Remove webpack-dev-server overlay when it appears
      // The overlay is added to the DOM, so we can watch for it and remove it
      const removeOverlay = (): void => {
        // webpack-dev-server creates an iframe with id 'webpack-dev-server-client-overlay'
        // or a div with similar naming patterns
        const selectors = [
          '#webpack-dev-server-client-overlay',
          '#webpack-dev-server-client-overlay-div',
          '[id*="webpack"][id*="overlay"]',
          'iframe[src*="overlay"]'
        ];

        selectors.forEach(selector => {
          const elements = document.querySelectorAll(selector);
          elements.forEach(el => {
            console.warn('[PiCanvas] Removed webpack-dev-server overlay element');
            el.remove();
          });
        });
      };

      // Run immediately in case overlay already exists
      removeOverlay();

      // Watch for overlay being added to DOM
      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (mutation.type === 'childList') {
            mutation.addedNodes.forEach((node) => {
              if (node instanceof HTMLElement) {
                const id = node.id || '';
                const tagName = node.tagName?.toLowerCase() || '';
                // Check if this looks like a webpack overlay
                if (
                  id.includes('webpack') ||
                  id.includes('overlay') ||
                  (tagName === 'iframe' && (node as HTMLIFrameElement).src?.includes('overlay'))
                ) {
                  console.warn('[PiCanvas] Detected and removed overlay element:', id || tagName);
                  node.remove();
                }
              }
            });
          }
        }
      });

      observer.observe(document.documentElement, {
        childList: true,
        subtree: true
      });
    }

    const telemetry = PnPTelemetry.getInstance();
    telemetry.optOut();
    // Load CSS for highlight styles (needed in edit mode for property pane interactions)
    require('./AddTabs.css');

    // Initialize template service
    this._templateService = new TemplateService(this.context);

    // Initialize permission service
    this._permissionService = new PermissionService(this.context);

    // Initialize lock service
    this._lockService = new TabLockService(this.instanceId);

    // Initialize metadata token service
    this._metadataTokenService = new MetadataTokenService(this.context);

    // Load available templates in background (don't block init)
    this.loadAvailableTemplates().catch(err => {
      console.warn('Failed to load templates:', err);
    });

    // Load metadata tokens in background (for property pane token picker)
    this.loadMetadataTokens().catch(err => {
      console.warn('Failed to load metadata tokens:', err);
    });

    // Wait for permission data to load before render (for correct filtering on first render)
    // This adds a small delay but ensures permissions work correctly
    await this.loadPermissionData().catch(err => {
      console.warn('Failed to load permission data:', err);
    });

    return super.onInit();
  }

  /**
   * Load available templates from built-ins and Site Assets
   */
  private async loadAvailableTemplates(): Promise<void> {
    if (!this._templateService) return;

    this._isLoadingTemplates = true;
    try {
      // Check Site Assets access
      this._hasSiteAssetsAccess = await this._templateService.checkSiteAssetsAccess();

      // Load all templates
      this._availableTemplates = await this._templateService.getAvailableTemplates();
    } catch (error) {
      console.error('Failed to load templates:', error);
      this._availableTemplates = [];
    }
    this._isLoadingTemplates = false;
  }

  /**
   * Load user's permission data from SharePoint
   * This is called on init and cached for subsequent renders
   */
  private async loadPermissionData(): Promise<void> {
    if (!this._permissionService || this._permissionDataLoading) return;

    this._permissionDataLoading = true;
    try {
      this._permissionData = await this._permissionService.getUserPermissionData();
    } catch (error) {
      console.error('Failed to load permission data:', error);
      this._permissionData = null;
    }
    this._permissionDataLoading = false;
  }

  /**
   * Load metadata tokens for the current page
   * This is called in background and cached for property pane display
   * Also pre-fetches metadata so substituteTokensSync works
   */
  private async loadMetadataTokens(): Promise<void> {
    if (!this._metadataTokenService || this._tokensLoading) return;

    this._tokensLoading = true;
    this._tokensError = null;

    try {
      // This fetches page metadata (which gets cached) and returns resolved tokens by category
      this._resolvedTokensByCategory = await this._metadataTokenService.getResolvedTokensByCategory();
    } catch (error) {
      console.error('Failed to load metadata tokens:', error);
      this._tokensError = (error as Error).message || 'Failed to load tokens';
      this._resolvedTokensByCategory = null;
    }

    this._tokensLoading = false;
  }

  /**
   * Get permission configuration for a specific tab
   */
  private getTabPermissionConfig(tabIndex: number): ITabPermissionConfig {
    const enabled = this.properties[`tab${tabIndex}PermissionEnabled`] as boolean || false;

    // Parse standard groups (stored as comma-separated string)
    const standardGroupsStr = (this.properties[`tab${tabIndex}PermissionGroups`] as string) || '';
    const validGroups = ['Owners', 'Members', 'Visitors'];
    const standardGroups = standardGroupsStr
      .split(',')
      .filter(g => g.trim().length > 0)
      .filter(g => validGroups.indexOf(g) !== -1) as ('Owners' | 'Members' | 'Visitors')[];

    // Parse custom group IDs (stored as comma-separated string of numbers)
    const customGroupIdsStr = (this.properties[`tab${tabIndex}PermissionCustomGroups`] as string) || '';
    const customGroupIds = customGroupIdsStr
      .split(',')
      .map(id => parseInt(id.trim(), 10))
      .filter(id => !isNaN(id) && id > 0);

    return {
      enabled,
      standardGroups,
      customGroupIds
    };
  }

  /**
   * Check if the current user has permission to view a tab
   * @param tabIndex - 1-based tab index
   * @returns true if visible, false if hidden
   */
  private isTabVisibleToUser(tabIndex: number): boolean {
    // If permission data not loaded yet, show all tabs (graceful degradation)
    if (!this._permissionService || !this._permissionData) {
      return true;
    }

    const config = this.getTabPermissionConfig(tabIndex);
    return this._permissionService.checkTabPermission(config, this._permissionData);
  }

  /**
   * Get lock state for a specific tab
   */
  private getTabLockState(tabIndex: number): ITabLockState {
    const enabled = this.properties[`tab${tabIndex}LockEnabled`] as boolean || false;
    const passwordHash = (this.properties[`tab${tabIndex}LockPasswordHash`] as string) || '';
    const hasPassword = !!passwordHash;
    const isUnlocked = enabled
      ? (!!this._lockService && hasPassword && this._lockService.isUnlocked(tabIndex, passwordHash))
      : true;

    return {
      enabled,
      hasPassword,
      isUnlocked,
      passwordHash
    };
  }

  /**
   * Build lock message HTML set (sanitized)
   */
  private getLockMessages(tabIndex: number): ILockMessages {
    const customize = this.properties[`tab${tabIndex}LockCustomizeMessages`] as boolean;
    const useGlobal = this.properties.lockDefaultMessagesEnabled === true;

    const globalPrompt = useGlobal ? (this.properties.lockDefaultMessagePrompt as string) : '';
    const globalError = useGlobal ? (this.properties.lockDefaultMessageError as string) : '';
    const globalMissing = useGlobal ? (this.properties.lockDefaultMessageMissing as string) : '';
    const globalSuccess = useGlobal ? (this.properties.lockDefaultMessageSuccess as string) : '';

    const promptRaw = customize
      ? (this.properties[`tab${tabIndex}LockMessagePrompt`] as string)
      : globalPrompt;
    const errorRaw = customize
      ? (this.properties[`tab${tabIndex}LockMessageError`] as string)
      : globalError;
    const missingRaw = customize
      ? (this.properties[`tab${tabIndex}LockMessageMissing`] as string)
      : globalMissing;
    const successRaw = customize
      ? (this.properties[`tab${tabIndex}LockMessageSuccess`] as string)
      : globalSuccess;

    const prompt = promptRaw && promptRaw.trim()
      ? promptRaw
      : `<p>${strings.LockPromptMessage || 'Enter the password to unlock this tab.'}</p>`;
    const error = errorRaw && errorRaw.trim()
      ? errorRaw
      : `<p>${strings.LockErrorMessage || 'Incorrect password. Please try again.'}</p>`;
    const missing = missingRaw && missingRaw.trim()
      ? missingRaw
      : `<p>${strings.LockMissingPasswordMessage || 'No password has been set for this tab.'}</p>`;
    const success = successRaw && successRaw.trim()
      ? successRaw
      : `<p>${strings.LockSuccessMessage || 'Unlocked.'}</p>`;

    return {
      prompt: ContentRenderer.renderLockTemplate(prompt).html,
      error: ContentRenderer.renderLockTemplate(error).html,
      missing: ContentRenderer.renderLockTemplate(missing).html,
      success: ContentRenderer.renderLockTemplate(success).html
    };
  }

  /**
   * Replace template tokens with safe values
   */
  private applyLockTemplateTokens(template: string, tokens: Record<string, string>): string {
    return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => {
      return tokens[key] ?? '';
    });
  }

  /**
   * Get sanitized lock template HTML for a tab
   */
  private getLockTemplateHtml(tabIndex: number, tabLabel: string, forceDefault: boolean = false): string {
    const useCustom = this.properties[`tab${tabIndex}LockUseCustomTemplate`] as boolean;
    const useGlobal = this.properties.lockDefaultTemplateEnabled === true;
    const customTemplate = !forceDefault && useCustom
      ? (this.properties[`tab${tabIndex}LockTemplate`] as string)
      : '';
    const globalTemplate = !forceDefault && !useCustom && useGlobal
      ? (this.properties.lockDefaultTemplate as string)
      : '';

    const rawTemplate = customTemplate && customTemplate.trim()
      ? customTemplate
      : (globalTemplate && globalTemplate.trim()
        ? globalTemplate
        : PiCanvasWebPart.DEFAULT_LOCK_TEMPLATE);

    const tokens = {
      tabLabel: this.encodeHtml(tabLabel || `Tab ${tabIndex}`),
      tabIndex: String(tabIndex),
      lockTitle: this.encodeHtml(strings.LockTitleText || 'Protected content'),
      passwordLabel: this.encodeHtml(strings.LockPasswordFieldLabel || 'Password'),
      unlockLabel: this.encodeHtml(strings.LockUnlockButtonLabel || 'Unlock')
    };

    const templated = this.applyLockTemplateTokens(rawTemplate, tokens);
    return ContentRenderer.renderLockTemplate(templated).html;
  }

  /**
   * Build lock overlay element with messages and required hooks
   */
  private buildLockOverlay(tabIndex: number, tabLabel: string): JQuery<HTMLElement> {
    const messages = this.getLockMessages(tabIndex);
    const templateHtml = this.getLockTemplateHtml(tabIndex, tabLabel);
    const fallbackHtml = this.getLockTemplateHtml(tabIndex, tabLabel, true);

    const materialize = (html: string, isFallback: boolean): JQuery<HTMLElement> | null => {
      if (!html || !html.trim()) {
        return null;
      }

      const $templateRoot = $(html);
      let $overlay = $templateRoot.filter('[data-picanvas-lock-overlay]').first();
      if (!$overlay.length) {
        $overlay = $('<div class="picanvas-lock-overlay" data-picanvas-lock-overlay="true"></div>');
        $overlay.append($templateRoot);
      }

      $overlay.addClass('picanvas-lock-overlay');
      $overlay.data('lock-messages', messages);

      const hasInput = $overlay.find('[data-picanvas-lock-input]').length > 0;
      const hasSubmit = $overlay.find('[data-picanvas-lock-submit]').length > 0;
      if (!hasInput || !hasSubmit) {
        if (!isFallback) {
          console.warn('[PiCanvas] Lock template missing required elements. Falling back to default template.');
          return null;
        }
        console.warn('[PiCanvas] Default lock template is missing required elements.');
      }

      const $message = $overlay.find('[data-picanvas-lock-message]').first();
      if ($message.length) {
        $message.html(messages.prompt);
      }
      $overlay.attr('data-lock-state', 'prompt');

      return $overlay;
    };

    const overlay = materialize(templateHtml, false) || materialize(fallbackHtml, true);
    return overlay || $('<div class="picanvas-lock-overlay" data-picanvas-lock-overlay="true"></div>');
  }

  /**
   * Attach lock overlay and content host to a tab panel
   */
  private attachLockElements(
    tabContentContainer: JQuery<HTMLElement>,
    tabIndex: number,
    tabLabel: string,
    lockState: ITabLockState
  ): JQuery<HTMLElement> {
    if (!lockState.enabled) {
      return tabContentContainer;
    }

    tabContentContainer.attr('data-lock-enabled', 'true');
    tabContentContainer.attr('data-lock-unlocked', lockState.isUnlocked ? 'true' : 'false');
    tabContentContainer.attr('data-lock-tab-index', String(tabIndex));

    const $overlay = this.buildLockOverlay(tabIndex, tabLabel);
    const $contentHost = $('<div class="picanvas-lock-content" data-lock-content="true"></div>');

    if (!lockState.isUnlocked) {
      $contentHost.attr('aria-hidden', 'true');
    }

    tabContentContainer.append($overlay);
    tabContentContainer.append($contentHost);

    return $contentHost;
  }

  /**
   * Update lock overlay message and state
   */
  private setLockOverlayState($overlay: JQuery<HTMLElement>, state: LockMessageState): void {
    const messages = $overlay.data('lock-messages') as ILockMessages | undefined;
    const $message = $overlay.find('[data-picanvas-lock-message]').first();
    if ($message.length && messages) {
      const html = messages[state] || '';
      $message.html(html);
    }
    $overlay.attr('data-lock-state', state);
  }

  /**
   * Mark a panel as unlocked/locked and update aria attributes
   */
  private setPanelUnlocked($panel: JQuery<HTMLElement>, unlocked: boolean): void {
    $panel.attr('data-lock-unlocked', unlocked ? 'true' : 'false');
    const $content = $panel.find('[data-lock-content]').first();
    if ($content.length) {
      $content.attr('aria-hidden', unlocked ? 'false' : 'true');
    }

    const tabIndex = parseInt($panel.attr('data-lock-tab-index') || '0', 10);
    if (tabIndex > 0) {
      const $tabsContainer = $panel.closest('[data-addui="tabs"]');
      const $tab = $tabsContainer.find(`.addui-Tabs-tab[data-picanvas-tab-index="${tabIndex}"]`);
      if ($tab.length) {
        $tab.attr('data-lock-unlocked', unlocked ? 'true' : 'false');
      }
    }
  }

  private getUnlockTtlMinutes(): number {
    const raw = this.properties.lockUnlockTtlMinutes;
    const parsed = typeof raw === 'number' ? raw : parseInt(String(raw || ''), 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return 5;
    }
    return Math.min(Math.max(parsed, 1), 1440);
  }

  /**
   * Fetch and render RSS feed content asynchronously
   */
  private async fetchAndRenderRssFeed(tabInfo: {
    tabIndex: number;
    feedUrl: string;
    $contentHost: JQuery<HTMLElement>;
    layout: 'list' | 'cards' | 'compact';
    maxItems: number;
    showDate: boolean;
    showDescription: boolean;
    showImage: boolean;
    showAuthor: boolean;
    descriptionLimit: number;
    dateFormat: 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'relative';
    linkTarget: '_blank' | '_self';
  }): Promise<void> {
    try {
      // Validate URL
      if (!isValidFeedUrl(tabInfo.feedUrl)) {
        const errorResult = ContentRenderer.renderRssError(`Invalid feed URL: ${tabInfo.feedUrl}`);
        tabInfo.$contentHost.html(errorResult.html);
        return;
      }

      console.log(`[PiCanvas] Fetching RSS feed for tab ${tabInfo.tabIndex}: ${tabInfo.feedUrl}`);

      // Fetch feed with proxy fallback
      const feedContent = await fetchFeedWithProxy(tabInfo.feedUrl, { timeout: 20000 });

      // Parse feed
      const parsedFeed: IRssFeed = parseRSSFeed(feedContent, `tab-${tabInfo.tabIndex}`, {
        name: `Tab ${tabInfo.tabIndex}`
      });

      console.log(`[PiCanvas] Parsed ${parsedFeed.itemCount} items from feed`);

      // Prepare display config
      const displayConfig: IRssDisplayConfig = {
        layout: tabInfo.layout,
        showDate: tabInfo.showDate,
        showDescription: tabInfo.showDescription,
        showImage: tabInfo.showImage,
        showAuthor: tabInfo.showAuthor,
        descriptionLimit: tabInfo.descriptionLimit,
        dateFormat: tabInfo.dateFormat,
        linkTarget: tabInfo.linkTarget,
        maxItems: tabInfo.maxItems
      };

      // Map parsed items to render format
      const renderItems = parsedFeed.items.map(item => ({
        title: item.title,
        link: item.link,
        description: item.description,
        publishedDate: item.publishedDate,
        author: item.author,
        thumbnail: item.thumbnail
      }));

      // Render feed
      const rendered = ContentRenderer.renderRss(renderItems, displayConfig);
      tabInfo.$contentHost.html(rendered.html);

    } catch (error) {
      console.error(`[PiCanvas] Failed to fetch RSS feed:`, error);
      const errorMessage = (error as Error).message || 'Failed to load feed';
      const errorResult = ContentRenderer.renderRssError(errorMessage);
      tabInfo.$contentHost.html(errorResult.html);
    }
  }

  /**
   * Fetch and render profile reports asynchronously.
   * Full-page app: Explorer (card grid) → Detail (report viewer).
   */
  private async fetchAndRenderProfileReports(
    tabIndex: number,
    config: IProfileReportDisplayConfig,
    $contentHost: JQuery<HTMLElement>
  ): Promise<void> {
    try {
      console.log(`[PiCanvas] Fetching company list for tab ${tabIndex} from ${config.listName ? 'list: ' + config.listName : 'library: ' + config.libraryName}`);

      const service = new ProfileReportService(this.context);
      const themeService = new ThemeService(this.context);

      // Step 1: Fetch company list and external themes in parallel
      const [companies_raw, availableThemes] = await Promise.all([
        service.fetchCompanyList(config.libraryName, config.listName),
        themeService.getAllThemes(config.libraryName)
      ]);
      let companies = companies_raw;
      console.log(`[PiCanvas] Found ${companies.length} companies, ${availableThemes.length} themes`);

      if (companies.length === 0) {
        const emptyResult = ContentRenderer.renderProfileReportEmpty(config.libraryName);
        $contentHost.html(emptyResult.html);
        return;
      }

      // Step 1b: Check for persisted theme choice
      const reportPersistId = `tab${config.libraryName}`;
      const persistedThemeId = themeService.loadPersistedChoice(reportPersistId);
      if (persistedThemeId && availableThemes.some(t => t.id === persistedThemeId)) {
        config.theme = persistedThemeId;
      }

      // Step 2: Apply initial sorting
      if (config.sortBy === 'name') {
        companies.sort((a, b) => a.companyName.localeCompare(b.companyName));
      } else if (config.sortBy === 'date') {
        companies.sort((a, b) => (b.timeCreated || '').localeCompare(a.timeCreated || ''));
      } else {
        companies.sort((a, b) => a.domain.localeCompare(b.domain));
      }

      // Step 3: Apply limit (0 or undefined = no limit, show all companies)
      if (config.companyLimit && config.companyLimit > 0 && companies.length > config.companyLimit) {
        companies = companies.slice(0, config.companyLimit);
      }

      // Step 4: Pre-compute search index (all searchable fields for instant filtering)
      const searchIndex = companies.map(c =>
        (c.companyName + ' ' + c.domain + ' ' + (c.accountOwner || '') + ' ' + (c.industry || '') + ' ' + (c.sector || '') + ' ' + (c.ticker || '') + ' ' + (c.searchTerms || '')).toLowerCase()
      );

      // Step 5: Render shell (explorer + detail views) with available themes
      const rendered = ContentRenderer.renderProfileReportShell(companies, config, availableThemes);
      $contentHost.html(rendered.html);

      // Step 6: Initialize interactions (explorer navigation, detail loading)
      this.initializeProfileReportInteractions($contentHost, service, companies, searchIndex, config, themeService, availableThemes);

      // Step 7: Initialize display mode (always fullScreen — body-append portal)
      this.initializeProfileReportDisplayMode($contentHost);

      console.log(`[PiCanvas] Profile report rendering complete`);

    } catch (error) {
      console.error(`[PiCanvas] Failed to fetch profile reports:`, error);
      const errorMessage = (error as Error).message || 'Failed to load profile reports';
      const errorResult = ContentRenderer.renderProfileReportError(errorMessage);
      $contentHost.html(errorResult.html);
    }
  }

  /**
   * Load content for a single company into the detail body.
   * Single detail body — cleared and repopulated per company.
   */
  private async loadCompanyContent(
    $report: JQuery<HTMLElement>,
    service: ProfileReportService,
    libraryName: string,
    entry: ICompanyEntry,
    _companyIndex: number,
    config: IProfileReportDisplayConfig
  ): Promise<void> {
    const $body = $report.find('.pr-detail-body');
    if (!$body.length) return;

    // Show loading
    $body.html('<div class="profile-loading"><div class="loading-spinner"></div><span>Loading profile...</span></div>');

    try {
      const metadataConfig = config.enableMetadataDiscovery && config.metadataCompanyColumn
        ? { companyColumn: config.metadataCompanyColumn, fileCategoryColumn: config.metadataFileCategoryColumn || 'FileCategory' }
        : undefined;

      // Fetch profile files and company intel in parallel
      const listName = config.listName || '';
      const hasPiRadarId = entry.piRadarId !== undefined && entry.piRadarId !== null;
      const [profile, companyIntel] = await Promise.all([
        service.loadCompanyProfile(libraryName, entry, metadataConfig),
        (hasPiRadarId && listName)
          ? service.fetchCompanyIntel(listName, entry.piRadarId!)
          : Promise.resolve(null)
      ]);

      // Attach intel to profile before rendering
      if (companyIntel) {
        profile.companyIntel = companyIntel;
      }

      const panelHtml = ContentRenderer.renderCompanyPanel(profile, config);
      $body.html(panelHtml);
    } catch (error) {
      console.error(`[PiCanvas] Failed to load profile for ${entry.domain}:`, error);
      $body.html(`<div class="profile-error">Failed to load profile for ${ContentRenderer.encodeHtmlPublic(entry.domain)}</div>`);
    }
  }

  /**
   * Initialize interactive elements for the profile report full-page app.
   * Two-phase UI: Explorer (card grid) ↔ Detail (report viewer).
   */
  private initializeProfileReportInteractions(
    $container: JQuery<HTMLElement>,
    service: ProfileReportService,
    companies: ICompanyEntry[],
    searchIndex: string[],
    config: IProfileReportDisplayConfig,
    themeService?: ThemeService,
    availableThemes?: IProfileReportTheme[]
  ): void {
    if (!$container.length || !document.body.contains($container[0])) {
      console.warn('[PiCanvas] Profile report container not in DOM, skipping interaction setup');
      return;
    }

    // $report may be in $container or on document.body (after portal)
    let $report = $container.find('.picanvas-profilereport');
    if (!$report.length) $report = $(document).find('.picanvas-profilereport');

    // ---- State ----
    let currentView: 'explorer' | 'detail' = 'explorer';
    let currentCompanyIndex = -1;
    let filteredCompanies: Array<{ entry: ICompanyEntry; originalIndex: number }> = companies.map((c, i) => ({ entry: c, originalIndex: i }));
    let renderedCardCount = 0;
    let explorerScrollTop = 0;
    const BATCH_SIZE = 200;

    // Sort state
    let currentSortBy = config.sortBy || 'name';
    let currentSearchQuery = '';

    // ---- Helpers ----

    const getActiveFilters = (): Record<string, string> => {
      const filters: Record<string, string> = {};
      $report.find('.pr-filter-select').each(function () {
        const $sel = $(this);
        const filterKey = $sel.attr('data-filter') || '';
        const val = ($sel.val() as string) || '';
        if (filterKey && val) filters[filterKey] = val;
      });
      return filters;
    };

    const updateFilterChips = (): void => {
      const $chips = $report.find('.pr-filter-chips');
      const filters = getActiveFilters();
      const chipEntries = Object.entries(filters);
      let chipHtml = chipEntries.map(([key, value]) =>
        `<span class="pr-filter-chip" data-filter-key="${ContentRenderer.encodeHtmlPublic(key)}">${ContentRenderer.encodeHtmlPublic(value)}<button class="pr-filter-chip-remove" data-filter-key="${ContentRenderer.encodeHtmlPublic(key)}">&times;</button></span>`
      ).join('');
      // Add "Clear all" button when multiple filters are active
      if (chipEntries.length > 1) {
        chipHtml += `<button class="pr-filter-clear-all">Clear all</button>`;
      }
      $chips.html(chipHtml);
    };

    // ---- Build filtered list ----

    const buildFilteredList = (): void => {
      const query = ($report.find('.pr-explorer-search').val() as string || '').toLowerCase().trim();
      currentSearchQuery = query;
      const filters = getActiveFilters();
      const hasFilters = Object.keys(filters).length > 0;

      // Filter
      const matches: Array<{ entry: ICompanyEntry; originalIndex: number }> = [];
      for (let i = 0; i < companies.length; i++) {
        const c = companies[i];

        // Dropdown filters (exact match)
        if (hasFilters) {
          if (filters.accountOwner && (c.accountOwner || '') !== filters.accountOwner) continue;
          if (filters.ownerRegion && (c.ownerRegion || '') !== filters.ownerRegion) continue;
          if (filters.industry && (c.industry || '') !== filters.industry) continue;
          if (filters.sector && (c.sector || '') !== filters.sector) continue;
        }

        // Text search (indexOf on precomputed searchIndex)
        if (query && searchIndex[i].indexOf(query) === -1) continue;

        matches.push({ entry: c, originalIndex: i });
      }

      // Apply sort
      if (currentSortBy === 'name') {
        matches.sort((a, b) => a.entry.companyName.localeCompare(b.entry.companyName));
      } else if (currentSortBy === 'date') {
        matches.sort((a, b) => (b.entry.timeCreated || '').localeCompare(a.entry.timeCreated || ''));
      } else {
        matches.sort((a, b) => a.entry.domain.localeCompare(b.entry.domain));
      }

      filteredCompanies = matches;
      renderedCardCount = 0;

      // Clear grid and render first batch
      const $grid = $report.find('.pr-explorer-grid');
      $grid.find('.pr-company-card').remove();
      renderNextBatch();

      // Update count — show "Showing X of Y" when filtered
      const totalCount = companies.length;
      const matchCount = matches.length;
      const matchLabel = matchCount >= 1000 ? `${(matchCount / 1000).toFixed(1)}K` : `${matchCount}`;
      const totalLabel = totalCount >= 1000 ? `${(totalCount / 1000).toFixed(1)}K` : `${totalCount}`;
      const isFiltered = query || Object.keys(filters).length > 0;
      $report.find('.pr-explorer-count').text(
        isFiltered ? `${matchLabel} of ${totalLabel} companies` : `${totalLabel} companies`
      );

      // Show/hide no-results message
      const $noResults = $report.find('.pr-no-results');
      if (matchCount === 0 && isFiltered) {
        $noResults.show();
      } else {
        $noResults.hide();
      }

      // Update filter chips
      updateFilterChips();

      // Scroll grid to top on filter change
      const grid = $report.find('.pr-explorer-grid')[0];
      if (grid) grid.scrollTop = 0;
    };

    // ---- Progressive card rendering ----

    const renderNextBatch = (): void => {
      if (renderedCardCount >= filteredCompanies.length) {
        $report.find('.pr-grid-sentinel').hide();
        return;
      }

      const end = Math.min(renderedCardCount + BATCH_SIZE, filteredCompanies.length);
      const fragment = document.createDocumentFragment();

      for (let i = renderedCardCount; i < end; i++) {
        const { entry, originalIndex } = filteredCompanies[i];
        const cardHtml = ContentRenderer.renderCompanyCard(entry, originalIndex, currentSearchQuery || undefined);
        const temp = document.createElement('div');
        temp.innerHTML = cardHtml;
        if (temp.firstElementChild) {
          // Store the filtered index on the card for prev/next navigation
          (temp.firstElementChild as HTMLElement).setAttribute('data-filtered-index', String(i));
          fragment.appendChild(temp.firstElementChild);
        }
      }

      const sentinel = $report.find('.pr-grid-sentinel')[0];
      if (sentinel && sentinel.parentElement) {
        sentinel.parentElement.insertBefore(fragment, sentinel);
      }

      renderedCardCount = end;

      // Show/hide sentinel
      if (renderedCardCount < filteredCompanies.length) {
        $report.find('.pr-grid-sentinel').show();
      } else {
        $report.find('.pr-grid-sentinel').hide();
      }
    };

    // ---- IntersectionObserver for progressive loading ----

    const setupIntersectionObserver = (): void => {
      const sentinel = $report.find('.pr-grid-sentinel')[0];
      const grid = $report.find('.pr-explorer-grid')[0];
      if (!sentinel || !grid) return;

      const observer = new IntersectionObserver((entries) => {
        if (entries[0]?.isIntersecting) {
          renderNextBatch();
        }
      }, { root: grid, rootMargin: '200px' });

      observer.observe(sentinel);

      // Store for cleanup
      ($report[0] as any)._prGridObserver = observer;
    };

    // ---- Navigation ----

    const navigateToDetail = async (filteredIndex: number): Promise<void> => {
      if (filteredIndex < 0 || filteredIndex >= filteredCompanies.length) return;

      // Save explorer scroll position
      const grid = $report.find('.pr-explorer-grid')[0];
      if (grid) explorerScrollTop = grid.scrollTop;

      currentCompanyIndex = filteredIndex;
      const { entry, originalIndex } = filteredCompanies[filteredIndex];

      // Update header
      $report.find('.pr-detail-header').html(
        ContentRenderer.renderDetailHeader(entry, filteredIndex, filteredCompanies.length)
      );

      // Switch view
      currentView = 'detail';
      $report.attr('data-view', 'detail');

      // Load content
      await this.loadCompanyContent($report, service, config.libraryName, entry, originalIndex, config);
    };

    const navigateToExplorer = (): void => {
      currentView = 'explorer';
      $report.attr('data-view', 'explorer');

      // Restore scroll position
      requestAnimationFrame(() => {
        const grid = $report.find('.pr-explorer-grid')[0];
        if (grid) grid.scrollTop = explorerScrollTop;
      });
    };

    const navigatePrev = async (): Promise<void> => {
      if (currentCompanyIndex > 0) {
        await navigateToDetail(currentCompanyIndex - 1);
      }
    };

    const navigateNext = async (): Promise<void> => {
      if (currentCompanyIndex < filteredCompanies.length - 1) {
        await navigateToDetail(currentCompanyIndex + 1);
      }
    };

    // ---- Event Handlers ----

    // Card click → detail
    $report.on('click.profilereport', '.pr-company-card', async (e) => {
      const $card = $(e.currentTarget);
      const filteredIndex = parseInt($card.attr('data-filtered-index') || '0', 10);
      await navigateToDetail(filteredIndex);
    });

    // Back button → explorer
    $report.on('click.profilereport', '.pr-back-btn', () => {
      navigateToExplorer();
    });

    // Prev/Next navigation
    $report.on('click.profilereport', '.pr-detail-nav-prev', async () => {
      await navigatePrev();
    });
    $report.on('click.profilereport', '.pr-detail-nav-next', async () => {
      await navigateNext();
    });

    // Search input (debounced) + clear button toggle
    let searchTimeout: ReturnType<typeof setTimeout> | null = null;
    $report.on('input.profilereport', '.pr-explorer-search', () => {
      if (searchTimeout) clearTimeout(searchTimeout);
      searchTimeout = setTimeout(buildFilteredList, 150);
      // Toggle clear button visibility
      const val = ($report.find('.pr-explorer-search').val() as string || '');
      $report.find('.pr-search-clear').toggle(val.length > 0);
    });

    // Clear search button
    $report.on('click.profilereport', '.pr-search-clear', () => {
      $report.find('.pr-explorer-search').val('').focus();
      $report.find('.pr-search-clear').hide();
      buildFilteredList();
    });

    // Filter dropdown change — also toggle active class for visual feedback
    $report.on('change.profilereport', '.pr-filter-select', function () {
      const $sel = $(this);
      $sel.toggleClass('pr-filter-active', !!$sel.val());
      buildFilteredList();
    });

    // Sort control change
    $report.on('change.profilereport', '.pr-sort-control', (e) => {
      currentSortBy = (($(e.currentTarget).val() as string) || 'name') as 'name' | 'date' | 'key';
      buildFilteredList();
    });

    // Filter chip remove
    $report.on('click.profilereport', '.pr-filter-chip-remove', (e) => {
      const filterKey = $(e.currentTarget).attr('data-filter-key') || '';
      if (filterKey) {
        $report.find(`.pr-filter-select[data-filter="${filterKey}"]`).val('').removeClass('pr-filter-active');
        buildFilteredList();
      }
    });

    // Clear all filters
    $report.on('click.profilereport', '.pr-filter-clear-all', () => {
      $report.find('.pr-filter-select').val('').removeClass('pr-filter-active');
      buildFilteredList();
    });

    // Theme toggle — uses ThemeService for inline token application + persistence
    let autoModeCleanup: (() => void) | null = null;
    const themes = availableThemes || BUILTIN_THEMES;

    const applySelectedTheme = (themeId: string): void => {
      // Clean up any previous auto mode listener
      if (autoModeCleanup) {
        autoModeCleanup();
        autoModeCleanup = null;
      }

      const reportEl = $report[0];
      if (!reportEl || !themeService) {
        // Fallback: basic data-attr swap (no ThemeService)
        $report.attr('data-theme', themeId);
        return;
      }

      if (themeId === 'auto') {
        const lightTheme = themes.find(t => t.id === 'light') || themes.find(t => t.mode === 'light');
        const darkTheme = themes.find(t => t.id === 'dark') || themes.find(t => t.mode === 'dark');
        if (lightTheme && darkTheme) {
          autoModeCleanup = themeService.setupAutoMode(reportEl, lightTheme, darkTheme);
        } else {
          $report.attr('data-theme', 'auto');
        }
      } else {
        const theme = themes.find(t => t.id === themeId);
        if (theme) {
          themeService.clearTheme(reportEl);
          themeService.applyTheme(reportEl, theme);
        } else {
          themeService.clearTheme(reportEl);
          $report.attr('data-theme', themeId);
        }
      }

      // Persist choice
      const reportPersistId = `tab${config.libraryName}`;
      themeService.persistChoice(reportPersistId, themeId);
    };

    // Apply initial theme on load
    if (themeService && config.theme !== 'auto') {
      applySelectedTheme(config.theme);
    } else if (themeService && config.theme === 'auto') {
      applySelectedTheme('auto');
    }

    $report.on('click.profilereport', '.pr-theme-btn', (e) => {
      const $btn = $(e.currentTarget);
      const themeValue = $btn.attr('data-theme-value') || 'auto';
      $report.find('.pr-theme-btn').removeClass('active');
      $btn.addClass('active');
      applySelectedTheme(themeValue);
    });

    // Method tab switching (within detail view)
    $report.on('click.profilereport', '.method-tab', (e) => {
      const $btn = $(e.currentTarget);
      const methodKey = $btn.attr('data-method-key');
      const $tabContainer = $btn.closest('.method-tabs-container');

      $tabContainer.find('.method-tab').removeClass('active');
      $btn.addClass('active');

      $tabContainer.find('.method-panel').removeClass('active');
      $tabContainer.find(`.method-panel[data-method-key="${methodKey}"]`).addClass('active');
    });

    // Metadata file view buttons
    $report.on('click.profilereport', '.pr-metadata-file-load', async (e) => {
      const $btn = $(e.currentTarget);
      const fileUrl = $btn.attr('data-file-url') || '';
      const fileExt = $btn.attr('data-file-ext') || '';
      const $panel = $btn.closest('.method-panel');
      const $viewer = $panel.find('.pr-metadata-file-viewer');

      if (!fileUrl || !$viewer.length) return;

      $panel.find('.pr-metadata-file-item').removeClass('active');
      $btn.closest('.pr-metadata-file-item').addClass('active');

      $viewer.addClass('active').html('<div class="profile-loading"><div class="loading-spinner"></div><span>Loading file...</span></div>');

      try {
        const content = await service.fetchFileContent(fileUrl);
        let renderedContent: string;

        if (fileExt === 'json') {
          try {
            const parsed = JSON.parse(content);
            renderedContent = `<pre>${ContentRenderer.encodeHtmlPublic(JSON.stringify(parsed, null, 2))}</pre>`;
          } catch {
            renderedContent = `<pre>${ContentRenderer.encodeHtmlPublic(content)}</pre>`;
          }
        } else if (fileExt === 'md') {
          const result = ContentRenderer.renderMarkdown(content);
          renderedContent = `<div class="markdown">${result.html}</div>`;
        } else if (fileExt === 'html' || fileExt === 'htm') {
          renderedContent = ContentRenderer.renderHtml(content).html;
        } else {
          renderedContent = `<pre>${ContentRenderer.encodeHtmlPublic(content)}</pre>`;
        }

        $viewer.html(renderedContent);
      } catch (error) {
        console.error('[PiCanvas] Failed to load metadata file:', error);
        $viewer.html(`<div class="profile-error">Failed to load file: ${ContentRenderer.encodeHtmlPublic((error as Error).message || 'Unknown error')}</div>`);
      }
    });

    // Keyboard navigation
    const keyHandler = (e: KeyboardEvent): void => {
      if (currentView === 'detail') {
        if (e.key === 'Escape') {
          navigateToExplorer();
          e.preventDefault();
        } else if (e.key === 'ArrowLeft') {
          navigatePrev();
          e.preventDefault();
        } else if (e.key === 'ArrowRight') {
          navigateNext();
          e.preventDefault();
        }
      } else if (currentView === 'explorer') {
        if (e.key === 'Escape') {
          // If search has value, clear it first; otherwise close handled by display mode
          const $search = $report.find('.pr-explorer-search');
          if ($search.val()) {
            $search.val('');
            $report.find('.pr-search-clear').hide();
            buildFilteredList();
            e.preventDefault();
          }
        }
      }
      // Cmd/Ctrl+F focuses search (when in explorer view)
      if ((e.metaKey || e.ctrlKey) && e.key === 'f' && currentView === 'explorer') {
        e.preventDefault();
        const searchInput = $report.find('.pr-explorer-search')[0] as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
      }
    };
    document.addEventListener('keydown', keyHandler);
    ($report[0] as any)._prKeyHandler = keyHandler;

    // Initialize: build initial list + observer
    setupIntersectionObserver();

    console.log(`[PiCanvas] Profile report interactions initialized for ${companies.length} companies (explorer/detail mode)`);
  }

  /**
   * Initialize display mode for profile report viewer.
   * Always fullScreen — body-append portal with edit mode detection.
   */
  private initializeProfileReportDisplayMode(
    $container: JQuery<HTMLElement>
  ): void {
    const $report = $container.find('.picanvas-profilereport');
    if (!$report.length) return;

    const reportEl = $report[0];

    // --- Edit mode detection ---
    const urlHasEditMode = window.location.href.toLowerCase().includes('mode=edit');
    const hasDesignModeClass = document.body.classList.contains('sp-pageLayout-designMode');
    const hasEditButton = !!document.querySelector('[data-automation-id="pageEditButton"][aria-pressed="true"]');
    const hasEditingMode = !!document.querySelector('.od-EditingMode');
    const hasSlotManager = !!document.querySelector('[data-automation-id="fabricSlotManager"]');
    const hasCanvasToolbar = !!document.querySelector('[data-automation-id="canvasToolboxAddButton"]');
    const isEditMode = urlHasEditMode || hasDesignModeClass || hasEditButton || hasEditingMode || hasSlotManager || hasCanvasToolbar;

    if (isEditMode) {
      console.log('[PiCanvas] Edit mode detected — profile report falling back to contained');
      reportEl.style.cssText = '';
      reportEl.setAttribute('data-display-mode', 'contained');
      return;
    }

    // --- Body-append portal ---
    if (reportEl.parentElement !== document.body) {
      const placeholder = document.createElement('div');
      placeholder.className = 'pr-display-placeholder';
      placeholder.setAttribute('data-report-id', reportEl.id);
      placeholder.style.display = 'none';
      reportEl.parentElement?.insertBefore(placeholder, reportEl);
      document.body.appendChild(reportEl);

      ContentRenderer.injectEditButton(reportEl, 'fullScreen');

      console.log('[PiCanvas] Profile report moved to body (fullScreen mode)');
    }

    // Focus search input
    const searchInput = $report.find('.pr-explorer-search')[0] as HTMLInputElement;
    if (searchInput) requestAnimationFrame(() => searchInput.focus());

    // --- Return to contained (exit) ---
    const returnToContained = (): void => {
      reportEl.style.cssText = '';
      reportEl.setAttribute('data-display-mode', 'contained');

      const placeholder = document.querySelector(`.pr-display-placeholder[data-report-id="${reportEl.id}"]`);
      if (placeholder && placeholder.parentElement) {
        placeholder.parentElement.insertBefore(reportEl, placeholder);
        placeholder.remove();
      }

      const editBtn = reportEl.querySelector('.picanvas-edit-button');
      if (editBtn) editBtn.remove();

      console.log('[PiCanvas] Profile report returned to contained mode');
    };

    // Close button
    $report.on('click.profilereport', '.pr-display-close', () => returnToContained());

    // Escape key (only when in explorer view — detail view Escape is handled by interactions)
    const escHandler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && reportEl.getAttribute('data-view') === 'explorer' && reportEl.getAttribute('data-display-mode') !== 'contained') {
        returnToContained();
      }
    };
    document.addEventListener('keydown', escHandler);

    // beforeprint
    const printHandler = (): void => {
      if (reportEl.getAttribute('data-display-mode') !== 'contained') {
        returnToContained();
      }
    };
    window.addEventListener('beforeprint', printHandler);

    // Cleanup reference
    (reportEl as any)._prDisplayCleanup = (): void => {
      returnToContained();
      document.removeEventListener('keydown', escHandler);
      window.removeEventListener('beforeprint', printHandler);
      const keyHandler = (reportEl as any)._prKeyHandler;
      if (keyHandler) document.removeEventListener('keydown', keyHandler);
      const observer = (reportEl as any)._prGridObserver;
      if (observer) observer.disconnect();
    };

    console.log('[PiCanvas] Profile report display mode initialized: fullScreen');
  }

  /**
   * Fetch and render external file content asynchronously
   */
  private async fetchAndRenderFileContent(
    tabIndex: number,
    fileUrl: string,
    fileType: 'html' | 'markdown',
    $contentHost: JQuery<HTMLElement>
  ): Promise<void> {
    try {
      console.log(`[PiCanvas] Fetching file for tab ${tabIndex}: ${fileUrl}`);

      // Build the REST API URL to fetch file content
      const siteUrl = this.context.pageContext.web.absoluteUrl;
      const serverRelativeUrl = fileUrl.startsWith('/') ? fileUrl : `/${fileUrl}`;
      const apiUrl = `${siteUrl}/_api/web/GetFileByServerRelativeUrl('${encodeURIComponent(serverRelativeUrl)}')/$value`;

      // Fetch file content via SPHttpClient
      const { SPHttpClient } = await import('@microsoft/sp-http');
      const response = await this.context.spHttpClient.get(
        apiUrl,
        SPHttpClient.configurations.v1
      );

      if (!response.ok) {
        throw new Error(`Failed to load file: ${response.status} ${response.statusText}`);
      }

      const content = await response.text();
      console.log(`[PiCanvas] Loaded file (${content.length} chars)`);

      // Substitute metadata tokens before rendering
      const contentWithTokens = this._metadataTokenService
        ? this._metadataTokenService.substituteTokensSync(content)
        : content;

      // Render based on file type
      const rendered = ContentRenderer.renderFileContent(contentWithTokens, fileType);
      $contentHost.html(rendered.html);

    } catch (error) {
      console.error(`[PiCanvas] Failed to fetch file:`, error);
      const errorMessage = (error as Error).message || 'Failed to load file';
      const errorResult = ContentRenderer.renderFileError(errorMessage);
      $contentHost.html(errorResult.html);
    }
  }

  /**
   * Trigger lazy-load behavior for a panel that just unlocked
   */
  private triggerLazyLoadForPanel($panel: JQuery<HTMLElement>): void {
    const shouldTriggerLazy = $panel.attr('data-lazy') === 'true' && $panel.attr('data-lazy-loaded') !== 'true';
    if (shouldTriggerLazy) {
      $panel.attr('data-lazy-loaded', 'true');
      const tabIndex = parseInt($panel.attr('data-lock-tab-index') || '0', 10) - 1;
      $panel.trigger('picanvas:lazy-load', { tabIndex: Math.max(tabIndex, 0) });
    }

    $panel.find('iframe[data-src]').each(function () {
      const $iframe = $(this);
      const src = $iframe.attr('data-src');
      if (src) {
        $iframe.attr('src', src);
        $iframe.removeAttr('data-src');
      }
    });
  }

  /**
   * Initialize lock behavior for all locked tab panels
   */
  private initializeTabLocks(tabsDiv: string): void {
    const lockService = this._lockService;
    if (!lockService) return;

    const tabsElement = document.getElementById(tabsDiv);
    if (!tabsElement) return;

    const $tabsContainer = $(tabsElement).parent('[data-addui="tabs"]');
    if (!$tabsContainer.length) return;

    $tabsContainer.find('.addui-Tabs-content[data-lock-enabled="true"]').each((_i, el) => {
      const $panel = $(el);
      if ($panel.attr('data-lock-initialized') === 'true') {
        return;
      }
      $panel.attr('data-lock-initialized', 'true');

      const tabIndex = parseInt($panel.attr('data-lock-tab-index') || '0', 10);
      if (!tabIndex) return;

      const passwordHash = (this.properties[`tab${tabIndex}LockPasswordHash`] as string) || '';
      const hasPassword = !!passwordHash;

      const $overlay = $panel.find('[data-picanvas-lock-overlay]').first();
      if (!$overlay.length) return;

      const $input = $overlay.find('[data-picanvas-lock-input]').first();
      const $submit = $overlay.find('[data-picanvas-lock-submit]').first();

      if (!hasPassword) {
        this.setLockOverlayState($overlay, 'missing');
        if ($input.length) $input.prop('disabled', true);
        if ($submit.length) $submit.prop('disabled', true);
        this.setPanelUnlocked($panel, false);
        return;
      }

      if (lockService.isUnlocked(tabIndex, passwordHash)) {
        this.setPanelUnlocked($panel, true);
        return;
      }

      this.setPanelUnlocked($panel, false);
      this.setLockOverlayState($overlay, 'prompt');

      const attemptUnlock = async (): Promise<void> => {
        const entered = String($input.val() || '').trim();
        if (!entered) {
          this.setLockOverlayState($overlay, 'error');
          return;
        }

        $overlay.attr('data-lock-busy', 'true');
        const isValid = await lockService.verifyPassword(entered, passwordHash);
        $overlay.attr('data-lock-busy', 'false');

        if (isValid) {
          if ($input.length) {
            $input.val('');
          }
          lockService.rememberUnlock(tabIndex, passwordHash, this.getUnlockTtlMinutes());
          this.setLockOverlayState($overlay, 'success');
          this.setPanelUnlocked($panel, true);
          this.triggerLazyLoadForPanel($panel);
        } else {
          if ($input.length) {
            $input.val('');
          }
          this.setLockOverlayState($overlay, 'error');
        }
      };

      if ($submit.length) {
        $submit.on('click', (e: JQuery.Event) => {
          e.preventDefault();
          void attemptUnlock();
        });
      }

      if ($input.length) {
        $input.on('keydown', (e: JQuery.Event) => {
          const key = (e as unknown as KeyboardEvent).key;
          if (key === 'Enter') {
            e.preventDefault();
            void attemptUnlock();
          }
        });
      }
    });
  }

  /**
   * Initialize Mermaid diagrams and JavaScript for the first active tab (v3.0)
   * Other tabs will be initialized via lazy loading
   */
  private initializeMermaidDiagrams(tabsDiv: string): void {
    // Use getElementById to handle IDs with special characters (base64 =, +, /)
    const tabsElement = document.getElementById(tabsDiv);
    if (!tabsElement) {
      console.warn('[PiCanvas] Could not find tabs element for mermaid initialization:', tabsDiv);
      return;
    }

    console.log('[PiCanvas] Looking for mermaid containers in active tab...');
    console.log('[PiCanvas] tabsElement:', tabsElement);
    console.log('[PiCanvas] siblings:', $(tabsElement).siblings().length);

    // Find first active tab's mermaid containers
    // The structure is: tabHolder (tabsElement) + content panels (.addui-Tabs-content) as siblings
    const $activePanel = $(tabsElement).siblings('.addui-Tabs-content.addui-Tabs-active');
    if ($activePanel.attr('data-lock-enabled') === 'true' && $activePanel.attr('data-lock-unlocked') !== 'true') {
      return;
    }
    const $activeContent = $activePanel.find('.picanvas-mermaid-container');
    const $jsContent = $activePanel.find('.picanvas-js-container');

    console.log('[PiCanvas] Found mermaid containers:', $activeContent.length);
    console.log('[PiCanvas] Found JavaScript containers:', $jsContent.length);

    if ($activeContent.length === 0 && $jsContent.length === 0) {
      // Try alternate selector - the content might be inside the parent container
      const $parent = $(tabsElement).parent('[data-addui="tabs"]');
      const $altPanel = $parent.find('.addui-Tabs-content.addui-Tabs-active');
      if ($altPanel.attr('data-lock-enabled') === 'true' && $altPanel.attr('data-lock-unlocked') !== 'true') {
        return;
      }
      const $altContent = $altPanel.find('.picanvas-mermaid-container');
      const $altJsContent = $altPanel.find('.picanvas-js-container');
      console.log('[PiCanvas] Alt selector found mermaid:', $altContent.length);
      console.log('[PiCanvas] Alt selector found JavaScript:', $altJsContent.length);

      $altContent.each((_i, el) => {
        console.log('[PiCanvas] Rendering mermaid (alt):', el);
        ContentRenderer.renderMermaidElement(el as HTMLElement).catch(err => {
          console.warn('[PiCanvas] Failed to render mermaid diagram:', err);
        });
      });

      $altJsContent.each((_i, el) => {
        console.log('[PiCanvas] Executing JavaScript (alt):', el);
        ContentRenderer.executeJavaScriptElement(el as HTMLElement);
      });

      // Initialize TOC elements (alt path)
      $altPanel.find('.picanvas-toc-wrapper:not(.picanvas-toc-initialized)').each((_i, el) => {
        this.initializeTocElement(el as HTMLElement);
      });
      $altPanel.find('[data-inline-toc="true"]:not([data-inline-toc-done])').each((_i, el) => {
        this.initializeInlineToc(el as HTMLElement);
      });
      return;
    }

    $activeContent.each((_i, el) => {
      console.log('[PiCanvas] Rendering mermaid:', el);
      ContentRenderer.renderMermaidElement(el as HTMLElement).catch(err => {
        console.warn('[PiCanvas] Failed to render mermaid diagram:', err);
      });
    });

    $jsContent.each((_i, el) => {
      console.log('[PiCanvas] Executing JavaScript:', el);
      ContentRenderer.executeJavaScriptElement(el as HTMLElement);
    });

    // Initialize TOC elements in the active panel
    $activePanel.find('.picanvas-toc-wrapper:not(.picanvas-toc-initialized)').each((_i, el) => {
      this.initializeTocElement(el as HTMLElement);
    });
    $activePanel.find('[data-inline-toc="true"]:not([data-inline-toc-done])').each((_i, el) => {
      this.initializeInlineToc(el as HTMLElement);
    });
  }

  /**
   * Initialize a page-level TOC element
   * Reads config from data attributes, scans page headings, renders TOC, attaches scroll handlers
   */
  private initializeTocElement(el: HTMLElement): void {
    if (el.classList.contains('picanvas-toc-initialized')) return;
    el.classList.add('picanvas-toc-initialized');

    const encodedConfig = el.getAttribute('data-toc-config') || '';
    let config: ITocConfig = TocService.DEFAULT_CONFIG;
    try {
      const decoded = decodeURIComponent(atob(encodedConfig));
      config = { ...TocService.DEFAULT_CONFIG, ...JSON.parse(decoded) };
    } catch (e) {
      console.warn('[PiCanvas] Failed to parse TOC config:', e);
    }

    // Track scrollspy cleanup for this specific TOC element
    let localScrollspyCleanup: (() => void) | null = null;

    // Helper: attach all interaction handlers after render
    const attachInteractions = (): void => {
      TocService.attachScrollHandlers(el);

      // Scrollspy
      if (config.enableScrollspy) {
        localScrollspyCleanup = TocService.attachScrollspy(el);
        if (localScrollspyCleanup) {
          this._tocScrollspyCleanups.push(localScrollspyCleanup);
        }
      }

      // Collapsible sections
      if (config.enableCollapsible) {
        TocService.attachCollapsibleHandlers(el);
      }

      // Click ripple
      if (config.enableClickRipple) {
        TocService.attachClickRipple(el);
      }
    };

    // Perform initial scan and render
    const renderToc = (): string => {
      const headings = TocService.scanPageHeadings(config);
      const tree = TocService.buildHeadingTree(headings);
      return TocService.renderToc(tree, config);
    };

    el.innerHTML = renderToc();
    attachInteractions();

    // Set up periodic re-scan (headings may load asynchronously)
    let stableCount = 0;
    let lastHtml = el.innerHTML;

    const intervalId = setInterval(() => {
      const newHtml = renderToc();
      if (newHtml === lastHtml) {
        stableCount++;
        if (stableCount >= 3) {
          // Content is stable, stop re-scanning
          clearInterval(intervalId);
          this._tocIntervals.delete(intervalId as unknown as number);
        }
      } else {
        stableCount = 0;
        lastHtml = newHtml;
        el.innerHTML = newHtml;
        // Clean up previous scrollspy for this element before re-attaching
        if (localScrollspyCleanup) {
          const idx = this._tocScrollspyCleanups.indexOf(localScrollspyCleanup);
          if (idx >= 0) this._tocScrollspyCleanups.splice(idx, 1);
          localScrollspyCleanup();
          localScrollspyCleanup = null;
        }
        attachInteractions();
      }
    }, 500);

    this._tocIntervals.set(intervalId as unknown as number, intervalId);
  }

  /**
   * Initialize an inline (within-tab) TOC
   * Scans the parent container for headings and renders a compact TOC
   */
  private initializeInlineToc(placeholderEl: HTMLElement): void {
    if (placeholderEl.getAttribute('data-inline-toc-done') === 'true') return;
    placeholderEl.setAttribute('data-inline-toc-done', 'true');

    // Find the content container (parent tab-content div)
    const container = placeholderEl.closest('.picanvas-tab-content') as HTMLElement;
    if (!container) return;

    const minHeadings = parseInt(container.getAttribute('data-inline-toc-min') || '3', 10);
    const maxLevel = parseInt(container.getAttribute('data-inline-toc-max-level') || '3', 10);

    const headings = TocService.scanElementHeadings(container, maxLevel);
    if (headings.length < minHeadings) {
      // Not enough headings - remove placeholder
      placeholderEl.remove();
      return;
    }

    const tree = TocService.buildHeadingTree(headings);
    const tocHtml = TocService.renderInlineToc(tree);
    placeholderEl.innerHTML = tocHtml;

    // Attach scroll handlers that scroll within the tab content
    const scrollParent = container.closest('.addui-Tabs-content') as HTMLElement || container;
    TocService.attachInlineScrollHandlers(placeholderEl, scrollParent);
  }

  /**
   * Initialize deep linking support (v3.0)
   * Reads URL hash and activates corresponding tab, updates hash on tab change
   */
  private initializeDeepLinking(tabsDiv: string): void {
    // Check if deep linking is enabled (default: true)
    if (this.properties.enableDeepLinking === false) {
      return;
    }

    // Use getElementById to handle IDs with special characters (base64 =, +, /)
    const tabsElement = document.getElementById(tabsDiv);
    if (!tabsElement) return;

    const $tabsContainer = $(tabsElement).parent('[data-addui="tabs"]');
    if (!$tabsContainer.length) return;

    // Get the activation function exposed by AddTabs.js
    const activateTab = $tabsContainer.data('picanvas-activate-tab');
    const findTab = $tabsContainer.data('picanvas-find-tab');

    if (!activateTab || !findTab) return;

    // Read URL hash on initial load
    const hash = window.location.hash.substring(1); // Remove #
    if (hash) {
      // Try to find tab by label text first
      let tabIndex = findTab(hash);

      // If not found by label, try numeric index (e.g., #tab-2)
      if (tabIndex === -1 && hash.match(/^tab-\d+$/)) {
        tabIndex = parseInt(hash.replace('tab-', ''), 10) - 1;
      }

      if (tabIndex >= 0) {
        activateTab(tabIndex);
      }
    }

    // Listen for tab changes and update URL hash
    $tabsContainer.on('picanvas:tab-change', (_e: JQuery.Event, data: { tabIndex: number; tabElement: JQuery }) => {
      const $tab = data.tabElement;
      const tabText = $tab.text().trim().toLowerCase().replace(/\s+/g, '-');
      const newHash = tabText || `tab-${data.tabIndex + 1}`;

      // Update URL without triggering page scroll
      if (history.replaceState) {
        history.replaceState(null, '', `#${newHash}`);
      }
    });
  }

  /**
   * Initialize lazy loading event handlers (v3.0)
   * Listens for tab activation and initializes mermaid diagrams in lazy-loaded panels
   */
  private initializeLazyLoadEvents(tabsDiv: string): void {
    // Check if lazy loading is enabled (default: true)
    if (this.properties.enableLazyLoading === false) {
      return;
    }

    // Use getElementById to handle IDs with special characters (base64 =, +, /)
    const tabsElement = document.getElementById(tabsDiv);
    if (!tabsElement) return;

    const $tabsContainer = $(tabsElement).parent('[data-addui="tabs"]');
    if (!$tabsContainer.length) return;

    // Listen for lazy load events from AddTabs.js
    $tabsContainer.on('picanvas:lazy-load', '.picanvas-tab-content', (e: JQuery.TriggeredEvent) => {
      const $panel = $(e.currentTarget as HTMLElement);
      if ($panel.attr('data-lock-enabled') === 'true' && $panel.attr('data-lock-unlocked') !== 'true') {
        return;
      }

      // Initialize mermaid diagrams in this panel
      const $mermaidContainers = $panel.find('.picanvas-mermaid-container');
      $mermaidContainers.each((_i, el) => {
        ContentRenderer.renderMermaidElement(el as HTMLElement).catch(err => {
          console.warn('[PiCanvas] Failed to render lazy-loaded mermaid diagram:', err);
        });
      });

      // Initialize JavaScript containers in this panel
      const $jsContainers = $panel.find('.picanvas-js-container');
      $jsContainers.each((_i, el) => {
        ContentRenderer.executeJavaScriptElement(el as HTMLElement);
      });

      // Initialize TOC elements in this panel
      $panel.find('.picanvas-toc-wrapper:not(.picanvas-toc-initialized)').each((_i, el) => {
        this.initializeTocElement(el as HTMLElement);
      });
      $panel.find('[data-inline-toc="true"]:not([data-inline-toc-done])').each((_i, el) => {
        this.initializeInlineToc(el as HTMLElement);
      });
    });
  }

  /**
   * Initialize shared webpart handling - moves webparts between tabs when the same
   * webpart is assigned to multiple tabs. Since React components can't be cloned,
   * we move the single instance to whichever tab is currently active.
   */
  private initializeSharedWebpartHandling(tabsDiv: string, usedElements: Map<string, JQuery<HTMLElement>>): void {
    const tabsElement = document.getElementById(tabsDiv);
    if (!tabsElement) return;

    const $tabsContainer = $(tabsElement).parent('[data-addui="tabs"]');
    if (!$tabsContainer.length) return;

    // Listen for tab changes
    $tabsContainer.on('picanvas:tab-change', (_e: JQuery.Event, data: { tabIndex: number; panelElement: JQuery }) => {
      const $activePanel = data.panelElement;

      // Execute any JavaScript containers in this panel that haven't been executed yet
      // This handles the case when lazy loading is disabled
      const $jsContainers = $activePanel.find('.picanvas-js-container:not(.picanvas-js-executed)');
      $jsContainers.each((_i, el) => {
        console.log('[PiCanvas] Tab change: Executing JavaScript:', el);
        ContentRenderer.executeJavaScriptElement(el as HTMLElement);
      });

      // Render any Mermaid diagrams that haven't been rendered yet
      const $mermaidContainers = $activePanel.find('.picanvas-mermaid-container:not(.picanvas-mermaid-rendered)');
      $mermaidContainers.each((_i, el) => {
        console.log('[PiCanvas] Tab change: Rendering mermaid:', el);
        ContentRenderer.renderMermaidElement(el as HTMLElement).catch(err => {
          console.warn('[PiCanvas] Failed to render mermaid diagram on tab change:', err);
        });
      });

      // Initialize TOC elements on tab change
      $activePanel.find('.picanvas-toc-wrapper:not(.picanvas-toc-initialized)').each((_i, el) => {
        this.initializeTocElement(el as HTMLElement);
      });
      $activePanel.find('[data-inline-toc="true"]:not([data-inline-toc-done])').each((_i, el) => {
        this.initializeInlineToc(el as HTMLElement);
      });

      // Check if the active panel expects a shared webpart
      const sharedWebpartId = $activePanel.attr('data-shared-webpart-id');
      if (sharedWebpartId) {
        console.log(`[PiCanvas] Tab change: Moving shared webpart "${sharedWebpartId}" to active tab`);

        // Find the shared webpart (it's currently in another tab panel)
        const $sharedWebpart = $tabsContainer.find(`[data-picanvas-webpart-id="${sharedWebpartId}"]`);
        if ($sharedWebpart.length) {
          // Move the webpart to this panel (respect lock content host if present)
          const $lockHost = $activePanel.find('[data-lock-content]').first();
          if ($lockHost.length) {
            $lockHost.append($sharedWebpart);
          } else {
            $activePanel.append($sharedWebpart);
          }

          // Force images to reload after moving
          this.forceImageWebpartLoad($sharedWebpart);
          // NOTE: resize event removed - it causes SharePoint to serve low-res thumbnails
        }
      }
    });

    console.log(`[PiCanvas] Shared webpart handling initialized for ${usedElements.size} elements`);
  }

  /**
   * Generate template dropdown options for property pane
   */
  private getTemplateOptions(): IPropertyPaneDropdownOption[] {
    const options: IPropertyPaneDropdownOption[] = [
      { key: '', text: strings.SelectTemplatePlaceholder }
    ];

    // Built-in templates
    const builtIn = this._availableTemplates.filter(t => t.isBuiltIn);
    if (builtIn.length > 0) {
      options.push({ key: 'divider1', text: strings.BuiltInTemplatesHeader });
      builtIn.forEach(t => {
        options.push({ key: t.templateId, text: t.templateName });
      });
    }

    // Saved templates
    const saved = this._availableTemplates.filter(t => !t.isBuiltIn);
    if (saved.length > 0) {
      options.push({ key: 'divider2', text: strings.SavedTemplatesHeader });
      saved.forEach(t => {
        options.push({ key: t.templateId, text: t.templateName });
      });
    }

    return options;
  }

  /**
   * Apply selected template handler
   */
  private async applySelectedTemplate(): Promise<void> {
    if (!this._templateService || !this._selectedTemplateId || this._selectedTemplateId.startsWith('divider')) {
      return;
    }

    try {
      const template = await this._templateService.loadTemplate(this._selectedTemplateId);
      if (template) {
        this._templateService.applyTemplate(template, this.properties);
        this._selectedTemplateId = ''; // Reset selection
        this.context.propertyPane.refresh();
        this.render();
      }
    } catch (error) {
      console.error('[PiCanvas] Failed to apply template:', error);
    }
  }

  /**
   * Export configuration to JSON file download
   */
  private exportConfiguration(): void {
    if (!this._templateService) return;

    const templateName = `PiCanvas-Export-${new Date().toISOString().split('T')[0]}`;
    const jsonContent = this._templateService.exportToJson(this.properties, templateName);

    // Create download
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${templateName}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Import configuration from JSON file
   */
  private importConfiguration(): void {
    if (!this._templateService) return;

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e: Event): void => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event): void => {
          try {
            const jsonContent = event.target?.result as string;
            const template = this._templateService?.parseImportedJson(jsonContent);
            if (template && this._templateService) {
              this._templateService.applyTemplate(template, this.properties);
              this.context.propertyPane.refresh();
              this.render();
              alert(strings.ImportSuccessMessage);
            } else {
              alert(strings.ImportErrorMessage);
            }
          } catch (error) {
            console.error('[PiCanvas] Import error:', error);
            alert(strings.ImportErrorMessage);
          }
        };
        reader.onerror = (error): void => {
          console.error('[PiCanvas] File read error:', error);
          alert(strings.ImportErrorMessage);
        };
        reader.readAsText(file);
      }
    };
    input.click();
  }

  /**
   * Save current configuration as template to Site Assets
   */
  private async saveAsTemplate(): Promise<void> {
    if (!this._templateService) return;

    const templateName = prompt(strings.TemplateNamePrompt, 'My Custom Template');
    if (templateName) {
      const template = this._templateService.propertiesToTemplate(this.properties, templateName);
      const success = await this._templateService.saveTemplate(template);
      if (success) {
        await this.loadAvailableTemplates();
        this.context.propertyPane.refresh();
        alert(strings.SaveTemplateSuccessMessage);
      } else {
        alert(strings.SaveTemplateErrorMessage);
      }
    }
  }

  /**
   * Get template group fields for property pane
   */
  private getTemplateGroupFields(): IPropertyPaneField<unknown>[] {
    const fields: IPropertyPaneField<unknown>[] = [];

    // Description
    fields.push(PropertyPaneLabel('templateInfo', {
      text: strings.TemplatesDescription
    }));

    // Show warning if Site Assets not accessible
    if (!this._hasSiteAssetsAccess) {
      fields.push(PropertyPaneLabel('permissionWarning', {
        text: '⚠️ ' + strings.NoSiteAssetsAccess
      }));
    }

    // Loading indicator
    if (this._isLoadingTemplates) {
      fields.push(PropertyPaneLabel('loadingTemplates', {
        text: 'Loading templates...'
      }));
    } else {
      // Template dropdown
      fields.push(PropertyPaneDropdown('_selectedTemplateId', {
        label: strings.ApplyTemplateLabel,
        options: this.getTemplateOptions(),
        selectedKey: this._selectedTemplateId
      }));

      // Apply button
      fields.push(PropertyPaneButton('applyTemplate', {
        text: strings.ApplyTemplateButton,
        buttonType: PropertyPaneButtonType.Primary,
        onClick: () => {
          this.applySelectedTemplate().catch(err => {
            console.error('[PiCanvas] Apply template error:', err);
          });
        }
      }));
    }

    // Export/Import separator
    fields.push(PropertyPaneLabel('exportImportHeader', {
      text: `─── ${strings.ExportImportHeader} ───`
    }));

    // Export button
    fields.push(PropertyPaneButton('exportConfig', {
      text: strings.ExportConfigLabel,
      buttonType: PropertyPaneButtonType.Normal,
      onClick: () => this.exportConfiguration()
    }));

    // Import button
    fields.push(PropertyPaneButton('importConfig', {
      text: strings.ImportConfigLabel,
      buttonType: PropertyPaneButtonType.Normal,
      onClick: () => this.importConfiguration()
    }));

    // Save as template button (only if Site Assets accessible)
    if (this._hasSiteAssetsAccess) {
      fields.push(PropertyPaneButton('saveAsTemplate', {
        text: strings.SaveAsTemplateLabel,
        buttonType: PropertyPaneButtonType.Normal,
        onClick: () => {
          this.saveAsTemplate().catch(err => {
            console.error('[PiCanvas] Save template error:', err);
          });
        }
      }));
    }

    return fields;
  }

  private getLockDefaultsFields(): IPropertyPaneField<unknown>[] {
    const fields: IPropertyPaneField<unknown>[] = [];

    fields.push(PropertyPaneLabel('lockDefaultsInfo', {
      text: strings.LockDefaultsDescription
    }));

    fields.push(PropertyPaneTextField('lockUnlockTtlMinutes', {
      label: strings.LockUnlockTtlLabel,
      description: strings.LockUnlockTtlDescription,
      placeholder: '5'
    }));

    fields.push(PropertyPaneToggle('lockDefaultTemplateEnabled', {
      label: strings.LockDefaultTemplateToggleLabel,
      checked: this.properties.lockDefaultTemplateEnabled === true,
      onText: strings.LockDefaultTemplateToggleOnText || 'Custom',
      offText: strings.LockDefaultTemplateToggleOffText || 'Default'
    }));

    if (this.properties.lockDefaultTemplateEnabled) {
      fields.push(PropertyPaneTextField('lockDefaultTemplate', {
        label: strings.LockDefaultTemplateLabel,
        description: strings.LockDefaultTemplateDescription,
        multiline: true,
        rows: 10
      }));
    }

    fields.push(PropertyPaneToggle('lockDefaultMessagesEnabled', {
      label: strings.LockDefaultMessagesToggleLabel,
      checked: this.properties.lockDefaultMessagesEnabled === true,
      onText: strings.LockDefaultMessagesToggleOnText || 'Custom',
      offText: strings.LockDefaultMessagesToggleOffText || 'Default'
    }));

    if (this.properties.lockDefaultMessagesEnabled) {
      fields.push(PropertyPaneTextField('lockDefaultMessagePrompt', {
        label: strings.LockDefaultPromptMessageLabel,
        description: strings.LockDefaultPromptMessageDescription,
        multiline: true,
        rows: 3
      }));

      fields.push(PropertyPaneTextField('lockDefaultMessageError', {
        label: strings.LockDefaultErrorMessageLabel,
        description: strings.LockDefaultErrorMessageDescription,
        multiline: true,
        rows: 3
      }));

      fields.push(PropertyPaneTextField('lockDefaultMessageMissing', {
        label: strings.LockDefaultMissingMessageLabel,
        description: strings.LockDefaultMissingMessageDescription,
        multiline: true,
        rows: 3
      }));

      fields.push(PropertyPaneTextField('lockDefaultMessageSuccess', {
        label: strings.LockDefaultSuccessMessageLabel,
        description: strings.LockDefaultSuccessMessageDescription,
        multiline: true,
        rows: 3
      }));
    }

    return fields;
  }

  /**
   * Detect if dark mode is active based on manual setting or auto-detection
   */
  private isDarkMode(): boolean {
    // Check manual override first
    const themeMode = this.properties.themeMode || 'auto';
    if (themeMode === 'light') return false;
    if (themeMode === 'dark') return true;

    // Auto-detection mode
    // 1. Check SharePoint theme variant (most reliable)
    const themeState = (window as unknown as { __themeState__?: { theme?: { isInverted?: boolean } } }).__themeState__;
    if (themeState?.theme?.isInverted === true) {
      return true;
    }
    if (themeState?.theme?.isInverted === false) {
      return false;
    }

    // 2. Check section background color luminance
    const section = this.domElement.closest('[data-automation-id="CanvasSection"]');
    if (section) {
      const bgColor = window.getComputedStyle(section).backgroundColor;
      if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
        const rgb = bgColor.match(/\d+/g);
        if (rgb && rgb.length >= 3) {
          const luminance = (0.299 * parseInt(rgb[0]) + 0.587 * parseInt(rgb[1]) + 0.114 * parseInt(rgb[2])) / 255;
          return luminance < 0.5;
        }
      }
    }

    // 3. Default to light mode (most SharePoint pages are light)
    return false;
  }

  /**
   * Force SharePoint Image webpart images to load after cloning.
   * SharePoint Image webparts use lazy loading and React state that doesn't
   * survive jQuery DOM cloning. This method copies background images from
   * original elements and forces img tags to reload.
   * @param $clonedWebpart - The jQuery element containing the cloned webpart
   */
  private forceImageWebpartLoad($clonedWebpart: JQuery<HTMLElement>): void {
    console.log('[PiCanvas] forceImageWebpartLoad: Starting image load fix for cloned webpart');

    // Method 1: Copy background-image styles from computed styles
    // SharePoint sets background-image via React after mount, which gets lost on clone
    $clonedWebpart.find('[style*="background"]').addBack('[style*="background"]').each(function () {
      const el = this as HTMLElement;
      const computedStyle = window.getComputedStyle(el);
      const bgImage = computedStyle.backgroundImage;
      if (bgImage && bgImage !== 'none') {
        console.log('[PiCanvas] forceImageWebpartLoad: Found background-image:', bgImage.substring(0, 100));
        el.style.backgroundImage = bgImage;
      }
    });

    // Method 2: Find SharePoint Image webpart containers and copy their image src
    // Image webparts use data-automation-id="imageWebPart" or similar
    $clonedWebpart.find('[data-automation-id*="image"], [data-automation-id*="Image"]').each(function () {
      const $container = $(this);
      console.log('[PiCanvas] forceImageWebpartLoad: Found Image webpart container');

      // Find img elements and force reload
      $container.find('img').each(function () {
        const $img = $(this);
        const src = $img.attr('src') || $img.attr('data-src');
        // SKIP BLOB URLs: removing/re-adding blob URLs invalidates them, causing ERR_FILE_NOT_FOUND
        if (src && src.indexOf('blob:') !== 0) {
          console.log('[PiCanvas] forceImageWebpartLoad: Forcing img reload:', src.substring(0, 100));
          // Remove and re-add src to force reload
          $img.removeAttr('src');
          setTimeout(() => {
            $img.attr('src', src);
          }, 10);
        }
      });
    });

    // Method 3: Handle lazy-loaded images with data-src
    $clonedWebpart.find('img[data-src]').each(function () {
      const $img = $(this);
      const dataSrc = $img.attr('data-src');
      if (dataSrc) {
        console.log('[PiCanvas] forceImageWebpartLoad: Loading lazy image from data-src');
        $img.attr('src', dataSrc);
        $img.removeAttr('data-src');
      }
    });

    // Method 4: Force all img elements with loading="lazy" to reload
    $clonedWebpart.find('img[loading="lazy"]').each(function () {
      const $img = $(this);
      const src = $img.attr('src');
      // SKIP BLOB URLs here too
      if (src && src.indexOf('blob:') !== 0) {
        console.log('[PiCanvas] forceImageWebpartLoad: Forcing lazy img reload');
        $img.attr('src', '');
        setTimeout(() => {
          $img.attr('src', src);
        }, 10);
      }
    });

    // Method 6: Persistent MutationObserver to fight SharePoint's responsive image logic
    // SharePoint downgrades images (c400x / width=400) and crunches containers (e.g. 199px)
    // asynchronously after tab switches. We need to actively watch and revert this.

    // Clean up any existing observer on this element
    const existingObserver = $clonedWebpart.data('picanvas-image-observer');
    if (existingObserver) {
      existingObserver.disconnect();
    }

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        const el = mutation.target as HTMLElement;

        // SAFETY: Ignore Banner and Hero webparts completely in this observer
        // They have delicate layouts that we shouldn't interfere with here
        if ($(el).closest('[data-automation-id="BannerWebPart"], [class*="bannerWebPart"], [data-automation-id="HeroWebPart"], [class*="heroWebPart"], [data-automation-id="fullWidthImageLayout"], .picanvas-contained-banner').length > 0) {
          return;
        }

        // 1. Check for Image Source Downgrades
        if (el.tagName === 'IMG') {
          const img = el as HTMLImageElement;
          const src = img.getAttribute('src');
          // pattern match for low-res
          if (src && (src.indexOf('c400x') > -1 || src.indexOf('width=400') > -1)) {
            console.log('[PiCanvas] Observer: Detected low-res image downgrade:', src);

            // A: Try to restore from original source
            const originalSrc = img.getAttribute('data-sp-originalimgsrc');
            if (originalSrc && !src.includes(originalSrc)) {
              console.log('[PiCanvas] Observer: Restoring original image src');
              img.src = originalSrc;
            } else {
              // B: Upgrade the URL manually
              let newSrc = src.replace(/c400x[0-9]*/, 'c1600x99999')
                .replace(/width=400/, 'width=1600');

              if (newSrc !== src) {
                console.log('[PiCanvas] Observer: Upgrading low-res image URL');
                img.src = newSrc;
              }
            }

            // Force styles
            img.style.width = '100%';
            img.style.maxWidth = '100%';
            img.style.height = 'auto';
            img.style.objectFit = 'contain';
          }
        }

        // 2. Check for Container Width Crunching (Figure/Div with fixed pixel width)
        if (el.tagName === 'FIGURE' ||
          (el.tagName === 'DIV' && (el.className.indexOf('ControlZone') > -1 || el.id.indexOf('vpc_') > -1))) {

          // Double check exclusion (redundant but safe)
          if ($(el).closest('[data-automation-id="BannerWebPart"], [class*="bannerWebPart"]').length > 0) return;

          const w = el.style.width;
          if (w && w.indexOf('px') > -1 && w !== '100%') {
            console.log('[PiCanvas] Observer: Detected fixed pixel width constraint:', w, 'on', el.tagName);
            // Force to 100%
            el.style.width = '100%';
            el.style.maxWidth = '100%';
            el.style.minWidth = '0'; // Unlock min-width
          }
        }
      });
    });

    // Start observing
    observer.observe($clonedWebpart[0], {
      subtree: true,
      attributes: true,
      attributeFilter: ['src', 'style', 'width']
    });

    // Store observer to clean up later
    $clonedWebpart.data('picanvas-image-observer', observer);

    // Initial pass (in case they are already bad)
    $clonedWebpart.find('img').each(function () {
      // SAFETY: Skip Banners/Heroes/FullWidthLayouts in initial pass too
      if ($(this).closest('[data-automation-id="BannerWebPart"], [class*="bannerWebPart"], [data-automation-id="HeroWebPart"], [class*="heroWebPart"], [data-automation-id="fullWidthImageLayout"]').length > 0) {
        return;
      }

      const $img = $(this);
      const src = $img.attr('src');
      if (src && (src.indexOf('c400x') > -1 || src.indexOf('width=400') > -1)) {
        console.log('[PiCanvas] Initial Pass: Upgrading low-res image');
        const newSrc = src.replace(/c400x[0-9]*/, 'c1600x99999').replace(/width=400/, 'width=1600');
        $img.attr('src', newSrc);
        $img.css({ 'width': '100%', 'height': 'auto' });
      }

      const $figure = $img.closest('figure');
      if ($figure.length) {
        const fw = $figure[0].style.width;
        if (fw && fw.indexOf('px') > -1) {
          console.log('[PiCanvas] Initial Pass: Fixing figure width');
          $figure.css('width', '100%');
        }
      }
    });

    // Run observer for 10 seconds to catch all lazy load / resize events
    setTimeout(() => {
      observer.disconnect();
      console.log('[PiCanvas] Observer disconnected');
    }, 10000);

    // Method 7: Trigger resize event for INITIAL image loading
    // This is CRITICAL for Banner/Hero webparts to calculate their layout/images correctly.
    // Side effect: It causes Image Webparts to downgrade to low-res thumbnails.
    // Resolution: The MutationObserver (Method 6) above actively watches and reverts the Image Webpart downgrade.
    setTimeout(() => {
      // PRE-RESIZE: Unlock any previous height/width locks so resize can work
      const $banners = $clonedWebpart.find('[data-automation-id="fullWidthImageLayout"]');
      $banners.removeClass('picanvas-height-locked picanvas-contained-banner picanvas-banner-fixed');
      $banners.each(function () {
        // Clear height/width styles that might be locked
        this.style.removeProperty('height');
        this.style.removeProperty('min-height');
        this.style.removeProperty('width');
        this.style.removeProperty('max-width');
        this.style.removeProperty('min-width');
      });

      console.log('[PiCanvas] forceImageWebpartLoad: Unlocked banners, triggering resize');
      window.dispatchEvent(new Event('resize'));

      // CRITICAL: Re-apply banner fixes immediately after resize
      // SharePoint's resize handler might reset styles (e.g. setting pixel width), so we must force our fixes again.
      this.fixGlobalBannerWebparts();

      // ...AND AGAIN after a short delay to catch any async React re-renders from SharePoint
      // This ensures we win the race condition against SharePoint's layout engine
      setTimeout(() => {
        console.log('[PiCanvas] forceImageWebpartLoad: Re-applying global banner fixes (delayed)');
        this.fixGlobalBannerWebparts();
      }, 200);

      // Also force reflow
      if ($clonedWebpart[0]) {
        void $clonedWebpart[0].offsetHeight;
      }
    }, 50);
  }

  /**
   * Fix all Banner/Hero/PageTitle webparts on the page, not just those inside tabs.
   * SharePoint webparts have inline flex styles with calculated pixel widths
   * that cause gray gaps when container sizes change.
   * This method clears those stale width calculations globally.
   */
  private fixGlobalBannerWebparts(): void {
    const enableFullWidth = this.properties.enableFullWidthFix !== false;
    console.log(`[PiCanvas] fixGlobalBannerWebparts: Mode=${enableFullWidth ? 'Full Width' : 'Contained'}`);

    // Helper to calculate object-position from SharePoint's legacy top/left offsets
    const calculateSharePointFocalPoint = (img: HTMLImageElement, container: HTMLElement): string | null => {
      // If it already has one, honor it
      if (img.style.objectPosition && img.style.objectPosition !== '50% 50%') {
        return img.style.objectPosition;
      }

      // Get SharePoint's calculated offsets
      const top = parseFloat(img.style.top || '0');
      const left = parseFloat(img.style.left || '0');

      // If no offsets, default to center
      if (top === 0 && left === 0) return '50% 50%';

      // Get true image dimensions from SharePoint attributes
      const h = parseFloat(img.getAttribute('imgheight') || (img.naturalHeight ? img.naturalHeight.toString() : '0'));
      const w = parseFloat(img.getAttribute('imgwidth') || (img.naturalWidth ? img.naturalWidth.toString() : '0'));

      // Get container dimensions (visible area)
      const containerH = container.offsetHeight || parseFloat(container.style.height || '200'); // fallback
      const containerW = container.offsetWidth || parseFloat(container.style.width || '1000'); // fallback

      if (h === 0 || w === 0) return '50% 50%';

      // Calculate the center of the VISIBLE portion relative to the FULL image
      // SharePoint sets 'top' to a negative value to shift the image up.
      const centerY = Math.abs(top) + (containerH / 2);
      const centerX = Math.abs(left) + (containerW / 2);

      // Convert to percentage
      let posY = (centerY / h) * 100;
      let posX = (centerX / w) * 100;

      // Clamp to 0-100
      posY = Math.max(0, Math.min(100, posY));
      posX = Math.max(0, Math.min(100, posX));

      return `${posX.toFixed(2)}% ${posY.toFixed(2)}%`;
    };

    // Fix fullWidthImageLayout (used by PageTitle/Banner webparts) - CRITICAL
    // IMPORTANT: Only fix elements OUTSIDE of PiCanvas tabs - elements inside tabs should
    // be constrained to their tab container width, not expanded to full page width
    const $fullWidthLayouts = $('[data-automation-id="fullWidthImageLayout"]');
    let fixedCount = 0;
    let containedCount = 0;

    $fullWidthLayouts.each(function () {
      const $layout = $(this);

      // Check if this element is inside a PiCanvas tab
      const $tabContent = $layout.closest('.picanvas-tab-content');
      const isInsideTab = $tabContent.length > 0;

      // Determine if full-width should be applied:
      // - For elements inside tabs: check the per-tab data-fullwidth-banner attribute
      // - For elements outside tabs: use the global enableFullWidthFix setting
      let shouldApplyFullWidth: boolean;

      if (isInsideTab) {
        // Per-tab setting: check data attribute (defaults to true if not set)
        const tabFullWidthAttr = $tabContent.attr('data-fullwidth-banner');
        shouldApplyFullWidth = tabFullWidthAttr !== 'false';
      } else {
        // Global setting for elements outside tabs
        shouldApplyFullWidth = enableFullWidth;
      }

      // If full-width mode is DISABLED, ACTIVELY constrain the banner
      // SharePoint banners default to full-width, so we must ADD containment styles
      if (!shouldApplyFullWidth) {
        containedCount++;

        // CONTAINED MODE: Add CSS class AND clear viewport-relative inline styles
        // SharePoint banners use tricks like "width: 100vw; margin-left: calc(-50vw + 50%)"
        // to escape their container. We must clear these for CSS containment to work.
        $layout.removeClass('picanvas-fullwidth-fixed');
        $layout.addClass('picanvas-contained-banner');

        // Clear viewport-relative styles from the layout element itself
        const layoutEl = $layout[0] as HTMLElement;
        const layoutWidth = layoutEl.style.width;
        if (layoutWidth && (layoutWidth.includes('vw') || layoutWidth.includes('calc'))) {
          layoutEl.style.removeProperty('width');
        }
        const layoutMarginLeft = layoutEl.style.marginLeft;
        if (layoutMarginLeft && (layoutMarginLeft.includes('vw') || layoutMarginLeft.includes('calc'))) {
          layoutEl.style.removeProperty('margin-left');
        }
        if (layoutEl.style.transform && layoutEl.style.transform.includes('translate')) {
          layoutEl.style.removeProperty('transform');
        }

        // Fix image focal point BEFORE clearing styles
        const img = layoutEl.querySelector('img');
        if (img) {
          // SAFETY: If element is hidden (0 dimensions), we cannot calculate focal point.
          // Skipping this prevents overwriting object-position with 0% 0%.
          // The fix will be reapplied when the tab becomes visible (triggering resize).
          if (layoutEl.offsetWidth > 0 && layoutEl.offsetHeight > 0) {
            const focalPoint = calculateSharePointFocalPoint(img, layoutEl);

            img.style.setProperty('width', '100%', 'important');
            img.style.setProperty('max-width', '100%', 'important');
            img.style.setProperty('height', '100%', 'important');
            img.style.setProperty('object-fit', 'cover', 'important');

            if (focalPoint) {
              img.style.setProperty('object-position', focalPoint, 'important');
            }

            // CRITICAL: Clear legacy SharePoint positioning
            img.style.setProperty('top', '0', 'important');
            img.style.setProperty('left', '0', 'important');
            img.style.setProperty('margin-top', '0', 'important');
            img.style.setProperty('margin-left', '0', 'important');
            img.style.setProperty('transform', 'none', 'important');
          }
        }

        // Clear viewport-relative styles from ALL nested elements
        $layout.find('*').each(function () {
          const el = this as HTMLElement;
          // Skip the image we just fixed
          if (el.tagName === 'IMG') return;

          const w = el.style.width;
          if (w && (w.includes('vw') || w.includes('calc'))) {
            el.style.removeProperty('width');
          }
          const ml = el.style.marginLeft;
          if (ml && (ml.includes('vw') || ml.includes('calc'))) {
            el.style.removeProperty('margin-left');
          }
          const mr = el.style.marginRight;
          if (mr && (mr.includes('vw') || mr.includes('calc'))) {
            el.style.removeProperty('margin-right');
          }
          if (el.style.transform && el.style.transform.includes('translate')) {
            el.style.removeProperty('transform');
          }
          // Also clear left positioning that might be viewport-relative
          const left = el.style.left;
          if (left && (left.includes('vw') || left.includes('calc'))) {
            el.style.removeProperty('left');
          }
        });

        return; // Skip to next element (don't apply full-width fixes)
      }

      fixedCount++;

      // For banners OUTSIDE PiCanvas tabs: Let SharePoint handle natively
      // CSS :has() rules in AddTabs.css will constrain sibling webparts
      // while keeping the banner full-width
      if (!isInsideTab) {
        console.log(`[PiCanvas] Banner outside tab: CSS :has() rules handle sibling constraints`);
        return; // Skip to next element - CSS handles the rest
      }

      // === ONLY FOR BANNERS INSIDE PICANVAS TABS ===

      // Clear any containment class from when it was in contained mode
      $layout.removeClass('picanvas-contained-banner');
      // Remove containment-specific inline styles from layout element (including scaling styles)
      const layoutEl = $layout[0] as HTMLElement;
      if (layoutEl.style.getPropertyValue('overflow') === 'hidden') layoutEl.style.removeProperty('overflow');
      if (layoutEl.style.getPropertyValue('transform')) layoutEl.style.removeProperty('transform');
      if (layoutEl.style.getPropertyValue('transform-origin')) layoutEl.style.removeProperty('transform-origin');
      if (layoutEl.style.getPropertyValue('width')) layoutEl.style.removeProperty('width');
      if (layoutEl.style.getPropertyValue('max-width')) layoutEl.style.removeProperty('max-width');
      if (layoutEl.style.getPropertyValue('position') === 'relative') layoutEl.style.removeProperty('position');
      if (layoutEl.style.getPropertyValue('left') === '0') layoutEl.style.removeProperty('left');
      if (layoutEl.style.getPropertyValue('right') === '0') layoutEl.style.removeProperty('right');

      // Also clear parent's scaling-related styles (height, flexbox, overflow)
      const parentEl = layoutEl.parentElement;
      if (parentEl) {
        if (parentEl.style.getPropertyValue('height')) parentEl.style.removeProperty('height');
        if (parentEl.style.getPropertyValue('overflow') === 'hidden') parentEl.style.removeProperty('overflow');
        if (parentEl.style.getPropertyValue('display') === 'flex') parentEl.style.removeProperty('display');
        if (parentEl.style.getPropertyValue('justify-content')) parentEl.style.removeProperty('justify-content');
      }

      // Clear containment-specific styles from titleRegionBackgroundImage
      $layout.find('[data-automation-id="titleRegionBackgroundImage"]').each(function () {
        const bgEl = this as HTMLElement;
        if (bgEl.style.getPropertyValue('position') === 'relative') bgEl.style.removeProperty('position');
        if (bgEl.style.getPropertyValue('left') === '0px' || bgEl.style.getPropertyValue('left') === '0') bgEl.style.removeProperty('left');
        if (bgEl.style.getPropertyValue('right') === '0px' || bgEl.style.getPropertyValue('right') === '0') bgEl.style.removeProperty('right');
        if (bgEl.style.getPropertyValue('width')) bgEl.style.removeProperty('width');
        if (bgEl.style.getPropertyValue('transform') === 'none') bgEl.style.removeProperty('transform');
        if (bgEl.style.getPropertyValue('min-width') === '0px' || bgEl.style.getPropertyValue('min-width') === '0') bgEl.style.removeProperty('min-width');
      });

      // Clear containment-specific styles from gradientBox
      $layout.find('[data-automation-id="gradientBox"]').each(function () {
        const gradEl = this as HTMLElement;
        if (gradEl.style.getPropertyValue('position') === 'relative') gradEl.style.removeProperty('position');
        if (gradEl.style.getPropertyValue('left') === '0px' || gradEl.style.getPropertyValue('left') === '0') gradEl.style.removeProperty('left');
        if (gradEl.style.getPropertyValue('right') === '0px' || gradEl.style.getPropertyValue('right') === '0') gradEl.style.removeProperty('right');
        if (gradEl.style.getPropertyValue('transform') === 'none') gradEl.style.removeProperty('transform');
      });

      // Also clear containment-specific styles from FullWidthLayoutColumn (if it exists)
      $layout.find('[data-automation-id="FullWidthLayoutColumn"]').each(function () {
        const colEl = this as HTMLElement;
        // Remove containment overrides so full-width can work
        if (colEl.style.getPropertyValue('left') === '0px' || colEl.style.getPropertyValue('left') === '0') colEl.style.removeProperty('left');
        if (colEl.style.getPropertyValue('right') === '0px' || colEl.style.getPropertyValue('right') === '0') colEl.style.removeProperty('right');
        if (colEl.style.getPropertyValue('transform') === 'none') colEl.style.removeProperty('transform');
      });

      // For elements INSIDE tabs: We control the tab content, so we can modify up to tab boundary
      const stopSelector = '.picanvas-tab-content';
      let $current: JQuery<HTMLElement> = $layout;
      while ($current.length && !$current.is(stopSelector)) {
        const el = $current[0] as HTMLElement;
        const automationId = el.getAttribute('data-automation-id');

        // For key containers within our tab, force full width
        if (automationId === 'CanvasControl' ||
          el.classList.contains('ControlZone') ||
          el.classList.contains('ControlZone--control')) {
          el.style.setProperty('width', '100%', 'important');
          el.style.setProperty('max-width', 'none', 'important');
          el.style.setProperty('padding-left', '0', 'important');
          el.style.setProperty('padding-right', '0', 'important');
          el.classList.add('picanvas-fullwidth-container');
        } else {
          // For other elements, just clear any stale pixel widths
          if (el.style.width && el.style.width.includes('px')) el.style.width = '';
          if (el.style.maxWidth && el.style.maxWidth.includes('px')) el.style.maxWidth = '';
        }
        $current = $current.parent() as JQuery<HTMLElement>;
      }

      // Clear inline pixel widths from children (not viewport-relative styles which SP uses for full-width)
      $layout.find('*').each(function () {
        const el = this as HTMLElement;
        if (el.style.width && el.style.width.includes('px')) el.style.width = '';
        if (el.style.maxWidth && el.style.maxWidth.includes('px')) el.style.maxWidth = '';
      });

      // Force the layout itself to be full width
      ($layout[0] as HTMLElement).style.setProperty('width', '100%', 'important');
      ($layout[0] as HTMLElement).style.setProperty('max-width', 'none', 'important');

      // Mark as fixed
      $layout.addClass('picanvas-fullwidth-fixed');
      void ($layout[0] as HTMLElement).offsetHeight;

      // For banners inside PiCanvas tabs: prevent resize on scroll while showing full image
      if (isInsideTab) {
        const bannerLayoutEl = $layout[0] as HTMLElement;
        let lockedHeight = 0;

        const lockBannerAtNaturalHeight = (): void => {
          // First, let the banner render at natural size
          bannerLayoutEl.style.removeProperty('height');
          bannerLayoutEl.style.removeProperty('overflow');

          const bannerImg = $layout.find('img')[0] as HTMLImageElement;
          if (bannerImg) {
            bannerImg.style.setProperty('width', '100%', 'important');
            bannerImg.style.setProperty('height', 'auto', 'important');
            bannerImg.style.setProperty('object-fit', 'contain', 'important');
          }

          // Force reflow to get accurate dimensions
          void bannerLayoutEl.offsetHeight;

          // Now capture and lock the natural height (without overflow:hidden to avoid cropping)
          setTimeout(() => {
            const naturalHeight = bannerLayoutEl.offsetHeight;
            if (naturalHeight > 0) {
              lockedHeight = naturalHeight;
              // Lock with min-height only - this prevents shrinking but allows content to show
              bannerLayoutEl.style.setProperty('min-height', `${naturalHeight}px`, 'important');
              $layout.addClass('picanvas-height-locked');
              console.log(`[PiCanvas] Banner in tab: locked at natural height ${naturalHeight}px`);
            }
          }, 100);
        };

        // Use MutationObserver to prevent SharePoint from changing dimensions
        const styleObserver = new MutationObserver(() => {
          if (lockedHeight > 0) {
            const currentMinHeight = parseInt(bannerLayoutEl.style.minHeight, 10);
            if (isNaN(currentMinHeight) || currentMinHeight !== lockedHeight) {
              bannerLayoutEl.style.setProperty('min-height', `${lockedHeight}px`, 'important');
            }
          }
        });
        styleObserver.observe(bannerLayoutEl, { attributes: true, attributeFilter: ['style'] });

        // Check if banner image is already loaded
        const $bannerImgCheck = $layout.find('img').first();
        if ($bannerImgCheck.length) {
          const bannerImgEl = $bannerImgCheck[0] as HTMLImageElement;
          if (bannerImgEl.complete && bannerImgEl.naturalHeight > 0) {
            lockBannerAtNaturalHeight();
          } else {
            $bannerImgCheck.on('load', lockBannerAtNaturalHeight);
            setTimeout(lockBannerAtNaturalHeight, 1000);
          }
        } else {
          lockBannerAtNaturalHeight();
        }

        // Re-lock on scroll events
        let scrollTimeout: ReturnType<typeof setTimeout> | null = null;
        const handleScroll = (): void => {
          if (scrollTimeout) clearTimeout(scrollTimeout);
          scrollTimeout = setTimeout(() => {
            if (lockedHeight > 0) {
              bannerLayoutEl.style.setProperty('min-height', `${lockedHeight}px`, 'important');
            }
          }, 50);
        };
        const scrollContainer = document.querySelector('[data-automation-id="contentScrollRegion"]') || window;
        scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
      }
    });

    console.log(`[PiCanvas] fixGlobalBannerWebparts: Fixed ${fixedCount} full-width, ${containedCount} contained`);

    // Fix gradientBox elements
    const $gradientBoxes = $('[data-automation-id="gradientBox"]');
    $gradientBoxes.each(function () {
      const el = this as HTMLElement;
      // Only clear viewport-breaking widths
      if (el.style.width && (el.style.width.includes('vw') || el.style.width.includes('calc'))) el.style.width = '';
      if (el.style.maxWidth && (el.style.maxWidth.includes('vw') || el.style.maxWidth.includes('calc'))) el.style.maxWidth = '';
    });

    // Find all Banner webparts on the page
    const $banners = $('[data-automation-id="BannerWebPart"], [class*="bannerWebPart"], [class*="BannerWebPart"]');

    $banners.each(function () {
      const $banner = $(this);

      // Check if this banner is inside a PiCanvas tab with contained mode
      const $tabContent = $banner.closest('.picanvas-tab-content');
      const isInsideTab = $tabContent.length > 0;
      const isContained = isInsideTab && $tabContent.attr('data-fullwidth-banner') === 'false';

      if (isContained) {
        // Apply containment class to Banner - this handles "Image and Heading" layout
        // which uses BannerWebPart but may not have fullWidthImageLayout attribute
        $banner.addClass('picanvas-contained-banner');
        $banner.removeClass('picanvas-banner-fixed');

        // Clear ONLY viewport-relative styles that force full width
        const bannerEl = $banner[0] as HTMLElement;
        if (bannerEl.style.width && (bannerEl.style.width.includes('vw') || bannerEl.style.width.includes('calc'))) bannerEl.style.removeProperty('width');
        if (bannerEl.style.maxWidth && (bannerEl.style.maxWidth.includes('vw') || bannerEl.style.maxWidth.includes('calc'))) bannerEl.style.removeProperty('max-width');
        if (bannerEl.style.minWidth && (bannerEl.style.minWidth.includes('vw') || bannerEl.style.minWidth.includes('calc'))) bannerEl.style.removeProperty('min-width');

        // Only remove transform if it looks like a centering hack (translate)
        // Preserves rotation or other transforms used by Image+Text layouts
        if (bannerEl.style.transform && bannerEl.style.transform.includes('translate')) {
          bannerEl.style.removeProperty('transform');
        }

        // Clear nested elements too - BUT BE GENTLE
        // Do NOT use find('*') as it strips styles from text elements, buttons, etc.
        // Only target layout containers that might have the breakdown styles
        $banner.find('div, span, section, aside').each(function () {
          const el = this as HTMLElement;
          const inlineWidth = el.style.width;
          if (inlineWidth && (inlineWidth.includes('vw') || inlineWidth.includes('calc') || inlineWidth.includes('100%'))) {
            // Only remove 100% if it's causing issues (context dependent), but always remove vw/calc
            if (inlineWidth.includes('vw') || inlineWidth.includes('calc')) {
              el.style.removeProperty('width');
            }
          }
          if (el.style.transform && el.style.transform.includes('translate')) {
            el.style.removeProperty('transform');
          }
        });
      } else {
        // Full-width mode: clear stale pixel widths but keep full-width behavior
        $banner.removeClass('picanvas-contained-banner');

        // Only clear PIXEL widths that are likely stale calculations
        // Do NOT clear percentages or other valid styles
        $banner.find('*').addBack().each(function () {
          const el = this as HTMLElement;
          const style = el.style;

          if (style.width && style.width.includes('px')) style.width = '';
          if (style.maxWidth && style.maxWidth.includes('px')) style.maxWidth = '';
          if (style.minWidth && style.minWidth.includes('px')) style.minWidth = '';
          // Only clear flex properties if they are fixed pixel basis
          if (style.flexBasis && style.flexBasis.includes('px')) style.flexBasis = '';
        });

        // Mark as fixed for CSS targeting
        $banner.addClass('picanvas-banner-fixed');
      }

      // Force reflow
      void ($banner[0] as HTMLElement).offsetHeight;
    });

    // Same for Hero webparts
    const $heroes = $('[data-automation-id="HeroWebPart"], [class*="heroWebPart"], [class*="HeroWebPart"]');

    $heroes.each(function () {
      const $hero = $(this);

      // Less aggressive clearing for Heroes too
      $hero.find('*').addBack().each(function () {
        const el = this as HTMLElement;
        const style = el.style;

        if (style.width && style.width.includes('px')) style.width = '';
        if (style.maxWidth && style.maxWidth.includes('px')) style.maxWidth = '';
        if (style.minWidth && style.minWidth.includes('px')) style.minWidth = '';
        // Only clear flex properties if they are fixed pixel basis
        if (style.flexBasis && style.flexBasis.includes('px')) style.flexBasis = '';
      });

      $hero.addClass('picanvas-hero-fixed');
      void ($hero[0] as HTMLElement).offsetHeight;
    });

    // === NEW: Fix Plain Image Webparts ===
    // These often don't have constraints when moved to tabs and can overflow
    const $images = $('[data-automation-id="imageWebPart"], [class*="imageWebPart"], .ControlZone--control img');
    $images.each(function () {
      const $imgContainer = $(this);
      const $tabContent = $imgContainer.closest('.picanvas-tab-content');

      if ($tabContent.length > 0) {
        // It's inside a tab - ensure it doesn't overflow
        $imgContainer.css({
          'max-width': '100%',
          'height': 'auto'
        });

        // Also target the img tag itself if we caught a container
        $imgContainer.find('img').css({
          'max-width': '100%',
          'height': 'auto',
          'object-fit': 'contain' // Ensure aspect ratio is preserved
        });
      }
    });

    // === NEW: Fix Page Title Webparts (often used as banners) ===
    const $pageTitles = $('[data-automation-id="pageTitle"]');
    $pageTitles.each(function () {
      const $title = $(this);
      // Page titles often use negative margins to stretch
      if ($title.closest('.picanvas-tab-content').length > 0) {
        const el = this as HTMLElement;
        if (el.style.marginTop && el.style.marginTop.includes('-')) el.style.marginTop = '0px';
        if (el.style.marginLeft && el.style.marginLeft.includes('-')) el.style.marginLeft = '0px';
        if (el.style.marginRight && el.style.marginRight.includes('-')) el.style.marginRight = '0px';
        el.style.width = '100%';
      }
    });

    console.log(`[PiCanvas] fixGlobalBannerWebparts: Processed ${$banners.length} banners, ${$heroes.length} heroes, ${$images.length} images`);
  }

  /**
   * Clear any existing highlight from the page
   */
  private clearHighlight(): void {
    if (this._currentHighlightedElement) {
      this._currentHighlightedElement.classList.remove('picanvas-highlight', 'picanvas-section-highlight');
      this._currentHighlightedElement = null;
    }
    // Also clear any stray highlights using native DOM
    document.querySelectorAll('.picanvas-highlight, .picanvas-section-highlight').forEach(el => {
      el.classList.remove('picanvas-highlight', 'picanvas-section-highlight');
    });
  }

  /**
   * Highlight a webpart or section by its ID
   */
  private highlightElement(elementId: string): void {
    this.clearHighlight();

    if (!elementId) {
      return;
    }

    let element: HTMLElement | null = null;
    let isSection = false;

    // Check if this is a section selection
    if (elementId.indexOf("SECTION:") === 0) {
      isSection = true;
      const sectionId = elementId.substring(8); // Remove "SECTION:" prefix
      element = document.querySelector(`[data-picanvas-section-id="${sectionId}"]`);
    } else {
      // Individual webpart
      element = document.getElementById(elementId);
    }

    if (element) {
      this._currentHighlightedElement = element;
      const highlightClass = isSection ? 'picanvas-section-highlight' : 'picanvas-highlight';
      element.classList.add(highlightClass);

      // Scroll element into view smoothly
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  /**
   * Called when a property pane field value changes
   */
  protected onPropertyPaneFieldChanged(propertyPath: string, oldValue: unknown, newValue: unknown): void {
    super.onPropertyPaneFieldChanged(propertyPath, oldValue, newValue);

    // Handle template dropdown selection
    if (propertyPath === '_selectedTemplateId') {
      this._selectedTemplateId = newValue as string;
      return;
    }

    // Check if a tab content dropdown was changed
    if (propertyPath.match(/^tab\d+WebPartID$/)) {
      const selectedId = newValue as string;
      const tabMatch = propertyPath.match(/^tab(\d+)WebPartID$/);
      const tabIndex = tabMatch ? parseInt(tabMatch[1], 10) : 0;

      // Use setTimeout to apply highlight and check position after any DOM updates complete
      setTimeout(() => {
        this.highlightElement(selectedId);

        // Check if selected element is above PiCanvas and update warning
        if (tabIndex > 0) {
          this.updatePositionWarning(tabIndex, selectedId);
          // Refresh property pane to show/hide warning
          this.context.propertyPane.refresh();
        }
      }, 100);

      // IMPORTANT: Save connected webparts to localStorage immediately when changed in Edit mode
      // This ensures the Application Customizer can hide them when switching to Preview/Read mode
      this.saveConnectedWebpartsFromProperties();
    }

    // Check if a tab label web part dropdown was changed
    if (propertyPath.match(/^tab\d+LabelWebPartID$/)) {
      const selectedId = newValue as string;
      // Use setTimeout to apply highlight after any DOM updates complete
      setTimeout(() => {
        this.highlightElement(selectedId);
      }, 100);
    }

    // Check if an icon dropdown was changed
    const iconMatch = propertyPath.match(/^tab(\d+)Icon$/);
    if (iconMatch && newValue) {
      const tabIndex = parseInt(iconMatch[1]);
      this.insertIconIntoLabel(tabIndex, newValue as string);
      // Reset the icon dropdown after inserting
      this.properties[`tab${tabIndex}Icon`] = '';
    }

    // Check if content type dropdown was changed - refresh property pane to show/hide conditional fields
    if (propertyPath.match(/^tab\d+ContentType$/)) {
      const match = propertyPath.match(/^tab(\d+)ContentType$/);
      if (match) {
        const tabIndex = parseInt(match[1], 10);
        const oldContentType = oldValue as string || 'webpart';
        const newContentType = newValue as string || 'webpart';

        // Clear WebPartID when switching between webpart and section content types
        // This prevents stale selections (e.g., section ID when switching to webpart mode)
        if ((oldContentType === 'webpart' && newContentType === 'section') ||
          (oldContentType === 'section' && newContentType === 'webpart')) {
          this.properties[`tab${tabIndex}WebPartID`] = '';
        }
      }
      // Force property pane refresh to show the appropriate fields for the new content type
      this.context.propertyPane.refresh();
    }

    // Check if custom content was changed - refresh preview
    if (propertyPath.match(/^tab\d+(CustomContent|EmbedUrl|EmbedHeight)$/)) {
      // Force property pane refresh to update the preview
      this.context.propertyPane.refresh();
    }

    const embedFullPageMatch = propertyPath.match(/^tab(\d+)EmbedFullPage$/);
    if (embedFullPageMatch) {
      const tabIndex = parseInt(embedFullPageMatch[1], 10);
      const enableFullPage = newValue === true;
      this.properties[`tab${tabIndex}EmbedFullWidth`] = enableFullPage;
      this.properties[`tab${tabIndex}EmbedFullHeight`] = enableFullPage;
      this.properties[`tab${tabIndex}EmbedFullPage`] = enableFullPage;
      this.context.propertyPane.refresh();
    }

    const embedFullWidthMatch = propertyPath.match(/^tab(\d+)EmbedFullWidth$/);
    if (embedFullWidthMatch) {
      const tabIndex = parseInt(embedFullWidthMatch[1], 10);
      if (newValue === true) {
        this.properties[`tab${tabIndex}EmbedFullHeight`] = true;
      }
      this.syncEmbedFullPage(tabIndex);
      this.context.propertyPane.refresh();
    }

    const embedFullHeightMatch = propertyPath.match(/^tab(\d+)EmbedFullHeight$/);
    if (embedFullHeightMatch) {
      const tabIndex = parseInt(embedFullHeightMatch[1], 10);
      this.syncEmbedFullPage(tabIndex);
      this.context.propertyPane.refresh();
    }

    // Lock enable toggle - refresh to show/hide lock fields
    const lockEnabledMatch = propertyPath.match(/^tab(\d+)LockEnabled$/);
    if (lockEnabledMatch) {
      const tabIndex = parseInt(lockEnabledMatch[1], 10);
      if (newValue === false) {
        this._lockService?.lock(tabIndex);
      }
      this.context.propertyPane.refresh();
    }

    // Lock password input (stored as hash)
    const lockPasswordMatch = propertyPath.match(/^tab(\d+)LockPassword$/);
    if (lockPasswordMatch) {
      const tabIndex = parseInt(lockPasswordMatch[1], 10);
      const plainPassword = (newValue as string) || '';
      if (plainPassword.trim()) {
        void this.updateTabLockPassword(tabIndex, plainPassword);
      }
      // Always clear the plaintext field
      this.properties[`tab${tabIndex}LockPassword`] = '';
      this.context.propertyPane.refresh();
      return;
    }

    // Lock customization toggles - refresh to show/hide fields
    if (propertyPath.match(/^tab\d+LockUseCustomTemplate$/) || propertyPath.match(/^tab\d+LockCustomizeMessages$/)) {
      this.context.propertyPane.refresh();
    }

    if (propertyPath === 'lockDefaultTemplateEnabled' || propertyPath === 'lockDefaultMessagesEnabled') {
      this.context.propertyPane.refresh();
    }

    // TOC style preset selection - batch-apply preset properties
    const tocPresetMatch = propertyPath.match(/^tab(\d+)TocStylePreset$/);
    if (tocPresetMatch && newValue) {
      const tabIndex = parseInt(tocPresetMatch[1], 10);
      const presetConfig = getTocPreset(newValue as TocPresetKey);
      if (presetConfig) {
        const propMap: Array<[string, string]> = [
          ['fontFamily', 'TocFontFamily'], ['baseFontSize', 'TocBaseFontSize'],
          ['titleFontSize', 'TocTitleFontSize'], ['levelSizeStep', 'TocLevelSizeStep'],
          ['titleFontWeight', 'TocTitleFontWeight'], ['h2FontWeight', 'TocH2FontWeight'],
          ['subHeadingFontWeight', 'TocSubHeadingFontWeight'], ['lineHeight', 'TocLineHeight'],
          ['letterSpacing', 'TocLetterSpacing'], ['linkColor', 'TocLinkColor'],
          ['linkHoverColor', 'TocLinkHoverColor'], ['activeColor', 'TocActiveColor'],
          ['titleColor', 'TocTitleColor'], ['levelColorDimming', 'TocLevelColorDimming'],
          ['backgroundColor', 'TocBackgroundColor'], ['borderColor', 'TocBorderColor'],
          ['containerPadding', 'TocContainerPadding'], ['itemSpacing', 'TocItemSpacing'],
          ['indentPerLevel', 'TocIndentPerLevel'], ['maxWidth', 'TocMaxWidth'],
          ['listStyle', 'TocListStyle'], ['customIcon', 'TocCustomIcon'],
          ['enableScrollspy', 'TocEnableScrollspy'], ['enableCollapsible', 'TocEnableCollapsible'],
          ['enableHoverBackground', 'TocEnableHoverBackground'],
          ['hoverBackgroundColor', 'TocHoverBackgroundColor'],
          ['enableClickRipple', 'TocEnableClickRipple']
        ];
        propMap.forEach(([configKey, suffix]) => {
          const val = (presetConfig as Record<string, unknown>)[configKey];
          if (val !== undefined && val !== null) {
            this.properties[`tab${tabIndex}${suffix}`] = val as string | number | boolean;
          }
        });
        this.context.propertyPane.refresh();
      }
    }

    // TOC conditional fields - refresh when list style or toggles change
    if (propertyPath.match(/^tab\d+Toc(ListStyle|EnableHoverBackground|HideTitle|ShowBackLink)$/)) {
      this.context.propertyPane.refresh();
    }
  }

  private async updateTabLockPassword(tabIndex: number, plainPassword: string): Promise<void> {
    if (!this._lockService) return;

    const hash = await this._lockService.hashPassword(plainPassword);
    if (!hash) return;

    this.properties[`tab${tabIndex}LockPasswordHash`] = hash;
    this._lockService.lock(tabIndex);
    this.context.propertyPane.refresh();
    this.render();
  }

  /**
   * Called when property pane is opened
   */
  protected onPropertyPaneConfigurationStart(): void {
    this._isPropertyPaneOpen = true;

    // Initialize position warnings for all configured tabs
    const numTabs = this.properties.tabCount || 2;
    for (let i = 1; i <= numTabs; i++) {
      const webPartID = this.properties[`tab${i}WebPartID`] as string;
      if (webPartID) {
        this.updatePositionWarning(i, webPartID);
      }
    }

    this.render();
  }

  /**
   * Called when property pane is closed
   */
  protected onPropertyPaneConfigurationComplete(): void {
    this.clearHighlight();
    this._isPropertyPaneOpen = false;

    // IMPORTANT: Save connected webparts to localStorage when property pane closes
    // This ensures sections/webparts are hidden when switching to Preview mode
    this.saveConnectedWebpartsFromProperties();

    this.render();
  }

  /**
   * Generate CSS custom properties style string from web part properties
   */
  private getCustomCSSVariables(): string {
    const vars: string[] = [];

    // Colors
    if (this.properties.accentColor) {
      vars.push(`--pi-tab-accent: ${this.properties.accentColor}`);
    }
    if (this.properties.tabTextColor) {
      vars.push(`--pi-tab-text: ${this.properties.tabTextColor}`);
    }
    if (this.properties.tabActiveTextColor) {
      vars.push(`--pi-tab-text-active: ${this.properties.tabActiveTextColor}`);
    }
    if (this.properties.tabBackgroundColor) {
      vars.push(`--pi-tab-bg: ${this.properties.tabBackgroundColor}`);
    }
    if (this.properties.tabActiveBackgroundColor) {
      vars.push(`--pi-tab-bg-active: ${this.properties.tabActiveBackgroundColor}`);
    }
    if (this.properties.tabHoverBackgroundColor) {
      vars.push(`--pi-tab-bg-hover: ${this.properties.tabHoverBackgroundColor}`);
    }

    // Typography
    if (this.properties.tabFontSize) {
      vars.push(`--pi-tab-font-size: ${this.properties.tabFontSize}`);
    }
    if (this.properties.tabFontWeight) {
      vars.push(`--pi-tab-font-weight: ${this.properties.tabFontWeight}`);
    }

    // Spacing
    if (this.properties.tabPaddingVertical) {
      vars.push(`--pi-tab-padding-v: ${this.properties.tabPaddingVertical}`);
    }
    if (this.properties.tabPaddingHorizontal) {
      vars.push(`--pi-tab-padding-h: ${this.properties.tabPaddingHorizontal}`);
    }
    if (this.properties.tabGap) {
      vars.push(`--pi-tab-gap: ${this.properties.tabGap}`);
    }

    // Borders & Effects
    if (this.properties.tabBorderRadius) {
      vars.push(`--pi-tab-radius: ${this.properties.tabBorderRadius}`);
    }
    if (this.properties.activeIndicatorWidth) {
      vars.push(`--pi-tab-indicator-width: ${this.properties.activeIndicatorWidth}`);
    }
    if (this.properties.tabShadow) {
      vars.push(`--pi-tab-shadow: ${this.properties.tabShadow}`);
    }

    // Active Indicator & Separators
    if (this.properties.showActiveIndicator === false) {
      vars.push(`--pi-tab-indicator-display: none`);
    }
    if (this.properties.activeIndicatorColor) {
      vars.push(`--pi-tab-indicator-color: ${this.properties.activeIndicatorColor}`);
    }
    if (this.properties.showTabSeparator === false) {
      vars.push(`--pi-tab-separator-display: none`);
    }
    if (this.properties.tabSeparatorColor) {
      vars.push(`--pi-tab-separator-color: ${this.properties.tabSeparatorColor}`);
    }

    // Content Gap
    if (this.properties.tabContentGap) {
      vars.push(`--pi-tab-content-gap: ${this.properties.tabContentGap}`);
    }

    // Label Image Settings (skip if 'none' - handled by data attribute instead)
    if (this.properties.labelImageHeight && this.properties.labelImageHeight !== 'none') {
      vars.push(`--pi-label-image-height: ${this.properties.labelImageHeight}`);
    }

    return vars.join('; ');
  }

  public render(): void {

    // Clear any TOC re-scan intervals and scrollspy observers before re-rendering
    this._tocIntervals.forEach((intervalId) => clearInterval(intervalId));
    this._tocIntervals.clear();
    this._tocScrollspyCleanups.forEach(fn => fn());
    this._tocScrollspyCleanups = [];

    // Disconnect any previous full-width resize listeners before re-rendering
    if (this._fullWidthResizeObserver) {
      this._fullWidthResizeObserver.disconnect();
      this._fullWidthResizeObserver = null;
    }
    if (this._fullWidthResizeHandler) {
      window.removeEventListener('resize', this._fullWidthResizeHandler);
      this._fullWidthResizeHandler = null;
    }

    require('./AddTabs.js');
    require('./AddTabs.css');

    // Control body classes for Application Customizer CSS
    // In Read mode: add classes so hiding CSS and banner full-width CSS take effect
    // In Edit mode: remove classes so sections/webparts are visible for editing
    if (this.displayMode === DisplayMode.Read) {
      document.body.classList.add('picanvas-hiding-active');
      document.body.classList.add('picanvas-banner-fullwidth');
    } else {
      document.body.classList.remove('picanvas-hiding-active');
      document.body.classList.remove('picanvas-banner-fullwidth');
      // Also remove pre-hide styles injected by onInit() so webparts are visible in Edit mode
      this.removePreHideStyles();
    }

    if (this.displayMode === DisplayMode.Read) {
      // Get webpart ID from SharePoint DOM structure, or fallback to SPFx instance ID for workbench
      const tabWebPartID = $(this.domElement).closest("div." + this.properties.webpartClass).attr("id")
        || `picanvas-${this.context.instanceId}`;

      const tabsDiv = tabWebPartID + "tabs";
      const contentsDiv = tabWebPartID + "Contents";

      const tabStyle = this.properties.tabStyle || 'default';
      const tabAlignment = this.properties.tabAlignment || 'stretch';
      const tabOrientation = this.properties.tabOrientation || 'horizontal';
      const verticalTabPosition = this.properties.verticalTabPosition || 'left';
      const verticalTabWidth = this.properties.verticalTabWidth || '200px';
      const customStyles = this.getCustomCSSVariables();
      const transitionsAttr = this.properties.enableTransitions === false ? 'data-transitions="false"' : '';
      const unlimitedImageAttr = this.properties.labelImageHeight === 'none' ? 'data-label-image-unlimited="true"' : '';

      // Build orientation-specific attributes
      const orientationAttrs = tabOrientation === 'vertical'
        ? `data-tab-orientation="vertical" data-vertical-position="${verticalTabPosition}" style="${customStyles}; --pi-vertical-tab-width: ${verticalTabWidth}"`
        : `data-tab-orientation="horizontal" style="${customStyles}"`;

      // Check if all tabs have hidden labels (for content-only mode)
      const numTabs = this.getTabCount();
      let allTabsHidden = true;
      for (let i = 1; i <= numTabs; i++) {
        const labelType = (this.properties[`tab${i}LabelType`] as string) || 'text';
        if (labelType !== 'hidden') {
          allTabsHidden = false;
          break;
        }
      }

      // Add data attribute if all tabs should be hidden (content-only mode)
      const contentOnlyAttr = allTabsHidden ? 'data-content-only="true"' : '';
      const fullWidthEmbedAttr = this.hasFullWidthEmbed() ? 'data-has-fullwidth-embed="true"' : '';
      const fullHeightEmbedAttr = this.hasFullHeightEmbed() ? 'data-has-fullheight-embed="true"' : '';
      const fullWidthContentAttr = this.hasFullWidthContent() ? 'data-has-fullwidth-content="true"' : '';

      this.domElement.innerHTML = `<div data-addui='tabs' data-tab-style='${tabStyle}' data-tab-alignment='${tabAlignment}' ${orientationAttrs} ${transitionsAttr} ${unlimitedImageAttr} ${contentOnlyAttr} ${fullWidthEmbedAttr} ${fullHeightEmbedAttr} ${fullWidthContentAttr}><div role='tabs' id='${tabsDiv}'></div><div role='contents' id='${contentsDiv}'></div></div>`;

      // IMPORTANT: Call getSections() to mark DOM elements with data-picanvas-section-id
      // and data-picanvas-column-id BEFORE we try to find them in the render loop
      this.getSections();

      // Track webparts/sections/columns that have been used within THIS instance
      // Store the actual element reference so we can clone from it later
      const usedElements = new Map<string, JQuery<HTMLElement>>();

      // Get unique instance ID for this PiCanvas instance
      const instanceId = this.instanceId;

      // Clear any previous registrations from THIS instance (in case of re-render)
      PiCanvasWebPart._globalWebpartRegistry.forEach((value, key) => {
        if (value.instanceId === instanceId) {
          PiCanvasWebPart._globalWebpartRegistry.delete(key);
        }
      });

      // Build tabData from dynamic properties if tabData is empty or not set
      const thisTabData = this.getTabDataFromProperties();

      // Save connected webpart IDs to localStorage for PiCanvasLoader extension
      // This enables pre-hiding of webparts on next page load
      const connectedWebpartIds = thisTabData
        .filter(tab => tab.WebPartID && !tab.isPlaceholder)
        .map(tab => tab.WebPartID);
      if (connectedWebpartIds.length > 0) {
        this.saveConnectedWebpartsToStorage(connectedWebpartIds);
      }

      for (const x in thisTabData) {
        // Handle regular tabs (with WebPartID), placeholder tabs, and custom content tabs
        const isPlaceholder = thisTabData[x].isPlaceholder || false;
        const tabIndex = thisTabData[x].originalTabIndex || (parseInt(x) + 1);
        const tabLabelForLock = thisTabData[x].TabLabel || `Tab ${tabIndex}`;
        const contentType = (this.properties[`tab${tabIndex}ContentType`] as string) || 'webpart';
        const isCustomContent = contentType === 'markdown' || contentType === 'html' || contentType === 'mermaid' || contentType === 'embed' || contentType === 'javascript' || contentType === 'rss' || contentType === 'file' || contentType === 'landing' || contentType === 'toc' || contentType === 'profilereport';
        const lockState = this.getTabLockState(tabIndex);
        const lockEnabled = lockState.enabled && !isPlaceholder;

        // Process tab if it has WebPartID, is placeholder, or has custom content type
        if (thisTabData[x].WebPartID || isPlaceholder || isCustomContent) {
          // Create tab with HTML support - the label can contain HTML for styling
          const tabDiv = $("<div></div>");
          const labelType = (this.properties[`tab${tabIndex}LabelType`] as string) || 'text';
          tabDiv.attr('data-picanvas-tab-index', String(tabIndex));

          if (labelType === 'hidden') {
            // Hidden label mode - tab header is invisible but content still renders
            tabDiv.addClass('hidden-label-tab');
            tabDiv.attr('data-hidden-label', 'true');
            // Empty content - the tab bar CSS will hide this
            tabDiv.html('');
          } else if (labelType === 'webpart') {
            // Web part label mode - move the selected web part into the tab header
            const labelWebPartID = this.properties[`tab${tabIndex}LabelWebPartID`] as string;
            if (labelWebPartID) {
              const $labelWebPart = $("#" + labelWebPartID);
              if ($labelWebPart.length) {
                tabDiv.addClass('webpart-label-tab');

                // Check if this web part is also used as tab content
                const tabContentWebPartID = thisTabData[x].WebPartID;
                const isAlsoContent = (labelWebPartID === tabContentWebPartID);

                if (isAlsoContent) {
                  // Same web part for label and content - clone it for the label
                  const $clonedLabel = $labelWebPart.clone(true, true);
                  $clonedLabel.removeAttr('id').addClass('as-tab-label cloned-label');
                  tabDiv.append($clonedLabel);
                  // Original stays in place for tab content
                } else {
                  // Different web parts - move the label web part into the tab header
                  tabDiv.append($labelWebPart);
                  $labelWebPart.addClass('as-tab-label');
                }
              } else {
                // Fallback if web part not found
                tabDiv.html(`Tab ${tabIndex}`);
              }
            } else {
              // No label web part selected - show default
              tabDiv.html(`Tab ${tabIndex}`);
            }
          } else {
            // Text label mode - original behavior
            // Security: Encode tab label to prevent XSS
            const tabLabel = this.encodeHtml(thisTabData[x].TabLabel || `Tab ${tabIndex}`);

            // Check for per-tab image URL
            // Security: Sanitize image URL to prevent javascript: and other malicious protocols
            const rawImageUrl = this.properties[`tab${tabIndex}Image`] as string;
            const tabImageUrl = this.sanitizeImageUrl(rawImageUrl);
            const imagePosition = (this.properties[`tab${tabIndex}ImagePosition`] as string) || 'left';

            if (tabImageUrl && tabImageUrl.length > 0) {
              if (imagePosition === 'background') {
                // Background image mode - set as background style
                tabDiv.attr('data-has-bg-image', 'true');
                tabDiv.css('background-image', `url(${tabImageUrl})`);
                tabDiv.html(`<span>${tabLabel}</span>`);
              } else if (imagePosition === 'top') {
                // Image above text
                tabDiv.html(`<img src="${tabImageUrl}" class="tab-image tab-image-top" alt="" /><span>${tabLabel}</span>`);
              } else if (imagePosition === 'right') {
                // Image to the right of text
                tabDiv.html(`<span>${tabLabel}</span><img src="${tabImageUrl}" class="tab-image tab-image-right" alt="" />`);
              } else {
                // Default: Image to the left of text
                tabDiv.html(`<img src="${tabImageUrl}" class="tab-image" alt="" /><span>${tabLabel}</span>`);
              }
            } else {
              // No image - just render label as before
              tabDiv.html(tabLabel);
            }
          }

          if (lockEnabled) {
            tabDiv.attr('data-lock-enabled', 'true');
            tabDiv.attr('data-lock-unlocked', lockState.isUnlocked ? 'true' : 'false');
          }

          // Add divider attribute if enabled for this tab
          const hasDivider = this.properties[`tab${tabIndex}DividerAfter`] as boolean;
          if (hasDivider) {
            tabDiv.attr('data-divider-after', 'true');
          }

          // Mark placeholder tabs as disabled with tooltip
          if (isPlaceholder) {
            tabDiv.attr('data-placeholder', 'true');
            tabDiv.attr('data-placeholder-text', thisTabData[x].placeholderText || 'Restricted');
            tabDiv.addClass('tab-placeholder');
          }

          $("#" + tabsDiv).append(tabDiv);

          // Create a container for this tab's content with appropriate class
          // Each tab MUST have exactly one content container for the AddTabs library to work
          let tabContentContainer: JQuery<HTMLElement>;
          let $contentHost: JQuery<HTMLElement>;

          if (isPlaceholder) {
            // Placeholder tab - show restricted message instead of content
            const placeholderMessage = this.encodeHtml(thisTabData[x].placeholderText || 'Restricted');
            tabContentContainer = $(`<div class='picanvas-tab-content picanvas-placeholder-content'>
              <div class="placeholder-restricted-message">
                <span class="placeholder-icon">&#128274;</span>
                <span class="placeholder-text">${placeholderMessage}</span>
              </div>
            </div>`);
            $contentHost = tabContentContainer;
          } else {
            // Check content type for this tab (v3.0 feature)
            const contentType = (this.properties[`tab${tabIndex}ContentType`] as string) || 'webpart';

            // Check if lazy loading should be applied (non-first tabs)
            const enableLazy = this.properties.enableLazyLoading !== false && parseInt(x, 10) > 0;

            if (contentType === 'markdown') {
              // Render Markdown content - from manual input or Text WebPart
              const contentSourceType = (this.properties[`tab${tabIndex}ContentSourceType`] as string) || 'manual';
              console.log(`[PiCanvas] Tab ${tabIndex} (markdown): contentSourceType="${contentSourceType}"`);
              const lazyAttr = enableLazy ? `data-lazy="true" data-lazy-loaded="false"` : '';
              const contentFullWidth = this.properties[`tab${tabIndex}ContentFullWidth`] === true;
              const contentFullWidthAttr = contentFullWidth ? 'data-content-fullwidth="true"' : '';
              tabContentContainer = $(`<div class='picanvas-tab-content picanvas-custom-content markdown-content' ${lazyAttr} ${contentFullWidthAttr}></div>`);
              $contentHost = this.attachLockElements(tabContentContainer, tabIndex, tabLabelForLock, lockState);

              if (contentSourceType === 'webpart') {
                // Source: Text WebPart on the page
                const sourceWebPartID = (this.properties[`tab${tabIndex}ContentSourceWebPartID`] as string) || '';
                console.log(`[PiCanvas] Tab ${tabIndex}: Using Text WebPart source, ID="${sourceWebPartID}"`);
                if (!sourceWebPartID) {
                  const errorResult = ContentRenderer.renderFileError(strings.FileSourceWebPartMissingMessage || 'No Text WebPart selected. Please select a Text WebPart in the settings.');
                  $contentHost.html(errorResult.html);
                } else {
                  const extracted = this.extractTextWebPartContent(sourceWebPartID);
                  if (!extracted.content) {
                    const errorResult = ContentRenderer.renderFileError(strings.FileSourceWebPartEmptyMessage || 'The selected Text WebPart is empty or could not be read.');
                    $contentHost.html(errorResult.html);
                  } else {
                    // Render as Markdown (user chose Markdown)
                    // Substitute metadata tokens before rendering
                    const contentWithTokens = this._metadataTokenService
                      ? this._metadataTokenService.substituteTokensSync(extracted.content)
                      : extracted.content;
                    const rendered = ContentRenderer.renderMarkdown(contentWithTokens);
                    $contentHost.html(rendered.html);
                    // Hide the source Text WebPart
                    const $sourceWP = $(`#${sourceWebPartID}`);
                    if ($sourceWP.length) {
                      $sourceWP.closest('[data-automation-id="CanvasControl"], .ControlZone').hide();
                    }
                  }
                }
              } else {
                // Source: Manual input
                const customContent = (this.properties[`tab${tabIndex}CustomContent`] as string) || '';
                // Substitute metadata tokens before rendering
                const contentWithTokens = this._metadataTokenService
                  ? this._metadataTokenService.substituteTokensSync(customContent)
                  : customContent;
                const rendered = ContentRenderer.renderMarkdown(contentWithTokens);
                $contentHost.html(rendered.html);
              }

              // Inject inline TOC placeholder if enabled for this Markdown tab
              if (this.properties[`tab${tabIndex}TocEnabled`] === true) {
                const sanitizedTabsDiv = tabsDiv.replace(/[^a-zA-Z0-9_-]/g, '');
                const inlineTocId = `picanvas-inline-toc-${sanitizedTabsDiv}-${tabIndex}`;
                const placeholder = ContentRenderer.renderInlineTocPlaceholder(inlineTocId);
                $contentHost.prepend(placeholder);
                tabContentContainer.attr('data-inline-toc-min', String(this.properties[`tab${tabIndex}TocMinHeadings`] || '3'));
                tabContentContainer.attr('data-inline-toc-max-level', String(this.properties[`tab${tabIndex}TocMaxLevel`] || '3'));
              }

            } else if (contentType === 'html') {
              // Render HTML content (sanitized) - from manual input or Text WebPart
              const contentSourceType = (this.properties[`tab${tabIndex}ContentSourceType`] as string) || 'manual';
              console.log(`[PiCanvas] Tab ${tabIndex} (html): contentSourceType="${contentSourceType}"`);
              const lazyAttr = enableLazy ? `data-lazy="true" data-lazy-loaded="false"` : '';
              const contentFullWidth = this.properties[`tab${tabIndex}ContentFullWidth`] === true;
              const contentFullWidthAttr = contentFullWidth ? 'data-content-fullwidth="true"' : '';
              tabContentContainer = $(`<div class='picanvas-tab-content picanvas-custom-content html-content' ${lazyAttr} ${contentFullWidthAttr}></div>`);
              $contentHost = this.attachLockElements(tabContentContainer, tabIndex, tabLabelForLock, lockState);

              if (contentSourceType === 'webpart') {
                // Source: Text WebPart on the page
                const sourceWebPartID = (this.properties[`tab${tabIndex}ContentSourceWebPartID`] as string) || '';
                console.log(`[PiCanvas] Tab ${tabIndex}: Using Text WebPart source, ID="${sourceWebPartID}"`);
                if (!sourceWebPartID) {
                  const errorResult = ContentRenderer.renderFileError(strings.FileSourceWebPartMissingMessage || 'No Text WebPart selected. Please select a Text WebPart in the settings.');
                  $contentHost.html(errorResult.html);
                } else {
                  const extracted = this.extractTextWebPartContent(sourceWebPartID);
                  if (!extracted.content) {
                    const errorResult = ContentRenderer.renderFileError(strings.FileSourceWebPartEmptyMessage || 'The selected Text WebPart is empty or could not be read.');
                    $contentHost.html(errorResult.html);
                  } else {
                    // Render as HTML (ignore detected type, user chose HTML)
                    // Substitute metadata tokens before rendering
                    const contentWithTokens = this._metadataTokenService
                      ? this._metadataTokenService.substituteTokensSync(extracted.content)
                      : extracted.content;
                    const rendered = ContentRenderer.renderHtml(contentWithTokens);
                    $contentHost.html(rendered.html);
                    // Hide the source Text WebPart
                    const $sourceWP = $(`#${sourceWebPartID}`);
                    if ($sourceWP.length) {
                      $sourceWP.closest('[data-automation-id="CanvasControl"], .ControlZone').hide();
                    }
                  }
                }
              } else {
                // Source: Manual input
                const customContent = (this.properties[`tab${tabIndex}CustomContent`] as string) || '';
                // Substitute metadata tokens before rendering
                const contentWithTokens = this._metadataTokenService
                  ? this._metadataTokenService.substituteTokensSync(customContent)
                  : customContent;
                const rendered = ContentRenderer.renderHtml(contentWithTokens);
                $contentHost.html(rendered.html);
              }

              // Inject inline TOC placeholder if enabled for this HTML tab
              if (this.properties[`tab${tabIndex}TocEnabled`] === true) {
                const sanitizedTabsDiv = tabsDiv.replace(/[^a-zA-Z0-9_-]/g, '');
                const inlineTocId = `picanvas-inline-toc-${sanitizedTabsDiv}-${tabIndex}`;
                const placeholder = ContentRenderer.renderInlineTocPlaceholder(inlineTocId);
                $contentHost.prepend(placeholder);
                tabContentContainer.attr('data-inline-toc-min', String(this.properties[`tab${tabIndex}TocMinHeadings`] || '3'));
                tabContentContainer.attr('data-inline-toc-max-level', String(this.properties[`tab${tabIndex}TocMaxLevel`] || '3'));
              }

            } else if (contentType === 'mermaid') {
              // Render Mermaid diagram (requires post-render initialization)
              const customContent = (this.properties[`tab${tabIndex}CustomContent`] as string) || '';
              // Sanitize ID for CSS selector compatibility (remove invalid chars like = from base64)
              const sanitizedTabsDiv = tabsDiv.replace(/[^a-zA-Z0-9_-]/g, '');
              const mermaidId = `mermaid-${sanitizedTabsDiv}-${tabIndex}`;
              const rendered = ContentRenderer.prepareMermaid(customContent, mermaidId);
              const lazyAttr = enableLazy ? `data-lazy="true" data-lazy-loaded="false"` : '';
              tabContentContainer = $(`<div class='picanvas-tab-content picanvas-custom-content mermaid-content' ${lazyAttr}></div>`);
              $contentHost = this.attachLockElements(tabContentContainer, tabIndex, tabLabelForLock, lockState);
              $contentHost.html(rendered.html);

            } else if (contentType === 'embed') {
              // Render embed iframe (URL validated against allow list)
              const embedUrl = (this.properties[`tab${tabIndex}EmbedUrl`] as string) || '';
              const rawEmbedHeight = (this.properties[`tab${tabIndex}EmbedHeight`] as string) || '400px';
              const embedFullPage = this.properties[`tab${tabIndex}EmbedFullPage`] as boolean;
              const embedFullHeight = embedFullPage || (this.properties[`tab${tabIndex}EmbedFullHeight`] as boolean);
              const embedHeight = embedFullHeight ? '100vh' : rawEmbedHeight;
              const embedFullWidth = embedFullPage || (this.properties[`tab${tabIndex}EmbedFullWidth`] as boolean);
              const embedFullWidthAttr = embedFullWidth ? 'data-embed-fullwidth="true"' : '';
              const embedFullHeightAttr = embedFullHeight ? 'data-embed-fullheight="true"' : '';
              const deferEmbed = lockEnabled && !lockState.isUnlocked;
              const rendered = ContentRenderer.renderEmbed({ url: embedUrl, height: embedHeight, defer: deferEmbed });
              const lazyAttr = enableLazy ? `data-lazy="true" data-lazy-loaded="false"` : '';
              tabContentContainer = $(`<div class='picanvas-tab-content picanvas-custom-content embed-content' ${lazyAttr} ${embedFullWidthAttr} ${embedFullHeightAttr}></div>`);
              $contentHost = this.attachLockElements(tabContentContainer, tabIndex, tabLabelForLock, lockState);
              $contentHost.html(rendered.html);

            } else if (contentType === 'rss') {
              // Render RSS feed content
              const feedUrl = (this.properties[`tab${tabIndex}RssFeedUrl`] as string) || '';
              const lazyAttr = enableLazy ? `data-lazy="true" data-lazy-loaded="false"` : '';
              tabContentContainer = $(`<div class='picanvas-tab-content picanvas-custom-content rss-content' ${lazyAttr} data-rss-feed-url="${feedUrl}"></div>`);
              $contentHost = this.attachLockElements(tabContentContainer, tabIndex, tabLabelForLock, lockState);

              if (!feedUrl) {
                // Show error if no URL configured
                const errorResult = ContentRenderer.renderRssError('No feed URL configured. Please enter an RSS or Atom feed URL in the web part settings.');
                $contentHost.html(errorResult.html);
              } else {
                // Show loading state initially
                const loadingMessage = (this.properties[`tab${tabIndex}RssLoadingMessage`] as string) || 'Loading feed...';
                const loadingResult = ContentRenderer.renderRssLoading(loadingMessage);
                $contentHost.html(loadingResult.html);

                // Store tab info for async rendering
                const rssTabInfo = {
                  tabIndex,
                  feedUrl,
                  $contentHost,
                  layout: (this.properties[`tab${tabIndex}RssLayout`] as 'list' | 'cards' | 'compact') || 'list',
                  maxItems: parseInt((this.properties[`tab${tabIndex}RssMaxItems`] as string) || '10', 10),
                  showDate: this.properties[`tab${tabIndex}RssShowDate`] !== false,
                  showDescription: this.properties[`tab${tabIndex}RssShowDescription`] !== false,
                  showImage: this.properties[`tab${tabIndex}RssShowImage`] !== false,
                  showAuthor: this.properties[`tab${tabIndex}RssShowAuthor`] === true,
                  descriptionLimit: parseInt((this.properties[`tab${tabIndex}RssDescriptionLimit`] as string) || '150', 10),
                  dateFormat: (this.properties[`tab${tabIndex}RssDateFormat`] as 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'relative') || 'relative',
                  linkTarget: (this.properties[`tab${tabIndex}RssLinkTarget`] as '_blank' | '_self') || '_blank'
                };

                // Async fetch and render
                this.fetchAndRenderRssFeed(rssTabInfo);
              }

            } else if (contentType === 'file') {
              // Render external file content - either from URL or Text WebPart
              const fileSourceType = (this.properties[`tab${tabIndex}FileSourceType`] as string) || 'url';
              const lazyAttr = enableLazy ? `data-lazy="true" data-lazy-loaded="false"` : '';
              tabContentContainer = $(`<div class='picanvas-tab-content picanvas-custom-content file-content' ${lazyAttr} data-source-type="${fileSourceType}"></div>`);
              $contentHost = this.attachLockElements(tabContentContainer, tabIndex, tabLabelForLock, lockState);

              if (fileSourceType === 'webpart') {
                // Source: Text WebPart on the page
                const sourceWebPartID = (this.properties[`tab${tabIndex}FileSourceWebPartID`] as string) || '';

                if (!sourceWebPartID) {
                  const errorResult = ContentRenderer.renderFileError(strings.FileSourceWebPartMissingMessage || 'No Text WebPart selected. Please select a Text WebPart in the settings.');
                  $contentHost.html(errorResult.html);
                } else {
                  // Extract content from the Text WebPart
                  const extracted = this.extractTextWebPartContent(sourceWebPartID);

                  if (!extracted.content) {
                    const errorResult = ContentRenderer.renderFileError(strings.FileSourceWebPartEmptyMessage || 'The selected Text WebPart is empty or could not be read.');
                    $contentHost.html(errorResult.html);
                  } else {
                    // Render the extracted content
                    // Substitute metadata tokens before rendering
                    const contentWithTokens = this._metadataTokenService
                      ? this._metadataTokenService.substituteTokensSync(extracted.content)
                      : extracted.content;
                    const rendered = ContentRenderer.renderFileContent(contentWithTokens, extracted.contentType);
                    $contentHost.html(rendered.html);

                    // Hide the source Text WebPart since we're displaying its content
                    const $sourceWP = $(`#${sourceWebPartID}`);
                    if ($sourceWP.length) {
                      $sourceWP.closest('[data-automation-id="CanvasControl"], .ControlZone').hide();
                    }
                  }
                }
              } else {
                // Source: External URL (file from SharePoint)
                const fileUrl = (this.properties[`tab${tabIndex}FileUrl`] as string) || '';

                if (!fileUrl) {
                  // Show error if no URL configured
                  const errorResult = ContentRenderer.renderFileError(strings.FileUrlMissingMessage || 'No file URL configured. Please enter a file path in the web part settings.');
                  $contentHost.html(errorResult.html);
                } else {
                  // Detect file type and validate
                  const fileType = ContentRenderer.detectFileType(fileUrl);
                  if (fileType === 'unknown') {
                    const errorResult = ContentRenderer.renderFileError(strings.FileTypeUnsupportedMessage || 'Unsupported file type. Only .html and .md files are supported.');
                    $contentHost.html(errorResult.html);
                  } else {
                    // Show loading state initially
                    const loadingResult = ContentRenderer.renderFileLoading(strings.FileLoadingMessage || 'Loading content...');
                    $contentHost.html(loadingResult.html);

                    // Async fetch and render
                    this.fetchAndRenderFileContent(tabIndex, fileUrl, fileType, $contentHost);
                  }
                }
              }

            } else if (contentType === 'javascript') {
              // Render JavaScript code (requires post-render execution)
              // Sources: Template, Text WebPart, or Manual Input
              const templateId = (this.properties[`tab${tabIndex}JavaScriptTemplate`] as string) || '';
              const contentSourceType = (this.properties[`tab${tabIndex}ContentSourceType`] as string) || 'manual';
              const jsDisplayMode = (this.properties[`tab${tabIndex}JavaScriptDisplayMode`] as string) || 'contained';
              console.log(`[PiCanvas] Tab ${tabIndex} (javascript): template="${templateId}", contentSourceType="${contentSourceType}", displayMode="${jsDisplayMode}"`);
              const lazyAttr = enableLazy ? `data-lazy="true" data-lazy-loaded="false"` : '';
              // Sanitize ID for CSS selector compatibility
              const sanitizedTabsDiv = tabsDiv.replace(/[^a-zA-Z0-9_-]/g, '');
              const jsId = `picanvas-js-${sanitizedTabsDiv}-${tabIndex}`;
              // Note: display mode styling is applied directly to .picanvas-js-container in prepareJavaScript
              tabContentContainer = $(`<div class='picanvas-tab-content picanvas-custom-content javascript-content' ${lazyAttr}></div>`);
              $contentHost = this.attachLockElements(tabContentContainer, tabIndex, tabLabelForLock, lockState);

              let jsCode = '';

              // Check if a template is selected
              if (templateId) {
                const template = getJavaScriptTemplate(templateId);
                if (template) {
                  // Get template configuration from property pane fields
                  const templateConfig = this.getJavaScriptTemplateConfig(tabIndex, template);
                  console.log(`[PiCanvas] Tab ${tabIndex}: Using template "${templateId}" with config:`, templateConfig);
                  // Generate code from template
                  jsCode = template.generateCode(templateConfig);
                } else {
                  console.warn(`[PiCanvas] Tab ${tabIndex}: Template "${templateId}" not found`);
                }
              } else if (contentSourceType === 'webpart') {
                // Source: Text WebPart on the page
                const sourceWebPartID = (this.properties[`tab${tabIndex}ContentSourceWebPartID`] as string) || '';
                console.log(`[PiCanvas] Tab ${tabIndex}: Using Text WebPart source for JavaScript, ID="${sourceWebPartID}"`);
                if (!sourceWebPartID) {
                  const errorResult = ContentRenderer.renderFileError(strings.FileSourceWebPartMissingMessage || 'No Text WebPart selected. Please select a Text WebPart in the settings.');
                  $contentHost.html(errorResult.html);
                } else {
                  const extracted = this.extractTextWebPartContent(sourceWebPartID);
                  if (!extracted.content) {
                    const errorResult = ContentRenderer.renderFileError(strings.FileSourceWebPartEmptyMessage || 'The selected Text WebPart is empty or could not be read.');
                    $contentHost.html(errorResult.html);
                  } else {
                    // Substitute metadata tokens before rendering
                    jsCode = this._metadataTokenService
                      ? this._metadataTokenService.substituteTokensSync(extracted.content)
                      : extracted.content;
                    // Hide the source Text WebPart
                    const $sourceWP = $(`#${sourceWebPartID}`);
                    if ($sourceWP.length) {
                      $sourceWP.closest('[data-automation-id="CanvasControl"], .ControlZone').hide();
                    }
                  }
                }
              } else {
                // Source: Manual input
                jsCode = (this.properties[`tab${tabIndex}CustomContent`] as string) || '';
              }

              // Render if we have code
              if (jsCode) {
                const rendered = ContentRenderer.prepareJavaScript(jsCode, jsId, jsDisplayMode);
                $contentHost.html(rendered.html);
              }

            } else if (contentType === 'toc') {
              // Render Table of Contents (scans page headings post-render)
              const lazyAttr = enableLazy ? `data-lazy="true" data-lazy-loaded="false"` : '';
              tabContentContainer = $(`<div class='picanvas-tab-content picanvas-custom-content toc-content' ${lazyAttr}></div>`);
              $contentHost = this.attachLockElements(tabContentContainer, tabIndex, tabLabelForLock, lockState);

              // Build TOC config from properties
              const tocConfig: ITocConfig = {
                searchText: this.properties[`tab${tabIndex}TocSearchText`] !== false,
                searchMarkdown: this.properties[`tab${tabIndex}TocSearchMarkdown`] !== false,
                searchCollapsible: this.properties[`tab${tabIndex}TocSearchCollapsible`] === true,
                showH2: this.properties[`tab${tabIndex}TocShowH2`] !== false,
                showH3: this.properties[`tab${tabIndex}TocShowH3`] !== false,
                showH4: this.properties[`tab${tabIndex}TocShowH4`] === true,
                showH5: this.properties[`tab${tabIndex}TocShowH5`] === true,
                listStyle: (this.properties[`tab${tabIndex}TocListStyle`] as ITocConfig['listStyle']) || 'disc',
                stickyMode: this.properties[`tab${tabIndex}TocStickyMode`] === true,
                hideInMobile: this.properties[`tab${tabIndex}TocHideInMobile`] === true,
                hideTitle: this.properties[`tab${tabIndex}TocHideTitle`] === true,
                titleText: (this.properties[`tab${tabIndex}TocTitleText`] as string) || 'Table of Contents',
                showBackLink: this.properties[`tab${tabIndex}TocShowBackLink`] === true,
                backLinkText: (this.properties[`tab${tabIndex}TocBackLinkText`] as string) || '',
                // Styling properties (v3.8)
                stylePreset: (this.properties[`tab${tabIndex}TocStylePreset`] as string) || '',
                fontFamily: (this.properties[`tab${tabIndex}TocFontFamily`] as string) || '',
                baseFontSize: (this.properties[`tab${tabIndex}TocBaseFontSize`] as number) ?? 14,
                titleFontSize: (this.properties[`tab${tabIndex}TocTitleFontSize`] as number) ?? 16,
                levelSizeStep: (this.properties[`tab${tabIndex}TocLevelSizeStep`] as number) ?? 1,
                titleFontWeight: (this.properties[`tab${tabIndex}TocTitleFontWeight`] as string) || '600',
                h2FontWeight: (this.properties[`tab${tabIndex}TocH2FontWeight`] as string) || '600',
                subHeadingFontWeight: (this.properties[`tab${tabIndex}TocSubHeadingFontWeight`] as string) || '400',
                lineHeight: (this.properties[`tab${tabIndex}TocLineHeight`] as number) ?? 1.6,
                letterSpacing: (this.properties[`tab${tabIndex}TocLetterSpacing`] as number) ?? 0,
                linkColor: (this.properties[`tab${tabIndex}TocLinkColor`] as string) || '',
                linkHoverColor: (this.properties[`tab${tabIndex}TocLinkHoverColor`] as string) || '',
                activeColor: (this.properties[`tab${tabIndex}TocActiveColor`] as string) || '',
                titleColor: (this.properties[`tab${tabIndex}TocTitleColor`] as string) || '',
                levelColorDimming: (this.properties[`tab${tabIndex}TocLevelColorDimming`] as number) ?? 10,
                backgroundColor: (this.properties[`tab${tabIndex}TocBackgroundColor`] as string) || '',
                borderColor: (this.properties[`tab${tabIndex}TocBorderColor`] as string) || '',
                containerPadding: (this.properties[`tab${tabIndex}TocContainerPadding`] as number) ?? 16,
                itemSpacing: (this.properties[`tab${tabIndex}TocItemSpacing`] as number) ?? 4,
                indentPerLevel: (this.properties[`tab${tabIndex}TocIndentPerLevel`] as number) ?? 20,
                maxWidth: (this.properties[`tab${tabIndex}TocMaxWidth`] as string) || '',
                customIcon: (this.properties[`tab${tabIndex}TocCustomIcon`] as string) || '',
                enableScrollspy: this.properties[`tab${tabIndex}TocEnableScrollspy`] === true,
                enableCollapsible: this.properties[`tab${tabIndex}TocEnableCollapsible`] === true,
                enableHoverBackground: this.properties[`tab${tabIndex}TocEnableHoverBackground`] === true,
                hoverBackgroundColor: (this.properties[`tab${tabIndex}TocHoverBackgroundColor`] as string) || '',
                enableClickRipple: this.properties[`tab${tabIndex}TocEnableClickRipple`] === true
              };

              const sanitizedTabsDiv = tabsDiv.replace(/[^a-zA-Z0-9_-]/g, '');
              const tocId = `picanvas-toc-${sanitizedTabsDiv}-${tabIndex}`;
              const configJson = JSON.stringify(tocConfig);
              const rendered = ContentRenderer.renderTocPlaceholder(tocId, configJson);
              $contentHost.html(rendered.html);

            } else if (contentType === 'profilereport') {
              // Render Profile Report viewer
              const libraryName = (this.properties[`tab${tabIndex}ProfileReportLibrary`] as string) || 'Profiles';
              const sanitizedLibraryName = libraryName.replace(/[^a-zA-Z0-9 _-]/g, '');
              const listNameRaw = (this.properties[`tab${tabIndex}ProfileReportListName`] as string) || '';
              const sanitizedListName = listNameRaw ? listNameRaw.replace(/[^a-zA-Z0-9 _-]/g, '') : '';
              const lazyAttr = enableLazy ? `data-lazy="true" data-lazy-loaded="false"` : '';
              tabContentContainer = $(`<div class='picanvas-tab-content picanvas-custom-content profilereport-content' ${lazyAttr}></div>`);
              $contentHost = this.attachLockElements(tabContentContainer, tabIndex, tabLabelForLock, lockState);

              // Build and validate config
              const layoutValue = this.properties[`tab${tabIndex}ProfileReportLayout`] as string;
              const sortByValue = this.properties[`tab${tabIndex}ProfileReportSortBy`] as string;
              const themeValue = this.properties[`tab${tabIndex}ProfileReportTheme`] as string;

              // Backward compat: migrate old enableFullscreen → displayMode
              let displayModeValue = this.properties[`tab${tabIndex}ProfileReportDisplayMode`] as string;
              if (!displayModeValue && this.properties[`tab${tabIndex}ProfileReportEnableFullscreen`] === true) {
                displayModeValue = 'fullSection'; // migrate old fullscreen toggle to fullSection
              }
              const validDisplayModes = ['contained', 'fullSection', 'fullScreen'];
              const resolvedDisplayMode = validDisplayModes.indexOf(displayModeValue) !== -1 ? displayModeValue : 'contained';

              const config: IProfileReportDisplayConfig = {
                layout: (layoutValue === 'tabbed' || layoutValue === 'accordion' || layoutValue === 'cards') ? layoutValue : 'tabbed',
                libraryName: sanitizedLibraryName,
                listName: sanitizedListName || undefined,
                showMethodK: this.properties[`tab${tabIndex}ProfileReportShowMethodK`] !== false,
                showMethodL: this.properties[`tab${tabIndex}ProfileReportShowMethodL`] !== false,
                showMethodM: this.properties[`tab${tabIndex}ProfileReportShowMethodM`] !== false,
                showProfileJson: this.properties[`tab${tabIndex}ProfileReportShowProfileJson`] !== false,
                companyLimit: (this.properties[`tab${tabIndex}ProfileReportCompanyLimit`] as number) || 0,
                sortBy: (sortByValue === 'name' || sortByValue === 'date' || sortByValue === 'key') ? sortByValue : 'name',
                theme: themeValue || 'auto',
                displayMode: resolvedDisplayMode as 'contained' | 'fullSection' | 'fullScreen',
                sidebarWidth: (this.properties[`tab${tabIndex}ProfileReportSidebarWidth`] as string) || '280px',
                enableMetadataDiscovery: this.properties[`tab${tabIndex}ProfileReportEnableMetadata`] === true,
                metadataCompanyColumn: (this.properties[`tab${tabIndex}ProfileReportMetadataCompanyCol`] as string) || 'Pi_CompanyID',
                metadataFileCategoryColumn: (this.properties[`tab${tabIndex}ProfileReportMetadataFileCategory`] as string) || 'FileCategory'
              };

              // Show loading state immediately
              const loadingResult = ContentRenderer.renderProfileReportLoading(`Loading from ${libraryName}...`);
              $contentHost.html(loadingResult.html);

              // Fetch and render async
              this.fetchAndRenderProfileReports(tabIndex, config, $contentHost);

            } else {
              // Default: webpart or section content type
              // Check if this is a section or column selection
              const isSection = thisTabData[x].WebPartID.indexOf("SECTION:") === 0;
              const isColumn = thisTabData[x].WebPartID.indexOf("COLUMN:") === 0;

              // Use different classes for sections/columns (preserve layout) vs individual webparts (full width)
              const contentClass = (isSection || isColumn) ? 'picanvas-tab-content picanvas-section-content' : 'picanvas-tab-content picanvas-single-webpart';
              const lazyAttr = enableLazy ? `data-lazy="true" data-lazy-loaded="false"` : '';
              // Per-tab full-width banner setting (defaults to true for backward compatibility)
              const fullWidthBanner = this.properties[`tab${tabIndex}FullWidthBanner`] as boolean ?? true;
              const fullWidthAttr = `data-fullwidth-banner="${fullWidthBanner}"`;
              tabContentContainer = $(`<div class='${contentClass}' ${lazyAttr} ${fullWidthAttr}></div>`);
              $contentHost = this.attachLockElements(tabContentContainer, tabIndex, tabLabelForLock, lockState);

              if (isSection) {
                const sectionId = thisTabData[x].WebPartID.substring(8); // Remove "SECTION:" prefix
                const elementKey = thisTabData[x].WebPartID;

                // Check GLOBAL registry first - is this section owned by ANOTHER PiCanvas instance?
                const globalOwner = PiCanvasWebPart._globalWebpartRegistry.get(elementKey);
                if (globalOwner && globalOwner.instanceId !== instanceId) {
                  // OWNED BY ANOTHER INSTANCE: Try to clone it
                  console.log(`[PiCanvas] Tab ${x}: Section "${elementKey}" owned by another instance, attempting clone`);

                  const $originalSection = globalOwner.$element;
                  if ($originalSection && $originalSection.length) {
                    const $clonedSection = $originalSection.clone(true, true);
                    const cloneSuffix = '-clone-' + instanceId;
                    $clonedSection.find('[id]').addBack('[id]').each(function () {
                      const $el = $(this);
                      const oldId = $el.attr('id');
                      if (oldId) { $el.attr('id', oldId + cloneSuffix); }
                    });
                    $clonedSection.attr('data-picanvas-clone', 'true');
                    $clonedSection.addClass('picanvas-cloned-webpart');
                    $contentHost.append($clonedSection);
                    tabContentContainer.addClass('picanvas-cloned-content');
                    console.log(`[PiCanvas] Tab ${x}: Successfully cloned section from another instance`);
                  } else {
                    tabContentContainer.addClass('picanvas-unavailable-content');
                    $contentHost.html(`
                      <div class="picanvas-unavailable-message" style="padding: 20px; text-align: center; color: #666; background: #f5f5f5; border-radius: 4px; margin: 10px;">
                        <div style="font-size: 24px; margin-bottom: 8px;">⚠️</div>
                        <div style="font-weight: 500;">Content unavailable</div>
                        <div style="font-size: 12px; margin-top: 4px;">Could not load this section. Try refreshing the page.</div>
                      </div>
                    `);
                  }
                } else if (usedElements.has(elementKey)) {
                  // DUPLICATE USE WITHIN THIS INSTANCE: Mark for shared handling
                  console.log(`[PiCanvas] Tab ${x}: Duplicate section within instance, marking container for sharing`);
                  tabContentContainer.attr('data-shared-webpart-id', elementKey);
                  tabContentContainer.addClass('picanvas-shared-content');
                } else {
                  // First use - find and move the original section
                  let $section = $(`[data-picanvas-section-id="${sectionId}"]`);
                  if (!$section.length) {
                    $section = $(`[data-automation-id="${sectionId}"]`);
                  }
                  if (!$section.length) {
                    $section = $(`#${sectionId}`);
                  }

                  if ($section.length) {
                    // Store in LOCAL registry
                    usedElements.set(elementKey, $section);
                    // Register in GLOBAL registry
                    PiCanvasWebPart._globalWebpartRegistry.set(elementKey, { instanceId, $element: $section });
                    $section.attr('data-picanvas-shared', 'true');
                    $section.attr('data-picanvas-webpart-id', elementKey);
                    $section.attr('data-picanvas-owner', instanceId);
                    tabContentContainer.attr('data-shared-webpart-id', elementKey);
                    $contentHost.append($section);

                    // Fallback: if container ended up empty, move all webparts inside the section
                    if ($contentHost.children().length === 0) {
                      const $webpartsInSection = $section.find('.ControlZone, [data-automation-id="CanvasControl"]');
                      $webpartsInSection.each((_i, wp) => { $contentHost.append(wp); });
                    }
                  }
                }
              } else if (isColumn) {
                const columnId = thisTabData[x].WebPartID.substring(7); // Remove "COLUMN:" prefix
                const elementKey = thisTabData[x].WebPartID;

                // Check GLOBAL registry first - is this column owned by ANOTHER PiCanvas instance?
                const globalOwner = PiCanvasWebPart._globalWebpartRegistry.get(elementKey);
                if (globalOwner && globalOwner.instanceId !== instanceId) {
                  // OWNED BY ANOTHER INSTANCE: Try to clone it
                  console.log(`[PiCanvas] Tab ${x}: Column "${elementKey}" owned by another instance, attempting clone`);

                  const $originalColumn = globalOwner.$element;
                  if ($originalColumn && $originalColumn.length) {
                    const $clonedColumn = $originalColumn.clone(true, true);
                    const cloneSuffix = '-clone-' + instanceId;
                    $clonedColumn.find('[id]').addBack('[id]').each(function () {
                      const $el = $(this);
                      const oldId = $el.attr('id');
                      if (oldId) { $el.attr('id', oldId + cloneSuffix); }
                    });
                    $clonedColumn.attr('data-picanvas-clone', 'true');
                    $clonedColumn.addClass('picanvas-cloned-webpart');
                    $contentHost.append($clonedColumn);
                    tabContentContainer.addClass('picanvas-cloned-content');
                    console.log(`[PiCanvas] Tab ${x}: Successfully cloned column from another instance`);
                  } else {
                    tabContentContainer.addClass('picanvas-unavailable-content');
                    $contentHost.html(`
                      <div class="picanvas-unavailable-message" style="padding: 20px; text-align: center; color: #666; background: #f5f5f5; border-radius: 4px; margin: 10px;">
                        <div style="font-size: 24px; margin-bottom: 8px;">⚠️</div>
                        <div style="font-weight: 500;">Content unavailable</div>
                        <div style="font-size: 12px; margin-top: 4px;">Could not load this column. Try refreshing the page.</div>
                      </div>
                    `);
                  }
                } else if (usedElements.has(elementKey)) {
                  // DUPLICATE USE WITHIN THIS INSTANCE: Mark for shared handling
                  console.log(`[PiCanvas] Tab ${x}: Duplicate column within instance, marking container for sharing`);
                  tabContentContainer.attr('data-shared-webpart-id', elementKey);
                  tabContentContainer.addClass('picanvas-shared-content');
                } else {
                  // First use - find and move the original column
                  let $column = $(`[data-picanvas-column-id="${columnId}"]`);
                  if (!$column.length) {
                    $column = $(`[data-automation-id="${columnId}"]`);
                  }
                  if (!$column.length) {
                    $column = $(`#${columnId}`);
                  }

                  if ($column.length) {
                    // Store in LOCAL registry
                    usedElements.set(elementKey, $column);
                    // Register in GLOBAL registry
                    PiCanvasWebPart._globalWebpartRegistry.set(elementKey, { instanceId, $element: $column });
                    $column.attr('data-picanvas-shared', 'true');
                    $column.attr('data-picanvas-webpart-id', elementKey);
                    $column.attr('data-picanvas-owner', instanceId);
                    tabContentContainer.attr('data-shared-webpart-id', elementKey);
                    $contentHost.append($column);
                  }
                }
              } else {
                // Individual webpart
                const elementKey = thisTabData[x].WebPartID;

                console.log(`[PiCanvas] Tab ${x}: Processing webpart ID "${elementKey}"`);
                console.log(`[PiCanvas] Tab ${x}: usedElements has key: ${usedElements.has(elementKey)}`);

                // Check GLOBAL registry first - is this webpart owned by ANOTHER PiCanvas instance?
                const globalOwner = PiCanvasWebPart._globalWebpartRegistry.get(elementKey);
                if (globalOwner && globalOwner.instanceId !== instanceId) {
                  // OWNED BY ANOTHER INSTANCE: Try to clone it
                  // Static content (images, text) will display correctly; interactive features won't work
                  console.log(`[PiCanvas] Tab ${x}: Webpart "${elementKey}" owned by another instance, attempting clone`);

                  const $originalWebpart = globalOwner.$element;
                  if ($originalWebpart && $originalWebpart.length) {
                    // Deep clone the webpart DOM (includes data and events where possible)
                    const $clonedWebpart = $originalWebpart.clone(true, true);

                    // Remove IDs to avoid duplicates (add unique suffix)
                    const cloneSuffix = '-clone-' + instanceId;
                    $clonedWebpart.find('[id]').addBack('[id]').each(function () {
                      const $el = $(this);
                      const oldId = $el.attr('id');
                      if (oldId) {
                        $el.attr('id', oldId + cloneSuffix);
                      }
                    });

                    // Mark as a clone
                    $clonedWebpart.attr('data-picanvas-clone', 'true');
                    $clonedWebpart.attr('data-picanvas-clone-source', elementKey);
                    $clonedWebpart.addClass('picanvas-cloned-webpart');

                    // Add to container
                    $contentHost.append($clonedWebpart);
                    tabContentContainer.addClass('picanvas-cloned-content');

                    // FORCE IMAGE LOADING: SharePoint uses lazy loading that doesn't trigger for cloned elements
                    // Copy ALL computed background-image styles from original to clone (not just inline)
                    $originalWebpart.find('*').each(function (i) {
                      const bgImage = window.getComputedStyle(this).backgroundImage;
                      if (bgImage && bgImage !== 'none') {
                        const $cloneEl = $clonedWebpart.find('*').eq(i);
                        if ($cloneEl.length) {
                          $cloneEl.css('background-image', bgImage);
                        }
                      }
                    });

                    // Also check the root element
                    const rootBgImage = window.getComputedStyle($originalWebpart[0]).backgroundImage;
                    if (rootBgImage && rootBgImage !== 'none') {
                      $clonedWebpart.css('background-image', rootBgImage);
                    }

                    // Force img src to reload (handle all variations)
                    $clonedWebpart.find('img, picture source').each(function () {
                      const $el = $(this);
                      const src = $el.attr('src') || $el.attr('data-src') || $el.attr('srcset') || $el.attr('data-srcset');
                      if (src) {
                        if ($el.attr('srcset') || $el.attr('data-srcset')) {
                          $el.attr('srcset', src);
                        } else {
                          $el.attr('src', src);
                          if (this.tagName === 'IMG') {
                            (this as HTMLImageElement).src = src;
                          }
                        }
                        $el.removeAttr('data-src');
                        $el.removeAttr('data-srcset');
                        $el.removeAttr('loading'); // Remove lazy loading attribute
                      }
                    });

                    // Force visibility and display on ALL elements
                    $clonedWebpart.css({
                      'visibility': 'visible',
                      'opacity': '1',
                      'display': 'block'
                    });
                    $clonedWebpart.find('*').css({
                      'visibility': 'visible',
                      'opacity': '1'
                    });
                    // Remove any lazy/hidden classes that SharePoint might use
                    $clonedWebpart.find('[class*="lazy"], [class*="hidden"], [class*="placeholder"]').removeClass(function (_i, className) {
                      return (className.match(/(^|\s)(lazy|hidden|placeholder)\S*/g) || []).join(' ');
                    });

                    // Trigger events to wake up lazy loaders
                    setTimeout(() => {
                      window.dispatchEvent(new Event('resize'));
                      window.dispatchEvent(new Event('scroll'));
                      // Force reflow on the cloned element
                      void $clonedWebpart[0].offsetHeight;
                      // Trigger intersection observer by simulating visibility change
                      $clonedWebpart.find('img').each(function () {
                        void (this as HTMLImageElement).offsetHeight;
                      });
                    }, 100);

                    // Second attempt with longer delay
                    setTimeout(() => {
                      window.dispatchEvent(new Event('resize'));
                      this.forceImageWebpartLoad($clonedWebpart);
                    }, 300);

                    console.log(`[PiCanvas] Tab ${x}: Successfully cloned webpart from another instance`);
                  } else {
                    // Fallback: show message if clone source not found
                    console.log(`[PiCanvas] Tab ${x}: Could not find source webpart to clone`);
                    tabContentContainer.addClass('picanvas-unavailable-content');
                    $contentHost.html(`
                      <div class="picanvas-unavailable-message" style="padding: 20px; text-align: center; color: #666; background: #f5f5f5; border-radius: 4px; margin: 10px;">
                        <div style="font-size: 24px; margin-bottom: 8px;">⚠️</div>
                        <div style="font-weight: 500;">Content unavailable</div>
                        <div style="font-size: 12px; margin-top: 4px;">Could not load this content. Try refreshing the page.</div>
                      </div>
                    `);
                  }
                } else if (usedElements.has(elementKey)) {
                  // DUPLICATE USE WITHIN THIS INSTANCE: This webpart is already in another tab of THIS PiCanvas
                  // Mark this container so the webpart can be moved here on tab switch
                  console.log(`[PiCanvas] Tab ${x}: Duplicate webpart within instance, marking container for sharing`);
                  tabContentContainer.attr('data-shared-webpart-id', elementKey);
                  tabContentContainer.addClass('picanvas-shared-content');
                  // Container is empty - webpart will move here when this tab is activated
                } else {
                  // FIRST USE: Move the original webpart to this tab
                  const $webpart = $("#" + thisTabData[x].WebPartID);
                  console.log(`[PiCanvas] Tab ${x}: First use, found webpart: ${$webpart.length > 0}, ID selector: "#${thisTabData[x].WebPartID}"`);
                  if ($webpart.length) {
                    // Store in LOCAL registry
                    usedElements.set(elementKey, $webpart);
                    // Register in GLOBAL registry so other PiCanvas instances know this is taken
                    PiCanvasWebPart._globalWebpartRegistry.set(elementKey, { instanceId, $element: $webpart });
                    // Mark the webpart so we can find it later
                    $webpart.attr('data-picanvas-shared', 'true');
                    $webpart.attr('data-picanvas-webpart-id', elementKey);
                    $webpart.attr('data-picanvas-owner', instanceId);
                    // Mark the container too - so we can move webpart back here on tab switch
                    tabContentContainer.attr('data-shared-webpart-id', elementKey);
                    // Move webpart to this tab
                    $contentHost.append($webpart);
                  }
                }
              }
            }
          }

          // Always append the container (even if empty) to maintain tab/content alignment
          $("#" + contentsDiv).append(tabContentContainer);
        }
      }

      // @ts-expect-error RenderTabs is defined in AddTabs.js
      RenderTabs();

      // Initialize lock behavior for password-protected tabs
      this.initializeTabLocks(tabsDiv);

      // Remove pre-hide styles injected by PiCanvasLoader Application Customizer
      // Now that webparts are in their tabs, they can be visible
      this.removePreHideStyles();

      // Set up shared webpart handling - move webparts between tabs on tab change
      this.initializeSharedWebpartHandling(tabsDiv, usedElements);

      // Initialize v3.0 features after tabs are rendered
      // Use setTimeout to ensure DOM is fully ready after RenderTabs
      setTimeout(() => {
        this.initializeMermaidDiagrams(tabsDiv);
        this.initializeDeepLinking(tabsDiv);
        this.initializeLazyLoadEvents(tabsDiv);

        // Fix all Banner/Hero webparts on the page (not just those in tabs)
        // This addresses gray area issues caused by stale width calculations
        this.fixGlobalBannerWebparts();

        // Apply full-width content layout using JS to handle SharePoint's overflow-hidden
        this.applyFullWidthContentLayout();
      }, 100);

      // Re-fix banners after a longer delay in case SharePoint's React re-renders
      setTimeout(() => {
        this.fixGlobalBannerWebparts();
      }, 500);

    } else {
      // Compact edit-mode view
      const isDark = this.isDarkMode();
      const themeClass = isDark ? styles.darkMode : '';
      const tabCount = this.getTabCount();
      const tabStyle = (this.properties.tabStyle as string) || 'default';
      const tabAlignment = (this.properties.tabAlignment as string) || 'stretch';
      const tabOrientation = (this.properties.tabOrientation as string) || 'horizontal';

      const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

      // Build zone/section lookup maps for getTabSummary
      const zones = this.getZones();
      const sections = this.getSections();
      const zonesMap = new Map<string, string>(zones.map(z => [z[0], z[1]]));
      const sectionsMap = new Map<string, string>(sections.map(s => [s[0], s[1]]));

      // Build tab summaries for all configured tabs
      const tabSummaries: ReturnType<typeof this.getTabSummary>[] = [];
      for (let i = 1; i <= tabCount; i++) {
        tabSummaries.push(this.getTabSummary(i, zonesMap, sectionsMap));
      }

      const maxVisible = 12;
      const visibleSummaries = tabSummaries.slice(0, maxVisible);
      const remaining = tabSummaries.length > maxVisible ? tabSummaries.length - maxVisible : 0;

      const hasConfiguredTabs = tabCount > 0;

      if (hasConfiguredTabs) {
        // Configured state: detailed tab list
        const tabListHtml = visibleSummaries.map(summary => {
          // Status icons
          const icons: string[] = [];
          if (summary.hasLock) icons.push('<span title="Password locked">&#128274;</span>');
          if (summary.hasPermission) icons.push('<span title="Permission restricted">&#128101;</span>');
          if (summary.isFullWidth) icons.push('<span title="Full width/page">&#127760;</span>');
          if (summary.hasWarning) icons.push(`<span class="${styles.compactTabWarning}" title="${esc(summary.warningText)}">&#9888;</span>`);

          return `<div class="${styles.compactTabRow}" data-configure-tab="${summary.index}" role="button" tabindex="0" title="Click to configure Tab ${summary.index}">
            <div class="${styles.compactTabPrimary}">
              <span class="${styles.compactTabNum}">${summary.index}</span>
              <span class="${styles.compactTabName}">${esc(summary.label)}</span>
              <span class="${styles.compactBadge} ${styles.compactBadgeType}">${summary.typeLabel}</span>
              ${icons.length > 0 ? `<span class="${styles.compactTabIcons}">${icons.join('')}</span>` : ''}
            </div>
            <div class="${styles.compactTabDetail}">
              <span>\u21B3 ${esc(summary.sourceDetail)}</span>
            </div>
          </div>`;
        }).join('');

        this.domElement.innerHTML = `
          <div class="${styles.piCanvas} ${themeClass}" data-theme="${isDark ? 'dark' : 'light'}">
            <div class="${styles.compactContainer}">
              <div class="${styles.compactHeader}">
                <div class="${styles.compactLogo}">&pi;</div>
                <h2 class="${styles.compactTitle}">PiCanvas</h2>
                <span class="${styles.compactBadge} ${styles.compactBadgeCount}">${tabCount} tab${tabCount !== 1 ? 's' : ''}</span>
                <div class="${styles.compactHeaderActions}">
                  <button class="${styles.compactHelpLink}" data-action="help" type="button" title="Help &amp; Docs">?</button>
                  <button class="${styles.compactConfigureBtn}" data-action="configure" type="button">&#9881; Configure</button>
                </div>
              </div>
              <div class="${styles.compactTabList}">
                ${tabListHtml}
                ${remaining > 0 ? `<div class="${styles.compactTabMore}">+${remaining} more tabs</div>` : ''}
              </div>
              <div class="${styles.compactFooter}">
                <span class="${styles.compactFooterBadge}">${tabStyle}</span>
                <span class="${styles.compactFooterBadge}">${tabAlignment}</span>
                <span class="${styles.compactFooterBadge}">${tabOrientation}</span>
                <span class="${styles.compactFooterSpacer}"></span>
                <span class="${styles.compactVersion}">v${PICANVAS_VERSION}</span>
              </div>
            </div>
          </div>`;
      } else {
        // Empty state: no tabs configured
        this.domElement.innerHTML = `
          <div class="${styles.piCanvas} ${themeClass}" data-theme="${isDark ? 'dark' : 'light'}">
            <div class="${styles.compactContainer}">
              <div class="${styles.compactHeader}">
                <div class="${styles.compactLogo}">&pi;</div>
                <h2 class="${styles.compactTitle}">PiCanvas</h2>
                <div class="${styles.compactHeaderActions}">
                  <button class="${styles.compactHelpLink}" data-action="help" type="button" title="Help &amp; Docs">?</button>
                </div>
              </div>
              <div class="${styles.compactEmptyState}">
                <p class="${styles.compactEmptyText}">No tabs configured yet.</p>
                <button class="${styles.compactEmptyBtn}" data-action="configure" type="button">&#9881; Configure Tabs</button>
                <p class="${styles.compactEmptyHint}">Or click the pencil icon to open settings</p>
              </div>
              <div class="${styles.compactFooter}">
                <span class="${styles.compactFooterSpacer}"></span>
                <span class="${styles.compactVersion}">v${PICANVAS_VERSION}</span>
              </div>
            </div>
          </div>`;
      }

      // Bind Configure button
      const configureBtn = this.domElement.querySelector('[data-action="configure"]');
      if (configureBtn) {
        configureBtn.addEventListener('click', () => this.openConfigPanel());
      }

      // Bind Help button
      const helpBtn = this.domElement.querySelector('[data-action="help"]');
      if (helpBtn) {
        helpBtn.addEventListener('click', () => this.openConfigPanel('help'));
      }

      // Bind tab row clicks — open config panel navigated to that specific tab
      this.domElement.querySelectorAll('[data-configure-tab]').forEach(row => {
        const handler = (): void => {
          const tabIndex = parseInt((row as HTMLElement).dataset.configureTab || '0', 10);
          if (tabIndex > 0) {
            this.openConfigPanel('tabs', tabIndex);
          }
        };
        row.addEventListener('click', handler);
        row.addEventListener('keydown', (e: Event) => {
          if ((e as KeyboardEvent).key === 'Enter' || (e as KeyboardEvent).key === ' ') {
            e.preventDefault();
            handler();
          }
        });
      });
    }
  }

  protected onDispose(): void {
    // Clean up profile report display mode (portal) if active
    const prEl = document.querySelector('.picanvas-profilereport[data-display-mode="fullSection"], .picanvas-profilereport[data-display-mode="fullScreen"]') as any;
    if (prEl && prEl._prDisplayCleanup) {
      prEl._prDisplayCleanup();
    }
    super.onDispose();
  }

  protected get dataVersion(): Version {
    return Version.parse('1.0');
  }

  /**
   * Build tabData array from dynamic properties (tab1WebPartID, tab1Label, etc.)
   */
  private getTabDataFromProperties(): ITabDataItem[] {
    const tabData: ITabDataItem[] = [];
    const numTabs = this.properties.tabCount || 2;

    // Helper to safely get string property (prevents [object Object])
    const safeString = (val: unknown): string => {
      if (!val) return '';
      return typeof val === 'string' ? val : String(val);
    };

    // Check configured tabs (label is optional - will default to "Tab N")
    for (let i = 1; i <= numTabs; i++) {
      const webPartIDKey = `tab${i}WebPartID`;
      const labelKey = `tab${i}Label`;
      const contentTypeKey = `tab${i}ContentType`;

      const webPartID = safeString(this.properties[webPartIDKey]);
      const label = safeString(this.properties[labelKey]);
      const contentType = safeString(this.properties[contentTypeKey]) || 'webpart';

      // Determine if tab has valid content based on its content type
      let hasValidContent = false;
      if (contentType === 'webpart' || contentType === 'section') {
        // WebPart/Section types require a WebPartID
        hasValidContent = !!webPartID;
      } else if (contentType === 'markdown' || contentType === 'html' || contentType === 'mermaid') {
        // Custom content types - allow even empty content so users can configure it
        hasValidContent = true;
      } else if (contentType === 'embed') {
        // Embed type requires embedUrl (or allow empty for configuration)
        hasValidContent = true; // Allow even empty so users can configure it
      } else if (contentType === 'file') {
        // File type - allow even empty so users can configure it
        hasValidContent = true;
      } else if (contentType === 'javascript') {
        // JavaScript type - allow even empty so users can configure it
        hasValidContent = true;
      } else if (contentType === 'toc') {
        // Table of Contents type - always valid, scans page headings
        hasValidContent = true;
      } else if (contentType === 'profilereport') {
        // Profile Report type - always valid, fetches from library
        hasValidContent = true;
      }

      if (hasValidContent) {
        // Check permission
        if (!this.isTabVisibleToUser(i)) {
          // Check if placeholder is enabled for this tab
          const showPlaceholder = this.properties[`tab${i}PermissionPlaceholder`] as boolean;
          if (showPlaceholder) {
            // Add as placeholder tab (visible but disabled)
            const placeholderText = safeString(this.properties[`tab${i}PermissionPlaceholderText`]) || strings.PermissionPlaceholderDefault;
            tabData.push({
              WebPartID: '', // No content for placeholder
              TabLabel: label || `Tab ${i}`,
              originalTabIndex: i,
              isPlaceholder: true,
              placeholderText: placeholderText
            });
          }
          // If no placeholder, skip this tab entirely (hidden)
          continue;
        }

        tabData.push({
          WebPartID: webPartID, // May be empty for custom content types
          TabLabel: label || '',  // Empty string if no label, render will handle default
          originalTabIndex: i     // Track original index for property lookup
        });
      }
    }

    return tabData;
  }

  /**
   * Get a structured summary of a single tab for the compact edit view.
   * Returns human-readable source description, status icons, and warning state.
   */
  private getTabSummary(tabIndex: number, zonesMap: Map<string, string>, sectionsMap: Map<string, string>): {
    index: number;
    label: string;
    contentType: string;
    typeLabel: string;
    sourceDetail: string;
    hasLock: boolean;
    hasPermission: boolean;
    isFullWidth: boolean;
    hasWarning: boolean;
    warningText: string;
  } {
    const props = this.properties;
    const label = (props[`tab${tabIndex}Label`] as string) || `Tab ${tabIndex}`;
    const contentType = (props[`tab${tabIndex}ContentType`] as string) || 'webpart';
    const webPartID = (props[`tab${tabIndex}WebPartID`] as string) || '';

    const contentTypeLabels: Record<string, string> = {
      'webpart': 'WP', 'section': 'SEC', 'markdown': 'MD', 'html': 'HTML',
      'mermaid': 'DIA', 'embed': 'EMB', 'rss': 'RSS', 'toc': 'TOC',
      'javascript': 'JS', 'file': 'FILE', 'profilereport': 'RPT', 'textwebpart': 'TXT'
    };
    const typeLabel = contentTypeLabels[contentType] || contentType.toUpperCase();

    let sourceDetail = '';
    let hasWarning = false;
    let warningText = '';

    // Build content source detail by type
    switch (contentType) {
      case 'webpart': {
        if (webPartID) {
          const zoneLabel = zonesMap.get(webPartID);
          sourceDetail = zoneLabel ? `${zoneLabel}` : `WebPart ID: ${webPartID.substring(0, 20)}...`;
        } else {
          hasWarning = true;
          warningText = 'No web part selected';
          sourceDetail = 'Not configured';
        }
        break;
      }
      case 'section': {
        if (webPartID) {
          const sectionLabel = sectionsMap.get(webPartID);
          sourceDetail = sectionLabel ? `${sectionLabel}` : `Section ID: ${webPartID.substring(0, 20)}...`;
        } else {
          hasWarning = true;
          warningText = 'No section selected';
          sourceDetail = 'Not configured';
        }
        break;
      }
      case 'markdown':
      case 'html': {
        const sourceType = (props[`tab${tabIndex}ContentSourceType`] as string) || 'manual';
        if (sourceType === 'webpart') {
          const sourceWpId = (props[`tab${tabIndex}ContentSourceWebPartID`] as string) || '';
          if (sourceWpId) {
            const zoneLabel = zonesMap.get(sourceWpId);
            sourceDetail = `From Text WebPart \u00b7 ${zoneLabel || 'Selected'}`;
          } else {
            hasWarning = true;
            warningText = 'No source web part selected';
            sourceDetail = 'Text WebPart \u00b7 Not configured';
          }
        } else {
          const content = (props[`tab${tabIndex}CustomContent`] as string) || '';
          const typeName = contentType === 'markdown' ? 'Markdown' : 'HTML';
          sourceDetail = content ? `${typeName} \u00b7 ${content.length} chars` : `${typeName} \u00b7 Empty`;
        }
        break;
      }
      case 'mermaid': {
        const content = (props[`tab${tabIndex}CustomContent`] as string) || '';
        sourceDetail = content ? `Mermaid \u00b7 ${content.length} chars` : 'Mermaid \u00b7 Empty';
        break;
      }
      case 'embed': {
        const url = (props[`tab${tabIndex}EmbedUrl`] as string) || '';
        const height = (props[`tab${tabIndex}EmbedHeight`] as string) || '';
        const fullPage = props[`tab${tabIndex}EmbedFullPage`] === true;
        if (url) {
          const truncUrl = url.length > 40 ? url.substring(0, 40) + '...' : url;
          sourceDetail = truncUrl + (fullPage ? ' \u00b7 full page' : (height ? ` \u00b7 ${height}` : ''));
        } else {
          hasWarning = true;
          warningText = 'No embed URL set';
          sourceDetail = 'No URL configured';
        }
        break;
      }
      case 'rss': {
        const feedUrl = (props[`tab${tabIndex}RssFeedUrl`] as string) || '';
        const layout = (props[`tab${tabIndex}RssLayout`] as string) || 'list';
        const maxItems = (props[`tab${tabIndex}RssMaxItems`] as string) || '10';
        if (feedUrl) {
          const truncUrl = feedUrl.length > 30 ? feedUrl.substring(0, 30) + '...' : feedUrl;
          sourceDetail = `${truncUrl} \u00b7 ${layout} \u00b7 ${maxItems} items`;
        } else {
          hasWarning = true;
          warningText = 'No feed URL set';
          sourceDetail = 'No feed URL configured';
        }
        break;
      }
      case 'file': {
        const fileUrl = (props[`tab${tabIndex}FileUrl`] as string) || '';
        if (fileUrl) {
          const truncUrl = fileUrl.length > 45 ? fileUrl.substring(0, 45) + '...' : fileUrl;
          sourceDetail = truncUrl;
        } else {
          hasWarning = true;
          warningText = 'No file URL set';
          sourceDetail = 'No file configured';
        }
        break;
      }
      case 'javascript': {
        const content = (props[`tab${tabIndex}CustomContent`] as string) || '';
        const displayMode = (props[`tab${tabIndex}JavaScriptDisplayMode`] as string) || 'contained';
        sourceDetail = content ? `JavaScript \u00b7 ${content.length} chars \u00b7 ${displayMode}` : 'JavaScript \u00b7 Empty';
        break;
      }
      case 'toc': {
        const sources: string[] = [];
        if (props[`tab${tabIndex}TocSearchText`] !== false) sources.push('Text');
        if (props[`tab${tabIndex}TocSearchMarkdown`] !== false) sources.push('MD');
        if (props[`tab${tabIndex}TocSearchCollapsible`] !== false) sources.push('Collapsible');
        sourceDetail = `Table of Contents \u00b7 ${sources.join(', ')}`;
        break;
      }
      case 'profilereport': {
        const library = (props[`tab${tabIndex}ProfileReportLibrary`] as string) || 'Profiles';
        const layout = (props[`tab${tabIndex}ProfileReportLayout`] as string) || 'tabbed';
        const limit = (props[`tab${tabIndex}ProfileReportCompanyLimit`] as number) || 50;
        sourceDetail = `Library: "${library}" \u00b7 ${layout} \u00b7 ${limit} max`;
        break;
      }
      case 'textwebpart': {
        const sourceWpId = (props[`tab${tabIndex}ContentSourceWebPartID`] as string) || '';
        if (sourceWpId) {
          const zoneLabel = zonesMap.get(sourceWpId);
          sourceDetail = `From Text WebPart \u00b7 ${zoneLabel || 'Selected'}`;
        } else {
          hasWarning = true;
          warningText = 'No text web part selected';
          sourceDetail = 'Not configured';
        }
        break;
      }
      default:
        sourceDetail = contentType;
    }

    // Status flags
    const hasLock = props[`tab${tabIndex}LockEnabled`] === true;
    const hasPermission = props[`tab${tabIndex}PermissionEnabled`] === true;
    const isFullWidth = props[`tab${tabIndex}EmbedFullWidth`] === true
      || props[`tab${tabIndex}EmbedFullPage`] === true
      || props[`tab${tabIndex}ContentFullWidth`] === true;

    return {
      index: tabIndex,
      label,
      contentType,
      typeLabel,
      sourceDetail,
      hasLock,
      hasPermission,
      isFullWidth,
      hasWarning,
      warningText
    };
  }

  /**
   * Get the section number for a webpart element
   */
  private getSectionNumber(element: JQuery<HTMLElement>): number {
    const section = element.closest("div." + this.properties.sectionClass);
    const allSections = $("div." + this.properties.sectionClass);
    let sectionNum = 0;
    allSections.each(function (index) {
      if ($(this).is(section)) {
        sectionNum = index + 1;
        return false; // break
      }
    });
    return sectionNum;
  }

  /**
   * Get detailed information about a webpart for the dropdown label
   */
  private getWebPartDetails(element: JQuery<HTMLElement>): {
    type: string | null;
    title: string | null;
    column: number;
    columnName: string;
    preview: string | null;
  } {
    const MAX_TITLE_LENGTH = 30;
    const MAX_PREVIEW_LENGTH = 25;

    // Helper to truncate and clean title
    const cleanTitle = (title: string): string => {
      // Remove accessibility instructions (text after "Press Enter" or "When inside")
      let cleaned = title.split(/\.\s*(Press Enter|When inside)/i)[0].trim();
      // Remove "web part" suffix if present
      cleaned = cleaned.replace(/\s*web\s*part$/i, '').trim();
      // Truncate if too long
      if (cleaned.length > MAX_TITLE_LENGTH) {
        cleaned = cleaned.substring(0, MAX_TITLE_LENGTH - 3) + '...';
      }
      return cleaned;
    };

    // Helper to extract webpart type from aria-label
    const extractWebPartType = (ariaLabel: string): string | null => {
      // Extract just the webpart type from beginning of aria-label
      // e.g., "Text web part beginning with..." -> "Text"
      // e.g., "Banner web part..." -> "Banner"
      // e.g., "Image web part, showing..." -> "Image"
      const match = ariaLabel.match(/^(\w+(?:\s+\w+)?)\s+web\s*part/i);
      if (match) {
        return match[1];
      }
      return null;
    };

    let webpartType: string | null = null;
    let title: string | null = null;

    // Method 1: Look for data-sp-web-part-title attribute or title region
    const titleAttr = element.find('[data-automation-id="titleRegion"]').text().trim();
    if (titleAttr) {
      title = cleanTitle(titleAttr);
    }

    // Method 2: Look for heading elements within the webpart (but not in toolbars/menus)
    if (!title) {
      const heading = element.find('h1, h2, h3, [role="heading"]').not('[role="menubar"] *, [role="toolbar"] *, [role="menu"] *').first().text().trim();
      if (heading && heading.length > 2 && heading.length < 50) {
        title = cleanTitle(heading);
      }
    }

    // Method 3: Look for aria-label on element or its children to get type
    let ariaLabel = element.attr('aria-label');
    if (ariaLabel) {
      webpartType = extractWebPartType(ariaLabel);
    }

    // Then check child elements with aria-label containing "web part"
    if (!webpartType) {
      const childWithAriaLabel = element.find('[aria-label*="web part"], [aria-label*="Web Part"]')
        .not('[role="menuitem"]')
        .first();
      if (childWithAriaLabel.length) {
        ariaLabel = childWithAriaLabel.attr('aria-label');
        if (ariaLabel) {
          webpartType = extractWebPartType(ariaLabel);
        }
      }
    }

    // Method 4: Look for Placeholder-text class (used by unconfigured webparts like Image, File, etc.)
    if (!webpartType) {
      const placeholderText = element.find('.Placeholder-text').first().text().trim();
      if (placeholderText && placeholderText.length > 1 && placeholderText.length < 30) {
        webpartType = placeholderText;
      }
    }

    // Method 5: Try to identify by common webpart patterns
    if (!webpartType) {
      // Check for common webpart indicators
      if (element.find('[data-automation-id="textbox"]').length) {
        webpartType = 'Text';
      } else if (element.find('img').length) {
        webpartType = 'Image';
      } else if (element.find('iframe').length) {
        webpartType = 'Embed';
      } else if (element.find('[data-automation-id="HeroWebPart"]').length) {
        webpartType = 'Hero';
      } else if (element.find('[data-automation-id="quickLinksWebPart"]').length) {
        webpartType = 'Quick Links';
      } else if (element.find('.ms-DocumentCard').length) {
        webpartType = 'Document';
      }
    }

    // Get column position
    const column = element.closest('[data-automation-id="CanvasColumn"]');
    let columnNum = 1;
    let columnName = 'Full';

    if (column.length) {
      const section = column.closest('[data-automation-id="CanvasSection"]');
      if (section.length) {
        const allColumns = section.find('[data-automation-id="CanvasColumn"]');
        allColumns.each((index: number, col: HTMLElement) => {
          if ($(col).is(column)) {
            columnNum = index + 1;
            return false;
          }
        });

        // Determine column name based on position and total columns
        const totalColumns = allColumns.length;
        if (totalColumns === 1) {
          columnName = 'Full';
        } else if (totalColumns === 2) {
          columnName = columnNum === 1 ? 'Left' : 'Right';
        } else if (totalColumns === 3) {
          columnName = columnNum === 1 ? 'Left' : (columnNum === 2 ? 'Center' : 'Right');
        } else {
          columnName = `Col ${columnNum}`;
        }
      }
    }

    // Extract preview content based on webpart type
    let preview: string | null = null;

    if (webpartType === 'Image' || element.find('img').length) {
      // For images: try to get filename from src or alt text
      const img = element.find('img').first();
      if (img.length) {
        const alt = img.attr('alt');
        const src = img.attr('src') || '';

        if (alt && alt.length > 1 && alt.length < 50 && alt.toLowerCase().indexOf('web part') === -1) {
          preview = alt;
        } else if (src) {
          // Extract filename from URL
          const urlParts = src.split('/');
          let filename = urlParts[urlParts.length - 1];
          // Remove query params
          filename = filename.split('?')[0];
          // Decode URI and clean up
          try {
            filename = decodeURIComponent(filename);
          } catch { /* ignore decode errors */ }
          // Truncate if needed
          if (filename && filename.length > 1 && filename.length < 60) {
            preview = filename.length > MAX_PREVIEW_LENGTH
              ? filename.substring(0, MAX_PREVIEW_LENGTH - 3) + '...'
              : filename;
          }
        }
      }
    } else if (webpartType === 'Text' || element.find('[data-automation-id="textbox"]').length) {
      // For text: get first line of text content
      const textBox = element.find('[data-automation-id="textbox"]').first();
      if (textBox.length) {
        let textContent = textBox.text().trim();
        // Clean up whitespace
        textContent = textContent.replace(/\s+/g, ' ');
        if (textContent.length > 1) {
          preview = textContent.length > MAX_PREVIEW_LENGTH
            ? `"${textContent.substring(0, MAX_PREVIEW_LENGTH - 3)}..."`
            : `"${textContent}"`;
        }
      }
    }

    return {
      type: webpartType,
      title: title,
      column: columnNum,
      columnName: columnName,
      preview: preview
    };
  }

  /**
   * Try to extract a meaningful title for a webpart from the DOM
   */
  private getWebPartTitle(element: JQuery<HTMLElement>): string | null {
    const details = this.getWebPartDetails(element);
    return details.type || details.title || null;
  }

  /**
   * Get all sections (rows) and columns on the page with their IDs
   * Returns array of [id, label, sectionNumber]
   *
   * Modern SharePoint DOM structure:
   * - Sections: elements with data-automation-id="CanvasSection" (or configurable class)
   * - Columns: elements with data-automation-id="CanvasColumn" inside a section
   * - Web parts: ControlZone / CanvasControl inside columns
   *
   * This method returns both:
   * - SECTION: entries for entire sections (all columns combined)
   * - COLUMN: entries for individual columns within multi-column sections
   */
  private getSections(): Array<[string, string, number]> {
    const results = new Array<[string, string, number]>();

    // Find the PiCanvas web part to avoid moving itself
    const tabWebPartElement = $(this.domElement).closest("div." + this.properties.webpartClass);
    const tabWebPartZone = tabWebPartElement.closest('[data-automation-id="CanvasZone"]');
    const tabWebPartSection = tabWebPartElement.closest('[data-automation-id="CanvasSection"], div.' + this.properties.sectionClass);
    const tabWebPartColumn = tabWebPartElement.closest('[data-automation-id="CanvasColumn"], div.CanvasColumn, [data-automation-id="CanvasSection"], div.' + this.properties.sectionClass);

    // --- Primary strategy: modern pages where CanvasZone is the row and CanvasSection are columns ---
    const rowContainers = $('[data-automation-id="CanvasZone"]').filter((_idx: number, el: HTMLElement) => {
      const $el = $(el);
      const hasSection = $el.find('[data-automation-id="CanvasSection"]').length > 0;
      const hasControlZone = $el.find('.ControlZone, [data-automation-id="CanvasControl"]').length > 0;
      const isNested = $el.parent().closest('[data-automation-id="CanvasZone"]').length > 0;
      return (hasSection || hasControlZone) && !isNested;
    });

    if (rowContainers.length > 0) {
      rowContainers.each((rowIndex: number, element: HTMLElement) => {
        const $row = $(element);
        const sectionNum = rowIndex + 1;

        // Count ALL web parts in this row (across all columns), excluding PiCanvas
        const allWebparts = $row.find('.ControlZone, [data-automation-id="CanvasControl"]')
          .filter((_i, wp: HTMLElement) => !tabWebPartElement.is(wp));
        const totalWebpartCount = allWebparts.length;

        if (totalWebpartCount === 0) {
          return; // continue
        }

        // Mark the row so render() can find it later
        const sectionId = `picanvas-section-${rowIndex}`;
        $row.attr("data-picanvas-section-id", sectionId);

        // Add the whole row as a SECTION option unless it contains PiCanvas
        if (!$row.is(tabWebPartZone)) {
          const sectionLabel = `▦ Section ${sectionNum} (${totalWebpartCount} web part${totalWebpartCount !== 1 ? 's' : ''})`;
          results.push([`SECTION:${sectionId}`, sectionLabel, sectionNum]);
        }

        // Columns: commonly CanvasSection within the row. Also allow CanvasColumn just in case.
        let columns = $row.find('[data-automation-id="CanvasSection"]');
        if (columns.length === 0) {
          columns = $row.find('[data-automation-id="CanvasColumn"], div.CanvasColumn');
        }

        // Only expose columns when there is more than one
        if (columns.length > 1) {
          columns.each((colIndex: number, colElement: HTMLElement) => {
            const $col = $(colElement);

            // Skip the column containing PiCanvas
            if ($col.is(tabWebPartColumn)) {
              return;
            }

            const colWebparts = $col.find('.ControlZone, [data-automation-id="CanvasControl"]')
              .filter((_i, wp: HTMLElement) => !tabWebPartElement.is(wp));

            if (colWebparts.length === 0) {
              return;
            }

            const columnId = `picanvas-column-${rowIndex}-${colIndex}`;
            $col.attr("data-picanvas-column-id", columnId);

            const columnName = this.getColumnPositionName(colIndex, columns.length);
            const columnLabel = `  ├ ${columnName} (${colWebparts.length} web part${colWebparts.length !== 1 ? 's' : ''})`;
            results.push([`COLUMN:${columnId}`, columnLabel, sectionNum]);
          });
        }
      });

      return results;
    }

    // --- Fallback strategy: treat CanvasSection as sections directly (older or variant DOM) ---
    const sections = $('[data-automation-id="CanvasSection"], div.' + this.properties.sectionClass);

    sections.each((sectionIndex: number, element: HTMLElement) => {
      const $section = $(element);
      const sectionNum = sectionIndex + 1;

      const sectionId = `picanvas-section-${sectionIndex}`;
      $section.attr("data-picanvas-section-id", sectionId);

      const allSectionWebparts = $section.find('.ControlZone, [data-automation-id="CanvasControl"]')
        .filter((_i, wp: HTMLElement) => !tabWebPartElement.is(wp));
      const webpartCount = allSectionWebparts.length;

      if (webpartCount > 0 && !$section.is(tabWebPartSection)) {
        const sectionLabel = `▦ Section ${sectionNum} (${webpartCount} web part${webpartCount !== 1 ? 's' : ''})`;
        results.push([`SECTION:${sectionId}`, sectionLabel, sectionNum]);
      }

      // Columns inside the section (if present)
      let columns = $section.find('[data-automation-id="CanvasColumn"], div.CanvasColumn');
      if (columns.length === 0) {
        columns = $section.find('[data-automation-id="CanvasSection"]');
      }

      if (columns.length > 1) {
        columns.each((colIndex: number, colElement: HTMLElement) => {
          const $col = $(colElement);
          if ($col.is(tabWebPartColumn)) {
            return;
          }

          const colWebparts = $col.find('.ControlZone, [data-automation-id="CanvasControl"]')
            .filter((_i, wp: HTMLElement) => !tabWebPartElement.is(wp));

          if (colWebparts.length === 0) {
            return;
          }

          const columnId = `picanvas-column-${sectionIndex}-${colIndex}`;
          $col.attr("data-picanvas-column-id", columnId);

          const columnName = this.getColumnPositionName(colIndex, columns.length);
          const columnLabel = `  ├ ${columnName} (${colWebparts.length} web part${colWebparts.length !== 1 ? 's' : ''})`;
          results.push([`COLUMN:${columnId}`, columnLabel, sectionNum]);
        });
      }
    });

    return results;
  }

  /**
   * Get a human-readable name for a column position
   */
  private getColumnPositionName(colIndex: number, totalColumns: number): string {
    if (totalColumns === 2) {
      return colIndex === 0 ? 'Left Column' : 'Right Column';
    } else if (totalColumns === 3) {
      if (colIndex === 0) return 'Left Column';
      if (colIndex === 1) return 'Center Column';
      return 'Right Column';
    } else {
      return `Column ${colIndex + 1}`;
    }
  }

  private getZones(): Array<[string, string, number]> {
    const zones = new Array<[string, string, number]>();

    // Get webpart ID from SharePoint DOM structure, or fallback to SPFx instance ID for workbench
    const tabWebPartID = $(this.domElement).closest("div." + this.properties.webpartClass).attr("id")
      || `picanvas-${this.context.instanceId}`;

    // Track webpart count per section for labeling
    const sectionWebPartCounts: { [key: number]: number } = {};

    // Find ALL webparts on the page, not just in current section
    const webpartClass = this.properties.webpartClass;

    $("div." + webpartClass).each((_index: number, element: HTMLElement) => {
      const $element = $(element);
      const thisWPID = $element.attr("id");

      if (thisWPID && thisWPID !== tabWebPartID) {
        const sectionNum = this.getSectionNumber($element);

        // Increment webpart count for this section
        if (!sectionWebPartCounts[sectionNum]) {
          sectionWebPartCounts[sectionNum] = 0;
        }
        sectionWebPartCounts[sectionNum]++;
        const wpNumInSection = sectionWebPartCounts[sectionNum];

        // Get detailed webpart information
        const details = this.getWebPartDetails($element);

        // Build detailed label
        // Format: "Sec X | Column | Type: Preview" or "Sec X | Column | Web Part #N"
        let zoneName: string;
        const sectionPart = `Sec ${sectionNum}`;
        const columnPart = details.columnName;

        // Build the label with as much detail as available
        const labelParts: string[] = [];

        if (details.type) {
          labelParts.push(details.type);
        }

        // Add preview content (image filename, text snippet, or title)
        if (details.preview) {
          labelParts.push(details.preview);
        } else if (details.title && details.title !== details.type) {
          labelParts.push(details.title);
        }

        if (labelParts.length > 0) {
          // Join with colon: "Image: photo.jpg" or "Text: Hello world..."
          zoneName = `${sectionPart} | ${columnPart} | ${labelParts.join(': ')}`;
        } else {
          // Fallback: "Sec 2 | Left | Web Part #1"
          zoneName = `${sectionPart} | ${columnPart} | Web Part #${wpNumInSection}`;
        }

        zones.push([thisWPID, zoneName, sectionNum]);
      }
    });

    this._zonesCache = zones.map(z => [z[0], z[1]]);
    return zones;
  }

  /**
   * Get which webparts/sections are already assigned to tabs
   * Returns a map of webpart/section ID -> tab number
   */
  private getAssignedItems(): Map<string, number> {
    const assigned = new Map<string, number>();
    const numTabs = this.getTabCount();

    for (let i = 1; i <= numTabs; i++) {
      const webPartID = this.properties[`tab${i}WebPartID`] as string;
      if (webPartID) {
        assigned.set(webPartID, i);
      }
    }

    return assigned;
  }

  /**
   * Build dropdown options from detected zones and sections
   * @param forTabIndex - The tab index this dropdown is for (to exclude self from "already used" check)
   * @param contentTypeFilter - Filter to show only 'webpart', only 'section', or 'all' (default)
   */
  private getDropdownOptions(forTabIndex?: number, contentTypeFilter: 'webpart' | 'section' | 'all' = 'all'): IPropertyPaneDropdownOption[] {
    const zones = this.getZones();
    const sections = this.getSections();
    const assignedItems = this.getAssignedItems();
    const options: IPropertyPaneDropdownOption[] = [
      { key: '', text: contentTypeFilter === 'section' ? '(None - skip this tab)' : '(None - skip this tab)' }
    ];

    // Get the currently selected item and custom label for this tab
    const currentTabWebPartID = forTabIndex ? this.properties[`tab${forTabIndex}WebPartID`] as string : '';
    const currentTabCustomLabel = forTabIndex ? this.properties[`tab${forTabIndex}WebPartLabel`] as string : '';

    // Helper to add "already used" indicator and custom label - informational since cloning is supported
    const addUsageIndicator = (text: string, itemKey: string): string => {
      let result = text;

      // If this is the currently selected item for this tab and it has a custom label, show it prominently
      if (itemKey === currentTabWebPartID && currentTabCustomLabel) {
        result = `★ ${currentTabCustomLabel} | ${text}`;
      }

      const assignedToTab = assignedItems.get(itemKey);
      if (assignedToTab && assignedToTab !== forTabIndex) {
        result = `${result} 🔄 Also in Tab ${assignedToTab}`;
      }
      return result;
    };

    // Add sections (only if filter allows)
    if (contentTypeFilter === 'section' || contentTypeFilter === 'all') {
      if (sections.length > 0) {
        sections.forEach(section => {
          options.push({
            key: section[0],
            text: addUsageIndicator(section[1], section[0])
          });
        });
      }
    }

    // Add webparts (only if filter allows)
    if (contentTypeFilter === 'webpart' || contentTypeFilter === 'all') {
      // Group webpart zones by section
      const sectionGroups: { [key: number]: Array<[string, string, number]> } = {};
      zones.forEach(zone => {
        const sectionNum = zone[2];
        if (!sectionGroups[sectionNum]) {
          sectionGroups[sectionNum] = [];
        }
        sectionGroups[sectionNum].push(zone);
      });

      // Add individual webparts sorted by section
      const sortedSections = Object.keys(sectionGroups).map(Number).sort((a, b) => a - b);
      sortedSections.forEach(sectionNum => {
        sectionGroups[sectionNum].forEach(zone => {
          // Only indent if showing both sections and webparts
          const prefix = contentTypeFilter === 'all' ? '    ' : '';
          options.push({
            key: zone[0],
            text: addUsageIndicator(`${prefix}${zone[1]}`, zone[0])
          });
        });
      });
    }

    return options;
  }

  /**
   * Get dropdown options for selecting a web part to use as a tab label
   * Only returns individual web parts (not sections), excluding already-used label web parts
   */
  private getLabelWebPartOptions(forTabIndex?: number): IPropertyPaneDropdownOption[] {
    const zones = this.getZones();
    const options: IPropertyPaneDropdownOption[] = [
      { key: '', text: '(Select a web part for label)' }
    ];

    // Get list of web parts already used as labels in other tabs
    const usedAsLabels = new Map<string, number>();
    const numTabs = this.getTabCount();
    for (let i = 1; i <= numTabs; i++) {
      if (i !== forTabIndex) {
        const labelWebPartID = this.properties[`tab${i}LabelWebPartID`] as string;
        if (labelWebPartID) {
          usedAsLabels.set(labelWebPartID, i);
        }
      }
    }

    // Helper to add "already used" indicator - informational since cloning is supported
    const addUsageIndicator = (text: string, itemKey: string): string => {
      const assignedToTab = usedAsLabels.get(itemKey);
      if (assignedToTab) {
        return `${text} 🔄 Label in Tab ${assignedToTab}`;
      }
      return text;
    };

    // Add individual webparts (skip sections)
    zones.forEach(zone => {
      options.push({
        key: zone[0],
        text: addUsageIndicator(zone[1], zone[0])
      });
    });

    return options;
  }

  /**
   * Get property pane configuration fields for a JavaScript template.
   * Dynamically generates fields based on the template's configOptions.
   * @param tabIndex - The tab index (1-based)
   * @param template - The JavaScript template definition
   */
  private getJavaScriptTemplateConfigFields(tabIndex: number, template: { configOptions: Array<{ key: string; label: string; type: string; default: string | number | boolean; description?: string; options?: Array<{ key: string; text: string }>; min?: number; max?: number }> }): IPropertyPaneField<unknown>[] {
    const fields: IPropertyPaneField<unknown>[] = [];

    // Get current template config (stored as JSON string)
    const configJson = (this.properties[`tab${tabIndex}JavaScriptTemplateConfig`] as string) || '{}';
    let currentConfig: IJavaScriptTemplateConfig = {};
    try {
      currentConfig = JSON.parse(configJson);
    } catch {
      currentConfig = {};
    }

    // Generate a field for each config option
    for (const opt of template.configOptions) {
      const propKey = `tab${tabIndex}TemplateConfig_${opt.key}`;
      const currentValue = currentConfig[opt.key] !== undefined ? currentConfig[opt.key] : opt.default;

      switch (opt.type) {
        case 'text':
        case 'color':
          fields.push(
            PropertyPaneTextField(propKey, {
              label: opt.label + (opt.type === 'color' ? ' (hex)' : ''),
              description: opt.description,
              value: String(currentValue || opt.default)
            })
          );
          break;

        case 'textarea':
          fields.push(
            PropertyPaneTextField(propKey, {
              label: opt.label,
              description: opt.description,
              multiline: true,
              rows: 3,
              value: String(currentValue || opt.default)
            })
          );
          break;

        case 'number':
          fields.push(
            PropertyPaneTextField(propKey, {
              label: opt.label,
              description: opt.description,
              value: String(currentValue || opt.default)
            })
          );
          break;

        case 'dropdown':
          if (opt.options) {
            fields.push(
              PropertyPaneDropdown(propKey, {
                label: opt.label,
                options: opt.options,
                selectedKey: String(currentValue || opt.default)
              })
            );
          }
          break;

        case 'toggle':
          fields.push(
            PropertyPaneToggle(propKey, {
              label: opt.label,
              checked: currentValue === true || currentValue === 'true' || (currentValue === undefined && opt.default === true),
              onText: 'Yes',
              offText: 'No'
            })
          );
          break;
      }
    }

    return fields;
  }

  /**
   * Get the template configuration for a tab by reading individual property pane fields.
   * @param tabIndex - The tab index (1-based)
   * @param template - The JavaScript template definition
   */
  private getJavaScriptTemplateConfig(tabIndex: number, template: { configOptions: Array<{ key: string; type: string; default: string | number | boolean }> }): IJavaScriptTemplateConfig {
    const config: IJavaScriptTemplateConfig = {};

    for (const opt of template.configOptions) {
      const propKey = `tab${tabIndex}TemplateConfig_${opt.key}`;
      const value = this.properties[propKey];

      if (value !== undefined) {
        // Handle type conversion
        if (opt.type === 'toggle') {
          config[opt.key] = value === true || value === 'true';
        } else if (opt.type === 'number') {
          config[opt.key] = Number(value) || opt.default;
        } else {
          config[opt.key] = value;
        }
      } else {
        config[opt.key] = opt.default;
      }
    }

    return config;
  }

  /**
   * Get Text WebParts on the page that can be used as content sources.
   * Text WebParts contain HTML/text content that can be rendered in PiCanvas tabs.
   */
  private getTextWebPartOptions(forTabIndex?: number): IPropertyPaneDropdownOption[] {
    const options: IPropertyPaneDropdownOption[] = [
      { key: '', text: '(Select a Text WebPart)' }
    ];

    // Get list of webparts already used as content sources in other tabs
    const usedAsSources = new Map<string, number>();
    const numTabs = this.getTabCount();
    for (let i = 1; i <= numTabs; i++) {
      if (i !== forTabIndex) {
        const sourceWebPartID = this.properties[`tab${i}FileSourceWebPartID`] as string;
        if (sourceWebPartID) {
          usedAsSources.set(sourceWebPartID, i);
        }
      }
    }

    // Get webpart ID for PiCanvas itself to exclude it
    const tabWebPartID = $(this.domElement).closest("div." + this.properties.webpartClass).attr("id")
      || `picanvas-${this.context.instanceId}`;

    const webpartClass = this.properties.webpartClass;

    $("div." + webpartClass).each((_index: number, element: HTMLElement) => {
      const $element = $(element);
      const thisWPID = $element.attr("id");

      if (thisWPID && thisWPID !== tabWebPartID) {
        // Check if this is a Text WebPart by looking at aria-label or content structure
        const details = this.getWebPartDetails($element);

        // Only include Text WebParts (type === 'Text')
        if (details.type && details.type.toLowerCase() === 'text') {
          const sectionNum = this.getSectionNumber($element);

          // Build label
          let label = `Sec ${sectionNum} | ${details.columnName}`;
          if (details.preview) {
            label += ` | "${details.preview}"`;
          } else {
            label += ' | Text WebPart';
          }

          // Add usage indicator if already used
          const assignedToTab = usedAsSources.get(thisWPID);
          if (assignedToTab) {
            label += ` 🔄 Used in Tab ${assignedToTab}`;
          }

          options.push({
            key: thisWPID,
            text: label
          });
        }
      }
    });

    return options;
  }

  /**
   * Extract HTML content from a Text WebPart by its ID.
   * Returns the text content of the Text WebPart (which may contain HTML code).
   *
   * When users type HTML code into a Text WebPart, SharePoint stores it as escaped text.
   * We use .text() to get the raw content, which preserves the HTML tags as intended.
   */
  private extractTextWebPartContent(webpartId: string): { content: string; contentType: 'html' | 'markdown' } {
    console.log(`[PiCanvas] extractTextWebPartContent: Looking for webpart with ID "${webpartId}"`);

    const $webpart = $(`#${webpartId}`);

    if (!$webpart.length) {
      console.warn(`[PiCanvas] Text WebPart not found: ${webpartId}`);
      // Debug: list all webpart IDs on the page
      const allWebparts = $('[data-automation-id="CanvasControl"]');
      console.log(`[PiCanvas] Found ${allWebparts.length} webparts on page. IDs:`, allWebparts.map(function() { return $(this).attr('id') || $(this).find('[id]').first().attr('id'); }).get());
      return { content: '', contentType: 'html' };
    }

    console.log(`[PiCanvas] Found webpart element:`, $webpart[0]);

    // SharePoint Text WebPart content is typically in a div with specific classes
    // Look for the rich text content area
    let $contentArea = $webpart.find('[data-automation-id="textBox"]');
    console.log(`[PiCanvas] Selector [data-automation-id="textBox"] found: ${$contentArea.length} elements`);

    if (!$contentArea.length) {
      // Fallback: look for common text webpart content containers
      $contentArea = $webpart.find('.rte-webpart, .ck-content, [class*="richText"], [class*="RichText"]');
      console.log(`[PiCanvas] Fallback selector (.rte-webpart, .ck-content, etc.) found: ${$contentArea.length} elements`);
    }

    if (!$contentArea.length) {
      // Last fallback: get the webpart's main content area
      $contentArea = $webpart.find('.ControlZone--control, [data-automation-id="CanvasControl"]').first();
      console.log(`[PiCanvas] Second fallback (.ControlZone--control, CanvasControl) found: ${$contentArea.length} elements`);
    }

    if (!$contentArea.length) {
      // Ultimate fallback: just get the webpart content
      $contentArea = $webpart;
      console.log(`[PiCanvas] Using webpart element itself as content area`);
    }

    // Get the HTML content first to preserve line breaks from block elements
    // SharePoint Text WebPart wraps lines in <p> or <div> tags which would lose newlines with .text()
    let htmlContent = $contentArea.html() || '';

    // Extract text while preserving line breaks from block elements
    // This is critical for JavaScript code where newlines matter (comments, statements)
    let content = htmlContent
      // Insert newlines before closing block tags to preserve line structure
      .replace(/<\/(p|div|li|h[1-6])>/gi, '\n</$1>')
      // Convert <br> tags to newlines
      .replace(/<br\s*\/?>/gi, '\n')
      // Remove all HTML tags
      .replace(/<[^>]+>/g, '')
      // Decode HTML entities
      .replace(/&nbsp;/gi, ' ')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&amp;/gi, '&')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/\u00A0/g, ' ') // Non-breaking space unicode
      // Clean up multiple consecutive newlines (but preserve at least one)
      .replace(/\n{3,}/g, '\n\n')
      // Trim leading/trailing whitespace
      .trim();

    // If the extraction resulted in no content but .text() has content, fall back
    // This handles edge cases where the content is plain text without HTML formatting
    if (!content && $contentArea.text()) {
      content = $contentArea.text().trim();
    }

    console.log(`[PiCanvas] extractTextWebPartContent: First 500 chars of extracted content:`, content.substring(0, 500));

    // Detect if content looks like markdown (simple heuristic)
    const looksLikeMarkdown = /^#+\s|^\*\s|^-\s|^\d+\.\s|```|^\[.*\]\(.*\)/m.test(content);

    console.log(`[PiCanvas] Extracted content (${content.length} chars, detected as ${looksLikeMarkdown ? 'markdown' : 'html'}):`, content.substring(0, 200) + (content.length > 200 ? '...' : ''));

    return {
      content,
      contentType: looksLikeMarkdown ? 'markdown' : 'html'
    };
  }

  /**
   * Get the current tab count, defaulting to 2
   */
  private getTabCount(): number {
    return this.properties.tabCount || 2;
  }

  /**
   * Open the full-screen configuration panel
   */
  private openConfigPanel(section?: string, tabIndex?: number): void {
    if (this._configPanel) return;

    this._configPanel = new ConfigurationPanel({
      getProperty: (key: string) => this.properties[key] as string | number | boolean | undefined,
      setProperty: (key: string, value: string | number | boolean | undefined) => {
        (this.properties as Record<string, string | number | boolean | undefined>)[key] = value;
      },
      setProperties: (updates: Record<string, string | number | boolean | undefined>) => {
        Object.entries(updates).forEach(([k, v]) => {
          (this.properties as Record<string, string | number | boolean | undefined>)[k] = v;
        });
      },
      reRender: () => this.render(),
      refreshPropertyPane: () => {
        try { this.context.propertyPane.refresh(); } catch { /* ignore if pane closed */ }
      },
      getTabCount: () => this.getTabCount(),
      addTab: () => this.addTab(),
      deleteTab: (i: number) => this.deleteTab(i),
      moveTabUp: (i: number) => this.moveTabUp(i),
      moveTabDown: (i: number) => this.moveTabDown(i),
      duplicateTab: (i: number) => this.duplicateTab(i),
      getZones: () => this.getZones(),
      getSections: () => this.getSections(),
      getTextWebPartOptions: (tabIndex: number) => {
        const spOptions = this.getTextWebPartOptions(tabIndex);
        return spOptions.map(o => ({ key: String(o.key), text: o.text }));
      },
      getTemplates: () => {
        return this._availableTemplates.map(t => ({
          id: t.templateId,
          name: t.templateName,
          description: t.description,
          isBuiltIn: t.isBuiltIn
        }));
      },
      applyTemplate: (templateId: string) => {
        this._selectedTemplateId = templateId;
        this.applySelectedTemplate();
      },
      exportConfig: () => this.exportConfiguration(),
      importConfig: () => this.importConfiguration(),
      saveAsTemplate: () => { this.saveAsTemplate(); },
      getThemePresets: () => {
        return BUILTIN_TEMPLATES.map(t => ({
          id: t.templateId,
          name: t.templateName,
          accentColor: t.accentColor || '#0078d4',
          tabStyle: t.tabStyle,
          properties: {
            tabStyle: t.tabStyle,
            accentColor: t.accentColor,
            tabFontSize: t.tabFontSize,
            tabFontWeight: t.tabFontWeight,
            tabBorderRadius: t.tabBorderRadius,
            tabPaddingVertical: t.tabPaddingVertical,
            tabPaddingHorizontal: t.tabPaddingHorizontal,
            tabGap: t.tabGap,
            tabAlignment: t.tabAlignment,
            showActiveIndicator: t.showActiveIndicator,
            activeIndicatorWidth: t.activeIndicatorWidth,
            enableTransitions: t.enableTransitions
          } as Record<string, string | number | boolean | undefined>
        }));
      },
      resetAllStyles: () => {
        this.properties.tabStyle = 'default';
        this.properties.tabAlignment = 'stretch';
        this.properties.tabOrientation = 'horizontal';
        this.properties.verticalTabPosition = 'left';
        this.properties.verticalTabWidth = '200px';
        this.properties.labelImageHeight = '';
        this.properties.themeMode = 'auto';
        this.properties.accentColor = '#0078d4';
        this.properties.tabTextColor = '';
        this.properties.tabActiveTextColor = '';
        this.properties.tabBackgroundColor = '';
        this.properties.tabActiveBackgroundColor = '';
        this.properties.tabHoverBackgroundColor = '';
        this.properties.tabFontSize = '';
        this.properties.tabFontWeight = '';
        this.properties.tabPaddingVertical = '';
        this.properties.tabPaddingHorizontal = '';
        this.properties.tabGap = '';
        this.properties.tabContentGap = '';
        this.properties.tabBorderRadius = '';
        this.properties.activeIndicatorWidth = '';
        this.properties.tabShadow = '';
        this.properties.enableTransitions = true;
        this.properties.showActiveIndicator = true;
        this.properties.activeIndicatorColor = '';
        this.properties.showTabSeparator = true;
        this.properties.tabSeparatorColor = '';
      },
      maxTabs: PiCanvasWebPart.MAX_TABS,
      tabPropertySuffixes: PiCanvasWebPart.TAB_PROPERTY_SUFFIXES
    });

    this._configPanel.open();

    // Deep-link to a specific section (and optionally a specific tab) if requested
    if (section) {
      this._configPanel.navigateTo(section, tabIndex);
    } else if (tabIndex) {
      this._configPanel.navigateTo('tabs', tabIndex);
    }

    // Clean up reference when panel closes
    const originalClose = this._configPanel.close.bind(this._configPanel);
    this._configPanel.close = (save: boolean) => {
      originalClose(save);
      this._configPanel = null;
    };
  }

  /**
   * Check if any tab is configured as a full-width embed.
   */
  private hasFullWidthEmbed(): boolean {
    const numTabs = this.getTabCount();
    for (let i = 1; i <= numTabs; i++) {
      const contentType = (this.properties[`tab${i}ContentType`] as string) || 'webpart';
      const fullWidth = this.properties[`tab${i}EmbedFullWidth`] === true;
      const fullPage = this.properties[`tab${i}EmbedFullPage`] === true;
      if (contentType === 'embed' && (fullWidth || fullPage)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if any tab has full-width HTML/Markdown content.
   */
  private hasFullWidthContent(): boolean {
    const numTabs = this.getTabCount();
    for (let i = 1; i <= numTabs; i++) {
      const contentType = (this.properties[`tab${i}ContentType`] as string) || 'webpart';
      const fullWidth = this.properties[`tab${i}ContentFullWidth`] === true;
      if ((contentType === 'html' || contentType === 'markdown') && fullWidth) {
        return true;
      }
    }
    return false;
  }

  /**
   * Apply full-width content layout using JavaScript.
   * SharePoint's contentScrollRegion has overflow-x: hidden which clips the CSS
   * viewport-escaping approach (width: 100vw; margin-left: calc(50% - 50vw)).
   * This method computes pixel values to fill the scroll region instead,
   * using setProperty with 'important' to override the CSS !important rules.
   * Also observes the scroll region for resize (e.g. nav expand/collapse).
   */
  private applyFullWidthContentLayout(): void {
    if (!this.hasFullWidthContent()) return;

    const contentDivs = this.domElement.querySelectorAll('[data-content-fullwidth="true"]');
    if (!contentDivs.length) return;

    // Find the SharePoint scroll region (the overflow-hidden ancestor)
    const scrollRegion = document.querySelector('[data-automation-id="contentScrollRegion"]') as HTMLElement;
    if (!scrollRegion) return;

    const scrollRegionStyle = window.getComputedStyle(scrollRegion);

    // Only apply JS fix if the scroll region clips horizontal overflow
    if (scrollRegionStyle.overflowX !== 'hidden') return;

    // Apply layout to all full-width content divs
    this._applyFullWidthSizing(contentDivs, scrollRegion);

    // Set up resize listeners to recalculate when scroll region width changes
    // (e.g. when SharePoint's left nav expands/collapses or window resizes)
    const recalculate = (): void => {
      const divs = this.domElement.querySelectorAll('[data-content-fullwidth="true"]');
      if (divs.length) {
        this._applyFullWidthSizing(divs, scrollRegion);
      }
    };

    if (!this._fullWidthResizeObserver) {
      let resizeTimeout: number | undefined;
      const debouncedRecalc = (): void => {
        if (resizeTimeout) { clearTimeout(resizeTimeout); }
        resizeTimeout = setTimeout(recalculate, 50) as unknown as number;
      };
      this._fullWidthResizeObserver = new ResizeObserver(debouncedRecalc);
      this._fullWidthResizeObserver.observe(scrollRegion);

      // Also listen for window resize as a fallback
      this._fullWidthResizeHandler = debouncedRecalc;
      window.addEventListener('resize', this._fullWidthResizeHandler);
    }
  }

  /**
   * Compute and apply pixel-based full-width sizing for content divs
   * relative to the scroll region boundaries.
   */
  private _applyFullWidthSizing(
    contentDivs: NodeListOf<Element>,
    scrollRegion: HTMLElement
  ): void {
    const scrollRegionStyle = window.getComputedStyle(scrollRegion);
    const scrollRegionRect = scrollRegion.getBoundingClientRect();
    const scrollRegionPaddingLeft = parseFloat(scrollRegionStyle.paddingLeft) || 0;
    const availableWidth = scrollRegion.clientWidth;
    const scrollRegionContentLeft = scrollRegionRect.left + scrollRegionPaddingLeft;

    contentDivs.forEach((div: HTMLElement) => {
      // First, temporarily reset CSS positioning to get the div's natural position
      div.style.setProperty('width', 'auto', 'important');
      div.style.setProperty('margin-left', '0', 'important');
      div.style.setProperty('margin-right', '0', 'important');

      // Read the natural position (where the div sits without full-width CSS)
      const naturalRect = div.getBoundingClientRect();
      const offsetFromScrollRegion = naturalRect.left - scrollRegionContentLeft;

      // Apply computed pixel values to fill the scroll region
      div.style.setProperty('width', availableWidth + 'px', 'important');
      div.style.setProperty('max-width', 'none', 'important');
      div.style.setProperty('margin-left', (-offsetFromScrollRegion) + 'px', 'important');
      div.style.setProperty('margin-right', '0', 'important');
      // Clip any internal elements that use viewport units (e.g. width: 100vw)
      div.style.setProperty('overflow', 'hidden', 'important');
    });
  }

  /**
   * Check if any tab is configured as a full-height embed.
   */
  private hasFullHeightEmbed(): boolean {
    const numTabs = this.getTabCount();
    for (let i = 1; i <= numTabs; i++) {
      const contentType = (this.properties[`tab${i}ContentType`] as string) || 'webpart';
      const fullHeight = this.properties[`tab${i}EmbedFullHeight`] === true;
      const fullPage = this.properties[`tab${i}EmbedFullPage`] === true;
      if (contentType === 'embed' && (fullHeight || fullPage)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Keep full-page toggle in sync with width/height toggles.
   */
  private syncEmbedFullPage(tabIndex: number): void {
    const fullWidth = this.properties[`tab${tabIndex}EmbedFullWidth`] === true;
    const fullHeight = this.properties[`tab${tabIndex}EmbedFullHeight`] === true;
    this.properties[`tab${tabIndex}EmbedFullPage`] = fullWidth && fullHeight;
  }

  /**
   * Add a new tab
   */
  private addTab(): void {
    const currentCount = this.getTabCount();
    if (currentCount < PiCanvasWebPart.MAX_TABS) { // Max 20 tabs
      this.properties.tabCount = currentCount + 1;
      this.context.propertyPane.refresh();
    }
  }

  /**
   * Remove the last tab
   */
  private removeTab(): void {
    const currentCount = this.getTabCount();
    if (currentCount > 1) { // Min 1 tab
      this.deleteTab(currentCount);
    }
  }

  /**
   * Move a tab up (swap with previous tab)
   */
  private moveTabUp(tabIndex: number): void {
    if (tabIndex <= 1) return; // Can't move first tab up

    // Swap with previous tab
    const prevIndex = tabIndex - 1;
    this.swapTabProperties(tabIndex, prevIndex);

    this.context.propertyPane.refresh();
    this.render();
  }

  /**
   * Move a tab down (swap with next tab)
   */
  private moveTabDown(tabIndex: number): void {
    const currentCount = this.getTabCount();
    if (tabIndex >= currentCount) return; // Can't move last tab down

    // Swap with next tab
    const nextIndex = tabIndex + 1;
    this.swapTabProperties(tabIndex, nextIndex);

    this.context.propertyPane.refresh();
    this.render();
  }

  /**
   * Copy all per-tab properties from one tab index to another
   */
  private copyTabProperties(sourceIndex: number, targetIndex: number): void {
    PiCanvasWebPart.TAB_PROPERTY_SUFFIXES.forEach((suffix) => {
      const sourceKey = `tab${sourceIndex}${suffix}`;
      const targetKey = `tab${targetIndex}${suffix}`;
      this.properties[targetKey] = this.properties[sourceKey];
    });
  }

  /**
   * Swap all per-tab properties between two tab indexes
   */
  private swapTabProperties(firstIndex: number, secondIndex: number): void {
    PiCanvasWebPart.TAB_PROPERTY_SUFFIXES.forEach((suffix) => {
      const firstKey = `tab${firstIndex}${suffix}`;
      const secondKey = `tab${secondIndex}${suffix}`;
      const firstValue = this.properties[firstKey];
      this.properties[firstKey] = this.properties[secondKey];
      this.properties[secondKey] = firstValue;
    });
  }

  /**
   * Clear all per-tab properties for a tab index
   */
  private clearTabProperties(tabIndex: number): void {
    PiCanvasWebPart.TAB_PROPERTY_SUFFIXES.forEach((suffix) => {
      const key = `tab${tabIndex}${suffix}`;
      this.properties[key] = undefined;
    });
  }

  /**
   * Delete a tab and shift remaining tabs down
   */
  private deleteTab(tabIndex: number): void {
    const currentCount = this.getTabCount();
    if (currentCount <= 1) return;
    if (tabIndex < 1 || tabIndex > currentCount) return;

    for (let i = tabIndex; i < currentCount; i++) {
      this.copyTabProperties(i + 1, i);
    }

    this.clearTabProperties(currentCount);
    this.properties.tabCount = currentCount - 1;

    this.context.propertyPane.refresh();
    this.render();
  }

  /**
   * Duplicate a tab and insert it after the source tab
   */
  private duplicateTab(tabIndex: number): void {
    const currentCount = this.getTabCount();
    if (currentCount >= PiCanvasWebPart.MAX_TABS) return;
    if (tabIndex < 1 || tabIndex > currentCount) return;

    const insertIndex = tabIndex + 1;
    this.properties.tabCount = currentCount + 1;

    for (let i = currentCount; i >= insertIndex; i--) {
      this.copyTabProperties(i, i + 1);
    }

    this.copyTabProperties(tabIndex, insertIndex);

    this.context.propertyPane.refresh();
    this.render();
  }

  /**
   * Browse content files from Site Assets and let user select one
   */
  private async browseContentFiles(tabIndex: number): Promise<void> {
    try {
      if (!this._templateService) {
        alert('Template service not available');
        return;
      }

      // Fetch files from SiteAssets/PiCanvas
      const files = await this._templateService.getContentFiles();

      if (files.length === 0) {
        alert('No .html or .md files found in SiteAssets/PiCanvas folder.\nPlease upload content files there first.');
        return;
      }

      // Create a simple selection dialog
      const fileList = files.map((f, i) => `${i + 1}. ${f.name}`).join('\n');
      const selection = prompt(
        `Select a file (enter number 1-${files.length}):\n\n${fileList}`,
        '1'
      );

      if (selection === null) return; // Cancelled

      const index = parseInt(selection, 10) - 1;
      if (isNaN(index) || index < 0 || index >= files.length) {
        alert('Invalid selection');
        return;
      }

      // Set the file URL
      this.properties[`tab${tabIndex}FileUrl`] = files[index].serverRelativeUrl;
      this.context.propertyPane.refresh();
      this.render();

    } catch (error) {
      console.error('[PiCanvas] Failed to browse files:', error);
      alert('Failed to load file list. Please check your permissions.');
    }
  }

  /**
   * Color presets for accent color selection
   */
  private getColorPresets(): IPropertyPaneDropdownOption[] {
    return [
      { key: '#0078d4', text: 'SharePoint Blue (default)' },
      { key: '#107c10', text: 'Green' },
      { key: '#5c2d91', text: 'Purple' },
      { key: '#d83b01', text: 'Orange' },
      { key: '#e81123', text: 'Red' },
      { key: '#008272', text: 'Teal' },
      { key: '#ffb900', text: 'Yellow' },
      { key: '#000000', text: 'Black' },
      { key: '#767676', text: 'Gray' }
    ];
  }

  /**
   * Text color presets
   */
  private getTextColorPresets(): IPropertyPaneDropdownOption[] {
    return [
      { key: '', text: '(Use default)' },
      { key: 'rgba(0,0,0,0.7)', text: 'Dark Gray (default)' },
      { key: 'rgba(0,0,0,0.87)', text: 'Near Black' },
      { key: '#000000', text: 'Black' },
      { key: '#ffffff', text: 'White' },
      { key: '#0078d4', text: 'SharePoint Blue' },
      { key: '#107c10', text: 'Green' },
      { key: '#5c2d91', text: 'Purple' }
    ];
  }

  /**
   * Font size presets
   */
  private getFontSizePresets(): IPropertyPaneDropdownOption[] {
    return [
      { key: '', text: '14px (default)' },
      { key: '12px', text: '12px - Small' },
      { key: '13px', text: '13px' },
      { key: '14px', text: '14px - Normal' },
      { key: '15px', text: '15px' },
      { key: '16px', text: '16px - Medium' },
      { key: '18px', text: '18px - Large' },
      { key: '20px', text: '20px - Extra Large' }
    ];
  }

  /**
   * Font weight presets
   */
  private getFontWeightPresets(): IPropertyPaneDropdownOption[] {
    return [
      { key: '', text: '500 (default)' },
      { key: '400', text: '400 - Normal' },
      { key: '500', text: '500 - Medium' },
      { key: '600', text: '600 - Semi-Bold' },
      { key: '700', text: '700 - Bold' }
    ];
  }

  /**
   * Padding presets
   */
  private getPaddingPresets(): IPropertyPaneDropdownOption[] {
    return [
      { key: '', text: '12px (default)' },
      { key: '8px', text: '8px - Compact' },
      { key: '10px', text: '10px' },
      { key: '12px', text: '12px - Normal' },
      { key: '16px', text: '16px - Comfortable' },
      { key: '20px', text: '20px - Spacious' },
      { key: '24px', text: '24px - Extra Spacious' }
    ];
  }

  /**
   * Gap presets
   */
  private getGapPresets(): IPropertyPaneDropdownOption[] {
    return [
      { key: '', text: '0px (default)' },
      { key: '0px', text: '0px - No gap' },
      { key: '4px', text: '4px - Tight' },
      { key: '8px', text: '8px - Normal' },
      { key: '12px', text: '12px - Spacious' },
      { key: '16px', text: '16px - Wide' }
    ];
  }

  /**
   * Border radius presets
   */
  private getBorderRadiusPresets(): IPropertyPaneDropdownOption[] {
    return [
      { key: '', text: '0px (default)' },
      { key: '0px', text: '0px - Square' },
      { key: '4px', text: '4px - Slightly Rounded' },
      { key: '6px', text: '6px - Rounded' },
      { key: '8px', text: '8px - More Rounded' },
      { key: '12px', text: '12px - Very Rounded' },
      { key: '16px', text: '16px - Pill-like' }
    ];
  }

  /**
   * Indicator width presets
   */
  private getIndicatorWidthPresets(): IPropertyPaneDropdownOption[] {
    return [
      { key: '', text: '3px (default)' },
      { key: '2px', text: '2px - Thin' },
      { key: '3px', text: '3px - Normal' },
      { key: '4px', text: '4px - Medium' },
      { key: '5px', text: '5px - Thick' },
      { key: '6px', text: '6px - Extra Thick' }
    ];
  }

  /**
   * Shadow presets
   */
  private getShadowPresets(): IPropertyPaneDropdownOption[] {
    return [
      { key: '', text: 'None (default)' },
      { key: 'none', text: 'None' },
      { key: '0 1px 2px rgba(0,0,0,0.1)', text: 'Subtle' },
      { key: '0 2px 4px rgba(0,0,0,0.15)', text: 'Medium' },
      { key: '0 4px 8px rgba(0,0,0,0.2)', text: 'Strong' },
      { key: '0 2px 8px rgba(0,120,212,0.3)', text: 'Blue Glow' },
      { key: '0 2px 8px rgba(16,124,16,0.3)', text: 'Green Glow' },
      { key: '0 2px 8px rgba(92,45,145,0.3)', text: 'Purple Glow' }
    ];
  }

  /**
   * Image position presets for per-tab images
   */
  private getImagePositionPresets(): IPropertyPaneDropdownOption[] {
    return [
      { key: '', text: 'Left of text (default)' },
      { key: 'left', text: 'Left of text' },
      { key: 'right', text: 'Right of text' },
      { key: 'top', text: 'Above text' },
      { key: 'background', text: 'Background image' }
    ];
  }

  /**
   * Icon presets for tab labels - Fluent UI icons that work in SharePoint
   */
  private getIconPresets(): IPropertyPaneDropdownOption[] {
    return [
      { key: '', text: '— Select icon to insert —' },
      { key: 'Home', text: '🏠 Home' },
      { key: 'Info', text: 'ℹ️ Info' },
      { key: 'Settings', text: '⚙️ Settings' },
      { key: 'Mail', text: '✉️ Mail' },
      { key: 'Calendar', text: '📅 Calendar' },
      { key: 'Contact', text: '👤 Contact' },
      { key: 'People', text: '👥 People' },
      { key: 'Document', text: '📄 Document' },
      { key: 'Folder', text: '📁 Folder' },
      { key: 'Chart', text: '📊 Chart' },
      { key: 'Search', text: '🔍 Search' },
      { key: 'Star', text: '⭐ Star' },
      { key: 'Heart', text: '❤️ Heart' },
      { key: 'CheckMark', text: '✓ Check' },
      { key: 'Warning', text: '⚠️ Warning' },
      { key: 'Lightning', text: '⚡ Lightning' },
      { key: 'Globe', text: '🌐 Globe' },
      { key: 'Lock', text: '🔒 Lock' },
      { key: 'Link', text: '🔗 Link' },
      { key: 'Photo', text: '🖼️ Photo' },
      { key: 'Video', text: '🎬 Video' },
      { key: 'Music', text: '🎵 Music' },
      { key: 'News', text: '📰 News' },
      { key: 'Edit', text: '✏️ Edit' },
      { key: 'Add', text: '➕ Add' },
      { key: 'Delete', text: '🗑️ Delete' },
      { key: 'Refresh', text: '🔄 Refresh' },
      { key: 'Download', text: '⬇️ Download' },
      { key: 'Upload', text: '⬆️ Upload' }
    ];
  }

  /**
   * Insert icon into tab label
   */
  private insertIconIntoLabel(tabIndex: number, iconKey: string): void {
    if (!iconKey) return;

    const currentLabel = (this.properties[`tab${tabIndex}Label`] as string) || '';
    const iconMap: Record<string, string> = {
      'Home': '🏠',
      'Info': 'ℹ️',
      'Settings': '⚙️',
      'Mail': '✉️',
      'Calendar': '📅',
      'Contact': '👤',
      'People': '👥',
      'Document': '📄',
      'Folder': '📁',
      'Chart': '📊',
      'Search': '🔍',
      'Star': '⭐',
      'Heart': '❤️',
      'CheckMark': '✓',
      'Warning': '⚠️',
      'Lightning': '⚡',
      'Globe': '🌐',
      'Lock': '🔒',
      'Link': '🔗',
      'Photo': '🖼️',
      'Video': '🎬',
      'Music': '🎵',
      'News': '📰',
      'Edit': '✏️',
      'Add': '➕',
      'Delete': '🗑️',
      'Refresh': '🔄',
      'Download': '⬇️',
      'Upload': '⬆️'
    };

    const icon = iconMap[iconKey] || '';
    // Prepend icon to existing label, or just set icon if label is empty
    this.properties[`tab${tabIndex}Label`] = currentLabel ? `${icon} ${currentLabel}` : `${icon} ${iconKey}`;
    this.context.propertyPane.refresh();
    this.render();
  }

  /**
   * Generate dynamic property pane fields for tab configuration
   */
  private getTabConfigurationFields(): IPropertyPaneField<unknown>[] {
    const fields: IPropertyPaneField<unknown>[] = [];
    const zones = this.getZones();
    const numTabs = this.getTabCount();

    fields.push(PropertyPaneLabel('tabConfigHeader', {
      text: `Configure Tabs (${zones.length} web part${zones.length !== 1 ? 's' : ''} detected)`
    }));

    // Add tab button
    fields.push(
      PropertyPaneButton('addTab', {
        text: 'Add Tab',
        buttonType: PropertyPaneButtonType.Normal,
        icon: 'Add',
        onClick: () => this.addTab()
      })
    );

    // Tab configuration fields
    for (let i = 1; i <= numTabs; i++) {
      // Tab header with move buttons
      fields.push(PropertyPaneLabel(`tab${i}Header`, {
        text: `━━━ Tab ${i} ━━━`
      }));

      // Move Up button (not for first tab)
      if (i > 1) {
        fields.push(
          PropertyPaneButton(`moveUp${i}`, {
            text: '↑ Move Up',
            buttonType: PropertyPaneButtonType.Normal,
            onClick: () => this.moveTabUp(i)
          })
        );
      }

      // Move Down button (not for last tab)
      if (i < numTabs) {
        fields.push(
          PropertyPaneButton(`moveDown${i}`, {
            text: '↓ Move Down',
            buttonType: PropertyPaneButtonType.Normal,
            onClick: () => this.moveTabDown(i)
          })
        );
      }

      if (numTabs < PiCanvasWebPart.MAX_TABS) {
        fields.push(
          PropertyPaneButton(`duplicateTab${i}`, {
            text: 'Duplicate Tab',
            buttonType: PropertyPaneButtonType.Normal,
            icon: 'Copy',
            onClick: () => this.duplicateTab(i)
          })
        );
      }

      if (numTabs > 1) {
        fields.push(
          PropertyPaneButton(`deleteTab${i}`, {
            text: 'Delete Tab',
            buttonType: PropertyPaneButtonType.Normal,
            icon: 'Delete',
            onClick: () => this.deleteTab(i)
          })
        );
      }

      // Content Type dropdown (v3.0)
      fields.push(
        PropertyPaneDropdown(`tab${i}ContentType`, {
          label: strings.ContentTypeLabel || 'Content Type',
          options: [
            { key: 'webpart', text: strings.ContentTypeWebPart || 'SharePoint Web Part' },
            { key: 'section', text: strings.ContentTypeSection || 'SharePoint Section' },
            { key: 'markdown', text: strings.ContentTypeMarkdown || 'Markdown Content' },
            { key: 'html', text: strings.ContentTypeHtml || 'HTML Content' },
            { key: 'mermaid', text: strings.ContentTypeMermaid || 'Mermaid Diagram' },
            { key: 'embed', text: strings.ContentTypeEmbed || 'Embed (iframe)' },
            { key: 'rss', text: strings.ContentTypeRss || 'RSS Feed' },
            { key: 'file', text: strings.ContentTypeFile || 'External File' },
            { key: 'javascript', text: strings.ContentTypeJavaScript || 'JavaScript Code' },
            { key: 'toc', text: strings.ContentTypeToc || 'Table of Contents' },
            { key: 'profilereport', text: strings.ContentTypeProfileReport || 'Profile Report' }
          ],
          selectedKey: this.properties[`tab${i}ContentType`] as string || 'webpart'
        })
      );

      const contentType = (this.properties[`tab${i}ContentType`] as string) || 'webpart';

      // Conditional fields based on content type
      if (contentType === 'webpart' || contentType === 'section') {
        // Show WebPartID dropdown filtered by content type (webpart shows only webparts, section shows only sections)
        fields.push(
          PropertyPaneDropdown(`tab${i}WebPartID`, {
            label: contentType === 'section' ? 'Section' : 'Web Part',
            options: this.getDropdownOptions(i, contentType as 'webpart' | 'section'),
            selectedKey: this.properties[`tab${i}WebPartID`] as string || ''
          })
        );

        // Show position warning if this webpart is above PiCanvas
        const positionWarning = this._positionWarnings.get(i);
        if (positionWarning) {
          fields.push(
            PropertyPaneLabel(`tab${i}PositionWarning`, {
              text: positionWarning
            })
          );
        }

        // Custom label field for identification (optional)
        fields.push(
          PropertyPaneTextField(`tab${i}WebPartLabel`, {
            label: 'Label (for identification)',
            placeholder: 'e.g., "Main Hero Banner", "Team Links"',
            description: 'Optional: helps you identify this selection'
          })
        );
      } else if (contentType === 'markdown' || contentType === 'html' || contentType === 'mermaid') {
        // For HTML and Markdown, show source type selection (Mermaid is always manual)
        if (contentType === 'html' || contentType === 'markdown') {
          const contentSourceType = (this.properties[`tab${i}ContentSourceType`] as string) || 'manual';

          fields.push(
            PropertyPaneDropdown(`tab${i}ContentSourceType`, {
              label: strings.ContentSourceTypeLabel || 'Content Source',
              options: [
                { key: 'manual', text: strings.ContentSourceManual || 'Manual Input' },
                { key: 'webpart', text: strings.ContentSourceWebPart || 'Text WebPart on Page' }
              ],
              selectedKey: contentSourceType
            })
          );

          if (contentSourceType === 'webpart') {
            // Show Text WebPart selector
            fields.push(
              PropertyPaneDropdown(`tab${i}ContentSourceWebPartID`, {
                label: strings.ContentSourceWebPartLabel || 'Select Text WebPart',
                options: this.getTextWebPartOptions(i),
                selectedKey: (this.properties[`tab${i}ContentSourceWebPartID`] as string) || ''
              })
            );
            // Info label
            fields.push(
              PropertyPaneLabel(`tab${i}ContentSourceInfo`, {
                text: strings.ContentSourceWebPartInfo || 'The selected Text WebPart will be hidden and its content rendered here.'
              })
            );
          } else {
            // Show manual content text field
            const placeholders: { [key: string]: string } = {
              markdown: strings.MarkdownPlaceholder || '# Heading\n\nYour **markdown** content here...',
              html: strings.HtmlPlaceholder || '<div>\n  <p>Your HTML content here...</p>\n</div>'
            };
            fields.push(
              PropertyPaneTextField(`tab${i}CustomContent`, {
                label: strings.CustomContentLabel || 'Content',
                placeholder: placeholders[contentType],
                multiline: true,
                rows: 8
              })
            );
            // Add live preview for custom content
            fields.push(
              PropertyPaneContentPreview(`tab${i}Preview`, {
                key: `tab${i}ContentPreview`,
                contentType: contentType as 'markdown' | 'html',
                content: (this.properties[`tab${i}CustomContent`] as string) || ''
              })
            );
            // Add metadata token picker for HTML and Markdown content
            fields.push(
              PropertyPaneMetadataTokenPicker(`tab${i}TokenPicker`, {
                key: `tab${i}MetadataTokenPicker`,
                tokensByCategory: this._resolvedTokensByCategory,
                isLoading: this._tokensLoading,
                error: this._tokensError || undefined,
                onTokenCopied: () => {
                  // Trigger property pane refresh to ensure user can paste
                  this.context.propertyPane.refresh();
                }
              })
            );
          }

          // Full-width content toggle (applies to both manual and webpart source)
          fields.push(
            PropertyPaneToggle(`tab${i}ContentFullWidth`, {
              label: strings.ContentFullWidthLabel || 'Content Width',
              checked: this.properties[`tab${i}ContentFullWidth`] as boolean || false,
              onText: strings.ContentFullWidthOn || 'Full Width (edge-to-edge)',
              offText: strings.ContentFullWidthOff || 'Contained'
            })
          );
        } else {
          // Mermaid is always manual input
          const placeholders: { [key: string]: string } = {
            mermaid: strings.MermaidPlaceholder || 'graph TD\n    A[Start] --> B[Process]\n    B --> C[End]'
          };
          fields.push(
            PropertyPaneTextField(`tab${i}CustomContent`, {
              label: strings.CustomContentLabel || 'Content',
              placeholder: placeholders[contentType],
              multiline: true,
              rows: 8
            })
          );
          // Add live preview for custom content
          fields.push(
            PropertyPaneContentPreview(`tab${i}Preview`, {
              key: `tab${i}ContentPreview`,
              contentType: contentType as 'mermaid',
              content: (this.properties[`tab${i}CustomContent`] as string) || ''
            })
          );
        }
      } else if (contentType === 'embed') {
        // Show embed URL and height fields
        fields.push(
          PropertyPaneTextField(`tab${i}EmbedUrl`, {
            label: strings.EmbedUrlLabel || 'Embed URL',
            placeholder: 'https://www.youtube.com/embed/...',
            description: strings.EmbedUrlDescription || 'Only trusted domains are allowed (YouTube, PowerBI, Forms, etc.)',
            multiline: false
          })
        );

        const embedFullPage = this.properties[`tab${i}EmbedFullPage`] as boolean || false;
        const embedFullWidth = this.properties[`tab${i}EmbedFullWidth`] as boolean || false;
        const embedFullHeight = this.properties[`tab${i}EmbedFullHeight`] as boolean || false;

        fields.push(
          PropertyPaneToggle(`tab${i}EmbedFullPage`, {
            label: strings.EmbedFullPageLabel || 'Embed Layout',
            checked: embedFullPage,
            onText: strings.EmbedFullPageOn || 'Full Page',
            offText: strings.EmbedFullPageOff || 'Custom'
          })
        );
        fields.push(
          PropertyPaneToggle(`tab${i}EmbedFullWidth`, {
            label: strings.EmbedFullWidthLabel || 'Embed Width',
            checked: embedFullWidth,
            onText: strings.EmbedFullWidthOn || 'Full Width',
            offText: strings.EmbedFullWidthOff || 'Contained'
          })
        );
        fields.push(
          PropertyPaneToggle(`tab${i}EmbedFullHeight`, {
            label: strings.EmbedFullHeightLabel || 'Embed Height',
            checked: embedFullHeight,
            onText: strings.EmbedFullHeightOn || 'Full Height (100vh)',
            offText: strings.EmbedFullHeightOff || 'Custom Height'
          })
        );
        if (!embedFullHeight && !embedFullPage) {
          fields.push(
            PropertyPaneTextField(`tab${i}EmbedHeight`, {
              label: strings.EmbedHeightLabel || 'Embed Height',
              placeholder: strings.EmbedHeightPlaceholder || '400px',
              multiline: false
            })
          );
        }
        // Add live preview for embed content
        fields.push(
          PropertyPaneContentPreview(`tab${i}EmbedPreview`, {
            key: `tab${i}EmbedContentPreview`,
            contentType: 'embed',
            content: '',
            embedUrl: (this.properties[`tab${i}EmbedUrl`] as string) || '',
            embedHeight: (this.properties[`tab${i}EmbedHeight`] as string) || '200px'
          })
        );
      } else if (contentType === 'rss') {
        // RSS Feed configuration fields
        fields.push(
          PropertyPaneTextField(`tab${i}RssFeedUrl`, {
            label: strings.RssFeedUrlLabel || 'Feed URL',
            placeholder: 'https://example.com/feed.xml',
            description: 'Enter RSS or Atom feed URL',
            multiline: false
          })
        );
        fields.push(
          PropertyPaneDropdown(`tab${i}RssLayout`, {
            label: strings.RssLayoutLabel || 'Layout',
            options: [
              { key: 'list', text: 'List' },
              { key: 'cards', text: 'Cards' },
              { key: 'compact', text: 'Compact' }
            ],
            selectedKey: this.properties[`tab${i}RssLayout`] as string || 'list'
          })
        );
        fields.push(
          PropertyPaneDropdown(`tab${i}RssMaxItems`, {
            label: strings.RssMaxItemsLabel || 'Max Items',
            options: [
              { key: '5', text: '5 items' },
              { key: '10', text: '10 items' },
              { key: '15', text: '15 items' },
              { key: '20', text: '20 items' }
            ],
            selectedKey: (this.properties[`tab${i}RssMaxItems`] as string) || '10'
          })
        );
        fields.push(
          PropertyPaneToggle(`tab${i}RssShowDate`, {
            label: strings.RssShowDateLabel || 'Show Date',
            checked: this.properties[`tab${i}RssShowDate`] !== false,
            onText: 'Yes',
            offText: 'No'
          })
        );
        fields.push(
          PropertyPaneToggle(`tab${i}RssShowDescription`, {
            label: strings.RssShowDescriptionLabel || 'Show Description',
            checked: this.properties[`tab${i}RssShowDescription`] !== false,
            onText: 'Yes',
            offText: 'No'
          })
        );
        fields.push(
          PropertyPaneToggle(`tab${i}RssShowImage`, {
            label: strings.RssShowImageLabel || 'Show Image',
            checked: this.properties[`tab${i}RssShowImage`] !== false,
            onText: 'Yes',
            offText: 'No'
          })
        );
        fields.push(
          PropertyPaneToggle(`tab${i}RssShowAuthor`, {
            label: strings.RssShowAuthorLabel || 'Show Author',
            checked: this.properties[`tab${i}RssShowAuthor`] === true,
            onText: 'Yes',
            offText: 'No'
          })
        );
        fields.push(
          PropertyPaneDropdown(`tab${i}RssDescriptionLimit`, {
            label: strings.RssDescriptionLimitLabel || 'Description Length',
            options: [
              { key: '100', text: '100 characters' },
              { key: '150', text: '150 characters' },
              { key: '200', text: '200 characters' },
              { key: '300', text: '300 characters' }
            ],
            selectedKey: (this.properties[`tab${i}RssDescriptionLimit`] as string) || '150'
          })
        );
        fields.push(
          PropertyPaneDropdown(`tab${i}RssDateFormat`, {
            label: strings.RssDateFormatLabel || 'Date Format',
            options: [
              { key: 'relative', text: 'Relative (2h ago)' },
              { key: 'MM/DD/YYYY', text: 'MM/DD/YYYY' },
              { key: 'DD/MM/YYYY', text: 'DD/MM/YYYY' }
            ],
            selectedKey: this.properties[`tab${i}RssDateFormat`] as string || 'relative'
          })
        );
        fields.push(
          PropertyPaneDropdown(`tab${i}RssLinkTarget`, {
            label: strings.RssLinkTargetLabel || 'Open Links In',
            options: [
              { key: '_blank', text: 'New Tab' },
              { key: '_self', text: 'Same Tab' }
            ],
            selectedKey: this.properties[`tab${i}RssLinkTarget`] as string || '_blank'
          })
        );
        fields.push(
          PropertyPaneTextField(`tab${i}RssLoadingMessage`, {
            label: strings.RssLoadingMessageLabel || 'Loading Message',
            placeholder: 'Loading feed...',
            multiline: false
          })
        );
      } else if (contentType === 'file') {
        // External file configuration fields
        fields.push(
          PropertyPaneTextField(`tab${i}FileUrl`, {
            label: strings.FileUrlLabel || 'File URL',
            placeholder: strings.FileUrlPlaceholder || '/sites/yoursite/SiteAssets/PiCanvas/content.html',
            description: strings.FileUrlDescription || 'Server-relative path to .html or .md file',
            multiline: false
          })
        );
        // Browse Site Assets button
        fields.push(
          PropertyPaneButton(`tab${i}BrowseFiles`, {
            text: strings.BrowseSiteAssetsLabel || 'Browse Site Assets',
            buttonType: PropertyPaneButtonType.Normal,
            icon: 'FolderOpen',
            onClick: () => this.browseContentFiles(i)
          })
        );
      } else if (contentType === 'javascript') {
        // JavaScript code configuration fields
        const selectedTemplate = (this.properties[`tab${i}JavaScriptTemplate`] as string) || '';
        const contentSourceType = (this.properties[`tab${i}ContentSourceType`] as string) || 'manual';

        // Template selector dropdown
        fields.push(
          PropertyPaneDropdown(`tab${i}JavaScriptTemplate`, {
            label: strings.JavaScriptTemplateLabel || 'Template',
            options: getJavaScriptTemplateOptions(),
            selectedKey: selectedTemplate
          })
        );

        // Display mode dropdown for JavaScript - Contained, Full Section, or Full Screen
        fields.push(
          PropertyPaneDropdown(`tab${i}JavaScriptDisplayMode`, {
            label: 'Display Mode',
            options: [
              { key: 'contained', text: 'Contained' },
              { key: 'fullSection', text: 'Full Section (keeps navigation)' },
              { key: 'fullScreen', text: 'Full Screen (hides everything)' }
            ],
            selectedKey: (this.properties[`tab${i}JavaScriptDisplayMode`] as string) || 'contained'
          })
        );

        // If a template is selected, show configuration options
        if (selectedTemplate) {
          const template = getJavaScriptTemplate(selectedTemplate);
          if (template) {
            // Template configuration header
            fields.push(
              PropertyPaneLabel(`tab${i}TemplateConfigHeader`, {
                text: `── ${strings.JavaScriptTemplateConfigHeader || 'Template Configuration'} ──`
              })
            );

            // Add configuration fields for the selected template
            fields.push(...this.getJavaScriptTemplateConfigFields(i, template));
          }
        } else {
          // No template selected - show content source options
          // Content source type dropdown
          fields.push(
            PropertyPaneDropdown(`tab${i}ContentSourceType`, {
              label: strings.ContentSourceTypeLabel || 'Content Source',
              options: [
                { key: 'manual', text: strings.ContentSourceManual || 'Manual Input' },
                { key: 'webpart', text: strings.ContentSourceWebPart || 'Text WebPart on Page' }
              ],
              selectedKey: contentSourceType
            })
          );

          if (contentSourceType === 'webpart') {
            // Text WebPart selector
            fields.push(
              PropertyPaneDropdown(`tab${i}ContentSourceWebPartID`, {
                label: strings.ContentSourceWebPartLabel || 'Select Text WebPart',
                options: this.getTextWebPartOptions(i),
                selectedKey: (this.properties[`tab${i}ContentSourceWebPartID`] as string) || ''
              })
            );
            // Info label
            fields.push(
              PropertyPaneLabel(`tab${i}ContentSourceInfo`, {
                text: strings.ContentSourceWebPartInfo || 'The selected Text WebPart will be hidden and its content rendered here.'
              })
            );
          } else {
            // Manual input field
            fields.push(
              PropertyPaneTextField(`tab${i}CustomContent`, {
                label: strings.CustomContentLabel || 'Content',
                placeholder: strings.JavaScriptPlaceholder || '// Your JavaScript code here\ncontainer.innerHTML = \'<h1>Hello!</h1>\';',
                multiline: true,
                rows: 12
              })
            );
          }
        }

      } else if (contentType === 'toc') {
        // Table of Contents configuration fields
        fields.push(
          PropertyPaneLabel(`tab${i}TocInfo`, {
            text: strings.TocInfoText || 'Scans the SharePoint page for headings and generates a navigable table of contents.'
          })
        );

        // Content source toggles
        fields.push(
          PropertyPaneToggle(`tab${i}TocSearchText`, {
            label: strings.TocSearchTextLabel || 'Scan Text Web Parts',
            checked: this.properties[`tab${i}TocSearchText`] !== false,
            onText: 'Yes',
            offText: 'No'
          })
        );
        fields.push(
          PropertyPaneToggle(`tab${i}TocSearchMarkdown`, {
            label: strings.TocSearchMarkdownLabel || 'Scan Markdown Web Parts',
            checked: this.properties[`tab${i}TocSearchMarkdown`] !== false,
            onText: 'Yes',
            offText: 'No'
          })
        );
        fields.push(
          PropertyPaneToggle(`tab${i}TocSearchCollapsible`, {
            label: strings.TocSearchCollapsibleLabel || 'Scan Collapsible Sections',
            checked: this.properties[`tab${i}TocSearchCollapsible`] === true,
            onText: 'Yes',
            offText: 'No'
          })
        );

        // Heading level toggles
        fields.push(
          PropertyPaneToggle(`tab${i}TocShowH2`, {
            label: strings.TocShowHeading1Label || 'Show H2 Headings',
            checked: this.properties[`tab${i}TocShowH2`] !== false,
            onText: 'Yes',
            offText: 'No'
          })
        );
        fields.push(
          PropertyPaneToggle(`tab${i}TocShowH3`, {
            label: strings.TocShowHeading2Label || 'Show H3 Headings',
            checked: this.properties[`tab${i}TocShowH3`] !== false,
            onText: 'Yes',
            offText: 'No'
          })
        );
        fields.push(
          PropertyPaneToggle(`tab${i}TocShowH4`, {
            label: strings.TocShowHeading3Label || 'Show H4 Headings',
            checked: this.properties[`tab${i}TocShowH4`] === true,
            onText: 'Yes',
            offText: 'No'
          })
        );
        fields.push(
          PropertyPaneToggle(`tab${i}TocShowH5`, {
            label: strings.TocShowHeading4Label || 'Show H5 Headings',
            checked: this.properties[`tab${i}TocShowH5`] === true,
            onText: 'Yes',
            offText: 'No'
          })
        );

        // Style preset
        fields.push(
          PropertyPaneDropdown(`tab${i}TocStylePreset`, {
            label: strings.TocStylePresetLabel || 'Style Preset',
            options: [
              { key: '', text: '(Custom)' },
              { key: 'classic', text: 'Classic' },
              { key: 'modern', text: 'Modern' },
              { key: 'sidebar', text: 'Sidebar' },
              { key: 'minimal', text: 'Minimal' },
              { key: 'elegant', text: 'Elegant' },
              { key: 'compact', text: 'Compact' }
            ],
            selectedKey: (this.properties[`tab${i}TocStylePreset`] as string) || ''
          })
        );

        // List style (expanded)
        fields.push(
          PropertyPaneDropdown(`tab${i}TocListStyle`, {
            label: strings.TocListStyleLabel || 'List Style',
            options: [
              { key: 'disc', text: 'Bullet Points' },
              { key: 'decimal', text: 'Numbered' },
              { key: 'none', text: 'No Markers' },
              { key: 'roman', text: 'Roman Numerals' },
              { key: 'alpha', text: 'Alphabetical' },
              { key: 'dash', text: 'Dashes' },
              { key: 'arrow', text: 'Arrows' },
              { key: 'custom-icon', text: 'Custom Icon' }
            ],
            selectedKey: (this.properties[`tab${i}TocListStyle`] as string) || 'disc'
          })
        );

        if ((this.properties[`tab${i}TocListStyle`] as string) === 'custom-icon') {
          fields.push(
            PropertyPaneTextField(`tab${i}TocCustomIcon`, {
              label: strings.TocCustomIconLabel || 'Custom Icon',
              placeholder: 'e.g. ▸ or ★',
              multiline: false
            })
          );
        }

        // Scrollspy
        fields.push(
          PropertyPaneToggle(`tab${i}TocEnableScrollspy`, {
            label: strings.TocEnableScrollspyLabel || 'Enable Scrollspy',
            checked: this.properties[`tab${i}TocEnableScrollspy`] === true,
            onText: 'On',
            offText: 'Off'
          })
        );

        // Collapsible sections
        fields.push(
          PropertyPaneToggle(`tab${i}TocEnableCollapsible`, {
            label: strings.TocEnableCollapsibleLabel || 'Collapsible Sections',
            checked: this.properties[`tab${i}TocEnableCollapsible`] === true,
            onText: 'On',
            offText: 'Off'
          })
        );

        // Hover background
        fields.push(
          PropertyPaneToggle(`tab${i}TocEnableHoverBackground`, {
            label: strings.TocEnableHoverBackgroundLabel || 'Hover Background',
            checked: this.properties[`tab${i}TocEnableHoverBackground`] === true,
            onText: 'On',
            offText: 'Off'
          })
        );

        // Click ripple
        fields.push(
          PropertyPaneToggle(`tab${i}TocEnableClickRipple`, {
            label: strings.TocEnableClickRippleLabel || 'Click Ripple Effect',
            checked: this.properties[`tab${i}TocEnableClickRipple`] === true,
            onText: 'On',
            offText: 'Off'
          })
        );

        // Sticky mode
        fields.push(
          PropertyPaneToggle(`tab${i}TocStickyMode`, {
            label: strings.TocStickyModeLabel || 'Sticky Mode',
            checked: this.properties[`tab${i}TocStickyMode`] === true,
            onText: 'On',
            offText: 'Off'
          })
        );

        // Hide on mobile
        fields.push(
          PropertyPaneToggle(`tab${i}TocHideInMobile`, {
            label: strings.TocHideInMobileLabel || 'Hide on Mobile',
            checked: this.properties[`tab${i}TocHideInMobile`] === true,
            onText: 'Hidden',
            offText: 'Visible'
          })
        );

        // Title customization
        fields.push(
          PropertyPaneToggle(`tab${i}TocHideTitle`, {
            label: strings.TocHideTitleLabel || 'Hide Title',
            checked: this.properties[`tab${i}TocHideTitle`] === true,
            onText: 'Hidden',
            offText: 'Visible'
          })
        );

        if (this.properties[`tab${i}TocHideTitle`] !== true) {
          fields.push(
            PropertyPaneTextField(`tab${i}TocTitleText`, {
              label: strings.TocTitleTextLabel || 'TOC Title',
              placeholder: 'Table of Contents',
              multiline: false
            })
          );
        }

        // Back link
        fields.push(
          PropertyPaneToggle(`tab${i}TocShowBackLink`, {
            label: strings.TocShowPreviousPageLinkLabel || 'Show Back Link',
            checked: this.properties[`tab${i}TocShowBackLink`] === true,
            onText: 'Yes',
            offText: 'No'
          })
        );

        if (this.properties[`tab${i}TocShowBackLink`] === true) {
          fields.push(
            PropertyPaneTextField(`tab${i}TocBackLinkText`, {
              label: strings.TocPreviousPageTextLabel || 'Back Link Text',
              placeholder: 'Back to previous page',
              multiline: false
            })
          );
        }
      } else if (contentType === 'profilereport') {
        // Profile Report configuration fields
        fields.push(
          PropertyPaneTextField(`tab${i}ProfileReportLibrary`, {
            label: strings.ProfileReportLibraryLabel || 'Document Library',
            description: strings.ProfileReportLibraryDescription || 'SharePoint library containing profile files',
            placeholder: 'Profiles'
          })
        );
        fields.push(
          PropertyPaneTextField(`tab${i}ProfileReportListName`, {
            label: strings.ProfileReportListNameLabel || 'Company List Name',
            description: 'SharePoint list with company data (leave empty to scan library folders instead)',
            placeholder: 'Pi_Companies'
          })
        );
        fields.push(
          PropertyPaneDropdown(`tab${i}ProfileReportLayout`, {
            label: strings.ProfileReportLayoutLabel || 'Layout',
            options: [
              { key: 'tabbed', text: 'Tabbed' },
              { key: 'accordion', text: 'Accordion' },
              { key: 'cards', text: 'Cards' }
            ],
            selectedKey: (this.properties[`tab${i}ProfileReportLayout`] as string) || 'tabbed'
          })
        );
        fields.push(
          PropertyPaneDropdown(`tab${i}ProfileReportSortBy`, {
            label: strings.ProfileReportSortByLabel || 'Sort By',
            options: [
              { key: 'name', text: 'Company Name' },
              { key: 'date', text: 'Date Created' },
              { key: 'key', text: 'Domain Key' }
            ],
            selectedKey: (this.properties[`tab${i}ProfileReportSortBy`] as string) || 'name'
          })
        );
        fields.push(
          PropertyPaneDropdown(`tab${i}ProfileReportTheme`, {
            label: strings.ProfileReportThemeLabel || 'Theme',
            options: [
              { key: 'auto', text: 'Auto (follow system)' },
              { key: 'light', text: 'Light' },
              { key: 'dark', text: 'Dark' },
              { key: 'high-contrast', text: 'High Contrast' }
            ],
            selectedKey: (this.properties[`tab${i}ProfileReportTheme`] as string) || 'auto'
          })
        );
        fields.push(
          PropertyPaneSlider(`tab${i}ProfileReportCompanyLimit`, {
            label: strings.ProfileReportCompanyLimitLabel || 'Max Companies',
            min: 100,
            max: 25000,
            step: 100,
            value: (this.properties[`tab${i}ProfileReportCompanyLimit`] as number) || 500
          })
        );
        fields.push(
          PropertyPaneToggle(`tab${i}ProfileReportShowMethodK`, {
            label: strings.ProfileReportShowMethodKLabel || 'Show Method-K',
            checked: this.properties[`tab${i}ProfileReportShowMethodK`] !== false,
            onText: 'Yes',
            offText: 'No'
          })
        );
        fields.push(
          PropertyPaneToggle(`tab${i}ProfileReportShowMethodL`, {
            label: strings.ProfileReportShowMethodLLabel || 'Show Method-L',
            checked: this.properties[`tab${i}ProfileReportShowMethodL`] !== false,
            onText: 'Yes',
            offText: 'No'
          })
        );
        fields.push(
          PropertyPaneToggle(`tab${i}ProfileReportShowMethodM`, {
            label: strings.ProfileReportShowMethodMLabel || 'Show Method-M (AI Synthesis)',
            checked: this.properties[`tab${i}ProfileReportShowMethodM`] !== false,
            onText: 'Yes',
            offText: 'No'
          })
        );
        fields.push(
          PropertyPaneToggle(`tab${i}ProfileReportShowProfileJson`, {
            label: strings.ProfileReportShowProfileJsonLabel || 'Show Profile JSON',
            checked: this.properties[`tab${i}ProfileReportShowProfileJson`] !== false,
            onText: 'Yes',
            offText: 'No'
          })
        );

        // Display mode dropdown (same pattern as JavaScript content type)
        fields.push(
          PropertyPaneDropdown(`tab${i}ProfileReportDisplayMode`, {
            label: strings.ProfileReportDisplayModeLabel || 'Display Mode',
            options: [
              { key: 'contained', text: 'Contained' },
              { key: 'fullSection', text: 'Full Section (keeps navigation)' },
              { key: 'fullScreen', text: 'Full Screen (hides everything)' }
            ],
            selectedKey: (this.properties[`tab${i}ProfileReportDisplayMode`] as string) || 'contained'
          })
        );
        // Sidebar width — only shown when not contained
        if ((this.properties[`tab${i}ProfileReportDisplayMode`] as string) === 'fullSection' ||
            (this.properties[`tab${i}ProfileReportDisplayMode`] as string) === 'fullScreen') {
          fields.push(
            PropertyPaneTextField(`tab${i}ProfileReportSidebarWidth`, {
              label: strings.ProfileReportSidebarWidthLabel || 'Sidebar Width',
              placeholder: '280px',
              description: 'CSS value (e.g., 280px, 20vw)'
            })
          );
        }

        // Metadata discovery options
        fields.push(
          PropertyPaneToggle(`tab${i}ProfileReportEnableMetadata`, {
            label: strings.ProfileReportEnableMetadataLabel || 'Enable Metadata Discovery',
            checked: this.properties[`tab${i}ProfileReportEnableMetadata`] === true,
            onText: 'Yes',
            offText: 'No'
          })
        );
        if (this.properties[`tab${i}ProfileReportEnableMetadata`] === true) {
          fields.push(
            PropertyPaneTextField(`tab${i}ProfileReportMetadataCompanyCol`, {
              label: strings.ProfileReportMetadataCompanyColLabel || 'Company Column Name',
              placeholder: 'Pi_CompanyID',
              description: 'Internal name of the indexed column used to filter by company'
            })
          );
          fields.push(
            PropertyPaneTextField(`tab${i}ProfileReportMetadataFileCategory`, {
              label: strings.ProfileReportMetadataFileCategoryLabel || 'File Category Column Name',
              placeholder: 'FileCategory',
              description: 'Internal name of the column used to categorize files'
            })
          );
        }
      }

      // Within-tab TOC fields for HTML and Markdown content types
      if (contentType === 'html' || contentType === 'markdown') {
        fields.push(
          PropertyPaneToggle(`tab${i}TocEnabled`, {
            label: strings.TocEnabledLabel || 'Auto Table of Contents',
            checked: this.properties[`tab${i}TocEnabled`] === true,
            onText: 'On',
            offText: 'Off'
          })
        );

        if (this.properties[`tab${i}TocEnabled`] === true) {
          fields.push(
            PropertyPaneDropdown(`tab${i}TocMinHeadings`, {
              label: strings.TocMinHeadingsLabel || 'Minimum Headings',
              options: [
                { key: '2', text: '2 headings' },
                { key: '3', text: '3 headings' },
                { key: '4', text: '4 headings' },
                { key: '5', text: '5 headings' }
              ],
              selectedKey: (this.properties[`tab${i}TocMinHeadings`] as string) || '3'
            })
          );
          fields.push(
            PropertyPaneDropdown(`tab${i}TocMaxLevel`, {
              label: strings.TocMaxLevelLabel || 'Max Heading Depth',
              options: [
                { key: '2', text: 'H2 only' },
                { key: '3', text: 'H2 - H3' },
                { key: '4', text: 'H2 - H4' },
                { key: '5', text: 'H2 - H5' }
              ],
              selectedKey: (this.properties[`tab${i}TocMaxLevel`] as string) || '3'
            })
          );
        }
      }

      // Label type dropdown - text, web part, or hidden
      fields.push(
        PropertyPaneDropdown(`tab${i}LabelType`, {
          label: `Label Type`,
          options: [
            { key: 'text', text: 'Text Label' },
            { key: 'webpart', text: 'Use Web Part as Label (e.g., Image)' },
            { key: 'hidden', text: 'Hidden (Content Only)' }
          ],
          selectedKey: this.properties[`tab${i}LabelType`] as string || 'text'
        })
      );

      const labelType = this.properties[`tab${i}LabelType`] as string || 'text';

      if (labelType === 'hidden') {
        // No additional fields needed for hidden label - just show content
        fields.push(
          PropertyPaneLabel(`tab${i}HiddenInfo`, {
            text: 'Tab bar will be hidden when all tabs use "Hidden" label type.'
          })
        );
      } else if (labelType === 'webpart') {
        // Show web part selector for label
        fields.push(
          PropertyPaneDropdown(`tab${i}LabelWebPartID`, {
            label: `Label Web Part`,
            options: this.getLabelWebPartOptions(i),
            selectedKey: this.properties[`tab${i}LabelWebPartID`] as string || ''
          })
        );
      } else {
        // Text label mode - show text field, icon picker, and image options
        fields.push(
          PropertyPaneTextField(`tab${i}Label`, {
            label: `Label`,
            placeholder: `Enter tab label`,
            multiline: false
          })
        );

        // Icon picker dropdown
        fields.push(
          PropertyPaneDropdown(`tab${i}Icon`, {
            label: `Add Icon`,
            options: this.getIconPresets(),
            selectedKey: ''
          })
        );

        // Per-tab image support - URL text field
        fields.push(
          PropertyPaneTextField(`tab${i}Image`, {
            label: `Tab Image URL (optional)`,
            placeholder: `Paste image URL from SharePoint`,
            description: 'Copy image URL from SharePoint library',
            multiline: false
          })
        );

        // Only show image position if image URL is set
        const tabImageUrl = this.properties[`tab${i}Image`] as string;
        if (tabImageUrl && tabImageUrl.length > 0) {
          fields.push(
            PropertyPaneDropdown(`tab${i}ImagePosition`, {
              label: `Image Position`,
              options: this.getImagePositionPresets(),
              selectedKey: this.properties[`tab${i}ImagePosition`] as string || 'left'
            })
          );
        }
      }

      // Divider toggle - add visual separator after this tab
      if (i < numTabs) { // Don't show for last tab
        fields.push(
          PropertyPaneToggle(`tab${i}DividerAfter`, {
            label: `Add divider after this tab`,
            checked: this.properties[`tab${i}DividerAfter`] as boolean || false,
            onText: 'Yes',
            offText: 'No'
          })
        );
      }

      // Full-width banner toggle - only show for webpart/section content types
      if (contentType === 'webpart' || contentType === 'section') {
        fields.push(
          PropertyPaneToggle(`tab${i}FullWidthBanner`, {
            label: `Banner Layout`,
            checked: this.properties[`tab${i}FullWidthBanner`] as boolean ?? true,
            onText: 'Full Width (edge-to-edge)',
            offText: 'Contained (with margins)'
          })
        );
      }

      // Permission settings header
      fields.push(PropertyPaneLabel(`tab${i}PermissionHeader`, {
        text: `── ${strings.PermissionHeaderLabel} ──`
      }));

      // Enable permission check toggle
      fields.push(
        PropertyPaneToggle(`tab${i}PermissionEnabled`, {
          label: strings.PermissionEnabledLabel,
          checked: this.properties[`tab${i}PermissionEnabled`] as boolean || false,
          onText: 'Restricted',
          offText: 'Everyone'
        })
      );

      // Only show group selection if permission is enabled
      const permissionEnabled = this.properties[`tab${i}PermissionEnabled`] as boolean;
      if (permissionEnabled) {
        // Standard groups dropdown with common combinations
        fields.push(
          PropertyPaneDropdown(`tab${i}PermissionGroups`, {
            label: strings.PermissionGroupsLabel,
            options: [
              { key: '', text: strings.PermissionVisibleToAll },
              { key: 'Owners', text: strings.PermissionOwnersLabel },
              { key: 'Members', text: strings.PermissionMembersLabel },
              { key: 'Visitors', text: strings.PermissionVisitorsLabel },
              { key: 'Owners,Members', text: strings.PermissionOwnersMembers },
              { key: 'Members,Visitors', text: strings.PermissionMembersVisitors },
              { key: 'Owners,Members,Visitors', text: strings.PermissionAllGroups }
            ],
            selectedKey: this.properties[`tab${i}PermissionGroups`] as string || ''
          })
        );

        // Custom group IDs text field
        fields.push(
          PropertyPaneTextField(`tab${i}PermissionCustomGroups`, {
            label: strings.PermissionCustomGroupsLabel,
            placeholder: strings.PermissionCustomGroupsPlaceholder,
            description: strings.PermissionCustomGroupsDescription,
            multiline: false
          })
        );

        // Show placeholder toggle (instead of hiding completely)
        fields.push(
          PropertyPaneToggle(`tab${i}PermissionPlaceholder`, {
            label: strings.PermissionPlaceholderLabel,
            checked: this.properties[`tab${i}PermissionPlaceholder`] as boolean || false,
            onText: 'Show placeholder',
            offText: 'Hide completely'
          })
        );

        // Custom placeholder text (only if placeholder is enabled)
        const showPlaceholder = this.properties[`tab${i}PermissionPlaceholder`] as boolean;
        if (showPlaceholder) {
          fields.push(
            PropertyPaneTextField(`tab${i}PermissionPlaceholderText`, {
              label: strings.PermissionPlaceholderTextLabel,
              placeholder: strings.PermissionPlaceholderTextPlaceholder,
              description: strings.PermissionPlaceholderDescription,
              multiline: false
            })
          );
        }
      }

      // Lock settings header
      fields.push(PropertyPaneLabel(`tab${i}LockHeader`, {
        text: `── ${strings.LockHeaderLabel} ──`
      }));

      fields.push(
        PropertyPaneToggle(`tab${i}LockEnabled`, {
          label: strings.LockEnabledLabel,
          checked: this.properties[`tab${i}LockEnabled`] as boolean || false,
          onText: strings.LockEnabledOnText || 'Locked',
          offText: strings.LockEnabledOffText || 'Unlocked'
        })
      );

      const lockEnabled = this.properties[`tab${i}LockEnabled`] as boolean;
      if (lockEnabled) {
        const hasPassword = !!(this.properties[`tab${i}LockPasswordHash`] as string);
        fields.push(PropertyPaneLabel(`tab${i}LockStatus`, {
          text: hasPassword ? strings.LockPasswordSetLabel : strings.LockPasswordMissingLabel
        }));

        fields.push(
          PropertyPaneTextField(`tab${i}LockPassword`, {
            label: strings.LockPasswordLabel,
            description: strings.LockPasswordDescription,
            multiline: false
          })
        );

        fields.push(
          PropertyPaneToggle(`tab${i}LockUseCustomTemplate`, {
            label: strings.LockTemplateToggleLabel,
            checked: this.properties[`tab${i}LockUseCustomTemplate`] as boolean || false,
            onText: strings.LockTemplateToggleOnText || 'Custom',
            offText: strings.LockTemplateToggleOffText || 'Default'
          })
        );

        const useCustomTemplate = this.properties[`tab${i}LockUseCustomTemplate`] as boolean;
        if (useCustomTemplate) {
          fields.push(
            PropertyPaneTextField(`tab${i}LockTemplate`, {
              label: strings.LockTemplateLabel,
              description: strings.LockTemplateDescription,
              multiline: true,
              rows: 10
            })
          );
        }

        fields.push(
          PropertyPaneToggle(`tab${i}LockCustomizeMessages`, {
            label: strings.LockMessagesToggleLabel,
            checked: this.properties[`tab${i}LockCustomizeMessages`] as boolean || false,
            onText: strings.LockMessagesToggleOnText || 'Custom',
            offText: strings.LockMessagesToggleOffText || 'Default'
          })
        );

        const customizeMessages = this.properties[`tab${i}LockCustomizeMessages`] as boolean;
        if (customizeMessages) {
          fields.push(
            PropertyPaneTextField(`tab${i}LockMessagePrompt`, {
              label: strings.LockPromptMessageLabel,
              description: strings.LockPromptMessageDescription,
              multiline: true,
              rows: 3
            })
          );

          fields.push(
            PropertyPaneTextField(`tab${i}LockMessageError`, {
              label: strings.LockErrorMessageLabel,
              description: strings.LockErrorMessageDescription,
              multiline: true,
              rows: 3
            })
          );

          fields.push(
            PropertyPaneTextField(`tab${i}LockMessageMissing`, {
              label: strings.LockMissingPasswordMessageLabel,
              description: strings.LockMissingPasswordMessageDescription,
              multiline: true,
              rows: 3
            })
          );

          fields.push(
            PropertyPaneTextField(`tab${i}LockMessageSuccess`, {
              label: strings.LockSuccessMessageLabel,
              description: strings.LockSuccessMessageDescription,
              multiline: true,
              rows: 3
            })
          );
        }
      }
    }

    return fields;
  }

  protected getPropertyPaneConfiguration(): IPropertyPaneConfiguration {
    return {
      pages: [
        {
          header: {
            description: strings.PropertyPaneDescription
          },
          groups: [
            {
              groupName: '',
              groupFields: [
                PropertyPaneConfigButton('openConfig', {
                  onClick: () => this.openConfigPanel()
                })
              ]
            },
            {
              groupName: strings.ManageTabLabels,
              groupFields: this.getTabConfigurationFields()
            },
            {
              groupName: strings.TemplatesGroupName,
              groupFields: this.getTemplateGroupFields()
            },
            {
              groupName: strings.LockDefaultsGroupName,
              groupFields: this.getLockDefaultsFields()
            },
            {
              groupName: 'Appearance',
              groupFields: [
                PropertyPaneDropdown('tabStyle', {
                  label: 'Tab Style',
                  options: [
                    { key: 'default', text: 'Default (underline indicator)' },
                    { key: 'pills', text: 'Pills (rounded buttons)' },
                    { key: 'underline', text: 'Underline (minimal)' },
                    { key: 'boxed', text: 'Boxed (bordered cards)' }
                  ],
                  selectedKey: this.properties.tabStyle || 'default'
                }),
                PropertyPaneDropdown('tabAlignment', {
                  label: 'Tab Alignment',
                  options: [
                    { key: 'stretch', text: 'Stretch (full width)' },
                    { key: 'left', text: 'Left' },
                    { key: 'center', text: 'Center' },
                    { key: 'right', text: 'Right' }
                  ],
                  selectedKey: this.properties.tabAlignment || 'stretch'
                }),
                PropertyPaneDropdown('tabOrientation', {
                  label: 'Tab Orientation',
                  options: [
                    { key: 'horizontal', text: 'Horizontal (tabs on top)' },
                    { key: 'vertical', text: 'Vertical (tabs on side)' }
                  ],
                  selectedKey: this.properties.tabOrientation || 'horizontal'
                }),
                // Only show vertical options when orientation is vertical
                ...(this.properties.tabOrientation === 'vertical' ? [
                  PropertyPaneDropdown('verticalTabPosition', {
                    label: 'Vertical Tab Position',
                    options: [
                      { key: 'left', text: 'Left side' },
                      { key: 'right', text: 'Right side' }
                    ],
                    selectedKey: this.properties.verticalTabPosition || 'left'
                  }),
                  PropertyPaneDropdown('verticalTabWidth', {
                    label: 'Vertical Tab Width',
                    options: [
                      { key: '150px', text: 'Narrow (150px)' },
                      { key: '200px', text: 'Medium (200px)' },
                      { key: '250px', text: 'Wide (250px)' },
                      { key: '300px', text: 'Extra Wide (300px)' },
                      { key: '25%', text: '25% of container' },
                      { key: '33%', text: '33% of container' }
                    ],
                    selectedKey: this.properties.verticalTabWidth || '200px'
                  })
                ] : []),
                PropertyPaneDropdown('labelImageHeight', {
                  label: 'Label Image Size',
                  options: [
                    { key: '40px', text: 'Small (40px)' },
                    { key: '60px', text: 'Medium (60px)' },
                    { key: '80px', text: 'Large (80px)' },
                    { key: '100px', text: 'Extra Large (100px)' },
                    { key: '120px', text: 'Huge (120px)' },
                    { key: 'none', text: 'No limit (full size)' }
                  ],
                  selectedKey: this.properties.labelImageHeight || '60px'
                }),
                PropertyPaneDropdown('themeMode', {
                  label: 'Theme Mode',
                  options: [
                    { key: 'auto', text: 'Auto (detect from page)' },
                    { key: 'light', text: 'Light' },
                    { key: 'dark', text: 'Dark' }
                  ],
                  selectedKey: this.properties.themeMode || 'auto'
                }),
                // v3.0 Feature toggles
                PropertyPaneToggle('enableDeepLinking', {
                  label: strings.EnableDeepLinkingLabel || 'Enable URL Deep Linking',
                  checked: this.properties.enableDeepLinking !== false,
                  onText: 'Enabled',
                  offText: 'Disabled'
                }),
                PropertyPaneToggle('enableLazyLoading', {
                  label: strings.EnableLazyLoadingLabel || 'Enable Lazy Loading',
                  checked: this.properties.enableLazyLoading !== false,
                  onText: 'Enabled',
                  offText: 'Disabled'
                }),
                PropertyPaneToggle('enableFullWidthFix', {
                  label: 'Page Banner Layout (outside tabs)',
                  checked: this.properties.enableFullWidthFix !== false,
                  onText: 'Full Width (edge-to-edge)',
                  offText: 'Contained (with margins)'
                })
              ]
            },
            {
              groupName: 'Colors',
              groupFields: [
                PropertyPaneTabPreview('stylePreview', {
                  accentColor: this.properties.accentColor,
                  tabTextColor: this.properties.tabTextColor,
                  tabActiveTextColor: this.properties.tabActiveTextColor,
                  tabBackgroundColor: this.properties.tabBackgroundColor,
                  tabActiveBackgroundColor: this.properties.tabActiveBackgroundColor,
                  tabHoverBackgroundColor: this.properties.tabHoverBackgroundColor,
                  tabFontSize: this.properties.tabFontSize,
                  tabFontWeight: this.properties.tabFontWeight,
                  tabPaddingVertical: this.properties.tabPaddingVertical,
                  tabPaddingHorizontal: this.properties.tabPaddingHorizontal,
                  tabGap: this.properties.tabGap,
                  tabBorderRadius: this.properties.tabBorderRadius,
                  activeIndicatorWidth: this.properties.activeIndicatorWidth,
                  tabShadow: this.properties.tabShadow,
                  tabStyle: this.properties.tabStyle,
                  showActiveIndicator: this.properties.showActiveIndicator,
                  activeIndicatorColor: this.properties.activeIndicatorColor,
                  showTabSeparator: this.properties.showTabSeparator,
                  tabSeparatorColor: this.properties.tabSeparatorColor
                }),
                PropertyPaneDropdown('accentColor', {
                  label: 'Accent Color',
                  options: this.getColorPresets(),
                  selectedKey: this.properties.accentColor || '#0078d4'
                }),
                PropertyPaneDropdown('tabTextColor', {
                  label: 'Tab Text Color',
                  options: this.getTextColorPresets(),
                  selectedKey: this.properties.tabTextColor || ''
                }),
                PropertyPaneDropdown('tabActiveTextColor', {
                  label: 'Active Tab Text Color',
                  options: this.getTextColorPresets(),
                  selectedKey: this.properties.tabActiveTextColor || ''
                }),
                PropertyPaneDropdown('tabBackgroundColor', {
                  label: 'Tab Background',
                  options: [
                    { key: '', text: 'Transparent (default)' },
                    { key: 'transparent', text: 'Transparent' },
                    { key: '#ffffff', text: 'White' },
                    { key: '#f5f5f5', text: 'Light Gray' },
                    { key: '#e0e0e0', text: 'Gray' },
                    { key: '#fafafa', text: 'Off White' }
                  ],
                  selectedKey: this.properties.tabBackgroundColor || ''
                }),
                PropertyPaneDropdown('tabActiveBackgroundColor', {
                  label: 'Active Tab Background',
                  options: [
                    { key: '', text: '(Use default for style)' },
                    { key: 'transparent', text: 'Transparent' },
                    { key: '#ffffff', text: 'White' },
                    { key: '#f5f5f5', text: 'Light Gray' },
                    { key: '#e8f4fd', text: 'Light Blue' },
                    { key: '#e8f5e9', text: 'Light Green' },
                    { key: '#f3e5f5', text: 'Light Purple' }
                  ],
                  selectedKey: this.properties.tabActiveBackgroundColor || ''
                }),
                PropertyPaneDropdown('tabHoverBackgroundColor', {
                  label: 'Hover Background',
                  options: [
                    { key: '', text: '(Use default)' },
                    { key: 'rgba(0,0,0,0.04)', text: 'Subtle Dark' },
                    { key: 'rgba(0,0,0,0.08)', text: 'Light Dark' },
                    { key: 'rgba(0,120,212,0.1)', text: 'Light Blue' },
                    { key: 'rgba(16,124,16,0.1)', text: 'Light Green' }
                  ],
                  selectedKey: this.properties.tabHoverBackgroundColor || ''
                })
              ]
            },
            {
              groupName: 'Typography & Spacing',
              groupFields: [
                PropertyPaneDropdown('tabFontSize', {
                  label: 'Font Size',
                  options: this.getFontSizePresets(),
                  selectedKey: this.properties.tabFontSize || ''
                }),
                PropertyPaneDropdown('tabFontWeight', {
                  label: 'Font Weight',
                  options: this.getFontWeightPresets(),
                  selectedKey: this.properties.tabFontWeight || ''
                }),
                PropertyPaneDropdown('tabPaddingVertical', {
                  label: 'Vertical Padding',
                  options: this.getPaddingPresets(),
                  selectedKey: this.properties.tabPaddingVertical || ''
                }),
                PropertyPaneDropdown('tabPaddingHorizontal', {
                  label: 'Horizontal Padding',
                  options: [
                    { key: '', text: '20px (default)' },
                    { key: '12px', text: '12px - Compact' },
                    { key: '16px', text: '16px' },
                    { key: '20px', text: '20px - Normal' },
                    { key: '24px', text: '24px - Comfortable' },
                    { key: '32px', text: '32px - Spacious' },
                    { key: '40px', text: '40px - Extra Spacious' }
                  ],
                  selectedKey: this.properties.tabPaddingHorizontal || ''
                }),
                PropertyPaneDropdown('tabGap', {
                  label: 'Gap Between Tabs',
                  options: this.getGapPresets(),
                  selectedKey: this.properties.tabGap || ''
                })
              ]
            },
            {
              groupName: 'Borders & Effects',
              groupFields: [
                PropertyPaneDropdown('tabBorderRadius', {
                  label: 'Corner Radius',
                  options: this.getBorderRadiusPresets(),
                  selectedKey: this.properties.tabBorderRadius || ''
                }),
                PropertyPaneDropdown('tabContentGap', {
                  label: 'Gap Between Tabs & Content',
                  options: [
                    { key: '', text: '0px (default)' },
                    { key: '0px', text: '0px - No gap' },
                    { key: '8px', text: '8px - Small' },
                    { key: '16px', text: '16px - Medium' },
                    { key: '24px', text: '24px - Large' },
                    { key: '32px', text: '32px - Extra Large' }
                  ],
                  selectedKey: this.properties.tabContentGap || ''
                }),
                PropertyPaneToggle('showActiveIndicator', {
                  label: 'Show Active Tab Indicator',
                  onText: 'Visible',
                  offText: 'Hidden',
                  checked: this.properties.showActiveIndicator !== false
                }),
                PropertyPaneDropdown('activeIndicatorWidth', {
                  label: 'Active Indicator Width',
                  options: this.getIndicatorWidthPresets(),
                  selectedKey: this.properties.activeIndicatorWidth || ''
                }),
                PropertyPaneDropdown('activeIndicatorColor', {
                  label: 'Active Indicator Color',
                  options: [
                    { key: '', text: '(Use accent color)' },
                    { key: '#0078d4', text: 'SharePoint Blue' },
                    { key: '#107c10', text: 'Green' },
                    { key: '#5c2d91', text: 'Purple' },
                    { key: '#d83b01', text: 'Orange' },
                    { key: '#e81123', text: 'Red' },
                    { key: '#008272', text: 'Teal' },
                    { key: '#ffb900', text: 'Yellow' },
                    { key: '#000000', text: 'Black' },
                    { key: '#ffffff', text: 'White' }
                  ],
                  selectedKey: this.properties.activeIndicatorColor || ''
                }),
                PropertyPaneToggle('showTabSeparator', {
                  label: 'Show Tab Separator Lines',
                  onText: 'Visible',
                  offText: 'Hidden',
                  checked: this.properties.showTabSeparator !== false
                }),
                PropertyPaneDropdown('tabSeparatorColor', {
                  label: 'Separator Line Color',
                  options: [
                    { key: '', text: '(Default gray)' },
                    { key: 'rgba(0,0,0,0.12)', text: 'Light Gray (default)' },
                    { key: 'rgba(0,0,0,0.25)', text: 'Medium Gray' },
                    { key: 'rgba(0,0,0,0.5)', text: 'Dark Gray' },
                    { key: '#0078d4', text: 'SharePoint Blue' },
                    { key: '#107c10', text: 'Green' },
                    { key: '#5c2d91', text: 'Purple' },
                    { key: '#d83b01', text: 'Orange' },
                    { key: 'transparent', text: 'Transparent' }
                  ],
                  selectedKey: this.properties.tabSeparatorColor || ''
                }),
                PropertyPaneDropdown('tabShadow', {
                  label: 'Shadow Effect',
                  options: this.getShadowPresets(),
                  selectedKey: this.properties.tabShadow || ''
                }),
                PropertyPaneToggle('enableTransitions', {
                  label: 'Enable Animations',
                  onText: 'On',
                  offText: 'Off',
                  checked: this.properties.enableTransitions !== false
                })
              ]
            },
            {
              groupName: strings.BasicGroupName,
              groupFields: [
                PropertyPaneLabel('troubleshootingHelp', {
                  text: 'If web parts aren\'t detected, try different selectors below. Most users never need to change these.'
                }),
                PropertyPaneDropdown('sectionClass', {
                  label: strings.SectionClass,
                  options: [
                    { key: 'CanvasSection', text: 'CanvasSection (Default - Modern pages)' },
                    { key: 'CanvasZone', text: 'CanvasZone (Some SP versions)' },
                    { key: 'WebPartZone', text: 'WebPartZone (Classic pages)' },
                    { key: 'ms-webpart-zone', text: 'ms-webpart-zone (Classic zones)' }
                  ],
                  selectedKey: this.properties.sectionClass || 'CanvasSection'
                }),
                PropertyPaneDropdown('webpartClass', {
                  label: strings.WebPartClass,
                  options: [
                    { key: 'ControlZone', text: 'ControlZone (Default - Modern pages)' },
                    { key: 'CanvasControl', text: 'CanvasControl (Some SP versions)' },
                    { key: 'WebPart', text: 'WebPart (Classic pages)' },
                    { key: 'ms-webpartzone-cell', text: 'ms-webpartzone-cell (Classic cells)' }
                  ],
                  selectedKey: this.properties.webpartClass || 'ControlZone'
                }),
                PropertyPaneButton('resetSelectors', {
                  text: 'Reset to Defaults',
                  buttonType: PropertyPaneButtonType.Normal,
                  onClick: () => {
                    this.properties.sectionClass = 'CanvasSection';
                    this.properties.webpartClass = 'ControlZone';
                    this.context.propertyPane.refresh();
                    this.render();
                  }
                }),
                PropertyPaneButton('resetAllStyles', {
                  text: 'Reset All Styles',
                  buttonType: PropertyPaneButtonType.Normal,
                  onClick: () => {
                    // Reset all styling properties to defaults

                    // Appearance
                    this.properties.tabStyle = 'default';
                    this.properties.tabAlignment = 'stretch';
                    this.properties.tabOrientation = 'horizontal';
                    this.properties.verticalTabPosition = 'left';
                    this.properties.verticalTabWidth = '200px';
                    this.properties.labelImageHeight = '';
                    this.properties.themeMode = 'auto';

                    // Colors
                    this.properties.accentColor = '#0078d4';
                    this.properties.tabTextColor = '';
                    this.properties.tabActiveTextColor = '';
                    this.properties.tabBackgroundColor = '';
                    this.properties.tabActiveBackgroundColor = '';
                    this.properties.tabHoverBackgroundColor = '';

                    // Typography & Spacing
                    this.properties.tabFontSize = '';
                    this.properties.tabFontWeight = '';
                    this.properties.tabPaddingVertical = '';
                    this.properties.tabPaddingHorizontal = '';
                    this.properties.tabGap = '';
                    this.properties.tabContentGap = '';

                    // Borders & Effects
                    this.properties.tabBorderRadius = '';
                    this.properties.activeIndicatorWidth = '';
                    this.properties.tabShadow = '';
                    this.properties.enableTransitions = true;

                    // Active Indicator & Separators
                    this.properties.showActiveIndicator = true;
                    this.properties.activeIndicatorColor = '';
                    this.properties.showTabSeparator = true;
                    this.properties.tabSeparatorColor = '';

                    this.context.propertyPane.refresh();
                    this.render();
                  }
                })
              ]
            }
          ]
        }
      ]
    };
  }
}
