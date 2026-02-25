/**
 * AppearanceSection — Tab style, alignment, orientation, theme, feature toggles.
 * Uses visual style cards for selection.
 */
import { DropdownControl } from '../controls/DropdownControl';
import { ToggleControl } from '../controls/ToggleControl';

export interface IAppearanceSectionOptions {
  getProperty: (key: string) => string | number | boolean | undefined;
  setProperty: (key: string, value: string | number | boolean | undefined) => void;
  onChanged: () => void;
}

interface IStyleOption {
  key: string;
  icon: string;
  label: string;
}

const TAB_STYLES: IStyleOption[] = [
  { key: 'default', icon: '&#9601;', label: 'Default' },
  { key: 'pills', icon: '&#9673;', label: 'Pills' },
  { key: 'underline', icon: '&#818;&#818;&#818;', label: 'Underline' },
  { key: 'boxed', icon: '&#9634;', label: 'Boxed' }
];

const ALIGNMENTS: IStyleOption[] = [
  { key: 'left', icon: '&#9698;', label: 'Left' },
  { key: 'center', icon: '&#9670;', label: 'Center' },
  { key: 'right', icon: '&#9699;', label: 'Right' },
  { key: 'stretch', icon: '&#8596;', label: 'Stretch' }
];

export class AppearanceSection {
  private _el: HTMLElement | null = null;
  private _options: IAppearanceSectionOptions;
  private _controls: Array<{ dispose: () => void }> = [];

  constructor(options: IAppearanceSectionOptions) {
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
    const currentStyle = (opts.getProperty('tabStyle') as string) || 'default';
    const currentAlignment = (opts.getProperty('tabAlignment') as string) || 'stretch';
    const currentOrientation = (opts.getProperty('tabOrientation') as string) || 'horizontal';

    const html = `
      <div class="picanvas-config-section-title">Appearance</div>
      <div class="picanvas-config-section-desc">Configure tab style, alignment, orientation, and feature toggles.</div>

      <div class="picanvas-config-field-group">
        <div class="picanvas-config-field-group-title">Tab Style</div>
        <div class="picanvas-config-style-cards">
          ${TAB_STYLES.map(s => `
            <div class="picanvas-config-style-card${s.key === currentStyle ? ' active' : ''}" data-style="${s.key}">
              <span class="picanvas-config-style-card-icon">${s.icon}</span>
              <span class="picanvas-config-style-card-label">${s.label}</span>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="picanvas-config-field-group">
        <div class="picanvas-config-field-group-title">Tab Alignment</div>
        <div class="picanvas-config-style-cards">
          ${ALIGNMENTS.map(a => `
            <div class="picanvas-config-style-card${a.key === currentAlignment ? ' active' : ''}" data-alignment="${a.key}">
              <span class="picanvas-config-style-card-icon">${a.icon}</span>
              <span class="picanvas-config-style-card-label">${a.label}</span>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="picanvas-config-field-group" data-orientation-group></div>
      <div class="picanvas-config-field-group" data-features-group></div>
    `;

    this._el.innerHTML = html;

    // Bind style card clicks
    this._el.querySelectorAll('[data-style]').forEach(card => {
      card.addEventListener('click', () => {
        opts.setProperty('tabStyle', (card as HTMLElement).dataset.style || 'default');
        this.rebuild();
        opts.onChanged();
      });
    });

    this._el.querySelectorAll('[data-alignment]').forEach(card => {
      card.addEventListener('click', () => {
        opts.setProperty('tabAlignment', (card as HTMLElement).dataset.alignment || 'stretch');
        this.rebuild();
        opts.onChanged();
      });
    });

    // Orientation group
    const orientGroup = this._el.querySelector('[data-orientation-group]') as HTMLElement;
    if (orientGroup) {
      const titleEl = document.createElement('div');
      titleEl.className = 'picanvas-config-field-group-title';
      titleEl.textContent = 'Orientation & Layout';
      orientGroup.appendChild(titleEl);

      const orientDd = new DropdownControl({
        label: 'Tab Orientation',
        value: currentOrientation,
        options: [
          { key: 'horizontal', text: 'Horizontal (tabs on top)' },
          { key: 'vertical', text: 'Vertical (tabs on side)' }
        ],
        onChange: (v) => { opts.setProperty('tabOrientation', v); this.rebuild(); opts.onChanged(); }
      });
      orientDd.render(orientGroup);
      this._controls.push(orientDd);

      if (currentOrientation === 'vertical') {
        const posDd = new DropdownControl({
          label: 'Vertical Tab Position',
          value: (opts.getProperty('verticalTabPosition') as string) || 'left',
          options: [
            { key: 'left', text: 'Left side' },
            { key: 'right', text: 'Right side' }
          ],
          onChange: (v) => { opts.setProperty('verticalTabPosition', v); opts.onChanged(); }
        });
        posDd.render(orientGroup);
        this._controls.push(posDd);

        const widthDd = new DropdownControl({
          label: 'Vertical Tab Width',
          value: (opts.getProperty('verticalTabWidth') as string) || '200px',
          options: [
            { key: '150px', text: 'Narrow (150px)' },
            { key: '200px', text: 'Medium (200px)' },
            { key: '250px', text: 'Wide (250px)' },
            { key: '300px', text: 'Extra Wide (300px)' },
            { key: '25%', text: '25% of container' },
            { key: '33%', text: '33% of container' }
          ],
          onChange: (v) => { opts.setProperty('verticalTabWidth', v); opts.onChanged(); }
        });
        widthDd.render(orientGroup);
        this._controls.push(widthDd);
      }

      const imgDd = new DropdownControl({
        label: 'Label Image Size',
        value: (opts.getProperty('labelImageHeight') as string) || '60px',
        options: [
          { key: '40px', text: 'Small (40px)' },
          { key: '60px', text: 'Medium (60px)' },
          { key: '80px', text: 'Large (80px)' },
          { key: '100px', text: 'Extra Large (100px)' },
          { key: '120px', text: 'Huge (120px)' },
          { key: 'none', text: 'No limit (full size)' }
        ],
        onChange: (v) => { opts.setProperty('labelImageHeight', v); opts.onChanged(); }
      });
      imgDd.render(orientGroup);
      this._controls.push(imgDd);

      const themeDd = new DropdownControl({
        label: 'Theme Mode',
        value: (opts.getProperty('themeMode') as string) || 'auto',
        options: [
          { key: 'auto', text: 'Auto (detect from page)' },
          { key: 'light', text: 'Light' },
          { key: 'dark', text: 'Dark' }
        ],
        onChange: (v) => { opts.setProperty('themeMode', v); opts.onChanged(); }
      });
      themeDd.render(orientGroup);
      this._controls.push(themeDd);
    }

    // Feature toggles
    const featGroup = this._el.querySelector('[data-features-group]') as HTMLElement;
    if (featGroup) {
      const titleEl = document.createElement('div');
      titleEl.className = 'picanvas-config-field-group-title';
      titleEl.textContent = 'Features';
      featGroup.appendChild(titleEl);

      const features: Array<{ key: string; label: string; onText: string; offText: string; defaultVal: boolean }> = [
        { key: 'enableDeepLinking', label: 'URL Deep Linking', onText: 'Enabled', offText: 'Disabled', defaultVal: true },
        { key: 'enableLazyLoading', label: 'Lazy Loading', onText: 'Enabled', offText: 'Disabled', defaultVal: true },
        { key: 'enableFullWidthFix', label: 'Banner Full Width', onText: 'Full Width', offText: 'Contained', defaultVal: true }
      ];

      features.forEach(f => {
        const toggle = new ToggleControl({
          label: f.label,
          checked: f.defaultVal ? opts.getProperty(f.key) !== false : opts.getProperty(f.key) === true,
          onText: f.onText,
          offText: f.offText,
          onChange: (v) => { opts.setProperty(f.key, v); opts.onChanged(); }
        });
        toggle.render(featGroup);
        this._controls.push(toggle);
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
