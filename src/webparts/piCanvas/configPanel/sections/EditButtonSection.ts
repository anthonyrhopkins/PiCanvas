/**
 * EditButtonSection — Configure the floating edit button appearance and position.
 * Shows a live preview mockup, position/style card selectors, size, opacity, colors, and label.
 */
import { ToggleControl } from '../controls/ToggleControl';
import { DropdownControl } from '../controls/DropdownControl';
import { SliderControl } from '../controls/SliderControl';
import { ColorPicker } from '../controls/ColorPicker';
import {
  IEditButtonConfig,
  getEditButtonConfig,
  getSizePx
} from '../../services/EditButtonConfig';

export interface IEditButtonSectionOptions {
  getProperty: (key: string) => string | number | boolean | undefined;
  setProperty: (key: string, value: string | number | boolean | undefined) => void;
  onChanged: () => void;
}

export class EditButtonSection {
  private _el: HTMLElement | null = null;
  private _options: IEditButtonSectionOptions;
  private _controls: Array<{ dispose: () => void }> = [];

  constructor(options: IEditButtonSectionOptions) {
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
    const config = getEditButtonConfig(opts.getProperty);

    const positions: Array<{ key: IEditButtonConfig['position']; label: string; arrow: string }> = [
      { key: 'top-left', label: 'Top Left', arrow: '&#8598;' },
      { key: 'top-right', label: 'Top Right', arrow: '&#8599;' },
      { key: 'bottom-left', label: 'Bottom Left', arrow: '&#8601;' },
      { key: 'bottom-right', label: 'Bottom Right', arrow: '&#8600;' }
    ];

    const styles: Array<{ key: IEditButtonConfig['style']; label: string; desc: string }> = [
      { key: 'icon', label: 'Icon', desc: 'Pencil icon only' },
      { key: 'icon-label', label: 'Icon + Label', desc: 'Icon with text' },
      { key: 'dot', label: 'Dot', desc: 'Minimal dot indicator' },
      { key: 'text', label: 'Text', desc: 'Text label only' }
    ];

    this._el.innerHTML = `
      <style>
        .pc-eb-section { padding:4px 0; }
        .pc-eb-title { font-size:20px; font-weight:700; color:var(--picanvas-config-text,#222); margin-bottom:4px; }
        .pc-eb-desc { font-size:13px; color:var(--picanvas-config-text-secondary,#666); margin-bottom:20px; line-height:1.5; }

        .pc-eb-preview-frame { width:100%; max-width:280px; height:160px; border-radius:8px; border:1px solid var(--picanvas-config-border,#ddd); background:#f8f8f8; position:relative; overflow:hidden; margin-bottom:24px; }
        .pc-eb-preview-topbar { height:20px; background:#1b1b1b; display:flex; align-items:center; padding:0 8px; }
        .pc-eb-preview-topbar-dot { width:6px; height:6px; border-radius:50%; background:#555; margin-right:4px; }
        .pc-eb-preview-body { position:relative; height:calc(100% - 20px); background:#fafafa; }
        .pc-eb-preview-btn { position:absolute; display:flex; align-items:center; justify-content:center; gap:3px; cursor:default; transition:all 0.3s; font-family:-apple-system,BlinkMacSystemFont,sans-serif; white-space:nowrap; }

        .pc-eb-cards { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:20px; }
        .pc-eb-card { padding:10px; border:2px solid var(--picanvas-config-border,#ddd); border-radius:8px; cursor:pointer; text-align:center; transition:border-color 0.2s, background 0.2s; background:var(--picanvas-config-bg,#fff); }
        .pc-eb-card:hover { border-color:#0078d4; background:rgba(0,120,212,0.04); }
        .pc-eb-card.active { border-color:#0078d4; background:rgba(0,120,212,0.08); }
        .pc-eb-card-icon { font-size:18px; margin-bottom:2px; }
        .pc-eb-card-label { font-size:12px; font-weight:600; color:var(--picanvas-config-text,#222); }

        .pc-eb-field-label { font-size:13px; font-weight:600; color:var(--picanvas-config-text,#222); margin-bottom:6px; display:block; }
        .pc-eb-text-input { width:100%; padding:8px 10px; border:1px solid var(--picanvas-config-border,#ddd); border-radius:6px; font-size:13px; font-family:inherit; background:var(--picanvas-config-bg,#fff); color:var(--picanvas-config-text,#222); box-sizing:border-box; }
        .pc-eb-text-input:focus { outline:none; border-color:#0078d4; box-shadow:0 0 0 2px rgba(0,120,212,0.15); }
        .pc-eb-text-input:disabled { opacity:0.5; cursor:not-allowed; }

        .pc-eb-group { margin-bottom:20px; }
        .pc-eb-disabled { opacity:0.45; pointer-events:none; }
      </style>

      <div class="pc-eb-section">
        <div class="pc-eb-title">Edit Button</div>
        <div class="pc-eb-desc">Configure the floating edit button that appears when SharePoint chrome is hidden or in fullscreen modes.</div>

        <!-- Live Preview -->
        <div class="pc-eb-preview-frame" data-eb-preview>
          <div class="pc-eb-preview-topbar">
            <div class="pc-eb-preview-topbar-dot"></div>
            <div class="pc-eb-preview-topbar-dot"></div>
            <div class="pc-eb-preview-topbar-dot"></div>
          </div>
          <div class="pc-eb-preview-body">
            <div class="pc-eb-preview-btn" data-eb-preview-btn></div>
          </div>
        </div>

        <!-- Toggle -->
        <div class="pc-eb-group" data-eb-toggle></div>

        <!-- Controls container (disabled when toggle off) -->
        <div data-eb-controls>
          <!-- Position -->
          <div class="pc-eb-group">
            <span class="pc-eb-field-label">Position</span>
            <div class="pc-eb-cards">
              ${positions.map(p => `
                <div class="pc-eb-card${config.position === p.key ? ' active' : ''}" data-eb-position="${p.key}">
                  <div class="pc-eb-card-icon">${p.arrow}</div>
                  <div class="pc-eb-card-label">${p.label}</div>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Style -->
          <div class="pc-eb-group">
            <span class="pc-eb-field-label">Style</span>
            <div class="pc-eb-cards">
              ${styles.map(s => `
                <div class="pc-eb-card${config.style === s.key ? ' active' : ''}" data-eb-style="${s.key}">
                  <div class="pc-eb-card-label">${s.label}</div>
                  <div style="font-size:10px;color:var(--picanvas-config-text-secondary,#888);">${s.desc}</div>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Size -->
          <div class="pc-eb-group" data-eb-size></div>

          <!-- Opacity -->
          <div class="pc-eb-group" data-eb-opacity></div>

          <!-- Background color -->
          <div class="pc-eb-group" data-eb-bg-color></div>

          <!-- Icon/text color -->
          <div class="pc-eb-group" data-eb-icon-color></div>

          <!-- Label text -->
          <div class="pc-eb-group" data-eb-label>
            <label class="pc-eb-field-label">Button Label</label>
            <input type="text" class="pc-eb-text-input" data-eb-label-input value="${this._escapeAttr(config.label)}" placeholder="Edit Page" maxlength="30" ${config.style !== 'icon-label' && config.style !== 'text' ? 'disabled' : ''} />
            <div style="font-size:11px;color:var(--picanvas-config-text-secondary,#888);margin-top:4px;">Used with "Icon + Label" and "Text" styles</div>
          </div>
        </div>
      </div>
    `;

    // Bind toggle
    const toggleContainer = this._el.querySelector('[data-eb-toggle]') as HTMLElement;
    const controlsContainer = this._el.querySelector('[data-eb-controls]') as HTMLElement;

    const toggle = new ToggleControl({
      label: 'Show Edit Button',
      checked: config.enabled,
      onText: 'Visible',
      offText: 'Hidden',
      onChange: (checked) => {
        opts.setProperty('editButtonEnabled', checked);
        controlsContainer?.classList.toggle('pc-eb-disabled', !checked);
        this._updatePreview();
        opts.onChanged();
      }
    });
    toggle.render(toggleContainer);
    this._controls.push(toggle);

    if (!config.enabled) {
      controlsContainer?.classList.add('pc-eb-disabled');
    }

    // Bind position cards
    this._el.querySelectorAll('[data-eb-position]').forEach(card => {
      card.addEventListener('click', () => {
        const pos = (card as HTMLElement).dataset.ebPosition;
        opts.setProperty('editButtonPosition', pos);
        this._el!.querySelectorAll('[data-eb-position]').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        this._updatePreview();
        opts.onChanged();
      });
    });

    // Bind style cards
    this._el.querySelectorAll('[data-eb-style]').forEach(card => {
      card.addEventListener('click', () => {
        const style = (card as HTMLElement).dataset.ebStyle;
        opts.setProperty('editButtonStyle', style);
        this._el!.querySelectorAll('[data-eb-style]').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        // Enable/disable label input based on style
        const labelInput = this._el!.querySelector('[data-eb-label-input]') as HTMLInputElement;
        if (labelInput) {
          labelInput.disabled = (style !== 'icon-label' && style !== 'text');
        }
        this._updatePreview();
        opts.onChanged();
      });
    });

    // Size dropdown
    const sizeContainer = this._el.querySelector('[data-eb-size]') as HTMLElement;
    const sizeControl = new DropdownControl({
      label: 'Size',
      value: config.size,
      options: [
        { key: 'small', text: 'Small (32px)' },
        { key: 'medium', text: 'Medium (44px)' },
        { key: 'large', text: 'Large (56px)' }
      ],
      onChange: (val) => {
        opts.setProperty('editButtonSize', val);
        this._updatePreview();
        opts.onChanged();
      }
    });
    sizeControl.render(sizeContainer);
    this._controls.push(sizeControl);

    // Opacity slider
    const opacityContainer = this._el.querySelector('[data-eb-opacity]') as HTMLElement;
    const opacityControl = new SliderControl({
      label: 'Opacity',
      value: String(config.opacity),
      min: 0.3,
      max: 1.0,
      step: 0.05,
      presets: [
        { value: 0.3, label: '0.3' },
        { value: 0.7, label: '0.7' },
        { value: 1.0, label: '1.0' }
      ],
      onChange: (val) => {
        opts.setProperty('editButtonOpacity', parseFloat(val));
        this._updatePreview();
        opts.onChanged();
      }
    });
    opacityControl.render(opacityContainer);
    this._controls.push(opacityControl);

    // Background color picker
    const bgColorContainer = this._el.querySelector('[data-eb-bg-color]') as HTMLElement;
    const bgColorPicker = new ColorPicker({
      label: 'Background Color',
      value: this._toHex(config.bgColor),
      presets: ['#ffffff', '#f5f5f5', '#1b1b1b', '#0078d4', '#333333', '#000000'],
      onChange: (val) => {
        opts.setProperty('editButtonBgColor', val);
        this._updatePreview();
        opts.onChanged();
      }
    });
    bgColorPicker.render(bgColorContainer);
    this._controls.push(bgColorPicker);

    // Icon/text color picker
    const iconColorContainer = this._el.querySelector('[data-eb-icon-color]') as HTMLElement;
    const iconColorPicker = new ColorPicker({
      label: 'Icon / Text Color',
      value: config.iconColor,
      presets: ['#333333', '#000000', '#ffffff', '#0078d4', '#107c10', '#d83b01'],
      onChange: (val) => {
        opts.setProperty('editButtonIconColor', val);
        this._updatePreview();
        opts.onChanged();
      }
    });
    iconColorPicker.render(iconColorContainer);
    this._controls.push(iconColorPicker);

    // Label text input
    const labelInput = this._el.querySelector('[data-eb-label-input]') as HTMLInputElement;
    if (labelInput) {
      labelInput.addEventListener('input', () => {
        opts.setProperty('editButtonLabel', labelInput.value);
        this._updatePreview();
        opts.onChanged();
      });
    }

    // Initial preview
    this._updatePreview();
  }

  private _updatePreview(): void {
    if (!this._el) return;
    const config = getEditButtonConfig(this._options.getProperty);
    const previewBtn = this._el.querySelector('[data-eb-preview-btn]') as HTMLElement;
    if (!previewBtn) return;

    if (!config.enabled) {
      previewBtn.style.display = 'none';
      return;
    }
    previewBtn.style.display = 'flex';

    const px = getSizePx(config.size);
    // Scale for miniature preview (200x140 body area)
    const scale = 0.6;
    const scaledPx = Math.round(px * scale);
    const edge = 8;

    // Position within preview body
    let posStyle = '';
    switch (config.position) {
      case 'top-left': posStyle = `top:${edge}px;left:${edge}px;`; break;
      case 'top-right': posStyle = `top:${edge}px;right:${edge}px;`; break;
      case 'bottom-left': posStyle = `bottom:${edge}px;left:${edge}px;`; break;
      default: posStyle = `bottom:${edge}px;right:${edge}px;`; break;
    }

    const isRound = config.style === 'dot' || config.style === 'icon';
    const borderRadius = isRound ? '50%' : '6px';
    const needsAutoWidth = config.style === 'icon-label' || config.style === 'text';
    const widthCss = needsAutoWidth
      ? `height:${scaledPx}px;padding:0 ${Math.round(scaledPx * 0.3)}px;`
      : `width:${scaledPx}px;height:${scaledPx}px;`;

    previewBtn.style.cssText = `
      position:absolute;${posStyle}
      ${widthCss}
      background:${config.bgColor};
      border:1px solid rgba(0,0,0,0.08);
      border-radius:${borderRadius};
      display:flex;align-items:center;justify-content:center;gap:2px;
      box-shadow:0 1px 4px rgba(0,0,0,0.12);
      opacity:${config.opacity};
      font-family:-apple-system,BlinkMacSystemFont,sans-serif;
      white-space:nowrap;
    `;

    // Simplified inner content for preview
    const iconSz = Math.round(scaledPx * 0.45);
    const dotSz = Math.round(iconSz * 0.5);
    const fontSize = Math.round(iconSz * 0.55);
    const pencil = `<svg xmlns="http://www.w3.org/2000/svg" width="${iconSz}" height="${iconSz}" viewBox="0 0 24 24" fill="none" stroke="${config.iconColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
    const label = `<span style="font-size:${fontSize}px;font-weight:500;color:${config.iconColor};">${this._escapeHtml(config.label)}</span>`;

    switch (config.style) {
      case 'icon-label': previewBtn.innerHTML = `${pencil}${label}`; break;
      case 'dot': previewBtn.innerHTML = `<div style="width:${dotSz}px;height:${dotSz}px;border-radius:50%;background:${config.iconColor};"></div>`; break;
      case 'text': previewBtn.innerHTML = label; break;
      default: previewBtn.innerHTML = pencil; break;
    }
  }

  private _toHex(color: string): string {
    // Convert rgba(...) to hex for color picker. Fallback to the raw value if not rgba.
    const rgbaMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (rgbaMatch) {
      const r = parseInt(rgbaMatch[1], 10);
      const g = parseInt(rgbaMatch[2], 10);
      const b = parseInt(rgbaMatch[3], 10);
      return '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('');
    }
    return color;
  }

  private _escapeAttr(str: string): string {
    return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  private _escapeHtml(str: string): string {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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
