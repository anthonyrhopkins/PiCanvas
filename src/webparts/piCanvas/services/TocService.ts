/**
 * TocService - Table of Contents Service
 * Scans SharePoint page or DOM elements for headings and generates navigable TOC HTML.
 */

export interface ITocConfig {
  searchText?: boolean;       // Scan Text WebParts (.cke_editable, .ck-content)
  searchMarkdown?: boolean;   // Scan Markdown WebParts
  searchCollapsible?: boolean; // Scan Collapsible Sections
  showH2?: boolean;
  showH3?: boolean;
  showH4?: boolean;
  showH5?: boolean;
  listStyle?: 'disc' | 'decimal' | 'none' | 'roman' | 'alpha' | 'dash' | 'arrow' | 'custom-icon';
  stickyMode?: boolean;
  hideInMobile?: boolean;
  hideTitle?: boolean;
  titleText?: string;
  showBackLink?: boolean;
  backLinkText?: string;

  // Style preset
  stylePreset?: string;

  // Typography
  fontFamily?: string;
  baseFontSize?: number;       // 12-24
  titleFontSize?: number;      // 14-32
  levelSizeStep?: number;      // 0-4
  titleFontWeight?: string;
  h2FontWeight?: string;
  subHeadingFontWeight?: string;
  lineHeight?: number;         // 1.2-2.2
  letterSpacing?: number;      // 0-2

  // Colors
  linkColor?: string;
  linkHoverColor?: string;
  activeColor?: string;
  titleColor?: string;
  levelColorDimming?: number;  // 0-30%
  backgroundColor?: string;
  borderColor?: string;

  // Spacing
  containerPadding?: number;   // 0-40
  itemSpacing?: number;        // 0-16
  indentPerLevel?: number;     // 0-40
  maxWidth?: string;

  // Custom icon
  customIcon?: string;

  // Interactions
  enableScrollspy?: boolean;
  enableCollapsible?: boolean;
  enableHoverBackground?: boolean;
  hoverBackgroundColor?: string;
  enableClickRipple?: boolean;
}

export interface ITocHeading {
  level: number;       // 2-5
  text: string;
  id: string;
  element?: HTMLElement;
}

export interface ITocTreeNode {
  heading: ITocHeading;
  children: ITocTreeNode[];
}

export class TocService {

  /**
   * Default configuration
   */
  public static readonly DEFAULT_CONFIG: ITocConfig = {
    searchText: true,
    searchMarkdown: true,
    searchCollapsible: false,
    showH2: true,
    showH3: true,
    showH4: false,
    showH5: false,
    listStyle: 'disc',
    stickyMode: false,
    hideInMobile: false,
    hideTitle: false,
    titleText: 'Table of Contents',
    showBackLink: false,
    backLinkText: '',
    stylePreset: '',
    fontFamily: '',
    baseFontSize: 14,
    titleFontSize: 16,
    levelSizeStep: 1,
    titleFontWeight: '600',
    h2FontWeight: '600',
    subHeadingFontWeight: '400',
    lineHeight: 1.6,
    letterSpacing: 0,
    linkColor: '',
    linkHoverColor: '',
    activeColor: '',
    titleColor: '',
    levelColorDimming: 10,
    backgroundColor: '',
    borderColor: '',
    containerPadding: 16,
    itemSpacing: 4,
    indentPerLevel: 20,
    maxWidth: '',
    customIcon: '',
    enableScrollspy: false,
    enableCollapsible: false,
    enableHoverBackground: false,
    hoverBackgroundColor: '',
    enableClickRipple: false
  };

  /**
   * Build CSS custom properties string from config.
   * Applied as inline style on .picanvas-toc-container.
   */
  public static buildCssVariables(config: ITocConfig): string {
    const vars: string[] = [];

    // Font family: replace double quotes with single quotes to be safe inside style="..."
    if (config.fontFamily) vars.push(`--toc-font-family: ${config.fontFamily.replace(/"/g, "'")}`);
    if (config.baseFontSize !== undefined) vars.push(`--toc-base-font-size: ${config.baseFontSize}px`);
    if (config.titleFontSize !== undefined) vars.push(`--toc-title-font-size: ${config.titleFontSize}px`);
    if (config.titleFontWeight) vars.push(`--toc-title-font-weight: ${config.titleFontWeight}`);
    if (config.h2FontWeight) vars.push(`--toc-h2-font-weight: ${config.h2FontWeight}`);
    if (config.subHeadingFontWeight) vars.push(`--toc-sub-font-weight: ${config.subHeadingFontWeight}`);
    if (config.lineHeight !== undefined) vars.push(`--toc-line-height: ${config.lineHeight}`);
    if (config.letterSpacing !== undefined) vars.push(`--toc-letter-spacing: ${config.letterSpacing}px`);

    if (config.linkColor) vars.push(`--toc-link-color: ${config.linkColor}`);
    if (config.linkHoverColor) vars.push(`--toc-link-hover-color: ${config.linkHoverColor}`);
    if (config.activeColor) vars.push(`--toc-active-color: ${config.activeColor}`);
    if (config.titleColor) vars.push(`--toc-title-color: ${config.titleColor}`);
    if (config.backgroundColor) vars.push(`--toc-bg-color: ${config.backgroundColor}`);
    if (config.borderColor) vars.push(`--toc-border-color: ${config.borderColor}`);

    if (config.containerPadding !== undefined) vars.push(`--toc-container-padding: ${config.containerPadding}px`);
    if (config.itemSpacing !== undefined) vars.push(`--toc-item-spacing: ${config.itemSpacing}px`);
    if (config.indentPerLevel !== undefined) vars.push(`--toc-indent: ${config.indentPerLevel}px`);
    if (config.maxWidth) vars.push(`--toc-max-width: ${config.maxWidth}`);

    if (config.enableHoverBackground && config.hoverBackgroundColor) {
      vars.push(`--toc-hover-bg: ${config.hoverBackgroundColor}`);
    }

    // Level-specific font sizes computed from baseFontSize and levelSizeStep
    const base = config.baseFontSize ?? 14;
    const step = config.levelSizeStep ?? 0;
    vars.push(`--toc-level-2-size: ${base}px`);
    vars.push(`--toc-level-3-size: ${Math.max(base - step, 10)}px`);
    vars.push(`--toc-level-4-size: ${Math.max(base - step * 2, 10)}px`);
    vars.push(`--toc-level-5-size: ${Math.max(base - step * 3, 10)}px`);

    // Level color dimming (reduce opacity for deeper levels)
    const dimming = config.levelColorDimming ?? 0;
    if (dimming > 0) {
      vars.push(`--toc-level-4-opacity: ${Math.max(1 - (dimming * 2) / 100, 0.4)}`);
      vars.push(`--toc-level-5-opacity: ${Math.max(1 - (dimming * 3) / 100, 0.3)}`);
    }

    return vars.join('; ');
  }

  /**
   * Scan the SharePoint page canvas for headings based on config
   */
  public static scanPageHeadings(config: ITocConfig): ITocHeading[] {
    const headings: ITocHeading[] = [];
    const pageCanvas = document.querySelector('#spPageCanvasContent');
    if (!pageCanvas) return headings;

    const maxLevel = this.getMaxLevel(config);

    // Build selector for target containers
    const containers: Element[] = [];

    if (config.searchText !== false) {
      // Text WebParts - CKEditor (classic) and CK5 (modern)
      const textWPs = pageCanvas.querySelectorAll('.cke_editable, .ck-content');
      textWPs.forEach(el => containers.push(el));
    }

    if (config.searchMarkdown !== false) {
      // Markdown WebParts
      const markdownWPs = pageCanvas.querySelectorAll('[data-sp-feature-tag*="Markdown"]');
      markdownWPs.forEach(el => containers.push(el));
    }

    if (config.searchCollapsible) {
      // Collapsible sections - look for section headers
      const collapsibleHeaders = pageCanvas.querySelectorAll(
        '.ms-CollapsibleSection, [data-automation-id="CollapsibleSection"]'
      );
      collapsibleHeaders.forEach(el => containers.push(el));
    }

    // If no specific containers found, fall back to scanning entire canvas
    if (containers.length === 0 && (config.searchText !== false || config.searchMarkdown !== false)) {
      containers.push(pageCanvas);
    }

    // Scan each container for headings
    containers.forEach(container => {
      this.collectHeadingsFromElement(container as HTMLElement, maxLevel, headings);
    });

    // Ensure all headings have IDs
    this.ensureHeadingIds(headings);

    return headings;
  }

  /**
   * Scan a DOM element for headings (used for within-tab TOC)
   */
  public static scanElementHeadings(element: HTMLElement, maxLevel: number = 4): ITocHeading[] {
    const headings: ITocHeading[] = [];
    this.collectHeadingsFromElement(element, maxLevel, headings);
    this.ensureHeadingIds(headings);
    return headings;
  }

  /**
   * Build hierarchical tree from flat heading list
   * H2 nodes contain H3 children, H3 nodes contain H4 children, etc.
   */
  public static buildHeadingTree(headings: ITocHeading[]): ITocTreeNode[] {
    const tree: ITocTreeNode[] = [];
    const stack: ITocTreeNode[] = [];

    for (const heading of headings) {
      const node: ITocTreeNode = { heading, children: [] };

      // Pop items from stack that are at same or deeper level
      while (stack.length > 0 && stack[stack.length - 1].heading.level >= heading.level) {
        stack.pop();
      }

      if (stack.length === 0) {
        // Top-level node
        tree.push(node);
      } else {
        // Child of current parent
        stack[stack.length - 1].children.push(node);
      }

      stack.push(node);
    }

    return tree;
  }

  /**
   * Ensure all headings have unique IDs for anchor linking
   */
  public static ensureHeadingIds(headings: ITocHeading[]): void {
    const usedIds = new Set<string>();

    for (const heading of headings) {
      if (heading.element) {
        let id = heading.element.id;
        if (!id) {
          id = this.slugify(heading.text);
          // Ensure uniqueness
          let uniqueId = id;
          let counter = 1;
          while (usedIds.has(uniqueId)) {
            uniqueId = `${id}-${counter}`;
            counter++;
          }
          heading.element.id = uniqueId;
          heading.id = uniqueId;
        } else {
          heading.id = id;
        }
        usedIds.add(heading.id);
      } else {
        // No element ref - generate a slug anyway
        const id = this.slugify(heading.text);
        let uniqueId = id;
        let counter = 1;
        while (usedIds.has(uniqueId)) {
          uniqueId = `${id}-${counter}`;
          counter++;
        }
        heading.id = uniqueId;
        usedIds.add(heading.id);
      }
    }
  }

  /**
   * Render TOC HTML from tree structure (page-level TOC)
   */
  public static renderToc(tree: ITocTreeNode[], config: ITocConfig): string {
    if (tree.length === 0) {
      return '<div class="picanvas-toc-empty">No headings found on this page.</div>';
    }

    const stickyClass = config.stickyMode ? ' picanvas-toc-sticky' : '';
    const mobileClass = config.hideInMobile ? ' picanvas-toc-hide-mobile' : '';
    const listStyleClass = this.getListStyleClass(config.listStyle || 'disc');
    const sidebarClass = config.stylePreset === 'sidebar' ? ' picanvas-toc-preset-sidebar' : '';
    const hoverBgClass = config.enableHoverBackground ? ' picanvas-toc-hover-bg' : '';
    const collapsibleClass = config.enableCollapsible ? ' picanvas-toc-collapsible' : '';

    const cssVars = this.buildCssVariables(config);
    const styleAttr = cssVars ? ` style="${cssVars}"` : '';

    let html = `<div class="picanvas-toc-container${stickyClass}${mobileClass}${sidebarClass}${hoverBgClass}${collapsibleClass}"${styleAttr}>`;

    // Title
    if (!config.hideTitle) {
      const title = config.titleText || 'Table of Contents';
      html += `<div class="picanvas-toc-title">${this.encodeHtml(title)}</div>`;
    }

    // Back link
    if (config.showBackLink && config.backLinkText) {
      html += `<a href="javascript:history.back()" class="picanvas-toc-back-link">&larr; ${this.encodeHtml(config.backLinkText)}</a>`;
    }

    // Render nested list
    html += this.renderTocList(tree, listStyleClass, config);

    html += '</div>';
    return html;
  }

  /**
   * Render compact inline TOC for within-tab use
   */
  public static renderInlineToc(tree: ITocTreeNode[]): string {
    if (tree.length === 0) return '';

    let html = '<div class="picanvas-inline-toc-wrapper">';
    html += '<div class="picanvas-toc-title">Contents</div>';
    html += this.renderTocList(tree, 'picanvas-toc-list-disc', {} as ITocConfig);
    html += '</div>';
    return html;
  }

  /**
   * Attach click handlers for smooth scrolling to page headings
   */
  public static attachScrollHandlers(container: HTMLElement): void {
    const links = container.querySelectorAll('.picanvas-toc-link');
    links.forEach(link => {
      link.addEventListener('click', (e: Event) => {
        e.preventDefault();
        const href = (link as HTMLAnchorElement).getAttribute('href');
        if (!href) return;
        const targetId = href.substring(1); // Remove #
        const target = document.getElementById(targetId);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          // Update URL hash without scrolling
          history.pushState(null, '', href);
        }
      });
    });
  }

  /**
   * Attach click handlers for smooth scrolling within a tab content area
   */
  public static attachInlineScrollHandlers(container: HTMLElement, scrollParent: HTMLElement): void {
    const links = container.querySelectorAll('.picanvas-toc-link');
    links.forEach(link => {
      link.addEventListener('click', (e: Event) => {
        e.preventDefault();
        const href = (link as HTMLAnchorElement).getAttribute('href');
        if (!href) return;
        const targetId = href.substring(1);
        const target = scrollParent.querySelector(`#${CSS.escape(targetId)}`);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });
  }

  /**
   * Attach scrollspy using IntersectionObserver.
   * Highlights the active link as the user scrolls through headings.
   * Returns a cleanup function to disconnect the observer.
   */
  public static attachScrollspy(container: HTMLElement): (() => void) | null {
    const links = container.querySelectorAll('.picanvas-toc-link');
    if (links.length === 0) return null;

    // Build map of heading id -> link element
    const linkMap = new Map<string, Element>();
    links.forEach(link => {
      const href = (link as HTMLAnchorElement).getAttribute('href');
      if (href && href.startsWith('#')) {
        linkMap.set(href.substring(1), link);
      }
    });

    if (linkMap.size === 0) return null;

    // Gather heading elements
    const headingElements: Element[] = [];
    linkMap.forEach((_link, id) => {
      const el = document.getElementById(id);
      if (el) headingElements.push(el);
    });

    if (headingElements.length === 0) return null;

    let currentActive: Element | null = null;

    const observer = new IntersectionObserver(
      (entries) => {
        // Find the topmost visible heading
        let topEntry: IntersectionObserverEntry | null = null;
        for (const entry of entries) {
          if (entry.isIntersecting) {
            if (!topEntry || entry.boundingClientRect.top < topEntry.boundingClientRect.top) {
              topEntry = entry;
            }
          }
        }

        if (topEntry) {
          const id = topEntry.target.id;
          const link = linkMap.get(id);
          if (link && link !== currentActive) {
            if (currentActive) currentActive.classList.remove('active');
            link.classList.add('active');
            currentActive = link;
          }
        }
      },
      {
        rootMargin: '-10% 0px -80% 0px',
        threshold: 0
      }
    );

    headingElements.forEach(el => observer.observe(el));

    return () => {
      observer.disconnect();
      if (currentActive) currentActive.classList.remove('active');
    };
  }

  /**
   * Attach collapsible toggle handlers.
   * Toggle buttons expand/collapse sub-lists via [data-toc-toggle] buttons.
   */
  public static attachCollapsibleHandlers(container: HTMLElement): void {
    const toggleButtons = container.querySelectorAll('[data-toc-toggle]');
    toggleButtons.forEach(btn => {
      btn.addEventListener('click', (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        const item = (btn as HTMLElement).closest('.picanvas-toc-item');
        if (item) {
          item.classList.toggle('collapsed');
          const isCollapsed = item.classList.contains('collapsed');
          (btn as HTMLElement).setAttribute('aria-expanded', String(!isCollapsed));
        }
      });
    });
  }

  /**
   * Attach click ripple effect on TOC links.
   */
  public static attachClickRipple(container: HTMLElement): void {
    const links = container.querySelectorAll('.picanvas-toc-link');
    links.forEach(link => {
      link.addEventListener('click', () => {
        // Remove existing ripple first to prevent accumulation from rapid clicks
        link.classList.remove('ripple');
        // Force reflow so re-adding the class restarts the animation
        void (link as HTMLElement).offsetWidth;
        link.classList.add('ripple');
        setTimeout(() => link.classList.remove('ripple'), 400);
      });
    });
  }

  // ========== Private Helpers ==========

  /**
   * Get CSS class for list style
   */
  private static getListStyleClass(listStyle: string): string {
    switch (listStyle) {
      case 'decimal': return 'picanvas-toc-list-decimal';
      case 'none': return 'picanvas-toc-list-none';
      case 'roman': return 'picanvas-toc-list-roman';
      case 'alpha': return 'picanvas-toc-list-alpha';
      case 'dash': return 'picanvas-toc-list-dash';
      case 'arrow': return 'picanvas-toc-list-arrow';
      case 'custom-icon': return 'picanvas-toc-list-custom-icon';
      default: return 'picanvas-toc-list-disc';
    }
  }

  /**
   * Collect headings from a DOM element into the headings array
   */
  private static collectHeadingsFromElement(
    element: HTMLElement,
    maxLevel: number,
    headings: ITocHeading[]
  ): void {
    // Build selector for h2-h{maxLevel}
    const selectors: string[] = [];
    for (let i = 2; i <= maxLevel; i++) {
      selectors.push(`h${i}`);
    }
    const selector = selectors.join(', ');

    const elements = element.querySelectorAll(selector);
    elements.forEach(el => {
      const headingEl = el as HTMLElement;

      // Skip filtered headings
      if (this.shouldSkipHeading(headingEl)) return;

      const text = this.getHeadingText(headingEl);
      if (!text) return;

      const level = parseInt(headingEl.tagName.substring(1), 10);

      headings.push({
        level,
        text,
        id: headingEl.id || '',
        element: headingEl
      });
    });
  }

  /**
   * Check if a heading should be skipped
   */
  private static shouldSkipHeading(el: HTMLElement): boolean {
    // Skip headings with data-toc-ignore
    if (el.getAttribute('data-toc-ignore') === 'true') return true;

    // Skip headings inside <aside>
    if (el.closest('aside')) return true;

    // Skip hidden elements
    if (el.offsetParent === null && !el.closest('[style*="position: fixed"]')) return true;

    // Skip empty headings
    const text = this.getHeadingText(el);
    if (!text) return true;

    return false;
  }

  /**
   * Get cleaned heading text (handles edit mode textarea headers)
   */
  private static getHeadingText(el: HTMLElement): string {
    // Handle collapsible section headers that may be textareas in edit mode
    const textarea = el.querySelector('textarea');
    if (textarea) {
      return textarea.value.trim();
    }
    return (el.textContent || '').trim();
  }

  /**
   * Get the maximum heading level based on config toggles
   */
  private static getMaxLevel(config: ITocConfig): number {
    if (config.showH5) return 5;
    if (config.showH4) return 4;
    if (config.showH3 !== false) return 3;
    return 2;
  }

  /**
   * Render nested TOC list HTML
   */
  private static renderTocList(nodes: ITocTreeNode[], listStyleClass: string, config: ITocConfig): string {
    // Custom icon: sanitize for use inside style attribute (replace " with ', strip control chars)
    const customIconAttr = (config.listStyle === 'custom-icon' && config.customIcon)
      ? ` style="--toc-custom-icon: '${config.customIcon.replace(/["\\<>]/g, '').substring(0, 4)}'"` : '';
    let html = `<ul class="picanvas-toc-list ${listStyleClass}"${customIconAttr}>`;
    for (const node of nodes) {
      const hasChildren = node.children.length > 0;
      html += `<li class="picanvas-toc-item picanvas-toc-level-${node.heading.level}">`;

      // Collapsible toggle button (only if collapsible enabled and node has children)
      if (config.enableCollapsible && hasChildren) {
        html += `<button class="picanvas-toc-toggle" data-toc-toggle aria-expanded="true" title="Toggle section">&#9656;</button>`;
      }

      html += `<a href="#${this.encodeHtml(node.heading.id)}" class="picanvas-toc-link" data-toc-target="${this.encodeHtml(node.heading.id)}">${this.encodeHtml(node.heading.text)}</a>`;
      if (hasChildren) {
        html += this.renderTocList(node.children, listStyleClass, config);
      }
      html += '</li>';
    }
    html += '</ul>';
    return html;
  }

  /**
   * Create a URL-friendly slug from text
   */
  private static slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')     // Remove special chars
      .replace(/[\s_]+/g, '-')       // Spaces/underscores to hyphens
      .replace(/-+/g, '-')           // Collapse multiple hyphens
      .replace(/^-+|-+$/g, '')       // Trim hyphens
      || 'heading';
  }

  /**
   * Encode HTML entities
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
}
