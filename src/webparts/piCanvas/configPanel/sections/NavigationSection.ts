/**
 * NavigationSection — Dedicated config section for Site Navigation.
 * Includes enable toggle, source/position/style options, theme picker
 * with visual preview swatches, and custom CSS editor.
 */
import { DropdownControl } from '../controls/DropdownControl';
import { ToggleControl } from '../controls/ToggleControl';

export interface INavigationSectionOptions {
  getProperty: (key: string) => string | number | boolean | undefined;
  setProperty: (key: string, value: string | number | boolean | undefined) => void;
  onChanged: () => void;
  getSpChromeConflicts?: () => string[];
}

interface IThemePreset {
  key: string;
  label: string;
  description: string;
  accent: string;
  bg: string;
  text: string;
  border: string;
  submenuBg: string;
  glass?: boolean;
}

const THEME_PRESETS: IThemePreset[] = [
  {
    key: 'auto',
    label: 'Auto',
    description: 'Matches page light/dark mode',
    accent: '#0078d4',
    bg: '#fafafa',
    text: '#323130',
    border: '#edebe9',
    submenuBg: '#ffffff'
  },
  {
    key: 'sharepoint',
    label: 'SharePoint',
    description: 'Uses your site\'s theme colors',
    accent: '#0070f2',
    bg: '#faf9f8',
    text: '#1a2733',
    border: '#edebe9',
    submenuBg: '#ffffff'
  },
  {
    key: 'fluent-light',
    label: 'Fluent Light',
    description: 'Clean Microsoft Fluent design',
    accent: '#0078d4',
    bg: '#fafafa',
    text: '#323130',
    border: '#edebe9',
    submenuBg: '#ffffff'
  },
  {
    key: 'fluent-dark',
    label: 'Fluent Dark',
    description: 'Dark mode with blue accent',
    accent: '#4ea8fe',
    bg: '#1b1b1b',
    text: '#d2d0ce',
    border: '#323130',
    submenuBg: '#252525'
  },
  {
    key: 'dark-glass',
    label: 'Dark Glass',
    description: 'Glassmorphism with gold accent',
    accent: '#fbbf24',
    bg: 'rgba(10,12,20,0.92)',
    text: 'rgba(255,255,255,0.88)',
    border: 'rgba(255,255,255,0.08)',
    submenuBg: 'rgba(15,18,28,0.96)',
    glass: true
  },
  {
    key: 'sap-dark',
    label: 'SAP Dark',
    description: 'SAP Horizon Dark with blue accent',
    accent: '#4DB1FF',
    bg: 'rgba(18,23,28,0.92)',
    text: 'rgba(255,255,255,0.88)',
    border: 'rgba(255,255,255,0.08)',
    submenuBg: 'rgba(29,35,42,0.96)',
    glass: true
  },
  {
    key: 'minimal',
    label: 'Minimal',
    description: 'Transparent, blends with page',
    accent: '#666666',
    bg: 'transparent',
    text: '#323130',
    border: 'transparent',
    submenuBg: '#ffffff'
  },
  {
    key: 'custom',
    label: 'Custom CSS',
    description: 'Define your own CSS variables',
    accent: '#8b5cf6',
    bg: '#f5f3ff',
    text: '#1e1b4b',
    border: '#c4b5fd',
    submenuBg: '#ffffff'
  }
];

export class NavigationSection {
  private _el: HTMLElement | null = null;
  private _options: INavigationSectionOptions;
  private _controls: Array<{ dispose: () => void }> = [];

  constructor(options: INavigationSectionOptions) {
    this._options = options;
  }

  public render(container: HTMLElement): void {
    this._el = container;
    this.rebuild();
  }

  public rebuild(): void {
    if (!this._el) return;
    this._disposeControls();

    const opts = this._options;
    const enabled = opts.getProperty('enableSiteNavigation') === true;
    const currentTheme = (opts.getProperty('siteNavTheme') as string) || 'auto';

    const html = `
      <div class="picanvas-config-section-title">Site Navigation</div>
      <div class="picanvas-config-section-desc">Add dynamic navigation from your SharePoint site to PiCanvas. Pulls links from Quick Launch, Top Nav, or Hub Nav automatically.</div>

      <div class="picanvas-config-field-group" data-nav-enable></div>

      ${enabled ? `
        <div class="picanvas-config-field-group">
          <div class="picanvas-config-field-group-title">Data Source</div>
          <div class="picanvas-config-section-desc" style="margin-top:-4px;margin-bottom:8px;">Choose where navigation links come from.</div>
          <div data-nav-source></div>
        </div>

        <div class="picanvas-config-field-group">
          <div class="picanvas-config-field-group-title">Layout</div>
          <div class="picanvas-config-section-desc" style="margin-top:-4px;margin-bottom:8px;">How the navigation appears and where it's placed.</div>
          <div data-nav-position></div>
          <div data-nav-style></div>
          <div data-nav-collapsible></div>
        </div>

        <div class="picanvas-config-field-group">
          <div class="picanvas-config-field-group-title">Typography & Layout</div>
          <div class="picanvas-config-section-desc" style="margin-top:-4px;margin-bottom:8px;">Control font, sizing, and alignment of nav items.</div>
          <div data-nav-font-family></div>
          <div data-nav-font-size></div>
          <div data-nav-font-weight></div>
          <div data-nav-item-height></div>
          <div data-nav-alignment></div>
          <div data-nav-item-spacing></div>
          <div data-nav-text-transform></div>
        </div>

        <div class="picanvas-config-field-group">
          <div class="picanvas-config-field-group-title">Theme</div>
          <div class="picanvas-config-section-desc" style="margin-top:-4px;margin-bottom:8px;">Pick a visual style for the navigation bar.</div>
          <div class="picanvas-nav-theme-grid" data-nav-theme-grid>
            ${THEME_PRESETS.map(preset => `
              <button type="button"
                class="picanvas-nav-theme-card${preset.key === currentTheme ? ' active' : ''}"
                data-theme-key="${preset.key}"
                title="${preset.description}">
                <div class="picanvas-nav-theme-preview" style="background:${preset.bg};border-color:${preset.border};${preset.glass ? 'backdrop-filter:blur(4px);' : ''}">
                  <div class="picanvas-nav-theme-bar" style="background:${preset.accent};"></div>
                  <div class="picanvas-nav-theme-items">
                    <span style="color:${preset.text};">Home</span>
                    <span style="color:${preset.accent};font-weight:600;">Active</span>
                    <span style="color:${preset.text};">Pages</span>
                    <span style="color:${preset.text};opacity:0.5;">&#9662;</span>
                  </div>
                </div>
                <div class="picanvas-nav-theme-label">${preset.label}</div>
              </button>
            `).join('')}
          </div>
        </div>

        ${currentTheme === 'custom' ? `
          <div class="picanvas-config-field-group">
            <div class="picanvas-config-field-group-title">Custom CSS Variables</div>
            <div class="picanvas-config-section-desc" style="margin-top:-4px;margin-bottom:8px;">Define CSS custom properties for full control over nav styling.</div>
            <textarea class="picanvas-config-textarea picanvas-nav-custom-css" rows="6" placeholder="--picanvas-nav-accent: #0078d4;&#10;--picanvas-nav-bg: #1b1b1b;&#10;--picanvas-nav-text: #ffffff;&#10;--picanvas-nav-hover-bg: rgba(255,255,255,0.08);&#10;--picanvas-nav-border: #323130;"
              style="width:100%;font-family:'SF Mono',Monaco,Consolas,monospace;font-size:11px;resize:vertical;padding:8px 10px;border:1px solid var(--picanvas-config-border,#ddd);border-radius:6px;background:var(--picanvas-config-input-bg,#fff);color:var(--picanvas-config-text,#333);line-height:1.6;"
            >${(opts.getProperty('siteNavCustomCss') as string) || ''}</textarea>
            <div style="font-size:11px;color:var(--picanvas-config-text-secondary,#888);margin-top:6px;line-height:1.5;">
              <strong>Available variables:</strong><br>
              <code>--picanvas-nav-accent</code> &middot;
              <code>--picanvas-nav-bg</code> &middot;
              <code>--picanvas-nav-text</code> &middot;
              <code>--picanvas-nav-hover-bg</code> &middot;
              <code>--picanvas-nav-active-bg</code> &middot;
              <code>--picanvas-nav-border</code> &middot;
              <code>--picanvas-nav-submenu-bg</code> &middot;
              <code>--picanvas-nav-submenu-shadow</code> &middot;
              <code>--picanvas-nav-font-size</code> &middot;
              <code>--picanvas-nav-item-height</code>
            </div>
          </div>
        ` : ''}
      ` : `
        <div style="text-align:center;padding:32px 16px;color:var(--picanvas-config-text-secondary,#888);">
          <div style="font-size:32px;margin-bottom:8px;">&#128279;</div>
          <p style="margin:0 0 4px;">Enable Site Navigation above to pull links from your SharePoint site.</p>
          <p style="margin:0;font-size:12px;">Supports Quick Launch, Top Nav, and Hub Nav with audience targeting.</p>
        </div>
      `}
    `;

    this._el.innerHTML = html;

    // Enable toggle
    const enableGroup = this._el.querySelector('[data-nav-enable]') as HTMLElement;
    if (enableGroup) {
      const toggle = new ToggleControl({
        label: 'Enable Site Navigation',
        checked: enabled,
        onText: 'Enabled',
        offText: 'Disabled',
        onChange: (v) => { opts.setProperty('enableSiteNavigation', v); this.rebuild(); opts.onChanged(); }
      });
      toggle.render(enableGroup);
      this._controls.push(toggle);
    }

    if (!enabled) return;

    // Source
    const sourceEl = this._el.querySelector('[data-nav-source]') as HTMLElement;
    if (sourceEl) {
      const dd = new DropdownControl({
        label: 'Navigation Source',
        value: (opts.getProperty('siteNavSource') as string) || 'quicklaunch',
        options: [
          { key: 'quicklaunch', text: 'Quick Launch (left nav)' },
          { key: 'topnav', text: 'Top Navigation (global)' },
          { key: 'hub', text: 'Hub Navigation (cross-site)' }
        ],
        onChange: (v) => { opts.setProperty('siteNavSource', v); opts.onChanged(); }
      });
      dd.render(sourceEl);
      this._controls.push(dd);
    }

    // Position
    const posEl = this._el.querySelector('[data-nav-position]') as HTMLElement;
    if (posEl) {
      const dd = new DropdownControl({
        label: 'Position',
        value: (opts.getProperty('siteNavPosition') as string) || 'above-tabs',
        options: [
          { key: 'above-tabs', text: 'Above Tabs' },
          { key: 'below-tabs', text: 'Below Tabs' },
          { key: 'replace-tabs', text: 'Replace Tab Bar' }
        ],
        onChange: (v) => { opts.setProperty('siteNavPosition', v); opts.onChanged(); }
      });
      dd.render(posEl);
      this._controls.push(dd);
    }

    // Style
    const styleEl = this._el.querySelector('[data-nav-style]') as HTMLElement;
    if (styleEl) {
      const dd = new DropdownControl({
        label: 'Style',
        value: (opts.getProperty('siteNavStyle') as string) || 'horizontal',
        options: [
          { key: 'horizontal', text: 'Horizontal Bar' },
          { key: 'vertical', text: 'Vertical Sidebar' },
          { key: 'dropdown', text: 'Dropdown Menus' }
        ],
        onChange: (v) => { opts.setProperty('siteNavStyle', v); opts.onChanged(); }
      });
      dd.render(styleEl);
      this._controls.push(dd);
    }

    // Collapsible
    const collEl = this._el.querySelector('[data-nav-collapsible]') as HTMLElement;
    if (collEl) {
      const toggle = new ToggleControl({
        label: 'Collapsible on Mobile',
        checked: opts.getProperty('siteNavCollapsible') !== false,
        onText: 'Yes',
        offText: 'No',
        onChange: (v) => { opts.setProperty('siteNavCollapsible', v); opts.onChanged(); }
      });
      toggle.render(collEl);
      this._controls.push(toggle);
    }

    // Typography & Layout controls
    const fontFamilyEl = this._el.querySelector('[data-nav-font-family]') as HTMLElement;
    if (fontFamilyEl) {
      const dd = new DropdownControl({
        label: 'Font Family',
        value: (opts.getProperty('siteNavFontFamily') as string) || '',
        options: [
          { key: '', text: 'Default (Segoe UI)' },
          { key: "'Segoe UI', sans-serif", text: 'Segoe UI' },
          { key: 'Inter, sans-serif', text: 'Inter' },
          { key: "'SF Pro Display', -apple-system, sans-serif", text: 'SF Pro (Apple)' },
          { key: "'Roboto', sans-serif", text: 'Roboto' },
          { key: "'Poppins', sans-serif", text: 'Poppins' },
          { key: "'DM Sans', sans-serif", text: 'DM Sans' },
          { key: "'IBM Plex Sans', sans-serif", text: 'IBM Plex Sans' },
          { key: "'Source Sans Pro', sans-serif", text: 'Source Sans Pro' },
          { key: 'Georgia, serif', text: 'Georgia (serif)' },
          { key: "'Fira Code', monospace", text: 'Fira Code (mono)' }
        ],
        onChange: (v) => { opts.setProperty('siteNavFontFamily', v); opts.onChanged(); }
      });
      dd.render(fontFamilyEl);
      this._controls.push(dd);
    }

    const fontSizeEl = this._el.querySelector('[data-nav-font-size]') as HTMLElement;
    if (fontSizeEl) {
      const dd = new DropdownControl({
        label: 'Font Size',
        value: (opts.getProperty('siteNavFontSize') as string) || '13px',
        options: [
          { key: '11px', text: '11px — Compact' },
          { key: '12px', text: '12px — Small' },
          { key: '13px', text: '13px — Default' },
          { key: '14px', text: '14px — Medium' },
          { key: '15px', text: '15px — Large' },
          { key: '16px', text: '16px — Extra Large' }
        ],
        onChange: (v) => { opts.setProperty('siteNavFontSize', v); opts.onChanged(); }
      });
      dd.render(fontSizeEl);
      this._controls.push(dd);
    }

    const fontWeightEl = this._el.querySelector('[data-nav-font-weight]') as HTMLElement;
    if (fontWeightEl) {
      const dd = new DropdownControl({
        label: 'Font Weight',
        value: (opts.getProperty('siteNavFontWeight') as string) || '400',
        options: [
          { key: '300', text: 'Light (300)' },
          { key: '400', text: 'Regular (400)' },
          { key: '500', text: 'Medium (500)' },
          { key: '600', text: 'Semibold (600)' },
          { key: '700', text: 'Bold (700)' }
        ],
        onChange: (v) => { opts.setProperty('siteNavFontWeight', v); opts.onChanged(); }
      });
      dd.render(fontWeightEl);
      this._controls.push(dd);
    }

    const itemHeightEl = this._el.querySelector('[data-nav-item-height]') as HTMLElement;
    if (itemHeightEl) {
      const dd = new DropdownControl({
        label: 'Item Height',
        value: (opts.getProperty('siteNavItemHeight') as string) || '36px',
        options: [
          { key: '28px', text: '28px — Compact' },
          { key: '32px', text: '32px — Small' },
          { key: '36px', text: '36px — Default' },
          { key: '40px', text: '40px — Medium' },
          { key: '44px', text: '44px — Comfortable' },
          { key: '48px', text: '48px — Large' }
        ],
        onChange: (v) => { opts.setProperty('siteNavItemHeight', v); opts.onChanged(); }
      });
      dd.render(itemHeightEl);
      this._controls.push(dd);
    }

    const alignEl = this._el.querySelector('[data-nav-alignment]') as HTMLElement;
    if (alignEl) {
      const dd = new DropdownControl({
        label: 'Alignment',
        value: (opts.getProperty('siteNavAlignment') as string) || 'left',
        options: [
          { key: 'left', text: 'Left' },
          { key: 'center', text: 'Center' },
          { key: 'right', text: 'Right' },
          { key: 'space-between', text: 'Space Between (stretch)' }
        ],
        onChange: (v) => { opts.setProperty('siteNavAlignment', v); opts.onChanged(); }
      });
      dd.render(alignEl);
      this._controls.push(dd);
    }

    const spacingEl = this._el.querySelector('[data-nav-item-spacing]') as HTMLElement;
    if (spacingEl) {
      const dd = new DropdownControl({
        label: 'Item Spacing',
        value: (opts.getProperty('siteNavItemSpacing') as string) || '2px',
        options: [
          { key: '0px', text: 'None' },
          { key: '2px', text: '2px — Tight (default)' },
          { key: '4px', text: '4px — Normal' },
          { key: '8px', text: '8px — Relaxed' },
          { key: '12px', text: '12px — Spacious' },
          { key: '16px', text: '16px — Wide' }
        ],
        onChange: (v) => { opts.setProperty('siteNavItemSpacing', v); opts.onChanged(); }
      });
      dd.render(spacingEl);
      this._controls.push(dd);
    }

    const transformEl = this._el.querySelector('[data-nav-text-transform]') as HTMLElement;
    if (transformEl) {
      const dd = new DropdownControl({
        label: 'Text Transform',
        value: (opts.getProperty('siteNavTextTransform') as string) || 'none',
        options: [
          { key: 'none', text: 'None (default)' },
          { key: 'uppercase', text: 'UPPERCASE' },
          { key: 'lowercase', text: 'lowercase' },
          { key: 'capitalize', text: 'Capitalize' }
        ],
        onChange: (v) => { opts.setProperty('siteNavTextTransform', v); opts.onChanged(); }
      });
      dd.render(transformEl);
      this._controls.push(dd);
    }

    // Theme cards click handler
    const themeGrid = this._el.querySelector('[data-nav-theme-grid]');
    if (themeGrid) {
      themeGrid.querySelectorAll('.picanvas-nav-theme-card').forEach(card => {
        card.addEventListener('click', () => {
          const key = (card as HTMLElement).dataset.themeKey || 'auto';
          opts.setProperty('siteNavTheme', key);
          this.rebuild();
          opts.onChanged();
        });
      });
    }

    // Custom CSS textarea
    const cssTextarea = this._el.querySelector('.picanvas-nav-custom-css') as HTMLTextAreaElement;
    if (cssTextarea) {
      cssTextarea.addEventListener('input', () => {
        opts.setProperty('siteNavCustomCss', cssTextarea.value);
        opts.onChanged();
      });
    }
  }

  private _disposeControls(): void {
    this._controls.forEach(c => c.dispose());
    this._controls = [];
  }

  public dispose(): void {
    this._disposeControls();
    this._el = null;
  }
}
