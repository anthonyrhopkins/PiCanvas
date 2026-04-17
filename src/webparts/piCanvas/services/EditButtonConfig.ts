/**
 * EditButtonConfig — Shared utility for the configurable edit button.
 * Consumed by PiCanvasWebPart.injectChromeEditButton() and ContentRenderer.injectEditButton().
 */

export interface IEditButtonConfig {
  enabled: boolean;
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  style: 'icon' | 'icon-label' | 'dot' | 'text';
  size: 'small' | 'medium' | 'large';
  opacity: number;
  bgColor: string;
  iconColor: string;
  label: string;
}

export const DEFAULT_EDIT_BUTTON_CONFIG: IEditButtonConfig = {
  enabled: true,
  position: 'bottom-right',
  style: 'icon',
  size: 'medium',
  opacity: 0.7,
  bgColor: 'rgba(255,255,255,0.92)',
  iconColor: '#333333',
  label: 'Edit Page'
};

export function getSizePx(size: string): number {
  switch (size) {
    case 'small': return 32;
    case 'large': return 56;
    default: return 44;
  }
}

export function getIconSize(size: string): number {
  switch (size) {
    case 'small': return 16;
    case 'large': return 24;
    default: return 20;
  }
}

/**
 * Extract edit button config from webpart properties.
 * Returns defaults for any undefined properties.
 */
export function getEditButtonConfig(
  getProperty: (key: string) => string | number | boolean | undefined
): IEditButtonConfig {
  const d = DEFAULT_EDIT_BUTTON_CONFIG;
  return {
    enabled: getProperty('editButtonEnabled') !== undefined ? getProperty('editButtonEnabled') as boolean : d.enabled,
    position: (getProperty('editButtonPosition') as IEditButtonConfig['position']) || d.position,
    style: (getProperty('editButtonStyle') as IEditButtonConfig['style']) || d.style,
    size: (getProperty('editButtonSize') as IEditButtonConfig['size']) || d.size,
    opacity: getProperty('editButtonOpacity') !== undefined ? getProperty('editButtonOpacity') as number : d.opacity,
    bgColor: (getProperty('editButtonBgColor') as string) || d.bgColor,
    iconColor: (getProperty('editButtonIconColor') as string) || d.iconColor,
    label: getProperty('editButtonLabel') !== undefined ? (getProperty('editButtonLabel') as string) : d.label
  };
}

/**
 * Build the inline CSS style string for the edit button.
 * @param config - Edit button configuration
 * @param displayMode - Optional display mode: 'fullSection' offsets top positions by 156px
 */
export function buildEditButtonStyle(config: IEditButtonConfig, displayMode?: string): string {
  const px = getSizePx(config.size);
  const topOffset = displayMode === 'fullSection' ? 156 : 24;
  const edge = 24;

  // Position mapping
  let positionCss: string;
  switch (config.position) {
    case 'top-left':
      positionCss = `top: ${topOffset}px !important; left: ${edge}px !important;`;
      break;
    case 'top-right':
      positionCss = `top: ${topOffset}px !important; right: ${edge}px !important;`;
      break;
    case 'bottom-left':
      positionCss = `bottom: ${edge}px !important; left: ${edge}px !important;`;
      break;
    default: // bottom-right
      positionCss = `bottom: ${edge}px !important; right: ${edge}px !important;`;
      break;
  }

  // Dot style is always round, others have slight border-radius
  const isRound = config.style === 'dot' || config.style === 'icon';
  const borderRadius = isRound ? '50%' : '8px';

  // Width adapts for text-containing styles
  const needsAutoWidth = config.style === 'icon-label' || config.style === 'text';
  const widthCss = needsAutoWidth
    ? `height: ${px}px !important; padding: 0 ${Math.round(px * 0.4)}px !important;`
    : `width: ${px}px !important; height: ${px}px !important;`;

  return `
    position: fixed !important;
    ${positionCss}
    ${widthCss}
    background: ${config.bgColor} !important;
    border: 1px solid rgba(0,0,0,0.08) !important;
    border-radius: ${borderRadius} !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    gap: 6px !important;
    cursor: pointer !important;
    z-index: 999999 !important;
    text-decoration: none !important;
    transition: background 0.2s, transform 0.2s, box-shadow 0.2s, opacity 0.2s !important;
    box-shadow: 0 2px 12px rgba(0,0,0,0.15) !important;
    opacity: ${config.opacity} !important;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
    white-space: nowrap !important;
  `.trim();
}

/**
 * Build the inner HTML for the edit button (SVG icon + optional label).
 */
export function buildEditButtonInnerHtml(config: IEditButtonConfig): string {
  const iconSz = getIconSize(config.size);
  const color = config.iconColor;
  const safeLabel = escapeHtml(config.label);

  const pencilSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${iconSz}" height="${iconSz}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`;

  const dotSz = Math.max(8, Math.round(iconSz * 0.5));
  const dotHtml = `<div style="width:${dotSz}px;height:${dotSz}px;border-radius:50%;background:${color};"></div>`;

  const labelHtml = `<span style="font-size:${Math.round(iconSz * 0.65)}px;font-weight:500;color:${color};">${safeLabel}</span>`;

  switch (config.style) {
    case 'icon-label':
      return `${pencilSvg}${labelHtml}`;
    case 'dot':
      return dotHtml;
    case 'text':
      return labelHtml;
    default: // 'icon'
      return pencilSvg;
  }
}

function escapeHtml(str: string): string {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
