/**
 * ChromeSection — Show / Hide SharePoint UI elements.
 * Visual layout with inline toggles so users see exactly what each setting controls.
 */
import { ToggleControl } from '../controls/ToggleControl';

export interface IChromeSectionOptions {
  getProperty: (key: string) => string | number | boolean | undefined;
  setProperty: (key: string, value: string | number | boolean | undefined) => void;
  onChanged: () => void;
  getSpChromeConflicts?: () => string[];
}

const SELECTOR_TO_ELEMENT: Record<string, string> = {
  '#SuiteNavWrapper': 'Top Bar',
  '#CenterRegion': 'Search / Branding',
  '#O365_SearchBoxContainer_container': 'Search Box',
  '#O365_SuiteBranding_container': '"SharePoint" Label',
  '#O365_DocTitle_container': 'Page Title',
  '[data-automationid="SiteHeader"]': 'Site Header',
  '#sp-appBar': 'Left Sidebar',
};

export class ChromeSection {
  private _el: HTMLElement | null = null;
  private _options: IChromeSectionOptions;
  private _controls: Array<{ dispose: () => void }> = [];

  constructor(options: IChromeSectionOptions) {
    this._options = options;
  }

  public render(container: HTMLElement): void {
    this._el = container;
    this.rebuild();
  }

  /** Shared styles for the visual page mockup */
  private _mockupStyles(): string {
    return `
      .pc-mockup { border-radius:8px; overflow:hidden; border:1px solid var(--picanvas-config-border, #ddd); font-family:-apple-system,BlinkMacSystemFont,sans-serif; font-size:11px; }
      .pc-mockup-row { display:flex; align-items:stretch; }
      .pc-mockup-region { padding:8px 10px; display:flex; align-items:center; gap:6px; transition:opacity 0.2s,background 0.2s; position:relative; }
      .pc-mockup-region.pc-hidden { opacity:0.35; }
      .pc-mockup-region.pc-hidden::after { content:'HIDDEN'; position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); font-size:9px; font-weight:700; letter-spacing:1px; color:#dc2626; background:rgba(255,255,255,0.85); padding:1px 6px; border-radius:3px; pointer-events:none; }
      .pc-mockup-topbar { background:#1b1b1b; color:#fff; min-height:36px; }
      .pc-mockup-siteheader { background:#f3f3f3; color:#333; border-top:1px solid #ddd; min-height:32px; }
      .pc-mockup-sidebar { background:#f3f3f3; color:#666; border-right:1px solid #ddd; width:36px; min-height:80px; flex:0 0 36px; flex-direction:column; justify-content:center; text-align:center; font-size:14px; line-height:1.6; }
      .pc-mockup-content { background:#fafafa; color:#aaa; flex:1; min-height:80px; display:flex; align-items:center; justify-content:center; font-style:italic; }
      .pc-mockup-label { font-size:10px; opacity:0.7; }
      .pc-mockup-icon { font-size:13px; }
      .pc-toggle-row { display:flex; align-items:center; justify-content:space-between; padding:6px 0; }
      .pc-toggle-row + .pc-toggle-row { border-top:1px solid var(--picanvas-config-border,#e8e8e8); }
      .pc-toggle-info { flex:1; min-width:0; }
      .pc-toggle-title { font-weight:600; font-size:13px; color:var(--picanvas-config-text,#222); }
      .pc-toggle-desc { font-size:11.5px; color:var(--picanvas-config-text-secondary,#777); margin-top:2px; line-height:1.4; }
      .pc-toggle-control { flex:0 0 auto; margin-left:12px; }
    `;
  }

  private _escapeAttr(str: string): string {
    return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  public rebuild(): void {
    if (!this._el) return;
    this._disposeControls();

    const opts = this._options;
    const searchHidden = opts.getProperty('hideSpSearch') === true;
    const brandingHidden = opts.getProperty('hideSpBranding') === true;
    const compactMode = opts.getProperty('hideSpSuiteHeader') === true;
    const siteHeaderHidden = opts.getProperty('hideSpHorizontalNav') === true;
    const sidebarHidden = opts.getProperty('hideSpAppBar') === true;
    const customLogoEnabled = opts.getProperty('chromeCustomLogoEnabled') === true;
    const customLogoUrl = (opts.getProperty('chromeCustomLogoUrl') as string) || '';
    const customLogoActive = customLogoEnabled && !!customLogoUrl.trim();

    const h = (hidden: boolean) => hidden ? 'pc-hidden' : '';

    // Branding region: custom logo overrides hidden state
    const brandingRegionClass = customLogoActive ? '' : h(brandingHidden);
    const brandingRegionContent = customLogoActive
      ? `<img src="${this._escapeAttr(customLogoUrl)}" alt="Custom logo" style="height:16px;max-width:80px;object-fit:contain;" onerror="this.style.display='none'" />`
      : `<span>SharePoint</span>`;

    const conflicts = opts.getSpChromeConflicts?.() || [];
    const hasAnyConflict = conflicts.length > 0;

    const conflictHtml = hasAnyConflict ? `
      <div style="margin-top:16px;padding:10px 12px;background:rgba(255,185,0,0.08);border:1px solid rgba(255,185,0,0.3);border-radius:6px;font-size:12px;line-height:1.8;">
        <div style="font-weight:600;margin-bottom:4px;">Your tab content has CSS that also targets these elements:</div>
        ${conflicts.map(sel => {
          const label = SELECTOR_TO_ELEMENT[sel] || sel;
          return `<div><code style="font-size:10px;background:rgba(0,0,0,0.06);padding:1px 4px;border-radius:3px;">${sel}</code> &rarr; ${label}</div>`;
        }).join('')}
        <div style="margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,185,0,0.3);" data-chrome-override-toggle></div>
      </div>
    ` : '';

    this._el.innerHTML = `
      <style>${this._mockupStyles()}</style>
      <div class="picanvas-config-section-title">Show / Hide</div>
      <div class="picanvas-config-section-desc">Control which parts of the SharePoint interface are visible. These only apply in Read mode.</div>

      <!-- Visual mockup -->
      <div class="pc-mockup" style="margin:12px 0 16px;">
        <!-- Top Bar -->
        <div class="pc-mockup-row pc-mockup-topbar ${compactMode ? '' : ''}">
          <div class="pc-mockup-region" style="flex:0 0 auto;">
            <span class="pc-mockup-icon">&#9776;</span>
          </div>
          <div class="pc-mockup-region ${brandingRegionClass}" data-mockup-branding style="flex:0 0 auto;">
            ${brandingRegionContent}
          </div>
          <div class="pc-mockup-region ${h(searchHidden)}" style="flex:1;justify-content:center;">
            <span style="background:rgba(255,255,255,0.15);padding:2px 24px;border-radius:3px;font-size:10px;">&#128269; Search this site</span>
          </div>
          <div class="pc-mockup-region" style="flex:0 0 auto;gap:8px;">
            <span class="pc-mockup-icon">&#128276;</span>
            <span class="pc-mockup-icon">&#9881;</span>
            <span class="pc-mockup-icon">&#10068;</span>
            <span style="background:#4a4a4a;color:#fff;width:20px;height:20px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;">AH</span>
          </div>
        </div>
        <!-- Site Header -->
        <div class="pc-mockup-row pc-mockup-siteheader ${h(siteHeaderHidden)}">
          <div class="pc-mockup-region" style="flex:1;gap:16px;">
            <span style="font-weight:600;">Contoso</span>
            <span class="pc-mockup-label">Home</span>
            <span class="pc-mockup-label">Documents</span>
            <span class="pc-mockup-label">Pages</span>
          </div>
        </div>
        <!-- Body -->
        <div class="pc-mockup-row">
          <div class="pc-mockup-region pc-mockup-sidebar ${h(sidebarHidden)}">
            &#127968;<br>&#128196;<br>&#128240;
          </div>
          <div class="pc-mockup-content">Your page content</div>
        </div>
      </div>

      <!-- Toggles -->
      <div style="display:flex;flex-direction:column;gap:12px;">

        <div class="picanvas-config-field-group" style="margin:0;">
          <div class="pc-toggle-row">
            <div class="pc-toggle-info">
              <div class="pc-toggle-title">&#128269; Search box</div>
              <div class="pc-toggle-desc">The "Search this site" input in the top bar.</div>
            </div>
            <div class="pc-toggle-control" data-chrome-hide-search></div>
          </div>
          <div class="pc-toggle-row">
            <div class="pc-toggle-info">
              <div class="pc-toggle-title">&#127475; "SharePoint" label</div>
              <div class="pc-toggle-desc">The "SharePoint" text next to the waffle icon.</div>
            </div>
            <div class="pc-toggle-control" data-chrome-hide-branding></div>
          </div>
          <div class="pc-toggle-row">
            <div class="pc-toggle-info">
              <div class="pc-toggle-title">&#128204; Compact top bar</div>
              <div class="pc-toggle-desc">Pin the top bar to the top of the screen and auto-hide search & label. Keeps waffle, settings, and profile visible.</div>
            </div>
            <div class="pc-toggle-control" data-chrome-compact-mode></div>
          </div>
        </div>

        <div class="picanvas-config-field-group" style="margin:0;">
          <div class="pc-toggle-row">
            <div class="pc-toggle-info">
              <div class="pc-toggle-title">&#127912; Custom site logo</div>
              <div class="pc-toggle-desc">Replace the tenant logo in the top bar with a custom image.</div>
            </div>
            <div class="pc-toggle-control" data-chrome-custom-logo></div>
          </div>
          <div class="pc-toggle-row" data-chrome-logo-url-row style="${customLogoEnabled ? '' : 'display:none;'}">
            <div style="width:100%;padding:4px 0;">
              <label style="font-size:11.5px;font-weight:600;color:var(--picanvas-config-text-secondary,#666);display:block;margin-bottom:4px;">Logo image URL</label>
              <input type="text" class="picanvas-config-text-input" data-chrome-logo-url-input
                value="${this._escapeAttr(customLogoUrl)}"
                placeholder="https://yoursite.sharepoint.com/SiteAssets/logo.png"
                style="font-size:12px;" />
              <div style="font-size:10.5px;color:var(--picanvas-config-text-secondary,#999);margin-top:3px;">
                Transparent PNG recommended, ~24px height. Overrides &ldquo;Hide SharePoint label&rdquo; when set.
              </div>
            </div>
          </div>
        </div>

        <div class="picanvas-config-field-group" style="margin:0;">
          <div class="pc-toggle-row">
            <div class="pc-toggle-info">
              <div class="pc-toggle-title">&#8596;&#65039; Site header</div>
              <div class="pc-toggle-desc">The row with the site logo, name, and navigation links (Home, Documents, Pages).</div>
            </div>
            <div class="pc-toggle-control" data-chrome-hide-site-header></div>
          </div>
        </div>

        <div class="picanvas-config-field-group" style="margin:0;">
          <div class="pc-toggle-row">
            <div class="pc-toggle-info">
              <div class="pc-toggle-title">&#9776; Left sidebar</div>
              <div class="pc-toggle-desc">The vertical icon bar on the far left (Home, My Sites, News, Files).</div>
            </div>
            <div class="pc-toggle-control" data-chrome-hide-sidebar></div>
          </div>
        </div>

      </div>

      ${conflictHtml}
    `;

    // --- Render toggle controls ---

    const searchEl = this._el.querySelector('[data-chrome-hide-search]') as HTMLElement;
    if (searchEl) {
      const toggle = new ToggleControl({
        label: '',
        checked: searchHidden,
        onText: 'Hidden',
        offText: 'Showing',
        onChange: (v) => { opts.setProperty('hideSpSearch', v); this._refreshMockup(); opts.onChanged(); }
      });
      toggle.render(searchEl);
      this._controls.push(toggle);
    }

    const brandingEl = this._el.querySelector('[data-chrome-hide-branding]') as HTMLElement;
    if (brandingEl) {
      const toggle = new ToggleControl({
        label: '',
        checked: brandingHidden,
        onText: 'Hidden',
        offText: 'Showing',
        onChange: (v) => { opts.setProperty('hideSpBranding', v); this._refreshMockup(); opts.onChanged(); }
      });
      toggle.render(brandingEl);
      this._controls.push(toggle);
    }

    const compactEl = this._el.querySelector('[data-chrome-compact-mode]') as HTMLElement;
    if (compactEl) {
      const toggle = new ToggleControl({
        label: '',
        checked: compactMode,
        onText: 'On',
        offText: 'Off',
        onChange: (v) => {
          opts.setProperty('hideSpSuiteHeader', v);
          if (v) {
            opts.setProperty('hideSpSearch', true);
            opts.setProperty('hideSpBranding', true);
          }
          this.rebuild();
          opts.onChanged();
        }
      });
      toggle.render(compactEl);
      this._controls.push(toggle);
    }

    // Custom logo toggle
    const customLogoEl = this._el.querySelector('[data-chrome-custom-logo]') as HTMLElement;
    if (customLogoEl) {
      const toggle = new ToggleControl({
        label: '',
        checked: customLogoEnabled,
        onText: 'On',
        offText: 'Off',
        onChange: (v) => {
          opts.setProperty('chromeCustomLogoEnabled', v);
          const urlRow = this._el!.querySelector('[data-chrome-logo-url-row]') as HTMLElement;
          if (urlRow) urlRow.style.display = v ? '' : 'none';
          this._refreshMockup();
          opts.onChanged();
        }
      });
      toggle.render(customLogoEl);
      this._controls.push(toggle);
    }

    // Custom logo URL input (debounced)
    const logoUrlInput = this._el.querySelector('[data-chrome-logo-url-input]') as HTMLInputElement;
    if (logoUrlInput) {
      let debounceTimer: ReturnType<typeof setTimeout> | null = null;
      const handler = (): void => {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          opts.setProperty('chromeCustomLogoUrl', logoUrlInput.value.trim());
          this._refreshMockup();
          opts.onChanged();
        }, 400);
      };
      logoUrlInput.addEventListener('input', handler);
      // Also fire on blur for immediate commit
      logoUrlInput.addEventListener('change', handler);
    }

    const siteHeaderEl = this._el.querySelector('[data-chrome-hide-site-header]') as HTMLElement;
    if (siteHeaderEl) {
      const toggle = new ToggleControl({
        label: '',
        checked: siteHeaderHidden,
        onText: 'Hidden',
        offText: 'Showing',
        onChange: (v) => { opts.setProperty('hideSpHorizontalNav', v); this._refreshMockup(); opts.onChanged(); }
      });
      toggle.render(siteHeaderEl);
      this._controls.push(toggle);
    }

    const sidebarEl = this._el.querySelector('[data-chrome-hide-sidebar]') as HTMLElement;
    if (sidebarEl) {
      const toggle = new ToggleControl({
        label: '',
        checked: sidebarHidden,
        onText: 'Hidden',
        offText: 'Showing',
        onChange: (v) => { opts.setProperty('hideSpAppBar', v); this._refreshMockup(); opts.onChanged(); }
      });
      toggle.render(sidebarEl);
      this._controls.push(toggle);
    }

    if (hasAnyConflict) {
      const overrideEl = this._el.querySelector('[data-chrome-override-toggle]') as HTMLElement;
      if (overrideEl) {
        const toggle = new ToggleControl({
          label: 'Let these toggles override content CSS',
          checked: opts.getProperty('chromeConfigOverridesContent') === true,
          onText: 'Yes — toggles win',
          offText: 'No — content CSS wins',
          onChange: (v) => {
            opts.setProperty('chromeConfigOverridesContent', v);
            this.rebuild();
            opts.onChanged();
          }
        });
        toggle.render(overrideEl);
        this._controls.push(toggle);
      }
    }
  }

  /** Refresh mockup classes without rebuilding controls */
  private _refreshMockup(): void {
    if (!this._el) return;
    const mockup = this._el.querySelector('.pc-mockup');
    if (!mockup) return;

    const opts = this._options;
    const regions = mockup.querySelectorAll('.pc-mockup-region');
    // Top bar regions: [0]=waffle, [1]=branding, [2]=search, [3]=right icons
    // Site header: [4]
    // Sidebar: [5]
    const setHidden = (el: Element | null, hidden: boolean) => {
      if (!el) return;
      if (hidden) el.classList.add('pc-hidden');
      else el.classList.remove('pc-hidden');
    };

    // Custom logo overrides branding visibility in the mockup
    const customLogoOn = opts.getProperty('chromeCustomLogoEnabled') === true;
    const customLogoUrl = (opts.getProperty('chromeCustomLogoUrl') as string) || '';
    const brandingRegion = regions[1];
    if (customLogoOn && customLogoUrl.trim()) {
      if (brandingRegion) {
        brandingRegion.classList.remove('pc-hidden');
        brandingRegion.innerHTML = `<img src="${this._escapeAttr(customLogoUrl)}" alt="Custom logo" style="height:16px;max-width:80px;object-fit:contain;" onerror="this.style.display='none'" />`;
      }
    } else {
      setHidden(brandingRegion, opts.getProperty('hideSpBranding') === true);
      if (brandingRegion && !brandingRegion.querySelector('span')) {
        brandingRegion.innerHTML = '<span>SharePoint</span>';
      }
    }

    setHidden(regions[2], opts.getProperty('hideSpSearch') === true);
    // Site header row
    const siteHeaderRow = mockup.querySelectorAll('.pc-mockup-row')[1];
    setHidden(siteHeaderRow, opts.getProperty('hideSpHorizontalNav') === true);
    // Sidebar
    const sidebarRegion = mockup.querySelector('.pc-mockup-sidebar');
    setHidden(sidebarRegion, opts.getProperty('hideSpAppBar') === true);
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
