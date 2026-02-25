/**
 * PropertyPaneMetadataTokenPicker
 * Property pane custom field that displays available metadata tokens for copying
 */

import {
  IPropertyPaneCustomFieldProps,
  IPropertyPaneField,
  PropertyPaneFieldType
} from '@microsoft/sp-property-pane';

import {
  IResolvedToken,
  MetadataTokenCategory,
  TOKEN_CATEGORY_INFO
} from './models/MetadataTokenModels';

export interface IPropertyPaneMetadataTokenPickerProps {
  key: string;
  /** Resolved tokens organized by category */
  tokensByCategory: Record<MetadataTokenCategory, IResolvedToken[]> | null;
  /** Whether tokens are currently loading */
  isLoading: boolean;
  /** Error message if loading failed */
  error?: string;
  /** Callback when a token is copied */
  onTokenCopied?: (token: IResolvedToken) => void;
}

interface IPropertyPaneMetadataTokenPickerInternalProps
  extends IPropertyPaneMetadataTokenPickerProps,
    IPropertyPaneCustomFieldProps {}

class PropertyPaneMetadataTokenPickerBuilder
  implements IPropertyPaneField<IPropertyPaneMetadataTokenPickerProps>
{
  public type: PropertyPaneFieldType = PropertyPaneFieldType.Custom;
  public targetProperty: string;
  public properties: IPropertyPaneMetadataTokenPickerInternalProps;

  private expandedCategories: Set<MetadataTokenCategory> = new Set(['page']);
  private searchQuery: string = '';
  private copiedTokenId: string | null = null;

  constructor(
    targetProperty: string,
    properties: IPropertyPaneMetadataTokenPickerProps
  ) {
    this.targetProperty = targetProperty;
    this.properties = {
      ...properties,
      onRender: this.onRender.bind(this)
    };
  }

  private onRender(elem: HTMLElement): void {
    const props = this.properties;

    // Container styles
    const containerStyles = `
      font-family: "Segoe UI", -apple-system, BlinkMacSystemFont, Roboto, sans-serif;
      font-size: 13px;
      margin: 12px 0;
    `;

    const labelStyles = `
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 8px;
      color: #323130;
    `;

    const helpTextStyles = `
      font-size: 11px;
      color: #605e5c;
      margin-bottom: 12px;
      line-height: 1.5;
    `;

    // Loading state
    if (props.isLoading) {
      elem.innerHTML = `
        <div style="${containerStyles}">
          <div style="${labelStyles}">Available Tokens</div>
          <div style="display: flex; align-items: center; gap: 8px; padding: 16px; color: #605e5c;">
            <div style="width: 16px; height: 16px; border: 2px solid #f3f2f1; border-top-color: #0078d4; border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
            <span>Loading page metadata...</span>
          </div>
          <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
        </div>
      `;
      return;
    }

    // Error state
    if (props.error) {
      elem.innerHTML = `
        <div style="${containerStyles}">
          <div style="${labelStyles}">Available Tokens</div>
          <div style="display: flex; align-items: center; gap: 8px; padding: 12px; background-color: #fef0f0; border: 1px solid #f3d6d8; border-radius: 4px; color: #a4262c;">
            <span style="font-weight: bold;">!</span>
            <span>${this.encodeHtml(props.error)}</span>
          </div>
        </div>
      `;
      return;
    }

    // No tokens available
    if (!props.tokensByCategory) {
      elem.innerHTML = `
        <div style="${containerStyles}">
          <div style="${labelStyles}">Available Tokens</div>
          <div style="color: #605e5c; padding: 12px;">No tokens available</div>
        </div>
      `;
      return;
    }

    // Build token picker UI
    const categoryOrder: MetadataTokenCategory[] = ['page', 'people', 'dates', 'site', 'custom'];

    // Filter tokens based on search
    const filteredCategories = this.filterTokens(props.tokensByCategory, this.searchQuery);

    // Render categories
    let categoriesHtml = '';
    for (const category of categoryOrder) {
      const tokens = filteredCategories[category];
      if (!tokens || tokens.length === 0) continue;

      const categoryInfo = TOKEN_CATEGORY_INFO[category];
      const isExpanded = this.expandedCategories.has(category);
      const categoryId = `metadata-category-${category}`;

      categoriesHtml += `
        <div class="picanvas-token-category" data-category="${category}">
          <button class="picanvas-token-category-header" data-action="toggle" data-category="${category}" style="
            width: 100%;
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 10px 12px;
            background-color: #faf9f8;
            border: none;
            border-bottom: 1px solid #e1dfdd;
            cursor: pointer;
            font-size: 13px;
            font-weight: 600;
            color: #323130;
            text-align: left;
          ">
            <span style="color: #0078d4; display: flex; align-items: center;">${this.getCategoryIcon(category)}</span>
            <span style="flex: 1;">${this.encodeHtml(categoryInfo.label)}</span>
            <span style="font-size: 11px; font-weight: 400; color: #605e5c; background-color: #e1dfdd; padding: 2px 6px; border-radius: 10px;">${tokens.length}</span>
            <span style="color: #605e5c; transition: transform 0.15s ease; transform: rotate(${isExpanded ? '90deg' : '0deg'});">▶</span>
          </button>
          <div class="picanvas-token-category-content" id="${categoryId}" style="display: ${isExpanded ? 'block' : 'none'}; background-color: #ffffff;">
            ${tokens.map(token => this.renderTokenItem(token)).join('')}
          </div>
        </div>
      `;
    }

    elem.innerHTML = `
      <div style="${containerStyles}" class="picanvas-metadata-token-picker">
        <div style="${labelStyles}">Available Tokens</div>
        <div style="${helpTextStyles}">
          Click a token to copy it. Paste <code style="font-family: Consolas, Monaco, monospace; background-color: #f3f2f1; padding: 2px 4px; border-radius: 3px; color: #0078d4;">{{TokenPath}}</code> into your content.
        </div>

        <!-- Search -->
        <div style="position: relative; margin-bottom: 12px;">
          <input type="text"
                 class="picanvas-token-search"
                 placeholder="Search tokens..."
                 value="${this.encodeHtml(this.searchQuery)}"
                 style="
                   width: 100%;
                   padding: 8px 32px 8px 10px;
                   border: 1px solid #8a8886;
                   border-radius: 4px;
                   font-size: 13px;
                   outline: none;
                   box-sizing: border-box;
                 " />
          ${this.searchQuery ? `
            <button class="picanvas-token-search-clear" data-action="clear-search" style="
              position: absolute;
              right: 8px;
              top: 50%;
              transform: translateY(-50%);
              background: none;
              border: none;
              padding: 4px;
              cursor: pointer;
              color: #605e5c;
            ">✕</button>
          ` : ''}
        </div>

        <!-- Categories -->
        <div style="border: 1px solid #e1dfdd; border-radius: 4px; overflow: hidden; max-height: 350px; overflow-y: auto;">
          ${categoriesHtml || '<div style="padding: 16px; color: #605e5c; text-align: center;">No tokens match your search</div>'}
        </div>

        <!-- Copy feedback -->
        <div class="picanvas-token-copy-feedback" style="
          position: fixed;
          bottom: 20px;
          left: 50%;
          transform: translateX(-50%) translateY(100px);
          background-color: #107c10;
          color: white;
          padding: 8px 16px;
          border-radius: 4px;
          font-size: 12px;
          opacity: 0;
          transition: all 0.3s ease;
          pointer-events: none;
          z-index: 10000;
        ">Token copied to clipboard!</div>
      </div>
    `;

    // Attach event handlers
    this.attachEventHandlers(elem, props);
  }

  private renderTokenItem(token: IResolvedToken): string {
    const isCopied = this.copiedTokenId === token.id;
    const hasValue = token.hasValue;

    return `
      <div class="picanvas-token-item"
           data-action="copy"
           data-token-id="${token.id}"
           data-token-path="${token.valuePath}"
           style="
             display: flex;
             align-items: flex-start;
             gap: 8px;
             padding: 10px 12px;
             border-bottom: 1px solid #f3f2f1;
             cursor: pointer;
             transition: background-color 0.1s ease;
             ${!hasValue ? 'opacity: 0.7;' : ''}
           ">
        <div style="flex: 1; min-width: 0;">
          <div style="font-weight: 500; color: #323130; margin-bottom: 2px;">${this.encodeHtml(token.label)}</div>
          <div style="
            font-size: 11px;
            font-family: Consolas, Monaco, monospace;
            color: #0078d4;
            background-color: #f3f2f1;
            padding: 2px 6px;
            border-radius: 3px;
            display: inline-block;
            margin-bottom: 4px;
          ">{{${this.encodeHtml(token.valuePath)}}}</div>
          <div style="font-size: 11px; color: #605e5c; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%;">
            ${hasValue ? this.encodeHtml(token.currentValue || '') : '<em>No value</em>'}
          </div>
        </div>
        <button class="picanvas-token-copy-btn"
                data-action="copy"
                data-token-id="${token.id}"
                data-token-path="${token.valuePath}"
                style="
                  flex-shrink: 0;
                  width: 28px;
                  height: 28px;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  background-color: ${isCopied ? '#107c10' : 'transparent'};
                  border: 1px solid ${isCopied ? '#107c10' : '#e1dfdd'};
                  border-radius: 4px;
                  cursor: pointer;
                  color: ${isCopied ? 'white' : '#605e5c'};
                  transition: all 0.1s ease;
                ">
          ${isCopied ? '✓' : '📋'}
        </button>
      </div>
    `;
  }

  private filterTokens(
    tokensByCategory: Record<MetadataTokenCategory, IResolvedToken[]>,
    query: string
  ): Record<MetadataTokenCategory, IResolvedToken[]> {
    if (!query.trim()) {
      return tokensByCategory;
    }

    const lowerQuery = query.toLowerCase();
    const result: Record<MetadataTokenCategory, IResolvedToken[]> = {
      page: [],
      people: [],
      dates: [],
      site: [],
      custom: []
    };

    for (const [category, tokens] of Object.entries(tokensByCategory)) {
      result[category as MetadataTokenCategory] = tokens.filter(token =>
        token.label.toLowerCase().includes(lowerQuery) ||
        token.valuePath.toLowerCase().includes(lowerQuery) ||
        token.description?.toLowerCase().includes(lowerQuery) ||
        token.currentValue?.toLowerCase().includes(lowerQuery)
      );
    }

    return result;
  }

  private attachEventHandlers(elem: HTMLElement, props: IPropertyPaneMetadataTokenPickerInternalProps): void {
    // Search input
    const searchInput = elem.querySelector('.picanvas-token-search') as HTMLInputElement;
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = (e.target as HTMLInputElement).value;
        this.onRender(elem);
      });
      searchInput.addEventListener('focus', () => {
        searchInput.style.borderColor = '#0078d4';
      });
      searchInput.addEventListener('blur', () => {
        searchInput.style.borderColor = '#8a8886';
      });
    }

    // Clear search button
    const clearBtn = elem.querySelector('[data-action="clear-search"]');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        this.searchQuery = '';
        this.onRender(elem);
      });
    }

    // Category toggle buttons
    const toggleBtns = elem.querySelectorAll('[data-action="toggle"]');
    toggleBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const category = btn.getAttribute('data-category') as MetadataTokenCategory;
        if (this.expandedCategories.has(category)) {
          this.expandedCategories.delete(category);
        } else {
          this.expandedCategories.add(category);
        }
        this.onRender(elem);
      });

      // Hover effect
      (btn as HTMLElement).addEventListener('mouseenter', () => {
        (btn as HTMLElement).style.backgroundColor = '#f3f2f1';
      });
      (btn as HTMLElement).addEventListener('mouseleave', () => {
        (btn as HTMLElement).style.backgroundColor = '#faf9f8';
      });
    });

    // Token copy handlers
    const tokenItems = elem.querySelectorAll('[data-action="copy"]');
    tokenItems.forEach(item => {
      item.addEventListener('click', async (e) => {
        e.stopPropagation();
        const tokenPath = item.getAttribute('data-token-path');
        const tokenId = item.getAttribute('data-token-id');
        if (!tokenPath) return;

        const tokenSyntax = `{{${tokenPath}}}`;

        try {
          await navigator.clipboard.writeText(tokenSyntax);

          // Show feedback
          this.copiedTokenId = tokenId;

          // Find the token in props to pass to callback
          if (props.onTokenCopied && props.tokensByCategory) {
            for (const tokens of Object.values(props.tokensByCategory)) {
              const token = tokens.find(t => t.id === tokenId);
              if (token) {
                props.onTokenCopied(token);
                break;
              }
            }
          }

          // Show copy feedback toast
          const feedback = elem.querySelector('.picanvas-token-copy-feedback') as HTMLElement;
          if (feedback) {
            feedback.style.opacity = '1';
            feedback.style.transform = 'translateX(-50%) translateY(0)';
            setTimeout(() => {
              feedback.style.opacity = '0';
              feedback.style.transform = 'translateX(-50%) translateY(100px)';
            }, 2000);
          }

          // Reset copied state after delay
          setTimeout(() => {
            this.copiedTokenId = null;
            this.onRender(elem);
          }, 2000);

          this.onRender(elem);
        } catch (err) {
          console.error('[PiCanvas] Failed to copy token:', err);
        }
      });

      // Hover effects for token items
      if (item.classList.contains('picanvas-token-item')) {
        (item as HTMLElement).addEventListener('mouseenter', () => {
          (item as HTMLElement).style.backgroundColor = '#f3f2f1';
        });
        (item as HTMLElement).addEventListener('mouseleave', () => {
          (item as HTMLElement).style.backgroundColor = '';
        });
      }
    });
  }

  private getCategoryIcon(category: MetadataTokenCategory): string {
    const icons: Record<MetadataTokenCategory, string> = {
      page: '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2zM6 3h8a1 1 0 0 1 1 1v1H5V4a1 1 0 0 1 1-1zm8 10H6a1 1 0 0 1-1-1V6h10v6a1 1 0 0 1-1 1z"/></svg>',
      people: '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm4 8c0 1-1 1-1 1H3s-1 0-1-1 1-4 6-4 6 3 6 4zm-1-.004c-.001-.246-.154-.986-.832-1.664C11.516 10.68 10.289 10 8 10c-2.29 0-3.516.68-4.168 1.332-.678.678-.83 1.418-.832 1.664h10z"/></svg>',
      dates: '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M3.5 0a.5.5 0 0 1 .5.5V1h8V.5a.5.5 0 0 1 1 0V1h1a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h1V.5a.5.5 0 0 1 .5-.5zM1 4v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V4H1z"/></svg>',
      site: '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8zm7.5-6.923c-.67.204-1.335.82-1.887 1.855A7.97 7.97 0 0 0 5.145 4H7.5V1.077zM4.09 4a9.267 9.267 0 0 1 .64-1.539 6.7 6.7 0 0 1 .597-.933A7.025 7.025 0 0 0 2.255 4H4.09zm-.582 3.5c.03-.877.138-1.718.312-2.5H1.674a6.958 6.958 0 0 0-.656 2.5h2.49zM4.847 5a12.5 12.5 0 0 0-.338 2.5H7.5V5H4.847zM8.5 5v2.5h2.99a12.495 12.495 0 0 0-.337-2.5H8.5z"/></svg>',
      custom: '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M2 2a1 1 0 0 1 1-1h4.586a1 1 0 0 1 .707.293l7 7a1 1 0 0 1 0 1.414l-4.586 4.586a1 1 0 0 1-1.414 0l-7-7A1 1 0 0 1 2 6.586V2zm3.5 4a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z"/></svg>'
    };
    return icons[category] || icons.page;
  }

  private encodeHtml(str: string): string {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}

export function PropertyPaneMetadataTokenPicker(
  targetProperty: string,
  properties: IPropertyPaneMetadataTokenPickerProps
): IPropertyPaneField<IPropertyPaneMetadataTokenPickerProps> {
  return new PropertyPaneMetadataTokenPickerBuilder(targetProperty, properties);
}
