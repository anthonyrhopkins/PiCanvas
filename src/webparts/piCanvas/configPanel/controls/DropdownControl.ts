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

  private static _escapeHtml(str: string): string {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  private static _buildOptions(options: IDropdownOption[], selectedKey: string): string {
    return options.map(o =>
      `<option value="${DropdownControl._escapeHtml(o.key)}"${o.key === selectedKey ? ' selected' : ''}>${DropdownControl._escapeHtml(o.text)}</option>`
    ).join('');
  }

  public render(container: HTMLElement): void {
    const opts = this._options;

    const wrapper = document.createElement('div');
    wrapper.className = 'picanvas-config-dropdown-control';

    wrapper.innerHTML = `
      <label class="picanvas-config-field-label">${DropdownControl._escapeHtml(opts.label)}</label>
      <select class="picanvas-config-dropdown">
        ${DropdownControl._buildOptions(opts.options, opts.value)}
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
    select.innerHTML = DropdownControl._buildOptions(options, selectedValue || this._options.value);
  }

  public dispose(): void {
    this._el = null;
  }
}
