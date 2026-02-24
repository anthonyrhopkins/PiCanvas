/**
 * DropdownControl — styled <select> wrapper
 */
export interface IDropdownOption {
  key: string;
  text: string;
}

export interface IDropdownControlOptions {
  label: string;
  value: string;
  options: IDropdownOption[];
  onChange: (value: string) => void;
}

export class DropdownControl {
  private _el: HTMLElement | null = null;
  private _options: IDropdownControlOptions;

  constructor(options: IDropdownControlOptions) {
    this._options = options;
  }

  public render(container: HTMLElement): void {
    const opts = this._options;

    const wrapper = document.createElement('div');
    wrapper.className = 'picanvas-config-dropdown-control';

    wrapper.innerHTML = `
      <label class="picanvas-config-field-label">${opts.label}</label>
      <select class="picanvas-config-dropdown">
        ${opts.options.map(o => `<option value="${o.key}"${o.key === opts.value ? ' selected' : ''}>${o.text}</option>`).join('')}
      </select>
    `;

    const select = wrapper.querySelector('.picanvas-config-dropdown') as HTMLSelectElement;
    select.addEventListener('change', () => {
      opts.onChange(select.value);
    });

    this._el = wrapper;
    container.appendChild(wrapper);
  }

  public updateValue(value: string): void {
    if (!this._el) return;
    const select = this._el.querySelector('.picanvas-config-dropdown') as HTMLSelectElement;
    if (select) select.value = value;
  }

  public updateOptions(options: IDropdownOption[], selectedValue?: string): void {
    if (!this._el) return;
    const select = this._el.querySelector('.picanvas-config-dropdown') as HTMLSelectElement;
    if (!select) return;
    select.innerHTML = options.map(o => `<option value="${o.key}"${o.key === (selectedValue || this._options.value) ? ' selected' : ''}>${o.text}</option>`).join('');
  }

  public dispose(): void {
    this._el = null;
  }
}
