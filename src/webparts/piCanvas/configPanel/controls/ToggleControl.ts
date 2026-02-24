/**
 * ToggleControl — CSS-styled checkbox as toggle switch
 */
export interface IToggleControlOptions {
  label: string;
  checked: boolean;
  onText?: string;
  offText?: string;
  onChange: (checked: boolean) => void;
}

export class ToggleControl {
  private _el: HTMLElement | null = null;
  private _options: IToggleControlOptions;

  constructor(options: IToggleControlOptions) {
    this._options = options;
  }

  public render(container: HTMLElement): void {
    const opts = this._options;
    const id = `toggle-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

    const wrapper = document.createElement('div');
    wrapper.className = 'picanvas-config-toggle-control';

    wrapper.innerHTML = `
      <div class="picanvas-config-toggle-row">
        <label class="picanvas-config-field-label" for="${id}">${opts.label}</label>
        <div class="picanvas-config-toggle-wrapper">
          <input type="checkbox" id="${id}" class="picanvas-config-toggle-input" ${opts.checked ? 'checked' : ''} />
          <label class="picanvas-config-toggle-switch" for="${id}"></label>
          <span class="picanvas-config-toggle-text">${opts.checked ? (opts.onText || 'On') : (opts.offText || 'Off')}</span>
        </div>
      </div>
    `;

    const checkbox = wrapper.querySelector('.picanvas-config-toggle-input') as HTMLInputElement;
    const statusText = wrapper.querySelector('.picanvas-config-toggle-text') as HTMLElement;

    checkbox.addEventListener('change', () => {
      statusText.textContent = checkbox.checked ? (opts.onText || 'On') : (opts.offText || 'Off');
      opts.onChange(checkbox.checked);
    });

    this._el = wrapper;
    container.appendChild(wrapper);
  }

  public updateValue(checked: boolean): void {
    if (!this._el) return;
    const checkbox = this._el.querySelector('.picanvas-config-toggle-input') as HTMLInputElement;
    const statusText = this._el.querySelector('.picanvas-config-toggle-text') as HTMLElement;
    if (checkbox) checkbox.checked = checked;
    if (statusText) {
      statusText.textContent = checked ? (this._options.onText || 'On') : (this._options.offText || 'Off');
    }
  }

  public dispose(): void {
    this._el = null;
  }
}
