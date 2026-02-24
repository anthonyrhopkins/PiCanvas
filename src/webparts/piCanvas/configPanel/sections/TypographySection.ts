/**
 * TypographySection — Sliders for font size, weight, padding, gap, border radius,
 * indicator width, shadow, transitions.
 */
import { SliderControl } from '../controls/SliderControl';
import { DropdownControl } from '../controls/DropdownControl';
import { ToggleControl } from '../controls/ToggleControl';

export interface ITypographySectionOptions {
  getProperty: (key: string) => string | number | boolean | undefined;
  setProperty: (key: string, value: string | number | boolean | undefined) => void;
  onChanged: () => void;
}

export class TypographySection {
  private _el: HTMLElement | null = null;
  private _options: ITypographySectionOptions;
  private _controls: Array<{ dispose: () => void }> = [];

  constructor(options: ITypographySectionOptions) {
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

    this._el.innerHTML = `
      <div class="picanvas-config-section-title">Typography & Spacing</div>
      <div class="picanvas-config-section-desc">Fine-tune font sizes, spacing, borders, and effects.</div>
      <div class="picanvas-config-field-group">
        <div class="picanvas-config-field-group-title">Typography</div>
        <div class="picanvas-config-field-row" data-typography-grid></div>
      </div>
      <div class="picanvas-config-field-group">
        <div class="picanvas-config-field-group-title">Spacing</div>
        <div class="picanvas-config-field-row" data-spacing-grid></div>
      </div>
      <div class="picanvas-config-field-group">
        <div class="picanvas-config-field-group-title">Borders & Effects</div>
        <div data-effects-area></div>
      </div>
    `;

    // Typography sliders
    const typoGrid = this._el.querySelector('[data-typography-grid]') as HTMLElement;
    if (typoGrid) {
      const cell1 = document.createElement('div');
      typoGrid.appendChild(cell1);
      const fontSize = new SliderControl({
        label: 'Font Size',
        value: (opts.getProperty('tabFontSize') as string) || '14px',
        min: 10, max: 24, step: 1, suffix: 'px',
        presets: [
          { value: 12, label: '12' }, { value: 14, label: '14' },
          { value: 16, label: '16' }, { value: 18, label: '18' }, { value: 20, label: '20' }
        ],
        onChange: (v) => { opts.setProperty('tabFontSize', v); opts.onChanged(); }
      });
      fontSize.render(cell1);
      this._controls.push(fontSize);

      const cell2 = document.createElement('div');
      typoGrid.appendChild(cell2);
      const fontWeight = new SliderControl({
        label: 'Font Weight',
        value: (opts.getProperty('tabFontWeight') as string) || '500',
        min: 300, max: 700, step: 100, suffix: '',
        presets: [
          { value: 400, label: 'Normal' }, { value: 500, label: 'Medium' },
          { value: 600, label: 'Semi-Bold' }, { value: 700, label: 'Bold' }
        ],
        onChange: (v) => { opts.setProperty('tabFontWeight', v.replace(/[^0-9]/g, '')); opts.onChanged(); }
      });
      fontWeight.render(cell2);
      this._controls.push(fontWeight);
    }

    // Spacing sliders
    const spacingGrid = this._el.querySelector('[data-spacing-grid]') as HTMLElement;
    if (spacingGrid) {
      const sliders: Array<{ label: string; key: string; max: number; defaultVal: string }> = [
        { label: 'Vertical Padding', key: 'tabPaddingVertical', max: 30, defaultVal: '12px' },
        { label: 'Horizontal Padding', key: 'tabPaddingHorizontal', max: 48, defaultVal: '20px' },
        { label: 'Tab Gap', key: 'tabGap', max: 20, defaultVal: '0px' },
        { label: 'Content Gap', key: 'tabContentGap', max: 40, defaultVal: '0px' }
      ];

      sliders.forEach(s => {
        const cell = document.createElement('div');
        spacingGrid.appendChild(cell);
        const slider = new SliderControl({
          label: s.label,
          value: (opts.getProperty(s.key) as string) || s.defaultVal,
          min: 0, max: s.max, step: 1, suffix: 'px',
          onChange: (v) => { opts.setProperty(s.key, v); opts.onChanged(); }
        });
        slider.render(cell);
        this._controls.push(slider);
      });
    }

    // Effects area
    const effectsArea = this._el.querySelector('[data-effects-area]') as HTMLElement;
    if (effectsArea) {
      const row = document.createElement('div');
      row.className = 'picanvas-config-field-row';
      effectsArea.appendChild(row);

      // Border radius slider
      const cell1 = document.createElement('div');
      row.appendChild(cell1);
      const borderRadius = new SliderControl({
        label: 'Corner Radius',
        value: (opts.getProperty('tabBorderRadius') as string) || '0px',
        min: 0, max: 20, step: 1, suffix: 'px',
        presets: [
          { value: 0, label: 'Square' }, { value: 4, label: '4' },
          { value: 8, label: '8' }, { value: 12, label: '12' }, { value: 16, label: 'Pill' }
        ],
        onChange: (v) => { opts.setProperty('tabBorderRadius', v); opts.onChanged(); }
      });
      borderRadius.render(cell1);
      this._controls.push(borderRadius);

      // Indicator width slider
      const cell2 = document.createElement('div');
      row.appendChild(cell2);
      const indicatorWidth = new SliderControl({
        label: 'Indicator Width',
        value: (opts.getProperty('activeIndicatorWidth') as string) || '3px',
        min: 1, max: 8, step: 1, suffix: 'px',
        presets: [
          { value: 2, label: 'Thin' }, { value: 3, label: 'Normal' },
          { value: 4, label: 'Medium' }, { value: 6, label: 'Thick' }
        ],
        onChange: (v) => { opts.setProperty('activeIndicatorWidth', v); opts.onChanged(); }
      });
      indicatorWidth.render(cell2);
      this._controls.push(indicatorWidth);

      // Shadow dropdown
      const shadowDd = new DropdownControl({
        label: 'Shadow Effect',
        value: (opts.getProperty('tabShadow') as string) || '',
        options: [
          { key: '', text: 'None (default)' },
          { key: 'none', text: 'None' },
          { key: '0 1px 2px rgba(0,0,0,0.1)', text: 'Subtle' },
          { key: '0 2px 4px rgba(0,0,0,0.15)', text: 'Medium' },
          { key: '0 4px 8px rgba(0,0,0,0.2)', text: 'Strong' },
          { key: '0 2px 8px rgba(0,120,212,0.3)', text: 'Blue Glow' },
          { key: '0 2px 8px rgba(16,124,16,0.3)', text: 'Green Glow' },
          { key: '0 2px 8px rgba(92,45,145,0.3)', text: 'Purple Glow' }
        ],
        onChange: (v) => { opts.setProperty('tabShadow', v); opts.onChanged(); }
      });
      shadowDd.render(effectsArea);
      this._controls.push(shadowDd);

      // Toggle row
      const toggleRow = document.createElement('div');
      toggleRow.className = 'picanvas-config-field-row';
      effectsArea.appendChild(toggleRow);

      const toggleCell1 = document.createElement('div');
      toggleRow.appendChild(toggleCell1);
      const indicatorToggle = new ToggleControl({
        label: 'Active Tab Indicator',
        checked: opts.getProperty('showActiveIndicator') !== false,
        onText: 'Visible',
        offText: 'Hidden',
        onChange: (v) => { opts.setProperty('showActiveIndicator', v); opts.onChanged(); }
      });
      indicatorToggle.render(toggleCell1);
      this._controls.push(indicatorToggle);

      const toggleCell2 = document.createElement('div');
      toggleRow.appendChild(toggleCell2);
      const separatorToggle = new ToggleControl({
        label: 'Tab Separator Lines',
        checked: opts.getProperty('showTabSeparator') !== false,
        onText: 'Visible',
        offText: 'Hidden',
        onChange: (v) => { opts.setProperty('showTabSeparator', v); opts.onChanged(); }
      });
      separatorToggle.render(toggleCell2);
      this._controls.push(separatorToggle);

      const toggleCell3 = document.createElement('div');
      toggleRow.appendChild(toggleCell3);
      const transitionToggle = new ToggleControl({
        label: 'Animations',
        checked: opts.getProperty('enableTransitions') !== false,
        onText: 'On',
        offText: 'Off',
        onChange: (v) => { opts.setProperty('enableTransitions', v); opts.onChanged(); }
      });
      transitionToggle.render(toggleCell3);
      this._controls.push(transitionToggle);
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
