/**
 * ContentRenderer Service
 * Renders custom content types: Markdown, HTML, Mermaid diagrams, Embeds, and RSS feeds
 * Includes security sanitization for all content types
 */

import { marked } from 'marked';
import mermaid from 'mermaid';
import * as echarts from 'echarts';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const DOMPurify = require('dompurify');
import { IProfileReportTheme, BUILTIN_THEMES } from '../models/ProfileReportThemes';

// Content type definitions
export type ContentType = 'webpart' | 'section' | 'markdown' | 'html' | 'mermaid' | 'embed' | 'rss' | 'landing' | 'file' | 'toc' | 'profilereport';

export interface IEmbedConfig {
  url: string;
  height?: string;
  additionalDomains?: string[];
  defer?: boolean;
}

export interface IRssDisplayConfig {
  layout: 'list' | 'cards' | 'compact';
  showDate: boolean;
  showDescription: boolean;
  showImage: boolean;
  showAuthor: boolean;
  descriptionLimit: number;
  dateFormat: 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'relative';
  linkTarget: '_blank' | '_self';
  loadingMessage?: string;
  maxItems?: number;
}

export interface IRssRenderItem {
  title: string;
  link: string;
  description: string;
  publishedDate: Date;
  author: string;
  thumbnail: string | null;
}

export interface IRenderResult {
  html: string;
  requiresPostRender?: boolean;
  postRenderType?: 'mermaid' | 'rss' | 'landing' | 'toc' | 'profilereport';
}

export interface IMetadataFileEntry {
  name: string;
  url: string;
  category: string;
  title: string;
  modified: string;
}

// ========== Company Intelligence Interfaces ==========

export interface IIntelExecutive {
  name: string;
  title: string;
}

export interface IIntelProduct {
  name: string;
  description?: string;
}

export interface IIntelFinancial {
  metric: string;
  value: number;
  unit: string;
  fiscalYear: number;
  tier: string;
  confidence: number;
}

export interface IIntelRelationship {
  name: string;
  domain?: string;
  confidence: number;
}

export interface IIntelGrowthEvent {
  date: string;
  type: string;
  title: string;
  description?: string;
  confidence: number;
  confirmed: boolean;
  sources?: number;
}

export interface IIntelEarnings {
  quarter: string;
  year: number;
  sentiment: 'positive' | 'negative' | 'neutral';
  summary: string;
  keyTopics?: string[];
}

export interface ICompanyIntel {
  piRadarId: number;
  description?: string;
  founded?: string;
  hq?: string;
  parentCompany?: string;
  executives: IIntelExecutive[];
  products: IIntelProduct[];
  financials: IIntelFinancial[];
  competitors: IIntelRelationship[];
  customers: IIntelRelationship[];
  partners: IIntelRelationship[];
  recentActivity: IIntelGrowthEvent[];
  earnings: IIntelEarnings[];
  lastUpdated: string;
}

export interface ICompanyProfile {
  companyKey: string;
  companyName: string;
  domain: string;
  piRadarId?: number;
  industry?: string;
  sector?: string;
  accountOwner?: string;
  ownerRegion?: string;
  methodK?: string;      // Markdown content
  methodL?: string;      // Markdown content
  methodM?: string;      // HTML content (final report)
  profileJson?: any;     // JSON object
  executiveBrief?: string;         // company-profile/executive-brief/{domain}.md
  competitiveLandscape?: string;   // company-profile/competitive-landscape/{domain}.md
  investorMemo?: string;           // company-profile/investor-memo/{domain}.md
  fullDossierNarrative?: string;   // company-profile/full-dossier-narrative/{domain}.md
  growthPropensity?: string;       // te-growth-propensity/method-A/{id}-{domain}-method-A.md
  aiSynthesis?: string;            // final-html/ai-synthesis/{id}-{domain}-method-M-final.md
  teRelevance?: string;            // te-relevance/method-I/{domain}.md
  // List-sourced fields for rich Overview
  spListItemId?: number;
  headquarters?: string;
  founded?: string;
  legalName?: string;
  subIndustry?: string;
  status?: string;
  logoUrl?: string;
  ticker?: string;
  revenue?: string;
  employees?: string;
  // Detail fields (fetched on demand from SP list)
  companyDescription?: string;
  competitors?: string;
  products?: string;
  customers?: string;
  executives?: string;
  executiveSummary?: string;
  generated?: Date;
  metrics?: {
    events: number;
    entities: number;
    relationships: number;
    financials: number;
    earnings: number;
  };
  metadataFiles?: IMetadataFileEntry[];
  companyIntel?: ICompanyIntel;
}

/** Lightweight company entry — sourced from Pi_Companies list or condensed/ folder */
export interface ICompanyEntry {
  domain: string;           // e.g. "crowdstrike.com"
  companyName: string;      // Title from list, or derived from domain
  jsonFileUrl: string;      // ServerRelativeUrl of the condensed JSON (may be empty for list-based entries)
  timeCreated: string;
  piRadarId?: number;       // PiRadarID from Pi_Companies list
  spListItemId?: number;    // SharePoint list item ID (for linking back)
  industry?: string;
  sector?: string;
  accountOwner?: string;
  ownerEmail?: string;
  ownerRegion?: string;
  ticker?: string;
  revenue?: string;
  employees?: string;
  searchTerms?: string;     // Entities + previous domains for search (semicolon-separated)
  headquarters?: string;
  founded?: string;
  legalName?: string;
  subIndustry?: string;
  status?: string;
  logoUrl?: string;
}

export interface IProfileReportDisplayConfig {
  layout: 'tabbed' | 'accordion' | 'cards';
  libraryName: string;          // e.g., "Profiles"
  listName?: string;            // e.g., "Pi_Companies" — if set, queries list instead of scanning folders
  showMethodK: boolean;
  showMethodL: boolean;
  showMethodM: boolean;
  showProfileJson: boolean;
  showExecutiveBrief: boolean;
  showCompetitiveLandscape: boolean;
  showInvestorMemo: boolean;
  showFullDossier: boolean;
  showGrowthPropensity: boolean;
  showTeRelevance: boolean;
  showAiSynthesis: boolean;
  companyLimit?: number;        // Max companies to display
  sortBy: 'name' | 'date' | 'key';
  theme: string;
  displayMode: 'contained' | 'fullSection' | 'fullScreen';
  sidebarWidth?: string;        // CSS value like "280px"
  enableMetadataDiscovery?: boolean;
  metadataCompanyColumn?: string;       // e.g., "Pi_CompanyID"
  metadataFileCategoryColumn?: string;  // e.g., "FileCategory"
  metadataVisibilityColumn?: string;    // e.g., "ShowInProfile" — Yes/No filter column
  metadataListSource?: string;          // e.g., "ProfileFiles" — query a SP list instead of the library
}

export interface ILandingConfig {
  brandName?: string;
  brandInitials?: string;
  heroTitle?: string;
  heroTitleGradient?: string;
  heroDescription?: string;
  ctaTitle?: string;
  ctaDescription?: string;
  ctaButtonText?: string;
  navItems?: string[];
  nodes?: ILandingNode[];
}

export interface ILandingNode {
  id: number;
  title: string;
  description: string;
  icon: string;
  stats: string;
}

export class ContentRenderer {
  private static mermaidInitialized = false;

  // Default trusted domains for embeds (Microsoft ecosystem + popular tools)
  private static readonly DEFAULT_TRUSTED_DOMAINS: string[] = [
    // YouTube
    'youtube.com', 'youtu.be', 'youtube-nocookie.com',
    // Vimeo
    'vimeo.com', 'player.vimeo.com',
    // Microsoft Power Platform
    'powerbi.com', 'app.powerbi.com',
    'powerapps.com', 'apps.powerapps.com',
    'flow.microsoft.com',
    // Microsoft Forms
    'forms.office.com', 'forms.microsoft.com',
    // SharePoint & OneDrive
    'sharepoint.com', 'sharepoint-df.com',
    'onedrive.live.com', 'onedrive.com',
    // Microsoft 365
    'sway.office.com', 'sway.com',
    'microsoft.com', 'office.com',
    'stream.microsoft.com', 'web.microsoftstream.com',
    'teams.microsoft.com',
    'loop.microsoft.com',
    // Design & Collaboration Tools
    'canva.com',
    'figma.com',
    'miro.com',
    'lucid.app', 'lucidchart.com',
    'whimsical.com',
    // Other common embeds
    'loom.com',
    'calendly.com',
    'typeform.com',
    'airtable.com',
    'notion.so', 'notion.site',
    'coda.io',
    'mural.co',
    'pitch.com',
    'pideas.studio'
  ];

  /**
   * Initialize mermaid library with configuration
   */
  private static initMermaid(): void {
    if (!this.mermaidInitialized) {
      mermaid.initialize({
        startOnLoad: false,
        theme: 'default',
        securityLevel: 'strict',
        fontFamily: '"Segoe UI", -apple-system, BlinkMacSystemFont, Roboto, sans-serif'
      });
      this.mermaidInitialized = true;
    }
  }

  /**
   * Render Markdown content to sanitized HTML
   */
  public static renderMarkdown(content: string): IRenderResult {
    if (!content || typeof content !== 'string') {
      return { html: '' };
    }

    try {
      // Parse markdown to HTML
      const rawHtml = marked.parse(content, {
        gfm: true, // GitHub Flavored Markdown
        breaks: true // Convert \n to <br>
      });

      // Sanitize output
      const sanitizedHtml = DOMPurify.sanitize(rawHtml as string, {
        USE_PROFILES: { html: true },
        ADD_ATTR: ['target', 'rel'], // Allow link attributes
        FORBID_TAGS: ['style', 'script'],
        FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover']
      });

      return { html: sanitizedHtml };
    } catch (error) {
      console.error('[PiCanvas] Markdown render error:', error);
      return { html: `<p class="picanvas-render-error">Error rendering Markdown content</p>` };
    }
  }

  /**
   * Render HTML content with sanitization
   */
  public static renderHtml(content: string): IRenderResult {
    if (!content || typeof content !== 'string') {
      return { html: '' };
    }

    try {
      // Sanitize HTML with more permissive settings for custom content
      const sanitizedHtml = DOMPurify.sanitize(content, {
        USE_PROFILES: { html: true },
        ADD_TAGS: ['iframe'], // Allow iframes (will be validated separately)
        ADD_ATTR: [
          'target', 'rel', 'allow', 'allowfullscreen', 'frameborder',
          'scrolling', 'loading', 'referrerpolicy', 'sandbox'
        ],
        FORBID_TAGS: ['script'],
        FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onmouseout', 'onfocus', 'onblur']
      });

      return { html: sanitizedHtml };
    } catch (error) {
      console.error('[PiCanvas] HTML render error:', error);
      return { html: `<p class="picanvas-render-error">Error rendering HTML content</p>` };
    }
  }

  /**
   * Render custom lock template HTML with permissive sanitization
   * Allows inline styles and data attributes for lock UI wiring.
   */
  public static renderLockTemplate(content: string): IRenderResult {
    if (!content || typeof content !== 'string') {
      return { html: '' };
    }

    try {
      const sanitizedHtml = DOMPurify.sanitize(content, {
        USE_PROFILES: { html: true },
        ADD_TAGS: ['style'],
        ADD_ATTR: ['style'],
        ALLOW_DATA_ATTR: true,
        FORBID_TAGS: ['script'],
        FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onmouseout', 'onfocus', 'onblur']
      });

      return { html: sanitizedHtml };
    } catch (error) {
      console.error('[PiCanvas] Lock template render error:', error);
      return { html: `<p class="picanvas-render-error">Error rendering lock template</p>` };
    }
  }

  /**
   * Prepare Mermaid diagram content for rendering
   * Note: Actual rendering happens post-DOM insertion via renderMermaidElement()
   */
  public static prepareMermaid(content: string, elementId: string): IRenderResult {
    if (!content || typeof content !== 'string') {
      return { html: '' };
    }

    // Encode content for data attribute (prevent XSS)
    const encodedContent = this.encodeForAttribute(content);

    // Generate a CSS-safe ID for mermaid (no special characters that break selectors)
    const safeId = this.makeCssSafeId(elementId);

    // Return placeholder that will be rendered after DOM insertion
    const html = `
      <div class="picanvas-mermaid-container"
           data-mermaid-id="${safeId}"
           data-mermaid-content="${encodedContent}">
        <div class="mermaid" id="${safeId}">
          ${this.encodeHtml(content)}
        </div>
      </div>
    `;

    return {
      html,
      requiresPostRender: true,
      postRenderType: 'mermaid'
    };
  }

  /**
   * Render a Mermaid element after DOM insertion
   * Call this after the element is in the DOM
   */
  public static async renderMermaidElement(element: HTMLElement): Promise<void> {
    this.initMermaid();

    const content = element.getAttribute('data-mermaid-content');
    const mermaidId = element.getAttribute('data-mermaid-id');

    if (!content || !mermaidId) {
      return;
    }

    // Decode content
    const decodedContent = this.decodeFromAttribute(content);

    const mermaidDiv = element.querySelector('.mermaid') as HTMLElement;
    if (!mermaidDiv || mermaidDiv.querySelector('svg')) {
      return; // Already rendered or no target
    }

    try {
      const { svg } = await mermaid.render(mermaidId + '-svg', decodedContent);
      mermaidDiv.innerHTML = svg;
      element.classList.add('picanvas-mermaid-rendered');
    } catch (error) {
      console.error('[PiCanvas] Mermaid render error:', error);
      mermaidDiv.innerHTML = `
        <div class="picanvas-mermaid-error">
          <span class="error-icon">⚠️</span>
          <span class="error-text">Diagram syntax error. Please check your Mermaid code.</span>
          <details>
            <summary>Details</summary>
            <pre>${this.encodeHtml(String(error))}</pre>
          </details>
        </div>
      `;
    }
  }

  /**
   * Render embed (iframe) content with URL validation
   */
  public static renderEmbed(config: IEmbedConfig): IRenderResult {
    const { url, height = '400px', additionalDomains = [], defer = false } = config;

    if (!url || typeof url !== 'string') {
      return { html: '<p class="picanvas-render-error">No embed URL provided</p>' };
    }

    // Validate and sanitize URL
    const sanitizedUrl = this.sanitizeEmbedUrl(url, additionalDomains);

    if (!sanitizedUrl) {
      return {
        html: `
          <div class="picanvas-embed-blocked">
            <span class="blocked-icon">🚫</span>
            <span class="blocked-text">This embed URL is not allowed.</span>
            <details>
              <summary>Allowed domains</summary>
              <p>Contact your site administrator to add this domain to the allow list.</p>
            </details>
          </div>
        `
      };
    }

    // Build iframe with security attributes
    const encodedUrl = this.encodeHtml(sanitizedUrl);
    const iframeSrcAttr = defer ? `data-src="${encodedUrl}"` : `src="${encodedUrl}"`;
    const html = `
      <div class="picanvas-embed-container" style="height: ${this.sanitizeCssValue(height)}">
        <iframe
          ${iframeSrcAttr}
          style="width: 100%; height: 100%; border: none;"
          loading="lazy"
          allowfullscreen
          referrerpolicy="no-referrer-when-downgrade"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-presentation"
        ></iframe>
      </div>
    `;

    return { html };
  }

  /**
   * Validate and sanitize embed URL against allow list
   */
  public static sanitizeEmbedUrl(url: string, additionalDomains: string[] = []): string {
    // Combine all allowed domains
    const allAllowed = [
      ...this.DEFAULT_TRUSTED_DOMAINS,
      ...additionalDomains
    ];

    try {
      const parsed = new URL(url);

      // Only allow HTTPS
      if (parsed.protocol !== 'https:') {
        console.warn('[PiCanvas] Embed URL rejected: not HTTPS');
        return '';
      }

      // Get domain without www prefix
      const domain = parsed.hostname.replace(/^www\./, '').toLowerCase();

      // Check against allow list
      const isAllowed = allAllowed.some(allowed => {
        const pattern = allowed.replace(/^www\./, '').toLowerCase();
        return domain === pattern || domain.endsWith('.' + pattern);
      });

      if (!isAllowed) {
        console.warn(`[PiCanvas] Embed URL rejected: domain "${domain}" not in allow list`);
        return '';
      }

      return url;
    } catch (error) {
      console.warn('[PiCanvas] Invalid embed URL:', error);
      return '';
    }
  }

  /**
   * Check if a domain is in the allow list
   */
  public static isDomainAllowed(domain: string, additionalDomains: string[] = []): boolean {
    const allAllowed = [
      ...this.DEFAULT_TRUSTED_DOMAINS,
      ...additionalDomains
    ];

    const cleanDomain = domain.replace(/^www\./, '').toLowerCase();

    return allAllowed.some(allowed => {
      const pattern = allowed.replace(/^www\./, '').toLowerCase();
      return cleanDomain === pattern || cleanDomain.endsWith('.' + pattern);
    });
  }

  /**
   * Get list of default trusted domains (for documentation/UI)
   */
  public static getDefaultTrustedDomains(): string[] {
    return [...this.DEFAULT_TRUSTED_DOMAINS];
  }

  /**
   * Get combined allow list (default + site)
   */
  public static getAllowedDomains(additionalDomains: string[] = []): string[] {
    return [
      ...this.DEFAULT_TRUSTED_DOMAINS,
      ...additionalDomains
    ];
  }

  // ========== Security Helper Methods ==========

  /**
   * Encode HTML entities to prevent XSS
   */
  private static encodeHtml(str: string): string {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Encode string for use in HTML attribute
   */
  private static encodeForAttribute(str: string): string {
    if (!str) return '';
    // Base64 encode to safely store in data attribute
    try {
      return btoa(encodeURIComponent(str));
    } catch {
      return this.encodeHtml(str);
    }
  }

  /**
   * Decode string from HTML attribute
   */
  private static decodeFromAttribute(str: string): string {
    if (!str) return '';
    try {
      return decodeURIComponent(atob(str));
    } catch {
      return str;
    }
  }

  /**
   * Sanitize CSS value to prevent injection
   */
  private static sanitizeCssValue(value: string): string {
    if (!value) return '';
    // Only allow safe CSS units and values
    const safePattern = /^[\d.]+(px|em|rem|%|vh|vw)?$/i;
    const trimmed = value.trim();
    if (safePattern.test(trimmed)) {
      return trimmed;
    }
    // Default to pixels if just a number
    if (/^\d+$/.test(trimmed)) {
      return trimmed + 'px';
    }
    return '400px'; // Safe default
  }

  /**
   * Generate a CSS-safe ID from a string
   * CSS selectors cannot contain =, +, /, or other special characters
   * This creates a valid HTML ID attribute value that can also be used in CSS selectors
   */
  private static makeCssSafeId(str: string): string {
    if (!str) return 'mermaid-' + Date.now();
    // Replace any non-alphanumeric characters (except hyphen and underscore) with hyphen
    // CSS IDs must start with a letter, underscore, or hyphen (not a digit)
    let safeId = str.replace(/[^a-zA-Z0-9_-]/g, '-');
    // Ensure it starts with a letter if it starts with a digit
    if (/^[0-9]/.test(safeId)) {
      safeId = 'm-' + safeId;
    }
    // Remove consecutive hyphens
    safeId = safeId.replace(/-+/g, '-');
    // Remove leading/trailing hyphens
    safeId = safeId.replace(/^-+|-+$/g, '');
    return safeId || 'mermaid-' + Date.now();
  }

  // ========== RSS Feed Rendering ==========

  /**
   * Render RSS feed loading state
   */
  public static renderRssLoading(message?: string): IRenderResult {
    const loadingMsg = message || 'Loading feed...';
    return {
      html: `
        <div class="picanvas-rss-container picanvas-rss-loading">
          <div class="picanvas-rss-loading-spinner"></div>
          <div class="picanvas-rss-loading-text">${this.encodeHtml(loadingMsg)}</div>
        </div>
      `
    };
  }

  /**
   * Render RSS feed error state
   */
  public static renderRssError(error: string): IRenderResult {
    return {
      html: `
        <div class="picanvas-rss-container picanvas-rss-error">
          <div class="picanvas-rss-error-icon">⚠️</div>
          <div class="picanvas-rss-error-text">${this.encodeHtml(error)}</div>
        </div>
      `
    };
  }

  /**
   * Render RSS feed items with configurable layout
   */
  public static renderRss(items: IRssRenderItem[], config: IRssDisplayConfig): IRenderResult {
    if (!items || items.length === 0) {
      return {
        html: `
          <div class="picanvas-rss-container picanvas-rss-empty">
            <div class="picanvas-rss-empty-text">No items to display</div>
          </div>
        `
      };
    }

    // Limit items if maxItems is set
    const displayItems = config.maxItems ? items.slice(0, config.maxItems) : items;

    // Choose layout
    let itemsHtml = '';
    switch (config.layout) {
      case 'cards':
        itemsHtml = this.renderRssCards(displayItems, config);
        break;
      case 'compact':
        itemsHtml = this.renderRssCompact(displayItems, config);
        break;
      case 'list':
      default:
        itemsHtml = this.renderRssList(displayItems, config);
        break;
    }

    return {
      html: `
        <div class="picanvas-rss-container picanvas-rss-${config.layout}">
          ${itemsHtml}
        </div>
      `
    };
  }

  /**
   * Render RSS items as a list
   */
  private static renderRssList(items: IRssRenderItem[], config: IRssDisplayConfig): string {
    return items.map(item => {
      const thumbnail = config.showImage && item.thumbnail
        ? `<div class="picanvas-rss-thumbnail"><img src="${this.encodeHtml(item.thumbnail)}" alt="" loading="lazy" /></div>`
        : '';

      const date = config.showDate
        ? `<span class="picanvas-rss-date">${this.formatRssDate(item.publishedDate, config.dateFormat)}</span>`
        : '';

      const author = config.showAuthor && item.author
        ? `<span class="picanvas-rss-author">${this.encodeHtml(item.author)}</span>`
        : '';

      const meta = (date || author)
        ? `<div class="picanvas-rss-meta">${date}${date && author ? ' • ' : ''}${author}</div>`
        : '';

      const description = config.showDescription && item.description
        ? `<div class="picanvas-rss-description">${this.encodeHtml(this.truncateRssText(item.description, config.descriptionLimit))}</div>`
        : '';

      return `
        <article class="picanvas-rss-item">
          ${thumbnail}
          <div class="picanvas-rss-content">
            <a href="${this.encodeHtml(item.link)}" target="${config.linkTarget}" rel="noopener noreferrer" class="picanvas-rss-title">
              ${this.encodeHtml(item.title)}
            </a>
            ${meta}
            ${description}
          </div>
        </article>
      `;
    }).join('');
  }

  /**
   * Render RSS items as cards
   */
  private static renderRssCards(items: IRssRenderItem[], config: IRssDisplayConfig): string {
    return `<div class="picanvas-rss-cards-grid">${items.map(item => {
      const thumbnail = config.showImage && item.thumbnail
        ? `<div class="picanvas-rss-card-image"><img src="${this.encodeHtml(item.thumbnail)}" alt="" loading="lazy" /></div>`
        : '<div class="picanvas-rss-card-image picanvas-rss-no-image"></div>';

      const date = config.showDate
        ? `<span class="picanvas-rss-date">${this.formatRssDate(item.publishedDate, config.dateFormat)}</span>`
        : '';

      const description = config.showDescription && item.description
        ? `<div class="picanvas-rss-description">${this.encodeHtml(this.truncateRssText(item.description, config.descriptionLimit))}</div>`
        : '';

      return `
        <article class="picanvas-rss-card">
          ${thumbnail}
          <div class="picanvas-rss-card-content">
            <a href="${this.encodeHtml(item.link)}" target="${config.linkTarget}" rel="noopener noreferrer" class="picanvas-rss-title">
              ${this.encodeHtml(item.title)}
            </a>
            ${date}
            ${description}
          </div>
        </article>
      `;
    }).join('')}</div>`;
  }

  /**
   * Render RSS items in compact format
   */
  private static renderRssCompact(items: IRssRenderItem[], config: IRssDisplayConfig): string {
    return items.map(item => {
      const date = config.showDate
        ? `<span class="picanvas-rss-date">${this.formatRssDate(item.publishedDate, config.dateFormat)}</span>`
        : '';

      return `
        <article class="picanvas-rss-compact-item">
          <a href="${this.encodeHtml(item.link)}" target="${config.linkTarget}" rel="noopener noreferrer" class="picanvas-rss-title">
            ${this.encodeHtml(item.title)}
          </a>
          ${date}
        </article>
      `;
    }).join('');
  }

  /**
   * Format RSS date for display
   */
  private static formatRssDate(date: Date, format: string): string {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
      return '';
    }

    if (format === 'relative') {
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays}d ago`;
      if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    }

    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();

    if (format === 'DD/MM/YYYY') {
      return `${day}/${month}/${year}`;
    }
    return `${month}/${day}/${year}`;
  }

  /**
   * Truncate RSS text to character limit
   */
  private static truncateRssText(text: string, limit: number): string {
    if (!text || text.length <= limit) return text;
    return text.substring(0, limit).trim() + '...';
  }

  // ========== External File Rendering ==========

  /**
   * Detect file type from URL extension
   * @param fileUrl - Server-relative or absolute URL to file
   * @returns 'html' | 'markdown' | 'unknown'
   */
  public static detectFileType(fileUrl: string): 'html' | 'markdown' | 'unknown' {
    if (!fileUrl || typeof fileUrl !== 'string') {
      return 'unknown';
    }

    const cleanUrl = fileUrl.split('?')[0].toLowerCase(); // Remove query params
    if (cleanUrl.endsWith('.html') || cleanUrl.endsWith('.htm')) {
      return 'html';
    }
    if (cleanUrl.endsWith('.md') || cleanUrl.endsWith('.markdown')) {
      return 'markdown';
    }
    return 'unknown';
  }

  /**
   * Render external file content based on detected type
   * @param content - Raw file content
   * @param fileType - 'html' | 'markdown'
   * @returns Rendered HTML result
   */
  public static renderFileContent(content: string, fileType: 'html' | 'markdown'): IRenderResult {
    if (!content || typeof content !== 'string') {
      return { html: '' };
    }

    if (fileType === 'markdown') {
      return this.renderMarkdown(content);
    }
    return this.renderHtml(content);
  }

  /**
   * Render file loading state
   */
  public static renderFileLoading(message?: string): IRenderResult {
    const loadingMsg = message || 'Loading content...';
    return {
      html: `
        <div class="picanvas-file-container picanvas-file-loading">
          <div class="picanvas-file-loading-spinner"></div>
          <div class="picanvas-file-loading-text">${this.encodeHtml(loadingMsg)}</div>
        </div>
      `
    };
  }

  /**
   * Render file error state
   */
  public static renderFileError(error: string): IRenderResult {
    return {
      html: `
        <div class="picanvas-file-container picanvas-file-error">
          <div class="picanvas-file-error-icon">⚠️</div>
          <div class="picanvas-file-error-text">${this.encodeHtml(error)}</div>
        </div>
      `
    };
  }

  // ========== JavaScript Content Rendering ==========

  /**
   * Prepare JavaScript content for rendering
   * Creates a container placeholder that will be populated when executeJavaScriptElement is called
   * @param displayMode - 'contained' (default), 'fullSection' (full width, keeps nav), or 'fullScreen' (covers viewport)
   * @param containerHeight - Optional height for contained mode (e.g. '300px', '50vh'). Empty = auto.
   */
  public static prepareJavaScript(code: string, elementId: string, displayMode: string = 'contained', containerHeight: string = ''): IRenderResult {
    if (!code || typeof code !== 'string') {
      return { html: '<div class="picanvas-js-container"><p class="picanvas-js-empty">No JavaScript code provided</p></div>' };
    }

    // Encode code for data attribute (prevent XSS)
    const encodedCode = this.encodeForAttribute(code);

    // Generate a CSS-safe ID
    const safeId = this.makeCssSafeId(elementId);

    // Determine CSS class and inline styles based on display mode
    let displayClass = '';
    let displayStyle = '';
    let outputStyle = '';

    if (displayMode === 'fullSection') {
      // Full Section: full viewport width positioned BELOW SharePoint header (navigation stays visible and clickable)
      // Uses position:fixed starting at top:146px (below SP header + site nav + toolbar)
      // z-index is lower than header to ensure navigation remains interactive
      displayClass = ' picanvas-js-fullsection';
      displayStyle = 'position:fixed!important;top:146px!important;left:0!important;right:0!important;bottom:0!important;width:100vw!important;z-index:100!important;margin:0!important;padding:0!important;background:#0f0f23!important;overflow:auto!important;box-sizing:border-box!important;';
      outputStyle = 'min-height:calc(100vh - 146px);width:100%;';
    } else if (displayMode === 'fullScreen') {
      // Full Screen: covers entire viewport (position:fixed)
      // WARNING: This hides SharePoint navigation - user must scroll/escape to access edit controls
      displayClass = ' picanvas-js-fullscreen';
      displayStyle = 'position:fixed!important;top:0!important;left:0!important;right:0!important;bottom:0!important;width:100vw!important;height:100vh!important;z-index:999999!important;margin:0!important;padding:0!important;background:#0f0f23!important;overflow:auto!important;';
      outputStyle = 'min-height:100vh;width:100%;';
    } else {
      // Contained mode: overflow hidden to prevent JS content from bleeding outside container
      displayStyle = 'overflow:hidden;';
      if (containerHeight) {
        const sanitizedHeight = this.sanitizeCssValue(containerHeight);
        displayStyle += `height:${sanitizedHeight};`;
        outputStyle = `height:100%;`;
      }
    }

    // Return placeholder that will be executed after DOM insertion
    const html = `
      <div class="picanvas-js-container${displayClass}"
           data-js-id="${safeId}"
           data-js-code="${encodedCode}"
           data-display-mode="${displayMode}"
           style="${displayStyle}">
        <div class="picanvas-js-output" id="${safeId}" style="${outputStyle}"></div>
      </div>
    `;

    return {
      html,
      requiresPostRender: true,
      postRenderType: 'javascript' as 'mermaid' // Type assertion for now
    };
  }

  /**
   * Execute JavaScript code within a sandboxed context
   * Provides helper utilities: container, render(), create()
   * Call this after the element is in the DOM
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public static executeJavaScriptElement(element: HTMLElement, graphFetch?: (...args: any[]) => any): void {
    const code = element.getAttribute('data-js-code');
    const jsId = element.getAttribute('data-js-id');

    if (!code || !jsId) {
      return;
    }

    // Check if already executed
    if (element.classList.contains('picanvas-js-executed')) {
      return;
    }

    // Handle display modes
    const displayMode = element.getAttribute('data-display-mode') || 'contained';

    // Detect if page is in edit mode - don't apply full-screen/full-section positioning in edit mode
    // Check URL first (most reliable), then DOM indicators
    const urlHasEditMode = window.location.href.toLowerCase().includes('mode=edit');
    const hasDesignModeClass = document.body.classList.contains('sp-pageLayout-designMode');
    const hasEditButton = !!document.querySelector('[data-automation-id="pageEditButton"][aria-pressed="true"]');
    const hasEditingMode = !!document.querySelector('.od-EditingMode');
    const hasSlotManager = !!document.querySelector('[data-automation-id="fabricSlotManager"]');
    // Also check for canvas editing UI
    const hasCanvasToolbar = !!document.querySelector('[data-automation-id="canvasToolboxAddButton"]');

    const isEditMode = urlHasEditMode || hasDesignModeClass || hasEditButton || hasEditingMode || hasSlotManager || hasCanvasToolbar;

    console.log('[PiCanvas] Edit mode detection:', {
      urlHasEditMode,
      hasDesignModeClass,
      hasEditButton,
      hasEditingMode,
      hasSlotManager,
      hasCanvasToolbar,
      isEditMode,
      displayMode,
      url: window.location.href
    });

    if (isEditMode) {
      console.log('[PiCanvas] Edit mode detected - skipping fixed positioning to allow editing');
      // Clear any fixed positioning styles that were set inline
      element.style.position = 'relative';
      element.style.top = '';
      element.style.left = '';
      element.style.right = '';
      element.style.bottom = '';
      element.style.width = '100%';
      element.style.height = 'auto';
      element.style.minHeight = '400px';
      element.style.zIndex = '';
      // Don't move to body or apply full positioning - just continue to execute JS below
    } else if (displayMode === 'fullScreen' && element.parentElement !== document.body) {
      // Full Screen mode: move element to body to escape parent CSS constraints (portal approach)
      // This covers the entire viewport including SharePoint navigation
      const placeholder = document.createElement('div');
      placeholder.className = 'picanvas-js-fullscreen-placeholder';
      placeholder.setAttribute('data-js-id', jsId);
      placeholder.style.display = 'none';
      element.parentElement?.insertBefore(placeholder, element);
      document.body.appendChild(element);

      // Inject edit button for users with edit permissions
      this.injectEditButton(element, 'fullScreen');
      console.log('[PiCanvas] Full Screen mode - moved JS container to body (covers everything)');
    } else if (displayMode === 'fullSection' && element.parentElement !== document.body) {
      // Full Section mode: move to body to escape SharePoint container constraints
      // Uses position:fixed but starts below the header (top:146px) so navigation remains visible and clickable
      const placeholder = document.createElement('div');
      placeholder.className = 'picanvas-js-fullsection-placeholder';
      placeholder.setAttribute('data-js-id', jsId);
      placeholder.style.display = 'none';
      element.parentElement?.insertBefore(placeholder, element);
      document.body.appendChild(element);

      // Inject edit button for users with edit permissions
      this.injectEditButton(element, 'fullSection');
      console.log('[PiCanvas] Full Section mode - moved to body, positioned below header (navigation visible)');
    } else {
      console.log('[PiCanvas] Contained mode - default styling');
    }

    // Decode code
    const decodedCode = this.decodeFromAttribute(code);

    const outputDiv = element.querySelector('.picanvas-js-output') as HTMLElement;
    if (!outputDiv) {
      return;
    }

    try {
      // Create sandboxed helpers
      const container = outputDiv;

      // render() helper - sets innerHTML with basic sanitization
      const render = (html: string): void => {
        // Basic sanitization - remove script tags and event handlers
        const sanitized = html
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/\bon\w+\s*=\s*["'][^"']*["']/gi, '');
        container.innerHTML = sanitized;
      };

      // create() helper - creates elements safely
      const create = (
        tag: string,
        attributes?: Record<string, unknown>,
        children?: string | HTMLElement | (string | HTMLElement)[]
      ): HTMLElement => {
        const el = document.createElement(tag);

        if (attributes) {
          Object.entries(attributes).forEach(([key, value]) => {
            if (key === 'style' && typeof value === 'object' && value !== null) {
              // Handle style object - use type assertion through unknown
              const styleObj = value as Record<string, string>;
              Object.keys(styleObj).forEach((styleProp) => {
                (el.style as unknown as Record<string, string>)[styleProp] = styleObj[styleProp];
              });
            } else if (key.startsWith('on') && typeof value === 'function') {
              // Handle event listeners
              const eventName = key.substring(2).toLowerCase();
              el.addEventListener(eventName, value as EventListener);
            } else if (key === 'className') {
              el.className = String(value);
            } else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
              el.setAttribute(key, String(value));
            }
          });
        }

        if (children) {
          const childArray = Array.isArray(children) ? children : [children];
          childArray.forEach(child => {
            if (typeof child === 'string') {
              el.appendChild(document.createTextNode(child));
            } else if (child instanceof HTMLElement) {
              el.appendChild(child);
            }
          });
        }

        return el;
      };

      // Create a scoped document proxy so user code that calls
      // document.querySelector('.picanvas-js-output') finds THIS instance's
      // container instead of always the first one on the page.
      // This is critical for multi-instance support.
      const scopedDocument = new Proxy(document, {
        get(target: Document, prop: string | symbol): unknown {
          if (prop === 'querySelector') {
            return (selector: string): Element | null => {
              // If querying for picanvas-js-output, scope to this element
              if (typeof selector === 'string' && selector.indexOf('picanvas-js-output') !== -1) {
                return element.querySelector(selector) || target.querySelector(selector);
              }
              return target.querySelector(selector);
            };
          }
          if (prop === 'querySelectorAll') {
            return (selector: string): NodeListOf<Element> => {
              if (typeof selector === 'string' && selector.indexOf('picanvas-js-output') !== -1) {
                const local = element.querySelectorAll(selector);
                return local.length > 0 ? local : target.querySelectorAll(selector);
              }
              return target.querySelectorAll(selector);
            };
          }
          if (prop === 'getElementById') {
            return (id: string): HTMLElement | null => {
              // Scope getElementById for this instance's JS output ID
              if (typeof id === 'string' && jsId && id === jsId) {
                return element.querySelector('#' + CSS.escape(id)) as HTMLElement || target.getElementById(id);
              }
              return target.getElementById(id);
            };
          }
          const value = (target as unknown as Record<string | symbol, unknown>)[prop];
          if (typeof value === 'function') {
            return value.bind(target);
          }
          return value;
        }
      });

      // Execute user code in a sandboxed function scope
      // Pass scoped 'document' so querySelector finds this instance's container
      // eslint-disable-next-line no-new-func
      const sandboxedFunction = new Function(
        'container',
        'render',
        'create',
        'echarts',
        'document',
        'graphFetch',
        decodedCode
      );

      sandboxedFunction(container, render, create, echarts, scopedDocument, graphFetch);

      element.classList.add('picanvas-js-executed');
    } catch (error) {
      console.error('[PiCanvas] JavaScript execution error:', error);
      outputDiv.innerHTML = `
        <div class="picanvas-js-error">
          <span class="error-icon">⚠️</span>
          <span class="error-text">JavaScript execution error</span>
          <details>
            <summary>Details</summary>
            <pre>${this.encodeHtml(String(error))}</pre>
          </details>
        </div>
      `;
      element.classList.add('picanvas-js-error');
    }
  }

  /**
   * Inject an edit button for Full Screen / Full Section mode
   * Shows an edit pencil icon in the top-right corner that links to page edit mode
   * @param displayMode - 'fullScreen' positions at viewport top, 'fullSection' positions below SP header
   */
  public static injectEditButton(container: HTMLElement, displayMode: 'fullScreen' | 'fullSection' = 'fullScreen'): void {
    // Check if edit button already exists
    if (container.querySelector('.picanvas-edit-button')) {
      return;
    }

    // Create the edit button
    const editButton = document.createElement('a');
    editButton.className = 'picanvas-edit-button';
    editButton.title = 'Edit Page';

    // Build edit URL - add ?Mode=Edit to current URL
    const currentUrl = window.location.href.split('?')[0];
    editButton.href = `${currentUrl}?Mode=Edit`;

    // Position depends on display mode:
    // - fullScreen: top of viewport (12px)
    // - fullSection: below SharePoint header (156px = 146px header + 10px padding)
    const topPosition = displayMode === 'fullSection' ? '156px' : '12px';

    // Style the button
    editButton.style.cssText = `
      position: fixed !important;
      top: ${topPosition} !important;
      right: 12px !important;
      width: 40px !important;
      height: 40px !important;
      background: rgba(255, 255, 255, 0.9) !important;
      border: 1px solid #ccc !important;
      border-radius: 8px !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      cursor: pointer !important;
      z-index: 999999 !important;
      text-decoration: none !important;
      transition: background 0.2s, transform 0.2s !important;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15) !important;
    `;

    // Add hover effect
    editButton.addEventListener('mouseenter', () => {
      editButton.style.background = 'rgba(255, 255, 255, 1)';
      editButton.style.transform = 'scale(1.05)';
    });
    editButton.addEventListener('mouseleave', () => {
      editButton.style.background = 'rgba(255, 255, 255, 0.9)';
      editButton.style.transform = 'scale(1)';
    });

    // Add pencil icon (SVG)
    editButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#333" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
      </svg>
    `;

    // Add to container
    container.appendChild(editButton);
    console.log('[PiCanvas] Injected edit button for fullscreen/fullsection mode');
  }

  // ========== Landing Page Rendering ==========
  //
  // Internal demo feature for a German-language pilot deployment.
  // The 'landing' content type renders an animated landing page with a hero section,
  // snake-path timeline, and CTA. It is NOT exposed in the config panel UI — it can
  // only be activated by manually setting a tab's contentType to 'landing'.
  // All German-language defaults (labels, descriptions, nav items) are overridable
  // via the ILandingConfig interface passed to renderLanding().

  // SVG Icons for landing page
  private static readonly LANDING_ICONS: Record<string, string> = {
    zap: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
    fileText: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`,
    users: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
    calendar: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
    barChart: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>`,
    folder: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`,
    messageSquare: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
    search: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
    bell: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`,
    arrowRight: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`
  };

  // Default landing nodes — German-language demo data, overridable via ILandingConfig.nodes
  private static readonly DEFAULT_LANDING_NODES: ILandingNode[] = [
    { id: 1, title: "Dokumente", description: "Alle wichtigen Dateien und Dokumente an einem Ort verwalten und teilen.", icon: 'fileText', stats: "2,847 Dateien" },
    { id: 2, title: "Team", description: "Zusammenarbeit mit Ihrem Team in Echtzeit - effizient und transparent.", icon: 'users', stats: "24 Mitglieder" },
    { id: 3, title: "Kalender", description: "Termine, Meetings und Deadlines immer im Blick behalten.", icon: 'calendar', stats: "12 Events" },
    { id: 4, title: "Analytics", description: "Datengetriebene Einblicke für bessere Entscheidungen.", icon: 'barChart', stats: "+34% Wachstum" },
    { id: 5, title: "Projekte", description: "Projektmanagement und Aufgabenverfolgung in einer Oberfläche.", icon: 'folder', stats: "8 aktiv" },
    { id: 6, title: "Kommunikation", description: "Nahtlose Kommunikation mit integrierten Chat- und Messaging-Tools.", icon: 'messageSquare', stats: "156 Nachrichten" }
  ];

  /**
   * Generate snake path SVG data
   */
  private static createSnakePath(): string {
    const points: string[] = [];
    const totalHeight = 2600;
    const segments = 6;
    const segmentHeight = totalHeight / segments;

    points.push(`M 200 0`);

    for (let i = 0; i < segments; i++) {
      const startY = i * segmentHeight;
      const endY = startY + segmentHeight;
      const isGoingRight = i % 2 === 0;

      if (isGoingRight) {
        points.push(`C 200 ${startY + segmentHeight * 0.3}, 350 ${startY + segmentHeight * 0.3}, 350 ${startY + segmentHeight * 0.5}`);
        points.push(`C 350 ${startY + segmentHeight * 0.7}, 200 ${startY + segmentHeight * 0.7}, 200 ${endY}`);
      } else {
        points.push(`C 200 ${startY + segmentHeight * 0.3}, 50 ${startY + segmentHeight * 0.3}, 50 ${startY + segmentHeight * 0.5}`);
        points.push(`C 50 ${startY + segmentHeight * 0.7}, 200 ${startY + segmentHeight * 0.7}, 200 ${endY}`);
      }
    }

    return points.join(' ');
  }

  /**
   * Render animated landing page (internal demo feature).
   * German-language defaults are used when no config is supplied;
   * callers can override every label via ILandingConfig.
   */
  public static renderLanding(config: ILandingConfig = {}): IRenderResult {
    const {
      brandName = 'SharePoint',
      brandInitials = 'MK',
      heroTitle = 'Ihr digitaler',
      heroTitleGradient = 'Arbeitsplatz',
      heroDescription = 'Verwalten Sie Dokumente, arbeiten Sie im Team zusammen und steigern Sie Ihre Produktivität mit unserer modernen Plattform.',
      ctaTitle = 'Bereit durchzustarten?',
      ctaDescription = 'Starten Sie noch heute und erleben Sie eine neue Art der Zusammenarbeit.',
      ctaButtonText = 'Kostenlos testen',
      navItems = ['Start', 'Dokumente', 'Team', 'Einstellungen'],
      nodes = this.DEFAULT_LANDING_NODES
    } = config;

    const snakePath = this.createSnakePath();
    const Icons = this.LANDING_ICONS;

    const html = `
      <div class="al-container" data-landing-root="true">
        <!-- Animated Background -->
        <div class="al-background">
          <div class="al-blob al-blob--pink"></div>
          <div class="al-blob al-blob--blue"></div>
        </div>

        <!-- Header -->
        <header class="al-header">
          <div class="al-header__inner">
            <div class="al-logo">
              <div class="al-logo__icon">${Icons.zap}</div>
              <span class="al-logo__text">${this.encodeHtml(brandName)}</span>
            </div>

            <nav class="al-nav">
              ${navItems.map(item => `<a href="#" class="al-nav__link">${this.encodeHtml(item)}</a>`).join('')}
            </nav>

            <div class="al-header__actions">
              <button class="al-icon-btn" aria-label="Search">${Icons.search}</button>
              <button class="al-icon-btn al-icon-btn--notify" aria-label="Notifications">
                ${Icons.bell}
                <span class="al-icon-btn__badge"></span>
              </button>
              <div class="al-avatar">${this.encodeHtml(brandInitials)}</div>
            </div>
          </div>
        </header>

        <!-- Hero Section -->
        <section class="al-hero">
          <div class="al-hero__content">
            <span class="al-badge">Willkommen bei ${this.encodeHtml(brandName)}</span>
            <h1 class="al-hero__title">
              ${this.encodeHtml(heroTitle)}
              <span class="al-hero__title-gradient">${this.encodeHtml(heroTitleGradient)}</span>
            </h1>
            <p class="al-hero__description">${this.encodeHtml(heroDescription)}</p>

            <div class="al-hero__buttons">
              <button class="al-btn al-btn--primary">Jetzt starten</button>
              <button class="al-btn al-btn--secondary">Mehr erfahren</button>
            </div>

            <div class="al-intro-line">
              <div class="al-intro-line__line"></div>
              <div class="al-intro-line__dot"></div>
            </div>

            <p class="al-scroll-hint">↓ Scrollen Sie, um mehr zu entdecken</p>
          </div>
        </section>

        <!-- Timeline Section -->
        <section class="al-timeline" data-landing-timeline="true">
          <div class="al-timeline__inner">
            <div class="al-timeline__title">
              <h2>Entdecken Sie unsere Features</h2>
            </div>

            <!-- Snake Path SVG -->
            <svg class="al-snake-container" width="400" height="2600" style="overflow: visible;">
              <path class="al-snake-path al-snake-path--bg" d="${snakePath}" fill="none" stroke-width="3" stroke-linecap="round"/>
              <path class="al-snake-path al-snake-path--glow" d="${snakePath}" fill="none" stroke-width="6" stroke-linecap="round"/>
              <path class="al-snake-path" d="${snakePath}" fill="none" stroke="url(#al-lineGradient)" stroke-width="3" stroke-linecap="round" data-landing-snake="true"/>
              <defs>
                <linearGradient id="al-lineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stop-color="#ffffff"/>
                  <stop offset="50%" stop-color="#ffffff"/>
                  <stop offset="100%" stop-color="#ec4899"/>
                </linearGradient>
              </defs>
            </svg>

            <div class="al-nodes-container">
              <!-- Pink Nodes -->
              ${nodes.map((_, index) => `
                <div class="al-pink-node ${index % 2 === 0 ? 'al-pink-node--right' : 'al-pink-node--left'}"
                     style="top: ${index * 400 + 300}px;"
                     data-index="${index}">
                  <div class="al-pink-node__outer"></div>
                  <div class="al-pink-node__middle"></div>
                  <div class="al-pink-node__core"></div>
                </div>
              `).join('')}

              <!-- Content Cards -->
              ${nodes.map((node, index) => `
                <div class="al-content-card ${index % 2 === 0 ? 'al-content-card--left' : 'al-content-card--right'}"
                     style="top: ${index * 400 + 100}px;"
                     data-node-id="${node.id}">
                  <div class="al-card">
                    <div class="al-card__header">
                      <div class="al-card__icon">${Icons[node.icon] || Icons.zap}</div>
                      <div class="al-card__info">
                        <h3 class="al-card__title">${this.encodeHtml(node.title)}</h3>
                        <span class="al-card__stats">${this.encodeHtml(node.stats)}</span>
                      </div>
                    </div>
                    <p class="al-card__description">${this.encodeHtml(node.description)}</p>
                    <div class="al-card__cta">
                      <span>Mehr erfahren</span>
                      ${Icons.arrowRight}
                    </div>
                  </div>
                </div>
              `).join('')}

              <!-- End Decoration -->
              <div class="al-timeline__end" style="top: ${nodes.length * 400 + 200}px;">
                <div class="al-timeline__end-icon">${Icons.zap}</div>
              </div>
            </div>
          </div>
        </section>

        <!-- CTA Section -->
        <section class="al-cta">
          <div class="al-cta__inner">
            <div class="al-cta__card">
              <div class="al-cta__sweep"></div>
              <div class="al-cta__content">
                <h2 class="al-cta__title">${this.encodeHtml(ctaTitle)}</h2>
                <p class="al-cta__description">${this.encodeHtml(ctaDescription)}</p>
                <button class="al-btn al-btn--primary al-cta__btn">${this.encodeHtml(ctaButtonText)}</button>
              </div>
            </div>
          </div>
        </section>

        <!-- Footer -->
        <footer class="al-footer">
          <div class="al-footer__inner">
            <div class="al-footer__logo">
              <div class="al-footer__logo-icon">${Icons.zap}</div>
              <span class="al-footer__logo-text">${this.encodeHtml(brandName)}</span>
            </div>
            <p class="al-footer__copyright">© ${new Date().getFullYear()} ${this.encodeHtml(brandName)}. Alle Rechte vorbehalten.</p>
          </div>
        </footer>
      </div>
    `;

    return {
      html,
      requiresPostRender: true,
      postRenderType: 'landing'
    };
  }

  /**
   * Initialize landing page animations after DOM insertion
   * Call this after the landing HTML is in the DOM
   */
  public static initLandingAnimations(container: HTMLElement): void {
    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Set up snake path animation
    const snakePath = container.querySelector('[data-landing-snake]') as SVGPathElement;
    const snakePathGlow = container.querySelector('.al-snake-path--glow') as SVGPathElement;
    const timeline = container.querySelector('[data-landing-timeline]') as HTMLElement;

    if (snakePath && timeline) {
      const pathLength = snakePath.getTotalLength();
      snakePath.style.strokeDasharray = `${pathLength}`;
      snakePath.style.strokeDashoffset = prefersReducedMotion ? '0' : `${pathLength}`;

      if (snakePathGlow) {
        snakePathGlow.style.strokeDasharray = `${pathLength}`;
        snakePathGlow.style.strokeDashoffset = prefersReducedMotion ? '0' : `${pathLength}`;
      }

      if (!prefersReducedMotion) {
        const handleScroll = (): void => {
          const rect = timeline.getBoundingClientRect();
          const windowHeight = window.innerHeight;
          const sectionTop = rect.top;
          const sectionHeight = rect.height;

          const scrollStart = sectionTop - windowHeight;
          const scrollEnd = sectionTop + sectionHeight;
          const scrollRange = scrollEnd - scrollStart;
          const currentScroll = -scrollStart;
          const progress = Math.max(0, Math.min(1, currentScroll / scrollRange));

          const offset = pathLength * (1 - progress);
          snakePath.style.strokeDashoffset = `${offset}`;
          if (snakePathGlow) {
            snakePathGlow.style.strokeDashoffset = `${offset}`;
          }
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        handleScroll(); // Initial call

        // Store cleanup function on container
        (container as HTMLElement & { _landingCleanup?: () => void })._landingCleanup = () => {
          window.removeEventListener('scroll', handleScroll);
        };
      }
    }

    // Set up Intersection Observers
    const observerOptions: IntersectionObserverInit = {
      threshold: 0.2,
      rootMargin: '-10% 0px -10% 0px'
    };

    const fadeInObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('al-in-view');
        }
      });
    }, observerOptions);

    const toggleObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('al-in-view');
        } else if (!prefersReducedMotion) {
          entry.target.classList.remove('al-in-view');
        }
      });
    }, { threshold: 0.3, rootMargin: '-15% 0px -15% 0px' });

    // Observe elements
    container.querySelectorAll('.al-timeline__title h2, .al-timeline__end, .al-cta__card')
      .forEach(el => fadeInObserver.observe(el));

    container.querySelectorAll('.al-content-card, .al-pink-node')
      .forEach(el => toggleObserver.observe(el));

    // Store observers for cleanup
    const existingCleanup = (container as HTMLElement & { _landingCleanup?: () => void })._landingCleanup;
    (container as HTMLElement & { _landingCleanup?: () => void })._landingCleanup = () => {
      if (existingCleanup) existingCleanup();
      fadeInObserver.disconnect();
      toggleObserver.disconnect();
    };
  }

  /**
   * Clean up landing page animations
   */
  public static destroyLandingAnimations(container: HTMLElement): void {
    const cleanup = (container as HTMLElement & { _landingCleanup?: () => void })._landingCleanup;
    if (cleanup) {
      cleanup();
      delete (container as HTMLElement & { _landingCleanup?: () => void })._landingCleanup;
    }
  }

  // ========== Table of Contents Rendering ==========

  /**
   * Render TOC placeholder that will be populated post-render
   * Config is encoded as JSON in a data attribute for the post-render hook
   */
  public static renderTocPlaceholder(elementId: string, configJson: string): IRenderResult {
    const safeId = this.makeCssSafeId(elementId);
    const encodedConfig = this.encodeForAttribute(configJson);

    const html = `
      <div class="picanvas-toc-wrapper"
           id="${safeId}"
           data-toc-config="${encodedConfig}">
        <div class="picanvas-toc-loading">Scanning page headings...</div>
      </div>
    `;

    return {
      html,
      requiresPostRender: true,
      postRenderType: 'toc'
    };
  }

  /**
   * Render an inline TOC placeholder for within-tab use
   * Returns a marker div that will be populated after the tab content renders
   */
  public static renderInlineTocPlaceholder(elementId: string): string {
    const safeId = this.makeCssSafeId(elementId);
    return `<div class="picanvas-inline-toc-placeholder" id="${safeId}" data-inline-toc="true"></div>`;
  }

  // ========== Profile Report Rendering ==========

  /**
   * Render loading state for profile reports
   */
  public static renderProfileReportLoading(message?: string): IRenderResult {
    const msg = this.encodeHtml(message || 'Loading company profiles...');
    return {
      html: `
        <div class="picanvas-profilereport-loading">
          <div class="spinner"></div>
          <p>${msg}</p>
        </div>
      `
    };
  }

  /**
   * Render error state for profile reports
   */
  public static renderProfileReportError(error: string): IRenderResult {
    const encodedError = this.encodeHtml(error);
    return {
      html: `
        <div class="picanvas-profilereport-error">
          <p class="error-icon">⚠️</p>
          <p class="error-message">${encodedError}</p>
        </div>
      `
    };
  }

  /**
   * Render empty state when no profiles found
   */
  public static renderProfileReportEmpty(libraryName: string): IRenderResult {
    const encodedLibrary = this.encodeHtml(libraryName);
    return {
      html: `
        <div class="picanvas-profilereport-empty">
          <p class="empty-icon">📊</p>
          <p class="empty-message">No company profiles found in "${encodedLibrary}"</p>
          <p class="empty-hint">Upload profile files (.md, .json) with Pi_CompanyID metadata to get started.</p>
        </div>
      `
    };
  }

  // ========== Company Intelligence Rendering ==========

  /**
   * Format currency values for display (e.g., 1500000000 → "$1.5B")
   */
  private static formatCurrency(value: number, unit: string = 'USD'): string {
    const prefix = unit === 'USD' ? '$' : '';
    const abs = Math.abs(value);
    if (abs >= 1e12) return `${prefix}${(value / 1e12).toFixed(1)}T`;
    if (abs >= 1e9) return `${prefix}${(value / 1e9).toFixed(1)}B`;
    if (abs >= 1e6) return `${prefix}${(value / 1e6).toFixed(1)}M`;
    if (abs >= 1e3) return `${prefix}${(value / 1e3).toFixed(0)}K`;
    return `${prefix}${value.toFixed(0)}`;
  }

  /**
   * Render enriched overview tab using company intel data
   */
  private static renderIntelOverview(intel: ICompanyIntel, profile: ICompanyProfile): string {
    const descriptionHtml = intel.description
      ? `<p class="intel-description">${this.encodeHtml(intel.description)}</p>`
      : '';

    const infoItems: string[] = [];
    if (intel.hq) infoItems.push(`<div class="intel-info-item"><span class="intel-info-label">Headquarters</span><span class="intel-info-value">${this.encodeHtml(intel.hq)}</span></div>`);
    if (intel.founded) infoItems.push(`<div class="intel-info-item"><span class="intel-info-label">Founded</span><span class="intel-info-value">${this.encodeHtml(intel.founded)}</span></div>`);
    if (intel.parentCompany) infoItems.push(`<div class="intel-info-item"><span class="intel-info-label">Parent Company</span><span class="intel-info-value">${this.encodeHtml(intel.parentCompany)}</span></div>`);
    if (profile.industry) infoItems.push(`<div class="intel-info-item"><span class="intel-info-label">Industry</span><span class="intel-info-value">${this.encodeHtml(profile.industry)}</span></div>`);
    if (profile.sector) infoItems.push(`<div class="intel-info-item"><span class="intel-info-label">Sector</span><span class="intel-info-value">${this.encodeHtml(profile.sector)}</span></div>`);

    const infoGridHtml = infoItems.length > 0
      ? `<div class="intel-info-grid">${infoItems.join('')}</div>`
      : '';

    const leadershipHtml = intel.executives.length > 0 ? this.renderLeadershipSection(intel.executives) : '';
    const productsHtml = intel.products.length > 0 ? this.renderProductsSection(intel.products) : '';

    return `
      <div class="intel-overview">
        ${descriptionHtml}
        ${infoGridHtml}
        ${leadershipHtml}
        ${productsHtml}
      </div>
    `;
  }

  /**
   * Render leadership/executives section
   */
  private static renderLeadershipSection(executives: IIntelExecutive[]): string {
    const cards = executives.map(exec => `
      <div class="intel-exec-card">
        <div class="intel-exec-name">${this.encodeHtml(exec.name)}</div>
        <div class="intel-exec-title">${this.encodeHtml(exec.title)}</div>
      </div>
    `).join('');

    return `
      <div class="intel-section">
        <h4 class="intel-section-title">Leadership</h4>
        <div class="intel-exec-grid">${cards}</div>
      </div>
    `;
  }

  /**
   * Render products section
   */
  private static renderProductsSection(products: IIntelProduct[]): string {
    const items = products.map(p => {
      const desc = p.description ? `<span class="intel-product-desc">${this.encodeHtml(p.description)}</span>` : '';
      return `<div class="intel-product-item"><span class="intel-product-name">${this.encodeHtml(p.name)}</span>${desc}</div>`;
    }).join('');

    return `
      <div class="intel-section">
        <h4 class="intel-section-title">Products & Services</h4>
        <div class="intel-products-list">${items}</div>
      </div>
    `;
  }

  /**
   * Render financials tab with tier badges
   */
  private static renderFinancialsSection(financials: IIntelFinancial[]): string {
    if (financials.length === 0) {
      return '<div class="intel-empty">No financial estimates available for this company.</div>';
    }

    // Group by fiscal year
    const byYear = new Map<number, IIntelFinancial[]>();
    for (const f of financials) {
      const arr = byYear.get(f.fiscalYear) || [];
      arr.push(f);
      byYear.set(f.fiscalYear, arr);
    }

    const years = [...byYear.keys()].sort((a, b) => b - a);

    const yearSections = years.map(year => {
      const items = byYear.get(year)!;
      const cards = items.map(f => {
        const tierClass = f.tier === 'A' ? 'intel-tier-a' : 'intel-tier-b';
        return `
          <div class="intel-financial-card">
            <div class="intel-financial-metric">${this.encodeHtml(f.metric)}</div>
            <div class="intel-financial-value">${this.formatCurrency(f.value, f.unit)}</div>
            <div class="intel-financial-meta">
              <span class="intel-tier-badge ${tierClass}">Tier ${this.encodeHtml(f.tier)}</span>
            </div>
          </div>
        `;
      }).join('');

      return `
        <div class="intel-year-group">
          <h4 class="intel-year-label">FY ${year}</h4>
          <div class="intel-financials-grid">${cards}</div>
        </div>
      `;
    }).join('');

    return `<div class="intel-financials">${yearSections}</div>`;
  }

  /**
   * Render competitive landscape with colored chips
   */
  private static renderCompetitiveLandscape(
    competitors: IIntelRelationship[],
    customers: IIntelRelationship[],
    partners: IIntelRelationship[]
  ): string {
    const hasAny = competitors.length > 0 || customers.length > 0 || partners.length > 0;
    if (!hasAny) {
      return '<div class="intel-empty">No relationship data available for this company.</div>';
    }

    const renderChips = (items: IIntelRelationship[], cssClass: string): string => {
      return items.map(r =>
        `<span class="intel-chip ${cssClass}" title="Confidence: ${(r.confidence * 100).toFixed(0)}%">${this.encodeHtml(r.name)}</span>`
      ).join('');
    };

    const sections: string[] = [];
    if (competitors.length > 0) {
      sections.push(`
        <div class="intel-landscape-group">
          <h4 class="intel-landscape-label">Competitors <span class="intel-landscape-count">${competitors.length}</span></h4>
          <div class="intel-chips-container">${renderChips(competitors, 'intel-chip-competitor')}</div>
        </div>
      `);
    }
    if (customers.length > 0) {
      sections.push(`
        <div class="intel-landscape-group">
          <h4 class="intel-landscape-label">Customers <span class="intel-landscape-count">${customers.length}</span></h4>
          <div class="intel-chips-container">${renderChips(customers, 'intel-chip-customer')}</div>
        </div>
      `);
    }
    if (partners.length > 0) {
      sections.push(`
        <div class="intel-landscape-group">
          <h4 class="intel-landscape-label">Partners <span class="intel-landscape-count">${partners.length}</span></h4>
          <div class="intel-chips-container">${renderChips(partners, 'intel-chip-partner')}</div>
        </div>
      `);
    }

    return `<div class="intel-landscape">${sections.join('')}</div>`;
  }

  /**
   * Render activity timeline with date, type, title, confirmation badges
   */
  private static renderActivityTimeline(events: IIntelGrowthEvent[]): string {
    if (events.length === 0) {
      return '<div class="intel-empty">No recent activity data available for this company.</div>';
    }

    const items = events.map(evt => {
      const confirmedBadge = evt.confirmed
        ? '<span class="intel-confirmed-badge">Confirmed</span>'
        : '';
      const sourcesBadge = evt.sources && evt.sources > 1
        ? `<span class="intel-sources-badge">${evt.sources} sources</span>`
        : '';
      const descHtml = evt.description
        ? `<div class="intel-event-desc">${this.encodeHtml(evt.description)}</div>`
        : '';
      const typeLabel = evt.type.replace(/_/g, ' ');

      return `
        <div class="intel-timeline-item">
          <div class="intel-timeline-dot"></div>
          <div class="intel-timeline-content">
            <div class="intel-event-header">
              <span class="intel-event-date">${this.encodeHtml(evt.date)}</span>
              <span class="intel-event-type">${this.encodeHtml(typeLabel)}</span>
              ${confirmedBadge}
              ${sourcesBadge}
            </div>
            <div class="intel-event-title">${this.encodeHtml(evt.title)}</div>
            ${descHtml}
          </div>
        </div>
      `;
    }).join('');

    return `<div class="intel-timeline">${items}</div>`;
  }

  /**
   * Render earnings summaries with sentiment badges
   */
  private static renderEarningsSection(earnings: IIntelEarnings[]): string {
    if (earnings.length === 0) {
      return '<div class="intel-empty">No earnings transcript data available for this company.</div>';
    }

    const cards = earnings.map(e => {
      const sentimentClass = `intel-sentiment-${e.sentiment}`;
      const sentimentLabel = e.sentiment.charAt(0).toUpperCase() + e.sentiment.slice(1);
      const topicsHtml = e.keyTopics && e.keyTopics.length > 0
        ? `<div class="intel-earnings-topics">${e.keyTopics.map(t => `<span class="intel-topic-tag">${this.encodeHtml(t)}</span>`).join('')}</div>`
        : '';

      return `
        <div class="intel-earnings-card">
          <div class="intel-earnings-header">
            <span class="intel-earnings-period">${this.encodeHtml(e.quarter)} ${e.year}</span>
            <span class="intel-sentiment-badge ${sentimentClass}">${sentimentLabel}</span>
          </div>
          <div class="intel-earnings-summary">${this.encodeHtml(e.summary)}</div>
          ${topicsHtml}
        </div>
      `;
    }).join('');

    return `<div class="intel-earnings">${cards}</div>`;
  }

  /**
   * Render a single company card for the explorer grid.
   * Returns an HTML string for a clickable card button.
   */
  public static renderCompanyCard(entry: ICompanyEntry, index: number, searchQuery?: string): string {
    const encodedName = this.encodeHtml(entry.companyName);
    const encodedDomain = this.encodeHtml(entry.domain);

    // Highlight matching text if searching
    const highlight = (text: string): string => {
      if (!searchQuery) return text;
      const escaped = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return text.replace(new RegExp(`(${escaped})`, 'gi'), '<mark class="pr-search-highlight">$1</mark>');
    };

    // Badges
    const badges: string[] = [];
    if (entry.industry) badges.push(`<span class="pr-card-badge pr-card-badge-industry">${highlight(this.encodeHtml(entry.industry))}</span>`);
    if (entry.sector) badges.push(`<span class="pr-card-badge pr-card-badge-sector">${highlight(this.encodeHtml(entry.sector))}</span>`);
    const badgesHtml = badges.length > 0 ? `<div class="pr-card-badges">${badges.join('')}</div>` : '';

    // Meta line
    const metaParts: string[] = [];
    if (entry.accountOwner) metaParts.push(highlight(this.encodeHtml(entry.accountOwner)));
    if (entry.revenue) metaParts.push(this.encodeHtml(entry.revenue));
    if (entry.employees) metaParts.push(`${this.encodeHtml(entry.employees)} emp`);
    const metaHtml = metaParts.length > 0
      ? `<div class="pr-card-meta">${metaParts.map(p => `<span>${p}</span>`).join('<span class="pr-card-meta-sep">&middot;</span>')}</div>`
      : '';

    const tickerHtml = entry.ticker
      ? `<span class="pr-card-ticker">${highlight(this.encodeHtml(entry.ticker))}</span>`
      : '';

    return `<button class="pr-company-card" data-company-index="${index}">
      <span class="pr-card-name">${highlight(encodedName)}</span>
      <div class="pr-card-domain-row">${highlight(encodedDomain)}${tickerHtml ? `<span class="pr-card-domain-sep">&middot;</span>${tickerHtml}` : ''}</div>
      ${badgesHtml}
      ${metaHtml}
    </button>`;
  }

  /**
   * Render the detail header for a selected company.
   * Returns inner HTML for the .pr-detail-header element.
   */
  public static renderDetailHeader(entry: ICompanyEntry, currentIndex: number, totalFiltered: number): string {
    const encodedName = this.encodeHtml(entry.companyName);
    const encodedDomain = this.encodeHtml(entry.domain);

    // Metadata badges
    const badges: string[] = [];
    if (entry.industry) badges.push(`<span class="company-badge company-badge-industry">${this.encodeHtml(entry.industry)}</span>`);
    if (entry.sector) badges.push(`<span class="company-badge company-badge-sector">${this.encodeHtml(entry.sector)}</span>`);
    if (entry.accountOwner) badges.push(`<span class="company-badge company-badge-owner">${this.encodeHtml(entry.accountOwner)}</span>`);
    if (entry.ownerRegion) badges.push(`<span class="company-badge company-badge-region">${this.encodeHtml(entry.ownerRegion)}</span>`);
    const badgesHtml = badges.length > 0 ? `<div class="pr-detail-badges">${badges.join('')}</div>` : '';

    const posLabel = `${currentIndex + 1} / ${totalFiltered}`;
    const hasPrev = currentIndex > 0;
    const hasNext = currentIndex < totalFiltered - 1;

    return `
      <button class="pr-back-btn" title="Back to explorer">&larr; Back</button>
      <div class="pr-detail-info">
        <h2 class="pr-detail-company-name">${encodedName}</h2>
        <span class="pr-detail-domain">${encodedDomain}</span>${entry.ticker ? `<span class="pr-detail-ticker">${this.encodeHtml(entry.ticker)}</span>` : ''}
        ${badgesHtml}
      </div>
      <div class="pr-detail-nav">
        <span class="pr-detail-pos">${posLabel}</span>
        <button class="pr-detail-nav-prev" ${hasPrev ? '' : 'disabled'}>&larr; Prev</button>
        <button class="pr-detail-nav-next" ${hasNext ? '' : 'disabled'}>Next &rarr;</button>
      </div>
    `;
  }

  /**
   * Render profile report shell — two-phase explorer/detail full-page app.
   * Explorer: full-screen card grid with search, filters, sort.
   * Detail: full-width report reader when a company is selected.
   * Content is loaded per-company on demand via renderCompanyPanel().
   */
  /**
   * Render theme toggle buttons from a themes array.
   * Falls back to hardcoded 4-button toggle if no themes provided.
   */
  public static renderThemeToggle(themes: IProfileReportTheme[], activeId: string): string {
    // Always prepend Auto button (meta-mode that follows OS preference)
    const autoActive = activeId === 'auto' ? ' active' : '';
    const autoBtn = `<button class="pr-theme-btn${autoActive}" data-theme-value="auto" title="Auto (follow system)"><svg class="pr-theme-icon" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.5"/><path d="M8 2a6 6 0 0 1 0 12z" fill="currentColor"/></svg></button>`;

    const themeButtons = themes.map(t => {
      const isActive = t.id === activeId ? ' active' : '';
      const safeId = this.encodeHtml(t.id);
      const safeName = this.encodeHtml(t.name);
      // Build SVG icon based on theme mode + icon data
      let svgContent: string;
      if (t.icon && t.mode === 'light') {
        // Sun icon with paths
        svgContent = `<circle cx="8" cy="8" r="3.5" stroke="currentColor" stroke-width="1.5"/><path d="${this.encodeHtml(t.icon)}" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>`;
      } else if (t.icon && t.mode === 'dark') {
        // Moon icon
        svgContent = `<path d="${this.encodeHtml(t.icon)}" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>`;
      } else if (t.icon && t.mode === 'high-contrast') {
        // Split circle
        svgContent = `<circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="2"/><path d="${this.encodeHtml(t.icon)}" fill="currentColor"/>`;
      } else {
        // Generic circle icon for unknown/external themes
        svgContent = `<circle cx="8" cy="8" r="5" stroke="currentColor" stroke-width="1.5" fill="none"/>`;
      }
      return `<button class="pr-theme-btn${isActive}" data-theme-value="${safeId}" title="${safeName}"><svg class="pr-theme-icon" viewBox="0 0 16 16" fill="none">${svgContent}</svg></button>`;
    }).join('');

    return autoBtn + themeButtons;
  }

  public static renderProfileReportShell(
    companies: ICompanyEntry[],
    config: IProfileReportDisplayConfig,
    availableThemes?: IProfileReportTheme[]
  ): IRenderResult {
    if (companies.length === 0) {
      return this.renderProfileReportEmpty(config.libraryName);
    }

    const reportId = `profile-report-${Date.now()}`;
    const totalCount = companies.length;
    const displayMode = 'fullScreen'; // Always fullScreen for the new app layout

    // Build inline display mode styles
    const displayStyle = 'position:fixed!important;top:0!important;left:0!important;right:0!important;bottom:0!important;z-index:999999!important;margin:0!important;border-radius:0!important;border:none!important;overflow:hidden!important;';

    const totalLabel = totalCount >= 1000 ? `${(totalCount / 1000).toFixed(1)}K` : `${totalCount}`;

    // Close button
    const closeBtnHtml = `<button class="pr-display-close" title="Close">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>`;

    // Collect unique filter values from companies for dropdowns
    const owners = [...new Set(companies.map(c => c.accountOwner).filter(Boolean))].sort() as string[];
    const regions = [...new Set(companies.map(c => c.ownerRegion).filter(Boolean))].sort() as string[];
    const industries = [...new Set(companies.map(c => c.industry).filter(Boolean))].sort() as string[];
    const sectors = [...new Set(companies.map(c => c.sector).filter(Boolean))].sort() as string[];

    const buildOptions = (values: string[]): string =>
      values.map(v => `<option value="${this.encodeHtml(v)}">${this.encodeHtml(v)}</option>`).join('');

    // Sort options
    const sortHtml = `<select class="pr-sort-control" data-sort="true">
      <option value="name">Sort: A-Z</option>
      <option value="date">Sort: Newest</option>
      <option value="key">Sort: Domain</option>
    </select>`;

    // Filter bar with horizontal dropdowns
    const filterBarHtml = `<div class="pr-explorer-filterbar">
      ${owners.length > 0 ? `<select class="pr-filter-select" data-filter="accountOwner"><option value="">All Owners (${owners.length})</option>${buildOptions(owners)}</select>` : ''}
      ${regions.length > 0 ? `<select class="pr-filter-select" data-filter="ownerRegion"><option value="">All Regions (${regions.length})</option>${buildOptions(regions)}</select>` : ''}
      ${industries.length > 0 ? `<select class="pr-filter-select" data-filter="industry"><option value="">All Industries (${industries.length})</option>${buildOptions(industries)}</select>` : ''}
      ${sectors.length > 0 ? `<select class="pr-filter-select" data-filter="sector"><option value="">All Sectors (${sectors.length})</option>${buildOptions(sectors)}</select>` : ''}
      <div class="pr-filter-chips"></div>
      ${sortHtml}
    </div>`;

    // Render initial batch of cards (50)
    const initialCards = companies.slice(0, 200).map((entry, index) =>
      this.renderCompanyCard(entry, index)
    ).join('');

    const html = `
      <div class="picanvas-profilereport" id="${reportId}" data-theme="${config.theme}" data-layout="${config.layout}" data-display-mode="${displayMode}" data-view="explorer" data-total-companies="${totalCount}" style="${displayStyle}">
        <div class="pr-explorer-view">
          <div class="pr-explorer-topbar">
            <span class="pr-app-title">Company Profiles</span>
            <div class="pr-search-wrapper">
              <input type="text" class="pr-explorer-search" placeholder="Search ${totalLabel} companies..." autocomplete="off" />
              <button class="pr-search-clear" style="display:none" title="Clear search">&times;</button>
            </div>
            <span class="pr-explorer-count">${totalLabel} companies</span>
            <div class="pr-theme-toggle" title="Switch theme">
              ${this.renderThemeToggle(availableThemes || BUILTIN_THEMES, config.theme)}
            </div>
            ${closeBtnHtml}
          </div>
          ${filterBarHtml}
          <div class="pr-explorer-grid">
            ${initialCards}
            <div class="pr-grid-sentinel"></div>
            <div class="pr-no-results" style="display:none">
              <div class="pr-no-results-icon">&#128269;</div>
              <div class="pr-no-results-text">No companies match your search</div>
              <div class="pr-no-results-hint">Try adjusting your search or filters</div>
            </div>
          </div>
        </div>
        <div class="pr-detail-view">
          <div class="pr-detail-header"></div>
          <div class="pr-detail-body"></div>
        </div>
      </div>
    `;

    return {
      html,
      requiresPostRender: true,
      postRenderType: 'profilereport'
    };
  }

  /**
   * Render a single company panel with method tabs (called after lazy load).
   * Returns inner HTML to be injected into the .pr-detail-body element.
   * The company header is rendered separately via renderDetailHeader().
   * Each tab shows a file-type flag badge so users can see what content type is loaded.
   */
  public static renderCompanyPanel(
    profile: ICompanyProfile,
    config: IProfileReportDisplayConfig
  ): string {
    // Build metrics cards if available
    const metricsHtml = profile.metrics ? `
      <div class="metrics-grid">
        <div class="metric-card"><span class="metric-label">Events</span><span class="metric-value">${profile.metrics.events ?? 0}</span></div>
        <div class="metric-card"><span class="metric-label">Entities</span><span class="metric-value">${profile.metrics.entities ?? 0}</span></div>
        <div class="metric-card"><span class="metric-label">Relationships</span><span class="metric-value">${profile.metrics.relationships ?? 0}</span></div>
        <div class="metric-card"><span class="metric-label">Financials</span><span class="metric-value">${profile.metrics.financials ?? 0}</span></div>
        <div class="metric-card"><span class="metric-label">Earnings</span><span class="metric-value">${profile.metrics.earnings ?? 0}</span></div>
      </div>
    ` : '';

    // Build method tabs based on config and available content
    // Each tab gets a file-type flag for visual identification
    const intel = profile.companyIntel;
    const methodTabs: Array<{ key: string; label: string; flag: string; content: string | undefined; show: boolean }> = [
      { key: 'overview', label: 'Overview', flag: 'SUM', content: this.generateOverviewContent(profile), show: true },
      { key: 'financials', label: 'Financials', flag: 'FIN', content: intel ? this.renderFinancialsSection(intel.financials) : undefined, show: !!intel && intel.financials.length > 0 },
      { key: 'landscape', label: 'Landscape', flag: 'REL', content: intel ? this.renderCompetitiveLandscape(intel.competitors, intel.customers, intel.partners) : undefined, show: !!intel && (intel.competitors.length > 0 || intel.customers.length > 0 || intel.partners.length > 0) },
      { key: 'activity', label: 'Activity', flag: 'EVT', content: intel ? this.renderActivityTimeline(intel.recentActivity) : undefined, show: !!intel && intel.recentActivity.length > 0 },
      { key: 'earnings', label: 'Earnings', flag: 'ERN', content: intel ? this.renderEarningsSection(intel.earnings) : undefined, show: !!intel && intel.earnings.length > 0 },
      { key: 'executiveBrief', label: 'Executive Brief', flag: 'MD', content: profile.executiveBrief, show: config.showExecutiveBrief && !!profile.executiveBrief },
      { key: 'competitiveLandscape', label: 'Competitive Landscape', flag: 'MD', content: profile.competitiveLandscape, show: config.showCompetitiveLandscape && !!profile.competitiveLandscape },
      { key: 'investorMemo', label: 'Investor Memo', flag: 'MD', content: profile.investorMemo, show: config.showInvestorMemo && !!profile.investorMemo },
      { key: 'fullDossierNarrative', label: 'Full Dossier', flag: 'MD', content: profile.fullDossierNarrative, show: config.showFullDossier && !!profile.fullDossierNarrative },
      { key: 'growthPropensity', label: 'Growth Propensity', flag: 'MD', content: profile.growthPropensity, show: config.showGrowthPropensity && !!profile.growthPropensity },
      { key: 'teRelevance', label: 'T&E Relevance', flag: 'MD', content: profile.teRelevance, show: config.showTeRelevance && !!profile.teRelevance },
      { key: 'aiSynthesis', label: 'AI Synthesis', flag: 'MD', content: profile.aiSynthesis, show: config.showAiSynthesis && !!profile.aiSynthesis },
      { key: 'methodK', label: 'Method-K', flag: 'MD', content: profile.methodK, show: config.showMethodK },
      { key: 'methodL', label: 'Method-L', flag: 'MD', content: profile.methodL, show: config.showMethodL },
      { key: 'methodM', label: 'Method-M', flag: 'HTML', content: profile.methodM, show: config.showMethodM },
      { key: 'profileJson', label: 'Profile JSON', flag: 'JSON', content: this.safeJsonStringify(profile.profileJson), show: config.showProfileJson && !!profile.profileJson }
    ].filter(tab => tab.show && (tab.key === 'overview' || tab.content));

    // Add metadata file tabs grouped by category — each gets a flag based on file types in the category
    const metadataFiles = profile.metadataFiles || [];
    const categories = [...new Set(metadataFiles.map(f => f.category))].sort();
    for (const cat of categories) {
      const catFiles = metadataFiles.filter(f => f.category === cat);
      const catKey = `metadata-${cat.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`;
      // Determine flag from most common file extension in category
      const exts = catFiles.map(f => f.name.split('.').pop()?.toUpperCase() || 'FILE');
      const flag = exts[0] || 'FILE';
      methodTabs.push({
        key: catKey,
        label: cat,
        flag: `${flag} x${catFiles.length}`,
        content: this.renderMetadataFilesPanel(catFiles),
        show: true
      });
    }

    const methodTabsHtml = methodTabs.map((tab, index) => {
      const isActive = index === 0 ? 'active' : '';
      const encodedMethodKey = this.encodeHtml(tab.key);
      const isMetadata = tab.key.startsWith('metadata-');
      const badgeClass = isMetadata ? ' method-tab-metadata' : '';
      const flagHtml = `<span class="method-tab-flag">${this.encodeHtml(tab.flag)}</span>`;
      return `<button class="method-tab ${isActive}${badgeClass}" data-method-key="${encodedMethodKey}">${flagHtml}${this.encodeHtml(tab.label)}</button>`;
    }).join('');

    // Intel tab keys that return pre-rendered HTML (like overview)
    const intelTabKeys = new Set(['overview', 'financials', 'landscape', 'activity', 'earnings']);

    const methodPanelsHtml = methodTabs.map((tab, index) => {
      const isActive = index === 0 ? 'active' : '';
      const encodedMethodKey = this.encodeHtml(tab.key);
      let contentHtml: string;
      if (tab.key.startsWith('metadata-')) {
        contentHtml = tab.content || '';
      } else if (tab.key === 'profileJson') {
        contentHtml = `<pre class="json-viewer">${this.encodeHtml(tab.content || '')}</pre>`;
      } else if (intelTabKeys.has(tab.key)) {
        contentHtml = tab.content || '';
      } else if (tab.flag === 'HTML') {
        // Render full HTML documents in a sandboxed iframe to preserve scripts, styles, and interactivity
        const srcdocValue = (tab.content || '<p>No content available.</p>')
          .replace(/&/g, '&amp;')
          .replace(/"/g, '&quot;');
        contentHtml = `<iframe class="method-html-frame" srcdoc="${srcdocValue}" sandbox="allow-scripts allow-same-origin" frameborder="0" scrolling="no" style="width:100%;border:none;min-height:400px;"></iframe>`;
      } else {
        contentHtml = `<div class="markdown">${this.renderMarkdown(tab.content || '## No Content\n\nThis method has no content available.').html}</div>`;
      }

      return `<div class="method-panel ${isActive}" data-method-key="${encodedMethodKey}">${contentHtml}</div>`;
    }).join('');

    return `
      ${metricsHtml}
      <div class="method-tabs-container">
        <div class="method-tabs">${methodTabsHtml}</div>
        <div class="method-panels">${methodPanelsHtml}</div>
      </div>
    `;
  }

  /**
   * Public HTML encoder for use by webpart callers
   */
  public static encodeHtmlPublic(str: string): string {
    return this.encodeHtml(str);
  }

  /**
   * Safely stringify JSON, handling circular references and errors
   */
  private static safeJsonStringify(obj: any): string | undefined {
    if (!obj) return undefined;
    try {
      return JSON.stringify(obj, null, 2);
    } catch (error) {
      console.warn('ContentRenderer: Failed to stringify JSON', error);
      return '{\n  "error": "Unable to display JSON (circular reference or invalid structure)"\n}';
    }
  }

  /**
   * Generate overview content for a company profile.
   * Uses company intel data when available, otherwise builds from SP list fields.
   */
  private static generateOverviewContent(profile: ICompanyProfile): string {
    // If intel data is available, render the enriched overview
    if (profile.companyIntel) {
      return this.renderIntelOverview(profile.companyIntel, profile);
    }

    // Build rich overview from SP list fields
    const e = this.encodeHtml.bind(this);
    const siteUrl = 'https://sap.sharepoint.com/sites/213105';

    // Company header with logo
    const logoHtml = profile.logoUrl
      ? `<img src="${e(profile.logoUrl)}" alt="" class="overview-logo" style="width:48px;height:48px;border-radius:8px;object-fit:contain;background:#f5f5f5;margin-right:16px;" onerror="this.style.display='none'" />`
      : '';
    const legalHtml = profile.legalName && profile.legalName !== profile.companyName
      ? `<div class="overview-legal" style="font-size:12px;color:#666;margin-top:2px;">${e(profile.legalName)}</div>`
      : '';
    const statusBadge = profile.status
      ? `<span class="overview-status-badge" style="display:inline-block;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:600;background:${profile.status === 'Active' ? '#e6f4ea' : '#fce8e6'};color:${profile.status === 'Active' ? '#137333' : '#c5221f'};">${e(profile.status)}</span>`
      : '';

    const headerHtml = `
      <div class="overview-header" style="display:flex;align-items:center;margin-bottom:20px;">
        ${logoHtml}
        <div>
          <div style="display:flex;align-items:center;gap:10px;">
            <h3 style="margin:0;font-size:20px;">${e(profile.companyName)}</h3>
            ${statusBadge}
          </div>
          ${legalHtml}
          <div style="font-size:13px;color:#5f6368;margin-top:4px;">
            <a href="https://${e(profile.domain)}" target="_blank" rel="noopener" style="color:#1a73e8;text-decoration:none;">${e(profile.domain)}</a>
            ${profile.ticker ? ` · <strong>${e(profile.ticker)}</strong>` : ''}
          </div>
        </div>
      </div>`;

    // Description
    const descHtml = profile.companyDescription
      ? `<div class="overview-description" style="margin-bottom:16px;line-height:1.6;color:#3c4043;">${e(profile.companyDescription)}</div>`
      : (profile.executiveSummary
        ? `<div class="overview-description" style="margin-bottom:16px;line-height:1.6;color:#3c4043;">${e(profile.executiveSummary)}</div>`
        : '');

    // Info grid
    const infoItems: string[] = [];
    const addInfo = (label: string, value: string | undefined): void => {
      if (value) infoItems.push(`<div style="padding:8px 0;border-bottom:1px solid #e8eaed;"><span style="font-weight:500;color:#5f6368;min-width:120px;display:inline-block;">${label}</span><span style="color:#202124;">${e(value)}</span></div>`);
    };
    addInfo('Industry', profile.industry);
    addInfo('Sub-Industry', profile.subIndustry);
    addInfo('Sector', profile.sector);
    addInfo('Headquarters', profile.headquarters);
    addInfo('Founded', profile.founded);
    addInfo('Revenue', profile.revenue);
    addInfo('Employees', profile.employees);
    addInfo('Account Owner', profile.accountOwner);
    addInfo('Region', profile.ownerRegion);

    const infoHtml = infoItems.length > 0
      ? `<div class="overview-info" style="margin-bottom:20px;">${infoItems.join('')}</div>`
      : '';

    // Executives
    const execsHtml = profile.executives ? (() => {
      const execs = profile.executives.split(';').map(s => s.trim()).filter(Boolean).slice(0, 8);
      if (execs.length === 0) return '';
      const cards = execs.map(ex => {
        const parts = ex.split(' — ');
        const name = parts[0] || ex;
        const title = parts[1] || '';
        return `<div style="padding:8px 12px;background:#f8f9fa;border-radius:6px;"><div style="font-weight:500;font-size:13px;">${e(name)}</div>${title ? `<div style="font-size:12px;color:#5f6368;">${e(title)}</div>` : ''}</div>`;
      }).join('');
      return `<div style="margin-bottom:16px;"><h4 style="font-size:14px;color:#202124;margin:0 0 8px;">Leadership</h4><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px;">${cards}</div></div>`;
    })() : '';

    // Competitors, Products, Customers as tag clouds
    const renderTags = (label: string, data: string | undefined, color: string): string => {
      if (!data) return '';
      const items = data.split(';').map(s => s.trim()).filter(Boolean).slice(0, 12);
      if (items.length === 0) return '';
      const tags = items.map(item =>
        `<span style="display:inline-block;padding:4px 10px;margin:3px;border-radius:14px;font-size:12px;background:${color};white-space:nowrap;">${e(item)}</span>`
      ).join('');
      return `<div style="margin-bottom:14px;"><h4 style="font-size:14px;color:#202124;margin:0 0 6px;">${label}</h4><div style="display:flex;flex-wrap:wrap;">${tags}</div></div>`;
    };

    const competitorsHtml = renderTags('Competitors', profile.competitors, '#fce8e6');
    const productsHtml = renderTags('Products & Services', profile.products, '#e8f0fe');
    const customersHtml = renderTags('Customers', profile.customers, '#e6f4ea');

    // SharePoint list item link
    const listLinkHtml = profile.spListItemId
      ? `<div style="margin-top:16px;padding-top:12px;border-top:1px solid #e8eaed;"><a href="${siteUrl}/Lists/Pi_Companies/DispForm.aspx?ID=${profile.spListItemId}" target="_blank" rel="noopener" style="color:#1a73e8;text-decoration:none;font-size:13px;">View in SharePoint List →</a></div>`
      : '';

    // Content inventory
    const available: string[] = [];
    if (profile.executiveBrief) available.push('Executive Brief');
    if (profile.competitiveLandscape) available.push('Competitive Landscape');
    if (profile.investorMemo) available.push('Investor Memo');
    if (profile.fullDossierNarrative) available.push('Full Dossier');
    if (profile.growthPropensity) available.push('Growth Propensity');
    if (profile.teRelevance) available.push('T&E Relevance');
    if (profile.aiSynthesis) available.push('AI Synthesis');
    if (profile.methodK) available.push('Method-K');
    if (profile.methodM) available.push('Method-M');
    if (profile.profileJson) available.push('Profile JSON');

    const inventoryHtml = available.length > 0
      ? `<div style="margin-top:14px;"><h4 style="font-size:14px;color:#202124;margin:0 0 6px;">Available Reports (${available.length})</h4><div style="display:flex;flex-wrap:wrap;">${available.map(r => `<span style="display:inline-block;padding:4px 10px;margin:3px;border-radius:14px;font-size:12px;background:#f3e8fd;">${e(r)}</span>`).join('')}</div></div>`
      : '';

    return `
      <div class="overview-content" style="max-width:800px;">
        ${headerHtml}
        ${descHtml}
        ${infoHtml}
        ${execsHtml}
        ${competitorsHtml}
        ${productsHtml}
        ${customersHtml}
        ${inventoryHtml}
        ${listLinkHtml}
      </div>
    `;
  }

  /**
   * Render metadata-discovered files as a file list panel
   */
  private static renderMetadataFilesPanel(files: IMetadataFileEntry[]): string {
    if (files.length === 0) return '<p class="pr-metadata-empty">No files found in this category.</p>';

    const fileItems = files.map(f => {
      const encodedName = this.encodeHtml(f.name);
      const encodedUrl = this.encodeHtml(f.url);
      const encodedTitle = this.encodeHtml(f.title || f.name);
      const ext = f.name.split('.').pop()?.toLowerCase() || '';
      return `<div class="pr-metadata-file-item" data-file-url="${encodedUrl}" data-file-ext="${ext}">
        <div class="pr-metadata-file-info">
          <span class="pr-metadata-file-ext">${this.encodeHtml(ext.toUpperCase())}</span>
          <span class="pr-metadata-file-name" title="${encodedTitle}">${encodedName}</span>
          ${f.modified ? `<span class="pr-metadata-file-date">${this.encodeHtml(f.modified)}</span>` : ''}
        </div>
        <button class="pr-metadata-file-load" data-file-url="${encodedUrl}" data-file-ext="${ext}">View</button>
      </div>`;
    }).join('');

    return `
      <div class="pr-metadata-files">
        ${fileItems}
      </div>
      <div class="pr-metadata-file-viewer"></div>
    `;
  }
}

