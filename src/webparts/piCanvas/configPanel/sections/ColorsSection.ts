/**
 * ColorsSection — Theme presets, color pickers for accent/text/background colors.
 */
import { ColorPicker } from '../controls/ColorPicker';

export interface IColorsSectionOptions {
  getProperty: (key: string) => string | number | boolean | undefined;
  setProperty: (key: string, value: string | number | boolean | undefined) => void;
  onChanged: () => void;
  getThemePresets: () => Array<{
    id: string;
    name: string;
    accentColor: string;
    tabStyle?: string;
    properties: Record<string, string | number | boolean | undefined>;
  }>;
}

interface IColorField {
  key: string;
  label: string;
  defaultValue: string;
  presets?: string[];
}

const BG_PRESETS = ['transparent', '#ffffff', '#f5f5f5', '#e0e0e0', '#fafafa', '#e8f4fd', '#e8f5e9', '#f3e5f5'];
const TEXT_PRESETS = ['rgba(0,0,0,0.7)', 'rgba(0,0,0,0.87)', '#000000', '#ffffff', '#0078d4', '#107c10', '#5c2d91'];

const COLOR_FIELDS: IColorField[] = [
  { key: 'accentColor', label: 'Accent Color', defaultValue: '#0078d4' },
  { key: 'tabTextColor', label: 'Tab Text Color', defaultValue: '#555555', presets: TEXT_PRESETS },
  { key: 'tabActiveTextColor', label: 'Active Tab Text', defaultValue: '#0078d4', presets: TEXT_PRESETS },
  { key: 'tabBackgroundColor', label: 'Tab Background', defaultValue: '#ffffff', presets: BG_PRESETS },
  { key: 'tabActiveBackgroundColor', label: 'Active Tab Background', defaultValue: '#ffffff', presets: BG_PRESETS },
  { key: 'tabHoverBackgroundColor', label: 'Hover Background', defaultValue: '#f0f0f0', presets: BG_PRESETS },
  { key: 'activeIndicatorColor', label: 'Indicator Color', defaultValue: '#0078d4' },
  { key: 'tabSeparatorColor', label: 'Separator Color', defaultValue: '#e0e0e0' }
];

export class ColorsSection {
  private _el: HTMLElement | null = null;
  private _options: IColorsSectionOptions;
  private _controls: Array<{ dispose: () => void }> = [];

  constructor(options: IColorsSectionOptions) {
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
    const presets = opts.getThemePresets();

    let html = `
      <div class="picanvas-config-section-title">Colors</div>
      <div class="picanvas-config-section-desc">Apply a theme preset or customize individual colors.</div>
    `;

    // Theme presets
    if (presets.length > 0) {
      html += `
        <div class="picanvas-config-field-group">
          <div class="picanvas-config-field-group-title">Theme Presets</div>
          <div class="picanvas-config-theme-presets">
            ${presets.map(p => `
              <div class="picanvas-config-theme-card" data-preset="${p.id}" title="${p.name}">
                <div class="picanvas-config-theme-card-preview">
                  <div class="picanvas-config-theme-card-swatch" style="background:${p.accentColor}"></div>
                  <div class="picanvas-config-theme-card-swatch" style="background:${p.properties['tabBackgroundColor'] || '#ffffff'}"></div>
                  <div class="picanvas-config-theme-card-swatch" style="background:${p.properties['tabTextColor'] || '#555555'}"></div>
                </div>
                <div class="picanvas-config-theme-card-name">${p.name}</div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    html += `
      <div class="picanvas-config-field-group">
        <div class="picanvas-config-field-group-title">Custom Colors</div>
        <div class="picanvas-config-field-row" data-colors-grid></div>
      </div>
    `;

    this._el.innerHTML = html;

    // Bind preset clicks
    this._el.querySelectorAll('[data-preset]').forEach(card => {
      card.addEventListener('click', () => {
        const presetId = (card as HTMLElement).dataset.preset;
        const preset = presets.find(p => p.id === presetId);
        if (preset) {
          Object.entries(preset.properties).forEach(([k, v]) => {
            opts.setProperty(k, v);
          });
          this.rebuild();
          opts.onChanged();
        }
      });
    });

    // Render color pickers in the grid
    const grid = this._el.querySelector('[data-colors-grid]') as HTMLElement;
    if (grid) {
      COLOR_FIELDS.forEach(f => {
        const cell = document.createElement('div');
        grid.appendChild(cell);
        const rawValue = opts.getProperty(f.key) as string;
        const value = rawValue || f.defaultValue;
        // Only render color picker for valid hex colors
        const hexValue = this._toHex(value);
        const picker = new ColorPicker({
          label: f.label,
          value: hexValue,
          presets: f.presets,
          onChange: (v) => { opts.setProperty(f.key, v); opts.onChanged(); }
        });
        picker.render(cell);
        this._controls.push(picker);
      });
    }
  }

  /**
   * Convert various color formats to hex for the color input
   */
  private _toHex(color: string): string {
    if (!color || color === 'transparent') return '#ffffff';
    if (color.startsWith('#') && color.length === 7) return color;
    if (color.startsWith('#') && color.length === 4) {
      // Expand shorthand
      return '#' + color[1] + color[1] + color[2] + color[2] + color[3] + color[3];
    }
    // For rgba/rgb values, try to convert via canvas
    if (color.startsWith('rgb')) {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 1;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = color;
          ctx.fillRect(0, 0, 1, 1);
          const data = ctx.getImageData(0, 0, 1, 1).data;
          return '#' + ((1 << 24) + (data[0] << 16) + (data[1] << 8) + data[2]).toString(16).slice(1);
        }
      } catch {
        // fallback
      }
    }
    return color.startsWith('#') ? color : '#0078d4';
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
