/**
 * NavRenderer Service
 * Converts INavNode[] + config into themed, responsive navigation HTML.
 * Follows the ContentRenderer static-service pattern.
 */

import { INavNode } from './NavigationService';
import { IListNavNode } from './ListNavigationService';

export interface INavRenderConfig {
  style: 'horizontal' | 'vertical' | 'dropdown';
  theme: string;
  customCss: string;
  collapsible: boolean;
  fontFamily: string;
  fontSize: string;
  fontWeight: string;
  itemHeight: string;
  alignment: string;
  itemSpacing: string;
  textTransform: string;
}

interface IThemeVars {
  accent: string;
  bg: string;
  text: string;
  border: string;
  submenuBg: string;
  glass: boolean;
}

const THEME_MAP: Record<string, IThemeVars> = {
  auto: { accent: '#0078d4', bg: '#fafafa', text: '#323130', border: '#edebe9', submenuBg: '#ffffff', glass: false },
  sharepoint: { accent: '#0070f2', bg: '#faf9f8', text: '#1a2733', border: '#edebe9', submenuBg: '#ffffff', glass: false },
  'fluent-light': { accent: '#0078d4', bg: '#fafafa', text: '#323130', border: '#edebe9', submenuBg: '#ffffff', glass: false },
  'fluent-dark': { accent: '#4ea8fe', bg: '#1b1b1b', text: '#d2d0ce', border: '#323130', submenuBg: '#252525', glass: false },
  'dark-glass': { accent: '#fbbf24', bg: 'rgba(10,12,20,0.92)', text: 'rgba(255,255,255,0.88)', border: 'rgba(255,255,255,0.08)', submenuBg: 'rgba(15,18,28,0.96)', glass: true },
  'sap-dark': { accent: '#4DB1FF', bg: 'rgba(18,23,28,0.92)', text: 'rgba(255,255,255,0.88)', border: 'rgba(255,255,255,0.08)', submenuBg: 'rgba(29,35,42,0.96)', glass: true },
  minimal: { accent: '#666666', bg: 'transparent', text: '#323130', border: 'transparent', submenuBg: '#ffffff', glass: false }
};

const MAX_DEPTH = 4;

/** HTML-encode a string to prevent XSS. */
function encodeHtml(str: string): string {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

/** Validate a URL — only allow safe protocols. */
function isSafeUrl(url: string): boolean {
  if (!url) return false;
  const trimmed = url.trim().toLowerCase();
  return trimmed.startsWith('http://') || trimmed.startsWith('https://') ||
    trimmed.startsWith('mailto:') || trimmed.startsWith('tel:') || trimmed.startsWith('#');
}

/**
 * Detect if a string starts with an emoji character.
 * Uses string iteration which correctly handles surrogate pairs.
 */
function startsWithEmoji(str: string): boolean {
  if (!str) return false;
  // Get first codepoint
  const cp = str.codePointAt(0);
  if (cp === undefined) return false;
  // Emoji ranges: Miscellaneous Symbols, Dingbats, Emoticons, Transport, Supplemental, Flags, etc.
  return (cp >= 0x1F300 && cp <= 0x1FAFF) || // Misc Symbols & Pictographs through Symbols Extended-A
    (cp >= 0x2600 && cp <= 0x27BF) ||          // Misc Symbols, Dingbats
    (cp >= 0x2700 && cp <= 0x27BF) ||          // Dingbats
    (cp >= 0xFE00 && cp <= 0xFE0F) ||          // Variation Selectors
    (cp >= 0x200D && cp <= 0x200D) ||          // Zero Width Joiner
    (cp >= 0x20E3 && cp <= 0x20E3) ||          // Combining Enclosing Keycap
    (cp >= 0xE0020 && cp <= 0xE007F);          // Tags
}

/**
 * Render an icon value into HTML. Detects format:
 * - Emoji → <span class="picanvas-nav-icon">emoji</span>
 * - URL (contains /) → <img class="picanvas-nav-icon" src="..." />
 * - SVG (starts with <svg) → <span class="picanvas-nav-icon">svg</span>
 * - Text → Fluent UI icon: <i class="picanvas-nav-icon ms-Icon ms-Icon--Name" />
 */
function renderIconHtml(icon: string): string {
  if (!icon) return '';
  const trimmed = icon.trim();
  if (!trimmed) return '';

  // SVG inline
  if (trimmed.toLowerCase().startsWith('<svg')) {
    return `<span class="picanvas-nav-icon picanvas-nav-icon-svg">${trimmed}</span>`;
  }

  // URL (image)
  if (trimmed.includes('/') || trimmed.startsWith('http')) {
    const safeUrl = isSafeUrl(trimmed) ? trimmed : '';
    if (safeUrl) {
      return `<img class="picanvas-nav-icon" src="${encodeHtml(safeUrl)}" alt="" />`;
    }
    return '';
  }

  // Emoji
  if (startsWithEmoji(trimmed)) {
    return `<span class="picanvas-nav-icon picanvas-nav-icon-emoji">${encodeHtml(trimmed)}</span>`;
  }

  // Fluent UI icon name (plain text like "Robot", "Globe")
  return `<i class="picanvas-nav-icon ms-Icon ms-Icon--${encodeHtml(trimmed)}" aria-hidden="true"></i>`;
}

function resolveThemeVars(config: INavRenderConfig): IThemeVars {
  if (config.theme === 'sharepoint') {
    // Try to read from SP theme state
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ts = (window as any).__themeState__?.theme;
    if (ts) {
      return {
        accent: ts.themePrimary || '#0070f2',
        bg: ts.bodyBackground || '#faf9f8',
        text: ts.bodyText || '#1a2733',
        border: ts.neutralLight || '#edebe9',
        submenuBg: ts.bodyBackground || '#ffffff',
        glass: false
      };
    }
  }
  return THEME_MAP[config.theme] || THEME_MAP.auto;
}

export class NavRenderer {

  /**
   * Render navigation nodes into HTML with embedded <style>.
   */
  public static render(nodes: INavNode[], config: INavRenderConfig): { html: string } {
    if (!nodes || nodes.length === 0) {
      return { html: '' };
    }

    const theme = resolveThemeVars(config);
    const styleBlock = NavRenderer._buildStyles(config, theme);
    let bodyHtml: string;

    switch (config.style) {
      case 'vertical':
        bodyHtml = NavRenderer._renderVertical(nodes, config);
        break;
      case 'dropdown':
        bodyHtml = NavRenderer._renderDropdown(nodes, config);
        break;
      default:
        bodyHtml = NavRenderer._renderHorizontal(nodes, config);
        break;
    }

    return {
      html: `<style>${styleBlock}</style><nav class="picanvas-site-nav" data-nav-style="${config.style}">${bodyHtml}</nav>`
    };
  }

  /**
   * Loading skeleton placeholder.
   */
  public static renderLoading(config: INavRenderConfig): string {
    const theme = resolveThemeVars(config);
    const styleBlock = NavRenderer._buildStyles(config, theme);
    const isVertical = config.style === 'vertical';
    const direction = isVertical ? 'flex-direction:column;' : '';
    const bars = Array.from({ length: 6 }, (_, i) => {
      const w = isVertical ? '100%' : `${50 + (i % 3) * 20}px`;
      return `<div class="picanvas-nav-skeleton-bar" style="width:${w};"></div>`;
    }).join('');

    return `<style>${styleBlock}</style><nav class="picanvas-site-nav" data-nav-style="${config.style}"><div class="picanvas-nav-skeleton" style="${direction}">${bars}</div></nav>`;
  }

  /**
   * Post-DOM-insert: bind Priority+ overflow, hamburger, keyboard nav, active page.
   */
  public static initializeNav(container: HTMLElement, siteUrl?: string): void {
    const nav = container.querySelector('.picanvas-site-nav') as HTMLElement;
    if (!nav) return;

    const style = nav.dataset.navStyle || 'horizontal';

    // Mark the active page
    NavRenderer._markActivePage(nav);

    if (style === 'horizontal') {
      NavRenderer._initPriorityPlus(nav);
      NavRenderer._initHamburger(nav);
    }

    // Keyboard navigation
    NavRenderer._initKeyboardNav(nav);

    // Dropdown click toggle (all styles with children)
    NavRenderer._initDropdownToggles(nav);

    // Apply NEW badges from PiCanvasNavBadges list
    if (siteUrl) {
      NavRenderer._applyNavBadges(nav, siteUrl);
    }
  }

  /**
   * Cleanup resize listeners and handlers.
   */
  public static destroyNav(container: HTMLElement): void {
    const nav = container.querySelector('.picanvas-site-nav') as HTMLElement;
    if (!nav) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cleanup = (nav as any).__picanvasNavCleanup;
    if (typeof cleanup === 'function') {
      cleanup();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (nav as any).__picanvasNavCleanup;
    }
  }

  // ──────────────────────────────────────────────
  //  CSS Generation
  // ──────────────────────────────────────────────

  private static _buildStyles(config: INavRenderConfig, theme: IThemeVars): string {
    const customBlock = config.theme === 'custom' ? config.customCss || '' : '';
    const fontFamily = config.fontFamily || "'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif";

    return `
.picanvas-site-nav {
  --picanvas-nav-accent: ${theme.accent};
  --picanvas-nav-bg: ${theme.bg};
  --picanvas-nav-text: ${theme.text};
  --picanvas-nav-border: ${theme.border};
  --picanvas-nav-submenu-bg: ${theme.submenuBg};
  --picanvas-nav-hover-bg: color-mix(in srgb, ${theme.accent} 8%, transparent);
  --picanvas-nav-active-bg: color-mix(in srgb, ${theme.accent} 12%, transparent);
  --picanvas-nav-font-size: ${config.fontSize || '13px'};
  --picanvas-nav-item-height: ${config.itemHeight || '36px'};
  --picanvas-nav-submenu-shadow: 0 4px 12px rgba(0,0,0,0.12);
  ${customBlock}
  font-family: ${fontFamily};
  font-size: var(--picanvas-nav-font-size);
  font-weight: ${config.fontWeight || '400'};
  text-transform: ${config.textTransform || 'none'};
  background: var(--picanvas-nav-bg);
  border-bottom: 1px solid var(--picanvas-nav-border);
  position: relative;
  z-index: 100;
  ${theme.glass ? 'backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);' : ''}
}
.picanvas-site-nav *, .picanvas-site-nav *::before, .picanvas-site-nav *::after { box-sizing: border-box; }
.picanvas-site-nav a { color: var(--picanvas-nav-text); text-decoration: none; }
.picanvas-site-nav a:hover { color: var(--picanvas-nav-accent); }

/* ── Horizontal ── */
.picanvas-site-nav[data-nav-style="horizontal"] { display: flex; align-items: center; padding: 0 12px; }
.picanvas-nav-hamburger {
  display: none; background: none; border: none; color: var(--picanvas-nav-text); cursor: pointer;
  font-size: 20px; padding: 6px 8px; line-height: 1; flex-shrink: 0;
}
.picanvas-nav-items {
  display: flex; align-items: center; gap: ${config.itemSpacing || '2px'};
  flex-wrap: nowrap; overflow: hidden; flex: 1;
  ${config.alignment === 'center' ? 'justify-content: center;' :
    config.alignment === 'right' ? 'justify-content: flex-end;' :
    config.alignment === 'space-between' ? 'justify-content: space-between;' :
    'justify-content: flex-start;'}
}
.picanvas-nav-item { position: relative; flex-shrink: 0; }
.picanvas-nav-item > a, .picanvas-nav-more > button {
  display: inline-flex; align-items: center; gap: 4px;
  height: var(--picanvas-nav-item-height); padding: 0 10px;
  border-radius: 4px; transition: background 0.15s, color 0.15s; white-space: nowrap;
}
.picanvas-nav-item > a:hover, .picanvas-nav-more > button:hover { background: var(--picanvas-nav-hover-bg); }
.picanvas-nav-item > a:focus-visible, .picanvas-nav-more > button:focus-visible {
  outline: 2px solid var(--picanvas-nav-accent); outline-offset: -2px;
}
.picanvas-nav-active > a { color: var(--picanvas-nav-accent); background: var(--picanvas-nav-active-bg); font-weight: 600; }
.picanvas-nav-arrow { font-size: 10px; opacity: 0.6; margin-left: 2px; }

/* Dropdowns (horizontal) */
.picanvas-nav-dropdown, .picanvas-nav-more-dropdown {
  display: none; position: absolute; top: 100%; left: 0; min-width: 180px;
  background: var(--picanvas-nav-submenu-bg); border: 1px solid var(--picanvas-nav-border);
  border-radius: 6px; box-shadow: var(--picanvas-nav-submenu-shadow); padding: 4px 0; z-index: 200;
  ${theme.glass ? 'backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);' : ''}
}
.picanvas-nav-dropdown.open, .picanvas-nav-more-dropdown.open { display: block; }
.picanvas-nav-dropdown a, .picanvas-nav-more-dropdown a {
  display: flex; align-items: center; padding: 6px 14px; gap: 6px; transition: background 0.12s;
}
.picanvas-nav-dropdown a:hover, .picanvas-nav-more-dropdown a:hover { background: var(--picanvas-nav-hover-bg); }
.picanvas-nav-has-sub { position: relative; }
.picanvas-nav-submenu {
  display: none; position: absolute; left: 100%; top: 0; min-width: 160px;
  background: var(--picanvas-nav-submenu-bg); border: 1px solid var(--picanvas-nav-border);
  border-radius: 6px; box-shadow: var(--picanvas-nav-submenu-shadow); padding: 4px 0; z-index: 210;
}
.picanvas-nav-has-sub:hover > .picanvas-nav-submenu { display: block; }

/* More button (Priority+) */
.picanvas-nav-more { position: relative; flex-shrink: 0; display: none; }
.picanvas-nav-more.visible { display: block; }
.picanvas-nav-more > button {
  background: none; border: none; color: var(--picanvas-nav-text); cursor: pointer;
  font-size: var(--picanvas-nav-font-size); font-family: inherit;
}
.picanvas-nav-more-dropdown { right: 0; left: auto; }

/* ── Mobile ── */
@media (max-width: 768px) {
  .picanvas-nav-hamburger { display: block; }
  .picanvas-site-nav[data-nav-style="horizontal"] .picanvas-nav-items { display: none; }
  .picanvas-site-nav[data-nav-style="horizontal"].mobile-open .picanvas-nav-items {
    display: flex; flex-direction: column; position: absolute; top: 100%; left: 0; right: 0;
    background: var(--picanvas-nav-submenu-bg); border-top: 1px solid var(--picanvas-nav-border);
    box-shadow: var(--picanvas-nav-submenu-shadow); padding: 8px 0; z-index: 300;
    ${theme.glass ? 'backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);' : ''}
  }
  .picanvas-site-nav[data-nav-style="horizontal"].mobile-open .picanvas-nav-items .picanvas-nav-item > a { width: 100%; border-radius: 0; padding: 0 16px; }
  .picanvas-site-nav[data-nav-style="horizontal"].mobile-open .picanvas-nav-dropdown {
    position: static; box-shadow: none; border: none; border-radius: 0; padding-left: 16px;
  }
  .picanvas-site-nav[data-nav-style="horizontal"].mobile-open .picanvas-nav-more { display: none; }
}

/* ── Vertical ── */
.picanvas-site-nav[data-nav-style="vertical"] { display: flex; flex-direction: column; padding: 8px 0; border-bottom: none; border-right: 1px solid var(--picanvas-nav-border); }
.picanvas-site-nav[data-nav-style="vertical"] .picanvas-nav-items { display: flex; flex-direction: column; gap: ${config.itemSpacing || '2px'}; }
.picanvas-site-nav[data-nav-style="vertical"] .picanvas-nav-item > a {
  display: flex; align-items: center; gap: 4px; height: var(--picanvas-nav-item-height); padding: 0 16px;
  border-radius: 0; transition: background 0.15s; white-space: nowrap;
}
.picanvas-site-nav[data-nav-style="vertical"] .picanvas-nav-item > a:hover { background: var(--picanvas-nav-hover-bg); }
.picanvas-site-nav[data-nav-style="vertical"] .picanvas-nav-children {
  display: none; flex-direction: column; padding-left: 16px;
}
.picanvas-site-nav[data-nav-style="vertical"] .picanvas-nav-children.open { display: flex; }
.picanvas-site-nav[data-nav-style="vertical"] .picanvas-nav-children a {
  display: flex; align-items: center; height: var(--picanvas-nav-item-height); padding: 0 16px;
  transition: background 0.12s;
}
.picanvas-site-nav[data-nav-style="vertical"] .picanvas-nav-children a:hover { background: var(--picanvas-nav-hover-bg); }

/* ── Dropdown Style ── */
.picanvas-site-nav[data-nav-style="dropdown"] { padding: 4px 12px; }
.picanvas-nav-dropdown-toggle {
  display: inline-flex; align-items: center; gap: 6px;
  height: var(--picanvas-nav-item-height); padding: 0 12px;
  background: none; border: 1px solid var(--picanvas-nav-border); border-radius: 6px;
  color: var(--picanvas-nav-text); cursor: pointer; font: inherit; font-size: var(--picanvas-nav-font-size);
}
.picanvas-nav-dropdown-toggle:hover { background: var(--picanvas-nav-hover-bg); }
.picanvas-nav-dropdown-panel {
  display: none; flex-direction: column; padding: 8px 0; margin-top: 4px;
  background: var(--picanvas-nav-submenu-bg); border: 1px solid var(--picanvas-nav-border);
  border-radius: 6px; box-shadow: var(--picanvas-nav-submenu-shadow);
}
.picanvas-nav-dropdown-panel.open { display: flex; }
.picanvas-nav-dropdown-panel a {
  display: flex; align-items: center; height: var(--picanvas-nav-item-height); padding: 0 14px;
  transition: background 0.12s;
}
.picanvas-nav-dropdown-panel a:hover { background: var(--picanvas-nav-hover-bg); }
.picanvas-nav-dropdown-panel .picanvas-nav-children { padding-left: 16px; display: none; flex-direction: column; }
.picanvas-nav-dropdown-panel .picanvas-nav-children.open { display: flex; }

/* ── Skeleton ── */
.picanvas-nav-skeleton { display: flex; align-items: center; gap: 12px; padding: 0 12px; height: var(--picanvas-nav-item-height); }
.picanvas-nav-skeleton-bar {
  height: 12px; border-radius: 4px; background: linear-gradient(90deg, var(--picanvas-nav-border) 25%, transparent 50%, var(--picanvas-nav-border) 75%);
  background-size: 200% 100%; animation: picanvas-nav-shimmer 1.5s infinite;
}
@keyframes picanvas-nav-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

/* ── Nav Badge ── */
.picanvas-nav-badge {
  display: inline-block;
  margin-left: 4px;
  padding: 1px 5px;
  font-size: 0.65em;
  font-weight: 700;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  color: #fff;
  background: linear-gradient(135deg, #3b82f6, #6366f1);
  border-radius: 4px;
  vertical-align: middle;
  animation: picanvas-nav-badge-pulse 2s ease-in-out infinite;
}
@keyframes picanvas-nav-badge-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

/* ── Nav Icons ── */
.picanvas-nav-icon {
  display: inline-block;
  width: 1em;
  height: 1em;
  vertical-align: middle;
  margin-right: 4px;
  flex-shrink: 0;
}
.picanvas-nav-icon.ms-Icon { width: auto; height: auto; font-size: 1em; }
.picanvas-nav-icon-emoji { width: auto; height: auto; line-height: 1; }
.picanvas-nav-icon-svg svg { width: 1em; height: 1em; vertical-align: middle; }
img.picanvas-nav-icon { object-fit: contain; border-radius: 2px; }
.picanvas-nav-item.picanvas-nav-icon-only > a { padding-left: 8px; padding-right: 8px; }
.picanvas-nav-item.picanvas-nav-icon-only > a .picanvas-nav-icon { margin-right: 0; }
.picanvas-nav-item.picanvas-nav-icon-only > a .picanvas-nav-label-text { display: none; }
`;
  }

  // ──────────────────────────────────────────────
  //  Horizontal Renderer
  // ──────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private static _renderHorizontal(nodes: INavNode[], _config: INavRenderConfig): string {
    const items = nodes.map(n => NavRenderer._renderHorizontalItem(n, 1)).join('');
    return `<button class="picanvas-nav-hamburger" aria-label="Toggle navigation" aria-expanded="false">&#9776;</button>` +
      `<div class="picanvas-nav-items">${items}</div>` +
      `<div class="picanvas-nav-more"><button aria-expanded="false">More &#9662;</button><div class="picanvas-nav-more-dropdown"></div></div>`;
  }

  private static _renderHorizontalItem(node: INavNode, depth: number): string {
    const safeTitle = encodeHtml(node.Title);
    const href = isSafeUrl(node.Url) ? node.Url : '#';
    const external = node.IsExternal || node.OpenInNewWindow;
    const targetAttr = external ? ' target="_blank" rel="noopener noreferrer"' : '';
    const hasChildren = node.Children && node.Children.length > 0 && depth < MAX_DEPTH;
    const arrow = hasChildren ? '<span class="picanvas-nav-arrow">&#9662;</span>' : '';
    const ln = node as IListNavNode;
    const iconHtml = renderIconHtml(ln.Icon || '');
    const isIconOnly = ln.IconOnly && iconHtml;
    const titleAttr = isIconOnly ? ` title="${safeTitle}" aria-label="${safeTitle}"` : '';
    const itemClass = 'picanvas-nav-item' + (isIconOnly ? ' picanvas-nav-icon-only' : '');

    let html = `<div class="${itemClass}">`;
    html += `<a href="${href}"${targetAttr}${titleAttr}>${iconHtml}<span class="picanvas-nav-label-text">${safeTitle}</span>${arrow}</a>`;

    if (hasChildren) {
      html += `<div class="picanvas-nav-dropdown">`;
      html += NavRenderer._renderSubmenu(node.Children, depth + 1, 'horizontal');
      html += `</div>`;
    }
    html += `</div>`;
    return html;
  }

  // ──────────────────────────────────────────────
  //  Vertical Renderer
  // ──────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private static _renderVertical(nodes: INavNode[], _config: INavRenderConfig): string {
    const items = nodes.map(n => NavRenderer._renderVerticalItem(n, 1)).join('');
    return `<div class="picanvas-nav-items">${items}</div>`;
  }

  private static _renderVerticalItem(node: INavNode, depth: number): string {
    const safeTitle = encodeHtml(node.Title);
    const href = isSafeUrl(node.Url) ? node.Url : '#';
    const external = node.IsExternal || node.OpenInNewWindow;
    const targetAttr = external ? ' target="_blank" rel="noopener noreferrer"' : '';
    const hasChildren = node.Children && node.Children.length > 0 && depth < MAX_DEPTH;
    const arrow = hasChildren ? '<span class="picanvas-nav-arrow" data-nav-toggle>&#9656;</span>' : '';
    const ln = node as IListNavNode;
    const iconHtml = renderIconHtml(ln.Icon || '');
    const isIconOnly = ln.IconOnly && iconHtml;
    const titleAttr = isIconOnly ? ` title="${safeTitle}" aria-label="${safeTitle}"` : '';
    const itemClass = 'picanvas-nav-item' + (isIconOnly ? ' picanvas-nav-icon-only' : '');

    let html = `<div class="${itemClass}">`;
    html += `<a href="${href}"${targetAttr}${titleAttr}>${iconHtml}<span class="picanvas-nav-label-text">${safeTitle}</span>${arrow}</a>`;

    if (hasChildren) {
      html += `<div class="picanvas-nav-children">`;
      for (const child of node.Children) {
        html += NavRenderer._renderVerticalItem(child, depth + 1);
      }
      html += `</div>`;
    }
    html += `</div>`;
    return html;
  }

  // ──────────────────────────────────────────────
  //  Dropdown Renderer
  // ──────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private static _renderDropdown(nodes: INavNode[], _config: INavRenderConfig): string {
    const items = nodes.map(n => NavRenderer._renderDropdownItem(n, 1)).join('');
    return `<button class="picanvas-nav-dropdown-toggle" aria-expanded="false">Navigation <span class="picanvas-nav-arrow">&#9662;</span></button>` +
      `<div class="picanvas-nav-dropdown-panel">${items}</div>`;
  }

  private static _renderDropdownItem(node: INavNode, depth: number): string {
    const safeTitle = encodeHtml(node.Title);
    const href = isSafeUrl(node.Url) ? node.Url : '#';
    const external = node.IsExternal || node.OpenInNewWindow;
    const targetAttr = external ? ' target="_blank" rel="noopener noreferrer"' : '';
    const hasChildren = node.Children && node.Children.length > 0 && depth < MAX_DEPTH;
    const arrow = hasChildren ? ' <span class="picanvas-nav-arrow" data-nav-toggle>&#9656;</span>' : '';
    const ln = node as IListNavNode;
    const iconHtml = renderIconHtml(ln.Icon || '');
    const isIconOnly = ln.IconOnly && iconHtml;
    const titleAttr = isIconOnly ? ` title="${safeTitle}" aria-label="${safeTitle}"` : '';
    const itemClass = 'picanvas-nav-item' + (isIconOnly ? ' picanvas-nav-icon-only' : '');

    let html = `<div class="${itemClass}">`;
    html += `<a href="${href}"${targetAttr}${titleAttr}>${iconHtml}<span class="picanvas-nav-label-text">${safeTitle}</span>${arrow}</a>`;

    if (hasChildren) {
      html += `<div class="picanvas-nav-children">`;
      for (const child of node.Children) {
        html += NavRenderer._renderDropdownItem(child, depth + 1);
      }
      html += `</div>`;
    }
    html += `</div>`;
    return html;
  }

  // ──────────────────────────────────────────────
  //  Shared Submenu (horizontal flyout style)
  // ──────────────────────────────────────────────

  private static _renderSubmenu(children: INavNode[], depth: number, _parentStyle: string): string {
    return children.map(child => {
      const safeTitle = encodeHtml(child.Title);
      const href = isSafeUrl(child.Url) ? child.Url : '#';
      const external = child.IsExternal || child.OpenInNewWindow;
      const targetAttr = external ? ' target="_blank" rel="noopener noreferrer"' : '';
      const hasGrandchildren = child.Children && child.Children.length > 0 && depth < MAX_DEPTH;
      const ln = child as IListNavNode;
      const iconHtml = renderIconHtml(ln.Icon || '');

      if (hasGrandchildren) {
        let html = `<div class="picanvas-nav-has-sub">`;
        html += `<a href="${href}"${targetAttr}>${iconHtml}<span class="picanvas-nav-label-text">${safeTitle}</span> <span class="picanvas-nav-arrow">&#9656;</span></a>`;
        html += `<div class="picanvas-nav-submenu">`;
        html += NavRenderer._renderSubmenu(child.Children, depth + 1, _parentStyle);
        html += `</div></div>`;
        return html;
      }
      return `<a href="${href}"${targetAttr}>${iconHtml}<span class="picanvas-nav-label-text">${safeTitle}</span></a>`;
    }).join('');
  }

  // ──────────────────────────────────────────────
  //  Initialization helpers
  // ──────────────────────────────────────────────

  private static _markActivePage(nav: HTMLElement): void {
    const currentPath = window.location.pathname.toLowerCase();
    const links = nav.querySelectorAll('a[href]');
    links.forEach(link => {
      const href = link.getAttribute('href') || '';
      if (!href || href === '#') return;
      try {
        const url = new URL(href, window.location.origin);
        if (url.pathname.toLowerCase() === currentPath) {
          const item = link.closest('.picanvas-nav-item');
          if (item) item.classList.add('picanvas-nav-active');
        }
      } catch { /* ignore invalid URLs */ }
    });
  }

  /**
   * Priority+ pattern: measure items, move overflow into "More" dropdown.
   */
  private static _initPriorityPlus(nav: HTMLElement): void {
    const itemsContainer = nav.querySelector('.picanvas-nav-items') as HTMLElement;
    const moreBtn = nav.querySelector('.picanvas-nav-more') as HTMLElement;
    const moreDropdown = nav.querySelector('.picanvas-nav-more-dropdown') as HTMLElement;
    if (!itemsContainer || !moreBtn || !moreDropdown) return;

    const allItems = Array.from(itemsContainer.querySelectorAll(':scope > .picanvas-nav-item'));

    const recalc = (): void => {
      // Reset: show all items, hide More
      allItems.forEach(item => { (item as HTMLElement).style.display = ''; });
      moreBtn.classList.remove('visible');
      moreDropdown.innerHTML = '';

      // Manually sum item widths — scrollWidth is unreliable in flex containers
      const gapSize = parseInt(getComputedStyle(itemsContainer).gap || '2', 10);
      let totalWidth = 0;
      const itemWidths: number[] = [];
      for (let i = 0; i < allItems.length; i++) {
        if (i > 0) totalWidth += gapSize;
        const w = (allItems[i] as HTMLElement).offsetWidth;
        itemWidths.push(w);
        totalWidth += w;
      }

      // If everything fits without More, we're done
      const containerWidth = itemsContainer.clientWidth;
      console.log(`[PiCanvas Nav] recalc: items=${allItems.length}, totalWidth=${totalWidth}, containerWidth=${containerWidth}, gap=${gapSize}, itemWidths=[${itemWidths.join(',')}]`);
      if (totalWidth <= containerWidth + 1) {
        console.log('[PiCanvas Nav] All items fit — no More needed');
        return;
      }

      // Items overflow — show More so flex layout reserves its space,
      // then read the items container's actual remaining width.
      moreBtn.classList.add('visible');
      const availableWidth = itemsContainer.clientWidth;
      console.log(`[PiCanvas Nav] Overflow detected. More visible, availableWidth=${availableWidth}`);
      let usedWidth = 0;

      for (let i = 0; i < allItems.length; i++) {
        const el = allItems[i] as HTMLElement;
        if (i > 0) usedWidth += gapSize;
        usedWidth += el.offsetWidth;
        if (usedWidth > availableWidth) {
          console.log(`[PiCanvas Nav] Item ${i} overflows (usedWidth=${usedWidth}). Moving ${allItems.length - i} items to More.`);
          // This item and all remaining go into More
          for (let j = i; j < allItems.length; j++) {
            (allItems[j] as HTMLElement).style.display = 'none';
            const link = (allItems[j] as HTMLElement).querySelector(':scope > a');
            if (link) moreDropdown.appendChild(link.cloneNode(true));
          }
          return;
        }
      }

      // All items fit even with More visible (rounding) — hide More
      console.log('[PiCanvas Nav] Rounding edge case — hiding More');
      moreBtn.classList.remove('visible');
      moreDropdown.innerHTML = '';
    };

    // Initial calculation after layout
    requestAnimationFrame(recalc);

    // Debounced recalculation on any size change
    let resizeTimer: number | undefined;
    const scheduleRecalc = (): void => {
      if (resizeTimer) cancelAnimationFrame(resizeTimer);
      resizeTimer = requestAnimationFrame(recalc);
    };

    // ResizeObserver catches container-level layout shifts (e.g. SharePoint
    // column resize, side panel open/close) that window resize misses.
    let observer: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(scheduleRecalc);
      observer.observe(nav);
    }
    window.addEventListener('resize', scheduleRecalc);

    // Recalculate after web fonts finish loading — item widths may shift
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(scheduleRecalc);
    }

    // Store cleanup
    const prevCleanup = (nav as any).__picanvasNavCleanup; // eslint-disable-line @typescript-eslint/no-explicit-any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (nav as any).__picanvasNavCleanup = () => {
      if (observer) observer.disconnect();
      window.removeEventListener('resize', scheduleRecalc);
      if (resizeTimer) cancelAnimationFrame(resizeTimer);
      if (typeof prevCleanup === 'function') prevCleanup();
    };
  }

  private static _initHamburger(nav: HTMLElement): void {
    const hamburger = nav.querySelector('.picanvas-nav-hamburger') as HTMLButtonElement;
    if (!hamburger) return;

    const onClick = (): void => {
      const isOpen = nav.classList.toggle('mobile-open');
      hamburger.setAttribute('aria-expanded', String(isOpen));
    };
    hamburger.addEventListener('click', onClick);

    const prevCleanup = (nav as any).__picanvasNavCleanup; // eslint-disable-line @typescript-eslint/no-explicit-any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (nav as any).__picanvasNavCleanup = () => {
      hamburger.removeEventListener('click', onClick);
      if (typeof prevCleanup === 'function') prevCleanup();
    };
  }

  private static _initKeyboardNav(nav: HTMLElement): void {
    const onKeyDown = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement;
      if (!target || !nav.contains(target)) return;

      const item = target.closest('.picanvas-nav-item');
      if (!item) return;

      const parent = item.parentElement;
      if (!parent) return;
      const siblings = Array.from(parent.querySelectorAll(':scope > .picanvas-nav-item'));
      const idx = siblings.indexOf(item);

      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown': {
          e.preventDefault();
          const next = siblings[idx + 1];
          if (next) (next.querySelector('a') as HTMLElement)?.focus();
          break;
        }
        case 'ArrowLeft':
        case 'ArrowUp': {
          e.preventDefault();
          const prev = siblings[idx - 1];
          if (prev) (prev.querySelector('a') as HTMLElement)?.focus();
          break;
        }
        case 'Escape': {
          // Close any open dropdowns
          nav.querySelectorAll('.open').forEach(el => el.classList.remove('open'));
          nav.classList.remove('mobile-open');
          break;
        }
        case 'Enter':
        case ' ': {
          // If this is a parent with children, toggle dropdown
          const dropdown = item.querySelector('.picanvas-nav-dropdown, .picanvas-nav-children');
          if (dropdown && target.tagName === 'A' && (target.getAttribute('href') === '#' || !target.getAttribute('href'))) {
            e.preventDefault();
            dropdown.classList.toggle('open');
          }
          break;
        }
      }
    };

    nav.addEventListener('keydown', onKeyDown);

    const prevCleanup = (nav as any).__picanvasNavCleanup; // eslint-disable-line @typescript-eslint/no-explicit-any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (nav as any).__picanvasNavCleanup = () => {
      nav.removeEventListener('keydown', onKeyDown);
      if (typeof prevCleanup === 'function') prevCleanup();
    };
  }

  private static _initDropdownToggles(nav: HTMLElement): void {
    // For vertical and dropdown styles, toggle children on click
    const toggleArrows = nav.querySelectorAll('[data-nav-toggle]');
    const handlers: Array<{ el: Element; fn: EventListener }> = [];

    toggleArrows.forEach(arrow => {
      const fn = (e: Event): void => {
        e.preventDefault();
        e.stopPropagation();
        const item = (arrow as HTMLElement).closest('.picanvas-nav-item');
        if (!item) return;
        const children = item.querySelector('.picanvas-nav-children');
        if (children) {
          children.classList.toggle('open');
          arrow.textContent = children.classList.contains('open') ? '\u25BE' : '\u25B8';
        }
      };
      arrow.addEventListener('click', fn);
      // Also make parent link toggle if href is '#'
      const parentLink = (arrow as HTMLElement).closest('a');
      if (parentLink && (parentLink.getAttribute('href') === '#' || !parentLink.getAttribute('href'))) {
        parentLink.addEventListener('click', fn);
        handlers.push({ el: parentLink, fn });
      }
      handlers.push({ el: arrow, fn });
    });

    // Horizontal dropdown toggles on hover (desktop) and click (mobile)
    const navStyle = nav.dataset.navStyle;
    if (navStyle === 'horizontal') {
      const items = nav.querySelectorAll('.picanvas-nav-item');
      items.forEach(item => {
        const dropdown = item.querySelector('.picanvas-nav-dropdown');
        if (!dropdown) return;
        const link = item.querySelector(':scope > a');
        if (!link) return;

        const clickFn = (e: Event): void => {
          // Only intercept on mobile or if href is '#'
          if (window.innerWidth <= 768 || link.getAttribute('href') === '#') {
            e.preventDefault();
            dropdown.classList.toggle('open');
          }
        };
        link.addEventListener('click', clickFn);
        handlers.push({ el: link, fn: clickFn });
      });
    }

    // Dropdown style toggle
    if (navStyle === 'dropdown') {
      const toggleBtn = nav.querySelector('.picanvas-nav-dropdown-toggle');
      const panel = nav.querySelector('.picanvas-nav-dropdown-panel');
      if (toggleBtn && panel) {
        const fn = (): void => {
          const isOpen = panel.classList.toggle('open');
          toggleBtn.setAttribute('aria-expanded', String(isOpen));
        };
        toggleBtn.addEventListener('click', fn);
        handlers.push({ el: toggleBtn, fn });
      }
    }

    // More button toggle
    const moreBtn = nav.querySelector('.picanvas-nav-more > button');
    const moreDropdown = nav.querySelector('.picanvas-nav-more-dropdown');
    if (moreBtn && moreDropdown) {
      const fn = (): void => {
        const isOpen = moreDropdown.classList.toggle('open');
        moreBtn.setAttribute('aria-expanded', String(isOpen));
      };
      moreBtn.addEventListener('click', fn);
      handlers.push({ el: moreBtn, fn });
    }

    // Close dropdowns on outside click
    const onDocClick = (e: Event): void => {
      if (!nav.contains(e.target as Node)) {
        nav.querySelectorAll('.open').forEach(el => el.classList.remove('open'));
        nav.classList.remove('mobile-open');
        nav.querySelectorAll('[aria-expanded="true"]').forEach(el => el.setAttribute('aria-expanded', 'false'));
      }
    };
    document.addEventListener('click', onDocClick);

    const prevCleanup = (nav as any).__picanvasNavCleanup; // eslint-disable-line @typescript-eslint/no-explicit-any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (nav as any).__picanvasNavCleanup = () => {
      handlers.forEach(h => h.el.removeEventListener('click', h.fn));
      document.removeEventListener('click', onDocClick);
      if (typeof prevCleanup === 'function') prevCleanup();
    };
  }

  /**
   * Fetch PiCanvasNavBadges list and append badge spans to matching nav links.
   */
  private static _applyNavBadges(nav: HTMLElement, siteUrl: string): void {
    const apiUrl = siteUrl + "/_api/web/lists/getbytitle('PiCanvasNavBadges')/items" +
      '?$select=Title,BadgePublishedDate,BadgeDays,BadgeLabel&$top=100';

    fetch(apiUrl, {
      headers: { 'Accept': 'application/json;odata=nometadata' },
      credentials: 'same-origin'
    })
      .then(r => {
        if (!r.ok) return null;
        return r.json();
      })
      .then(data => {
        if (!data || !data.value || !data.value.length) return;

        const now = Date.now();
        const badgeMap: Record<string, string> = {};

        for (const item of data.value) {
          if (!item.BadgePublishedDate) continue;
          const pub = new Date(item.BadgePublishedDate).getTime();
          const days = item.BadgeDays || 30;
          const age = (now - pub) / 86400000;
          if (age <= days) {
            badgeMap[item.Title.trim().toLowerCase()] = item.BadgeLabel || 'NEW';
          }
        }

        if (!Object.keys(badgeMap).length) return;

        // Match against all nav links (top-level and dropdown children)
        const links = nav.querySelectorAll('a');
        let matched = 0;
        links.forEach(link => {
          // Get just the text content (excluding arrow spans)
          const textNode = link.childNodes[0];
          const linkText = (textNode && textNode.nodeType === 3 ? (textNode.textContent || '') : (link.textContent || '')).trim().toLowerCase();
          if (badgeMap[linkText]) {
            const badge = document.createElement('span');
            badge.className = 'picanvas-nav-badge';
            badge.textContent = badgeMap[linkText];
            link.appendChild(badge);
            matched++;
          }
        });

        if (matched > 0) {
          console.log(`[PiCanvas] Nav badges applied: ${matched} of ${Object.keys(badgeMap).length} active badges`);
        }
      })
      .catch(err => {
        console.log('[PiCanvas] NavBadges fetch skipped:', err.message);
      });
  }
}
