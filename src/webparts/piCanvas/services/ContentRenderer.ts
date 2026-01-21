/**
 * ContentRenderer Service
 * Renders custom content types: Markdown, HTML, Mermaid diagrams, Embeds, and RSS feeds
 * Includes security sanitization for all content types
 */

import { marked } from 'marked';
import mermaid from 'mermaid';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const DOMPurify = require('dompurify');

// Content type definitions
export type ContentType = 'webpart' | 'section' | 'markdown' | 'html' | 'mermaid' | 'embed' | 'rss' | 'landing' | 'file';

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
  postRenderType?: 'mermaid' | 'rss' | 'landing';
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

  // ========== Landing Page Rendering ==========

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

  // Default landing nodes
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
   * Render animated landing page
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
}
