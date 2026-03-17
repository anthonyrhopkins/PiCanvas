/**
 * ChromeSection — Controls SharePoint page chrome visibility:
 * suite header bar, search box, branding text, left app bar,
 * site navigation header, and content CSS override toggle.
 * Shows per-element detection of whether config or content CSS is controlling each item.
 */
import { ToggleControl } from '../controls/ToggleControl';

export interface IChromeSectionOptions {
  getProperty: (key: string) => string | number | boolean | undefined;
  setProperty: (key: string, value: string | number | boolean | undefined) => void;
  onChanged: () => void;
  getSpChromeConflicts?: () => string[];
}

// Map SP chrome CSS selectors to human-readable element names
const SELECTOR_TO_ELEMENT: Record<string, string> = {
  '#SuiteNavWrapper': 'Suite Header',
  '#CenterRegion': 'Search / Branding',
  '#O365_SearchBoxContainer_container': 'Search Box',
  '#O365_SuiteBranding_container': 'SharePoint Branding',
  '#O365_DocTitle_container': 'Document Title',
  '[data-automationid="SiteHeader"]': 'Site Navigation',
  '#sp-appBar': 'App Bar (left rail)',
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

  /** Build a small status badge */
  private _badge(label: string, color: string, bgColor: string): string {
    return `<span style="display:inline-block;font-size:10px;font-weight:600;padding:2px 6px;border-radius:4px;color:${color};background:${bgColor};letter-spacing:0.3px;vertical-align:middle;margin-left:6px;">${label}</span>`;
  }

  /** Get status for an element: what's controlling it */
  private _getStatus(configEnabled: boolean, conflictSelectors: string[], relevantSelectors: string[]): string {
    const hasConflict = relevantSelectors.some(sel => conflictSelectors.includes(sel));
    const overrideEnabled = this._options.getProperty('chromeConfigOverridesContent') === true;

    if (configEnabled && hasConflict && !overrideEnabled) {
      return this._badge('CONFLICT', '#92400e', 'rgba(255,185,0,0.2)') +
        this._badge('HTML CSS', '#6b21a8', 'rgba(147,51,234,0.1)') +
        this._badge('CONFIG', '#1e40af', 'rgba(59,130,246,0.1)');
    }
    if (configEnabled && hasConflict && overrideEnabled) {
      return this._badge('CONFIG', '#1e40af', 'rgba(59,130,246,0.15)') +
        this._badge('HTML stripped', '#6b7280', 'rgba(107,114,128,0.1)');
    }
    if (configEnabled && !hasConflict) {
      return this._badge('CONFIG', '#1e40af', 'rgba(59,130,246,0.15)');
    }
    if (!configEnabled && hasConflict) {
      return this._badge('HTML CSS', '#6b21a8', 'rgba(147,51,234,0.15)');
    }
    return this._badge('DEFAULT', '#6b7280', 'rgba(107,114,128,0.1)');
  }

  public rebuild(): void {
    if (!this._el) return;
    this._disposeControls();

    const opts = this._options;
    const conflicts = opts.getSpChromeConflicts?.() || [];
    const hasAnyConflict = conflicts.length > 0;
    const overrideEnabled = opts.getProperty('chromeConfigOverridesContent') === true;

    // Build per-element status — suite header area is "config-controlled" if any of the three toggles are on
    const suiteConfigActive = opts.getProperty('hideSpSuiteHeader') === true ||
      opts.getProperty('hideSpSearch') === true || opts.getProperty('hideSpBranding') === true;
    const suiteStatus = this._getStatus(
      suiteConfigActive,
      conflicts,
      ['#SuiteNavWrapper', '#CenterRegion', '#O365_SearchBoxContainer_container', '#O365_SuiteBranding_container', '#O365_DocTitle_container']
    );
    const navStatus = this._getStatus(
      opts.getProperty('hideSpHorizontalNav') === true,
      conflicts,
      ['[data-automationid="SiteHeader"]']
    );
    const appBarStatus = this._getStatus(
      opts.getProperty('hideSpAppBar') === true,
      conflicts,
      ['#sp-appBar']
    );

    // Detection summary
    const detectionHtml = hasAnyConflict ? `
      <div class="picanvas-config-field-group">
        <div class="picanvas-config-field-group-title">Detection</div>
        <div style="padding:10px 12px;background:var(--picanvas-config-field-bg, #f8f8f8);border:1px solid var(--picanvas-config-border, #e0e0e0);border-radius:6px;font-size:12px;line-height:1.8;">
          <div style="font-weight:600;margin-bottom:6px;color:var(--picanvas-config-text,#333);">Your HTML content has CSS rules targeting:</div>
          ${conflicts.map(sel => {
            const label = SELECTOR_TO_ELEMENT[sel] || sel;
            return `<div style="display:flex;align-items:center;gap:6px;padding:2px 0;">
              <code style="font-size:10.5px;background:rgba(0,0,0,0.06);padding:1px 5px;border-radius:3px;font-family:'SF Mono',Monaco,Consolas,monospace;">${sel}</code>
              <span style="color:var(--picanvas-config-text-secondary,#888);">&rarr;</span>
              <span>${label}</span>
            </div>`;
          }).join('')}
          <div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--picanvas-config-border, #e0e0e0);" data-chrome-override-toggle></div>
        </div>
      </div>
    ` : `
      <div class="picanvas-config-field-group">
        <div class="picanvas-config-field-group-title">Detection</div>
        <div style="padding:10px 12px;background:var(--picanvas-config-field-bg, #f8f8f8);border:1px solid var(--picanvas-config-border, #e0e0e0);border-radius:6px;font-size:12px;color:var(--picanvas-config-text-secondary,#888);text-align:center;">
          <span style="font-size:16px;">&#9989;</span> No content CSS conflicts detected. Chrome is fully controlled by the toggles above.
        </div>
      </div>
    `;

    this._el.innerHTML = `
      <div class="picanvas-config-section-title">Page Chrome</div>
      <div class="picanvas-config-section-desc">Control which SharePoint UI elements are visible. Changes only apply in Read mode.</div>

      <div class="picanvas-config-field-group">
        <div class="picanvas-config-field-group-title">Suite Header (top bar) ${suiteStatus}</div>
        <div class="picanvas-config-section-desc" style="margin-top:-4px;margin-bottom:8px;">The Office 365 bar with waffle menu, search, and profile icon.</div>
        <div data-chrome-hide-search></div>
        <div data-chrome-hide-branding></div>
        <div data-chrome-hide-suite-header style="margin-top:8px;padding-top:8px;border-top:1px solid var(--picanvas-config-border, #e0e0e0);"></div>
      </div>

      <div class="picanvas-config-field-group">
        <div class="picanvas-config-field-group-title">Site Navigation ${navStatus}</div>
        <div class="picanvas-config-section-desc" style="margin-top:-4px;margin-bottom:8px;">The horizontal site header with page links and hub navigation.</div>
        <div data-chrome-hide-horizontal-nav></div>
      </div>

      <div class="picanvas-config-field-group">
        <div class="picanvas-config-field-group-title">App Bar (left rail) ${appBarStatus}</div>
        <div class="picanvas-config-section-desc" style="margin-top:-4px;margin-bottom:8px;">The vertical sidebar with Home, Sites, News, and Files icons.</div>
        <div data-chrome-hide-appbar></div>
      </div>

      ${detectionHtml}
    `;

    // Search toggle (independent — works with or without Waffle-Clean Mode)
    const searchEl = this._el.querySelector('[data-chrome-hide-search]') as HTMLElement;
    if (searchEl) {
      const toggle = new ToggleControl({
        label: 'Hide Search Box',
        checked: opts.getProperty('hideSpSearch') === true,
        onText: 'Hidden',
        offText: 'Visible',
        onChange: (v) => { opts.setProperty('hideSpSearch', v); opts.onChanged(); }
      });
      toggle.render(searchEl);
      this._controls.push(toggle);
    }

    // Branding toggle (independent)
    const brandingEl = this._el.querySelector('[data-chrome-hide-branding]') as HTMLElement;
    if (brandingEl) {
      const toggle = new ToggleControl({
        label: 'Hide "SharePoint" Branding',
        checked: opts.getProperty('hideSpBranding') === true,
        onText: 'Hidden',
        offText: 'Visible',
        onChange: (v) => { opts.setProperty('hideSpBranding', v); opts.onChanged(); }
      });
      toggle.render(brandingEl);
      this._controls.push(toggle);
    }

    // Suite Header toggle (Waffle-Clean Mode — makes header fixed/compact)
    const suiteHeaderEl = this._el.querySelector('[data-chrome-hide-suite-header]') as HTMLElement;
    if (suiteHeaderEl) {
      const toggle = new ToggleControl({
        label: 'Waffle-Clean Mode (fixed header)',
        checked: opts.getProperty('hideSpSuiteHeader') === true,
        onText: 'Fixed compact bar — search & branding auto-hidden',
        offText: 'Default header layout',
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
      toggle.render(suiteHeaderEl);
      this._controls.push(toggle);
    }

    // Horizontal nav toggle
    const horizNavEl = this._el.querySelector('[data-chrome-hide-horizontal-nav]') as HTMLElement;
    if (horizNavEl) {
      const toggle = new ToggleControl({
        label: 'Hide Site Navigation Bar',
        checked: opts.getProperty('hideSpHorizontalNav') === true,
        onText: 'Hidden',
        offText: 'Visible',
        onChange: (v) => { opts.setProperty('hideSpHorizontalNav', v); opts.onChanged(); }
      });
      toggle.render(horizNavEl);
      this._controls.push(toggle);
    }

    // App bar toggle
    const appBarEl = this._el.querySelector('[data-chrome-hide-appbar]') as HTMLElement;
    if (appBarEl) {
      const toggle = new ToggleControl({
        label: 'Hide App Bar',
        checked: opts.getProperty('hideSpAppBar') === true,
        onText: 'Hidden',
        offText: 'Visible',
        onChange: (v) => { opts.setProperty('hideSpAppBar', v); opts.onChanged(); }
      });
      toggle.render(appBarEl);
      this._controls.push(toggle);
    }

    // Override toggle (inside detection area, only when conflicts exist)
    if (hasAnyConflict) {
      const overrideEl = this._el.querySelector('[data-chrome-override-toggle]') as HTMLElement;
      if (overrideEl) {
        const toggle = new ToggleControl({
          label: 'Config overrides content CSS',
          checked: overrideEnabled,
          onText: 'Config wins — HTML rules stripped',
          offText: 'Content wins — HTML rules kept',
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

  private _disposeControls(): void {
    this._controls.forEach(c => c.dispose());
    this._controls = [];
  }

  public dispose(): void {
    this._disposeControls();
    this._el = null;
  }
}
