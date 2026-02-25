/**
 * LivePreview — renders a live tab strip preview using actual tab labels.
 * Supports all 4 styles (default/pills/underline/boxed), both orientations, all color properties.
 */
export interface ILivePreviewOptions {
  getProperty: (key: string) => string | number | boolean | undefined;
  getTabCount: () => number;
}

export class LivePreview {
  private _el: HTMLElement | null = null;
  private _options: ILivePreviewOptions;
  private _collapsed: boolean = false;

  constructor(options: ILivePreviewOptions) {
    this._options = options;
  }

  public render(container: HTMLElement): void {
    const wrapper = document.createElement('div');
    wrapper.className = 'picanvas-config-preview';

    wrapper.innerHTML = `
      <div class="picanvas-config-preview-header">
        <span class="picanvas-config-preview-title">Live Preview</span>
        <button type="button" class="picanvas-config-preview-toggle" title="Toggle preview">&#9660;</button>
      </div>
      <div class="picanvas-config-preview-body"></div>
    `;

    const toggleBtn = wrapper.querySelector('.picanvas-config-preview-toggle') as HTMLElement;
    const body = wrapper.querySelector('.picanvas-config-preview-body') as HTMLElement;

    toggleBtn.addEventListener('click', () => {
      this._collapsed = !this._collapsed;
      body.style.display = this._collapsed ? 'none' : '';
      toggleBtn.innerHTML = this._collapsed ? '&#9650;' : '&#9660;';
    });

    this._el = wrapper;
    container.appendChild(wrapper);
    this.refresh();
  }

  public refresh(): void {
    if (!this._el) return;
    const body = this._el.querySelector('.picanvas-config-preview-body') as HTMLElement;
    if (!body) return;

    const p = this._options.getProperty;
    const tabCount = this._options.getTabCount();

    const accentColor = (p('accentColor') as string) || '#0078d4';
    const tabTextColor = (p('tabTextColor') as string) || 'rgba(0,0,0,0.7)';
    const tabActiveTextColor = (p('tabActiveTextColor') as string) || accentColor;
    const tabBackgroundColor = (p('tabBackgroundColor') as string) || 'transparent';
    const tabActiveBackgroundColor = (p('tabActiveBackgroundColor') as string) || 'transparent';
    const tabHoverBackgroundColor = (p('tabHoverBackgroundColor') as string) || 'rgba(0,0,0,0.04)';
    const tabFontSize = (p('tabFontSize') as string) || '14px';
    const tabFontWeight = (p('tabFontWeight') as string) || '500';
    const tabPaddingVertical = (p('tabPaddingVertical') as string) || '12px';
    const tabPaddingHorizontal = (p('tabPaddingHorizontal') as string) || '20px';
    const tabGap = (p('tabGap') as string) || '0px';
    const tabBorderRadius = (p('tabBorderRadius') as string) || '0px';
    const activeIndicatorWidth = (p('activeIndicatorWidth') as string) || '3px';
    const tabShadow = (p('tabShadow') as string) || 'none';
    const tabStyle = (p('tabStyle') as string) || 'default';
    const showActiveIndicator = p('showActiveIndicator') !== false;
    const activeIndicatorColor = (p('activeIndicatorColor') as string) || accentColor;
    const showTabSeparator = p('showTabSeparator') !== false;
    const tabSeparatorColor = (p('tabSeparatorColor') as string) || 'rgba(0,0,0,0.12)';
    const tabOrientation = (p('tabOrientation') as string) || 'horizontal';

    // Gather tab labels
    const labels: string[] = [];
    for (let i = 1; i <= Math.min(tabCount, 8); i++) {
      const label = (p(`tab${i}Label`) as string) || `Tab ${i}`;
      labels.push(label);
    }
    if (tabCount > 8) labels.push(`+${tabCount - 8} more`);
    if (labels.length === 0) labels.push('Tab 1', 'Tab 2', 'Tab 3');

    const isVertical = tabOrientation === 'vertical';
    const borderBottom = showTabSeparator ? `1px solid ${tabSeparatorColor}` : 'none';

    const tabsHtml = labels.map((label, idx) => {
      const isActive = idx === 0;
      let style = `padding:${tabPaddingVertical} ${tabPaddingHorizontal};font-size:${tabFontSize};font-weight:${tabFontWeight};cursor:pointer;transition:all 0.2s ease;white-space:nowrap;text-overflow:ellipsis;overflow:hidden;max-width:150px;`;

      if (isActive) {
        if (tabStyle === 'pills') {
          style += `color:white;background:${accentColor};border-radius:20px;`;
        } else if (tabStyle === 'boxed') {
          const br = tabBorderRadius !== '0px' ? tabBorderRadius : '6px';
          style += `color:${tabActiveTextColor};background:${tabActiveBackgroundColor};border:1px solid rgba(0,0,0,0.1);border-bottom:1px solid white;margin-bottom:-1px;border-radius:${br} ${br} 0 0;`;
        } else {
          style += `color:${tabActiveTextColor};background:${tabActiveBackgroundColor};`;
          if (showActiveIndicator) {
            if (isVertical) {
              style += `border-left:${activeIndicatorWidth} solid ${activeIndicatorColor};padding-left:calc(${tabPaddingHorizontal} - ${activeIndicatorWidth});`;
            } else {
              style += `border-bottom:${activeIndicatorWidth} solid ${activeIndicatorColor};padding-bottom:calc(${tabPaddingVertical} - ${activeIndicatorWidth});`;
            }
          }
        }
        style += `box-shadow:${tabShadow};`;
      } else {
        style += `color:${tabTextColor};background:${tabBackgroundColor};border-radius:${tabStyle === 'pills' ? '20px' : tabBorderRadius};`;
        if (tabStyle === 'boxed') {
          const br = tabBorderRadius !== '0px' ? tabBorderRadius : '6px';
          style += `border:1px solid transparent;border-radius:${br} ${br} 0 0;`;
        }
      }

      return `<div class="picanvas-config-preview-tab" style="${style}" data-idx="${idx}">${this._escapeHtml(label)}</div>`;
    }).join('');

    const containerStyle = isVertical
      ? `display:flex;flex-direction:column;gap:${tabGap};border-right:${borderBottom};width:fit-content;min-width:120px;`
      : `display:flex;gap:${tabGap};border-bottom:${tabStyle === 'boxed' ? `1px solid ${tabSeparatorColor}` : borderBottom};flex-wrap:nowrap;overflow-x:auto;`;

    body.innerHTML = `
      <div style="background:white;border-radius:6px;padding:12px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <div style="${containerStyle}">${tabsHtml}</div>
        <div style="height:20px;background:linear-gradient(90deg,#f0f0f0 25%,transparent 25%,transparent 50%,#f0f0f0 50%,#f0f0f0 75%,transparent 75%);background-size:20px 20px;border-radius:4px;opacity:0.5;margin-top:8px;"></div>
      </div>
    `;

    // Add hover effect for non-active tabs
    const tabs = body.querySelectorAll('.picanvas-config-preview-tab');
    tabs.forEach((tab, index) => {
      if (index > 0) {
        (tab as HTMLElement).addEventListener('mouseenter', () => {
          (tab as HTMLElement).style.background = tabHoverBackgroundColor;
        });
        (tab as HTMLElement).addEventListener('mouseleave', () => {
          (tab as HTMLElement).style.background = tabBackgroundColor;
        });
      }
    });
  }

  private _escapeHtml(str: string): string {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  public dispose(): void {
    this._el = null;
  }
}
