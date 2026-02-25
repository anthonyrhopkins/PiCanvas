/**
 * AdvancedSection — Lock defaults, section/webpart selectors, reset.
 */
import { DropdownControl } from '../controls/DropdownControl';
import { ToggleControl } from '../controls/ToggleControl';
import { SliderControl } from '../controls/SliderControl';

export interface IAdvancedSectionOptions {
  getProperty: (key: string) => string | number | boolean | undefined;
  setProperty: (key: string, value: string | number | boolean | undefined) => void;
  onChanged: () => void;
  resetAllStyles: () => void;
}

export class AdvancedSection {
  private _el: HTMLElement | null = null;
  private _options: IAdvancedSectionOptions;
  private _controls: Array<{ dispose: () => void }> = [];

  constructor(options: IAdvancedSectionOptions) {
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
      <div class="picanvas-config-section-title">Advanced Settings</div>
      <div class="picanvas-config-section-desc">Lock defaults, CSS selectors, and troubleshooting.</div>

      <div class="picanvas-config-field-group">
        <div class="picanvas-config-field-group-title">Lock Defaults</div>
        <div data-lock-defaults></div>
      </div>

      <div class="picanvas-config-field-group">
        <div class="picanvas-config-field-group-title">CSS Selectors</div>
        <div class="picanvas-config-info">Most users never need to change these. Only modify if web parts aren't detected.</div>
        <div data-selectors></div>
      </div>

      <div class="picanvas-config-field-group">
        <div class="picanvas-config-field-group-title">Embed Security</div>
        <div class="picanvas-config-info">Add custom domains to the embed allowlist. Built-in domains (YouTube, Vimeo, etc.) are always allowed.</div>
        <div data-embed-security></div>
      </div>

      <div class="picanvas-config-field-group">
        <div class="picanvas-config-field-group-title">Reset</div>
        <button type="button" class="picanvas-config-btn picanvas-config-btn-cancel" data-action="reset-all" style="color:#d83b01;border-color:#d83b01;">Reset All Styles to Defaults</button>
      </div>
    `;

    // Lock defaults
    const lockArea = this._el.querySelector('[data-lock-defaults]') as HTMLElement;
    if (lockArea) {
      const ttlSlider = new SliderControl({
        label: 'Unlock Duration (minutes)',
        value: String(opts.getProperty('lockUnlockTtlMinutes') || 30),
        min: 1, max: 1440, step: 1, suffix: ' min',
        presets: [
          { value: 5, label: '5m' }, { value: 15, label: '15m' },
          { value: 30, label: '30m' }, { value: 60, label: '1h' },
          { value: 480, label: '8h' }
        ],
        onChange: (v) => { opts.setProperty('lockUnlockTtlMinutes', parseInt(v, 10) || 30); opts.onChanged(); }
      });
      ttlSlider.render(lockArea);
      this._controls.push(ttlSlider);

      const tmplToggle = new ToggleControl({
        label: 'Custom Default Lock Screen',
        checked: opts.getProperty('lockDefaultTemplateEnabled') === true,
        onText: 'Custom',
        offText: 'Default',
        onChange: (v) => { opts.setProperty('lockDefaultTemplateEnabled', v); this.rebuild(); opts.onChanged(); }
      });
      tmplToggle.render(lockArea);
      this._controls.push(tmplToggle);

      if (opts.getProperty('lockDefaultTemplateEnabled')) {
        this._renderTextArea(lockArea, 'lockDefaultTemplate', 'Default Lock Screen HTML',
          'Include data-picanvas-lock-input, data-picanvas-lock-submit, data-picanvas-lock-message');
      }

      const msgToggle = new ToggleControl({
        label: 'Custom Default Messages',
        checked: opts.getProperty('lockDefaultMessagesEnabled') === true,
        onText: 'Custom',
        offText: 'Default',
        onChange: (v) => { opts.setProperty('lockDefaultMessagesEnabled', v); this.rebuild(); opts.onChanged(); }
      });
      msgToggle.render(lockArea);
      this._controls.push(msgToggle);

      if (opts.getProperty('lockDefaultMessagesEnabled')) {
        ['Prompt', 'Error', 'Missing', 'Success'].forEach(msgType => {
          this._renderTextField(lockArea, `lockDefaultMessage${msgType}`, `Default ${msgType} Message`, '');
        });
      }
    }

    // CSS Selectors
    const selectorsArea = this._el.querySelector('[data-selectors]') as HTMLElement;
    if (selectorsArea) {
      const sectionDd = new DropdownControl({
        label: 'Section Selector',
        value: (opts.getProperty('sectionClass') as string) || 'CanvasSection',
        options: [
          { key: 'CanvasSection', text: 'CanvasSection (Default - Modern pages)' },
          { key: 'CanvasZone', text: 'CanvasZone (Some SP versions)' },
          { key: 'WebPartZone', text: 'WebPartZone (Classic pages)' },
          { key: 'ms-webpart-zone', text: 'ms-webpart-zone (Classic zones)' }
        ],
        onChange: (v) => { opts.setProperty('sectionClass', v); opts.onChanged(); }
      });
      sectionDd.render(selectorsArea);
      this._controls.push(sectionDd);

      const wpDd = new DropdownControl({
        label: 'Web Part Selector',
        value: (opts.getProperty('webpartClass') as string) || 'ControlZone',
        options: [
          { key: 'ControlZone', text: 'ControlZone (Default - Modern pages)' },
          { key: 'CanvasControl', text: 'CanvasControl (Some SP versions)' },
          { key: 'WebPart', text: 'WebPart (Classic pages)' },
          { key: 'ms-webpartzone-cell', text: 'ms-webpartzone-cell (Classic cells)' }
        ],
        onChange: (v) => { opts.setProperty('webpartClass', v); opts.onChanged(); }
      });
      wpDd.render(selectorsArea);
      this._controls.push(wpDd);
    }

    // Embed Security
    const embedSecurityArea = this._el.querySelector('[data-embed-security]') as HTMLElement;
    if (embedSecurityArea) {
      this._renderTextField(embedSecurityArea, 'embedCustomDomains', 'Custom Embed Domains', 'e.g. myapp.example.com, internal.corp.net');
    }

    // Reset button
    const resetBtn = this._el.querySelector('[data-action="reset-all"]');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        opts.resetAllStyles();
        this.rebuild();
        opts.onChanged();
      });
    }
  }

  private _renderTextField(container: HTMLElement, key: string, label: string, placeholder: string): void {
    const opts = this._options;
    const wrapper = document.createElement('div');
    wrapper.style.marginBottom = '12px';
    wrapper.innerHTML = `
      <label class="picanvas-config-field-label">${label}</label>
      <input type="text" class="picanvas-config-text-input" value="${this._escapeAttr((opts.getProperty(key) as string) || '')}" placeholder="${this._escapeAttr(placeholder)}" />
    `;
    const input = wrapper.querySelector('input') as HTMLInputElement;
    input.addEventListener('change', () => {
      opts.setProperty(key, input.value);
      opts.onChanged();
    });
    container.appendChild(wrapper);
  }

  private _renderTextArea(container: HTMLElement, key: string, label: string, placeholder: string): void {
    const opts = this._options;
    const wrapper = document.createElement('div');
    wrapper.style.marginBottom = '12px';
    wrapper.innerHTML = `
      <label class="picanvas-config-field-label">${label}</label>
      <textarea class="picanvas-config-textarea" placeholder="${this._escapeAttr(placeholder)}">${this._escapeHtml((opts.getProperty(key) as string) || '')}</textarea>
    `;
    const textarea = wrapper.querySelector('textarea') as HTMLTextAreaElement;
    textarea.addEventListener('change', () => {
      opts.setProperty(key, textarea.value);
      opts.onChanged();
    });
    container.appendChild(wrapper);
  }

  private _escapeHtml(str: string): string {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  private _escapeAttr(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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
