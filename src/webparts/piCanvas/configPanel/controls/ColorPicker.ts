/**
 * ColorPicker control — <input type="color"> + swatch presets + hex input
 * All three inputs stay synced. Calls onChange with hex string.
 */
export interface IColorPickerOptions {
  label: string;
  value: string;
  presets?: string[];
  onChange: (value: string) => void;
}

const DEFAULT_PRESETS = [
  '#0078d4', '#107c10', '#5c2d91', '#d83b01', '#e81123',
  '#008272', '#ffb900', '#000000', '#767676', '#ffffff'
];

export class ColorPicker {
  private _el: HTMLElement | null = null;
  private _options: IColorPickerOptions;

  constructor(options: IColorPickerOptions) {
    this._options = options;
  }

  public render(container: HTMLElement): void {
    const opts = this._options;
    const presets = opts.presets || DEFAULT_PRESETS;
    const currentValue = opts.value || '#0078d4';

    const wrapper = document.createElement('div');
    wrapper.className = 'picanvas-config-color-picker';

    wrapper.innerHTML = `
      <label class="picanvas-config-field-label">${opts.label}</label>
      <div class="picanvas-config-color-picker-row">
        <input type="color" class="picanvas-config-color-input" value="${currentValue}" />
        <input type="text" class="picanvas-config-color-hex" value="${currentValue}" maxlength="7" spellcheck="false" />
      </div>
      <div class="picanvas-config-color-swatches">
        ${presets.map(c => `<button type="button" class="picanvas-config-color-swatch${c === currentValue ? ' active' : ''}" data-color="${c}" style="background:${c};" title="${c}"></button>`).join('')}
      </div>
    `;

    const colorInput = wrapper.querySelector('.picanvas-config-color-input') as HTMLInputElement;
    const hexInput = wrapper.querySelector('.picanvas-config-color-hex') as HTMLInputElement;
    const swatches = wrapper.querySelectorAll('.picanvas-config-color-swatch');

    const sync = (hex: string): void => {
      const normalized = hex.startsWith('#') ? hex : `#${hex}`;
      colorInput.value = normalized;
      hexInput.value = normalized;
      swatches.forEach(s => {
        s.classList.toggle('active', (s as HTMLElement).dataset.color === normalized);
      });
      opts.onChange(normalized);
    };

    colorInput.addEventListener('input', () => sync(colorInput.value));

    hexInput.addEventListener('change', () => {
      let val = hexInput.value.trim();
      if (!val.startsWith('#')) val = '#' + val;
      if (/^#[0-9a-fA-F]{6}$/.test(val)) {
        sync(val);
      }
    });

    swatches.forEach(swatch => {
      swatch.addEventListener('click', () => {
        const color = (swatch as HTMLElement).dataset.color || '#0078d4';
        sync(color);
      });
    });

    this._el = wrapper;
    container.appendChild(wrapper);
  }

  public updateValue(value: string): void {
    if (!this._el) return;
    const colorInput = this._el.querySelector('.picanvas-config-color-input') as HTMLInputElement;
    const hexInput = this._el.querySelector('.picanvas-config-color-hex') as HTMLInputElement;
    if (colorInput) colorInput.value = value;
    if (hexInput) hexInput.value = value;
    const swatches = this._el.querySelectorAll('.picanvas-config-color-swatch');
    swatches.forEach(s => {
      s.classList.toggle('active', (s as HTMLElement).dataset.color === value);
    });
  }

  public dispose(): void {
    this._el = null;
  }
}
