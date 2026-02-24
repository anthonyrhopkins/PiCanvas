/**
 * SliderControl — styled <input type="range"> with value display and tick presets
 */
export interface ISliderControlOptions {
  label: string;
  value: string;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  presets?: { value: number; label: string }[];
  onChange: (value: string) => void;
}

export class SliderControl {
  private _el: HTMLElement | null = null;
  private _options: ISliderControlOptions;

  constructor(options: ISliderControlOptions) {
    this._options = options;
  }

  public render(container: HTMLElement): void {
    const opts = this._options;
    const suffix = opts.suffix || '';
    const numericValue = parseFloat(opts.value) || opts.min;

    const wrapper = document.createElement('div');
    wrapper.className = 'picanvas-config-slider-control';

    const presetTicks = opts.presets
      ? `<div class="picanvas-config-slider-ticks">${opts.presets.map(p =>
          `<button type="button" class="picanvas-config-slider-tick${p.value === numericValue ? ' active' : ''}" data-value="${p.value}" title="${p.label}">${p.label}</button>`
        ).join('')}</div>`
      : '';

    wrapper.innerHTML = `
      <div class="picanvas-config-slider-header">
        <label class="picanvas-config-field-label">${opts.label}</label>
        <span class="picanvas-config-slider-value">${numericValue}${suffix}</span>
      </div>
      <input type="range" class="picanvas-config-slider" min="${opts.min}" max="${opts.max}" step="${opts.step}" value="${numericValue}" />
      ${presetTicks}
    `;

    const slider = wrapper.querySelector('.picanvas-config-slider') as HTMLInputElement;
    const valueDisplay = wrapper.querySelector('.picanvas-config-slider-value') as HTMLElement;
    const ticks = wrapper.querySelectorAll('.picanvas-config-slider-tick');

    const update = (val: number): void => {
      slider.value = String(val);
      valueDisplay.textContent = `${val}${suffix}`;
      ticks.forEach(t => {
        t.classList.toggle('active', Number((t as HTMLElement).dataset.value) === val);
      });
      opts.onChange(`${val}${suffix}`);
    };

    slider.addEventListener('input', () => update(Number(slider.value)));

    ticks.forEach(tick => {
      tick.addEventListener('click', () => {
        update(Number((tick as HTMLElement).dataset.value));
      });
    });

    this._el = wrapper;
    container.appendChild(wrapper);
  }

  public updateValue(value: string): void {
    if (!this._el) return;
    const numericValue = parseFloat(value) || 0;
    const slider = this._el.querySelector('.picanvas-config-slider') as HTMLInputElement;
    const valueDisplay = this._el.querySelector('.picanvas-config-slider-value') as HTMLElement;
    if (slider) slider.value = String(numericValue);
    if (valueDisplay) valueDisplay.textContent = `${numericValue}${this._options.suffix || ''}`;
  }

  public dispose(): void {
    this._el = null;
  }
}
