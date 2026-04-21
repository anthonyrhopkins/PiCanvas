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

/* ── Checkout-aware edit button click handler ── */

export interface IEditClickOptions {
  siteUrl: string;
  pageRelUrl: string;
  editUrl: string;
  currentUserId: number;
  buttonEl: HTMLElement;
}

const SPINNER_SVG = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-dasharray="31.4 31.4" stroke-dashoffset="0"><animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite"/></circle></svg>`;

async function getFormDigest(siteUrl: string): Promise<string> {
  const r = await fetch(`${siteUrl}/_api/contextinfo`, {
    method: 'POST',
    headers: { 'Accept': 'application/json;odata=nometadata' },
    credentials: 'same-origin'
  });
  const d = await r.json();
  return d.FormDigestValue;
}

async function getCheckoutUserId(siteUrl: string, pageRelUrl: string): Promise<number | null> {
  const r = await fetch(
    `${siteUrl}/_api/web/GetFileByServerRelativeUrl('${pageRelUrl}')/ListItemAllFields?$select=CheckoutUserId`,
    { headers: { 'Accept': 'application/json;odata=nometadata' }, credentials: 'same-origin' }
  );
  if (!r.ok) return null;
  const d = await r.json();
  return d.CheckoutUserId ?? null;
}

async function getUserInfo(siteUrl: string, userId: number): Promise<{ Title: string; Email: string }> {
  const r = await fetch(
    `${siteUrl}/_api/web/GetUserById(${userId})?$select=Title,Email`,
    { headers: { 'Accept': 'application/json;odata=nometadata' }, credentials: 'same-origin' }
  );
  if (!r.ok) return { Title: `User #${userId}`, Email: '' };
  const d = await r.json();
  return { Title: d.Title || `User #${userId}`, Email: d.Email || '' };
}

async function callCheckOut(siteUrl: string, pageRelUrl: string, digest: string): Promise<Response> {
  return fetch(`${siteUrl}/_api/web/GetFileByServerRelativeUrl('${pageRelUrl}')/CheckOut()`, {
    method: 'POST',
    headers: { 'Accept': 'application/json;odata=nometadata', 'X-RequestDigest': digest },
    credentials: 'same-origin'
  });
}

async function callUndoCheckOut(siteUrl: string, pageRelUrl: string, digest: string): Promise<Response> {
  return fetch(`${siteUrl}/_api/web/GetFileByServerRelativeUrl('${pageRelUrl}')/UndoCheckOut()`, {
    method: 'POST',
    headers: { 'Accept': 'application/json;odata=nometadata', 'X-RequestDigest': digest },
    credentials: 'same-origin'
  });
}

function showCheckoutToast(message: string, type: 'info' | 'warning' | 'error'): void {
  const existing = document.getElementById('picanvas-checkout-toast');
  if (existing) existing.remove();

  const colors = {
    info: { bg: '#E8F4FD', border: '#0070F2', text: '#003362' },
    warning: { bg: '#FFF3CD', border: '#D4790A', text: '#664D03' },
    error: { bg: '#FDEAEA', border: '#D32F2F', text: '#5F2120' }
  };
  const c = colors[type];

  const toast = document.createElement('div');
  toast.id = 'picanvas-checkout-toast';
  toast.style.cssText = `
    position: fixed; bottom: 80px; right: 24px; max-width: 380px; z-index: 1000000;
    background: ${c.bg}; border: 1px solid ${c.border}; border-radius: 8px;
    padding: 12px 36px 12px 14px; box-shadow: 0 4px 20px rgba(0,0,0,0.18);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 13px; line-height: 1.5; color: ${c.text};
    animation: picanvas-toast-in 0.25s ease-out;
  `;
  toast.innerHTML = `
    <style>
      @keyframes picanvas-toast-in { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
      #picanvas-checkout-toast a { color: ${c.border}; text-decoration: underline; }
    </style>
    ${message}
    <button style="position:absolute;top:6px;right:6px;background:none;border:none;cursor:pointer;font-size:16px;color:${c.text};line-height:1;padding:2px 6px;" title="Dismiss">&times;</button>
  `;
  toast.querySelector('button')!.addEventListener('click', () => toast.remove());
  document.body.appendChild(toast);
  setTimeout(() => { if (toast.parentNode) toast.remove(); }, 10000);
}

/**
 * Checkout-aware click handler for the edit button.
 * Checks page checkout state before navigating to edit mode.
 * Handles stale checkouts by attempting UndoCheckOut (owners) or showing guidance.
 */
export async function handleEditButtonClick(opts: IEditClickOptions): Promise<void> {
  const { siteUrl, pageRelUrl, editUrl, currentUserId, buttonEl } = opts;

  const origHtml = buttonEl.innerHTML;
  buttonEl.innerHTML = SPINNER_SVG;
  buttonEl.style.pointerEvents = 'none';

  const restore = (): void => {
    buttonEl.innerHTML = origHtml;
    buttonEl.style.pointerEvents = '';
  };

  try {
    const [digest, checkoutUserId] = await Promise.all([
      getFormDigest(siteUrl),
      getCheckoutUserId(siteUrl, pageRelUrl)
    ]);

    // Not checked out — normal flow
    if (!checkoutUserId) {
      const r = await callCheckOut(siteUrl, pageRelUrl, digest);
      if (r.ok || r.status === 423) {
        // 423 can happen in a race — navigate anyway, SP will handle it
        window.location.href = editUrl;
        return;
      }
      // Unexpected error
      restore();
      showCheckoutToast('Unable to check out this page. Please try again or use the SharePoint page library.', 'error');
      return;
    }

    // Checked out by current user — just navigate
    if (checkoutUserId === currentUserId) {
      window.location.href = editUrl;
      return;
    }

    // Checked out by someone else — try to discard (owners can do this)
    const undoResp = await callUndoCheckOut(siteUrl, pageRelUrl, digest);
    if (undoResp.ok) {
      // Re-fetch digest (old one may be stale after undo)
      const freshDigest = await getFormDigest(siteUrl);
      await callCheckOut(siteUrl, pageRelUrl, freshDigest);
      window.location.href = editUrl;
      return;
    }

    // UndoCheckOut failed — user lacks permission. Show helpful message.
    restore();
    const user = await getUserInfo(siteUrl, checkoutUserId);
    const nameDisplay = user.Email
      ? `<strong>${escapeHtml(user.Title)}</strong> (${escapeHtml(user.Email)})`
      : `<strong>${escapeHtml(user.Title)}</strong>`;
    showCheckoutToast(
      `This page is checked out by ${nameDisplay}.<br>` +
      `Ask them to check it in, or go to <a href="${escapeHtml(siteUrl)}/SitePages/Forms/AllItems.aspx" target="_blank">Site Pages library</a> ` +
      `&rarr; right-click the page &rarr; <em>Discard Check Out</em>.`,
      'warning'
    );
  } catch (err) {
    restore();
    showCheckoutToast('Unable to check out this page. Please try again.', 'error');
    console.error('[PiCanvas] Edit checkout failed:', err);
  }
}
