/**
 * CommandPalette — Cmd+K / Ctrl+K fuzzy-search overlay for instant access
 * to any setting, section, template, or action across the entire config panel.
 *
 * This is the standout feature: no other SharePoint webpart has a command palette.
 * Inspired by VS Code, Figma, Linear.
 */

export interface ICommandItem {
  id: string;
  label: string;
  description?: string;
  category: 'navigation' | 'setting' | 'template' | 'action';
  icon?: string;
  section?: string;        // Which sidebar section this belongs to
  keywords?: string[];     // Extra keywords for fuzzy search
  execute: () => void;
}

export interface ICommandPaletteOptions {
  getItems: () => ICommandItem[];
}

export class CommandPalette {
  private _overlay: HTMLElement | null = null;
  private _options: ICommandPaletteOptions;
  private _selectedIndex: number = 0;
  private _filteredItems: ICommandItem[] = [];
  private _allItems: ICommandItem[] = [];
  private _onKeyDownBound: ((e: KeyboardEvent) => void) | null = null;

  constructor(options: ICommandPaletteOptions) {
    this._options = options;
  }

  public open(): void {
    if (this._overlay) return;

    this._allItems = this._options.getItems();
    this._filteredItems = this._allItems.slice(0, 12);
    this._selectedIndex = 0;

    this._overlay = document.createElement('div');
    this._overlay.className = 'picanvas-cmd-overlay';
    this._overlay.innerHTML = `
      <div class="picanvas-cmd-backdrop"></div>
      <div class="picanvas-cmd-dialog">
        <div class="picanvas-cmd-input-wrapper">
          <svg class="picanvas-cmd-search-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="7" cy="7" r="5.5" stroke="currentColor" stroke-width="1.5"/>
            <line x1="11" y1="11" x2="14.5" y2="14.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          <input type="text" class="picanvas-cmd-input" placeholder="Search settings, templates, actions..." spellcheck="false" autocomplete="off" />
          <kbd class="picanvas-cmd-shortcut">ESC</kbd>
        </div>
        <div class="picanvas-cmd-results"></div>
        <div class="picanvas-cmd-footer">
          <span><kbd>&uarr;</kbd><kbd>&darr;</kbd> navigate</span>
          <span><kbd>Enter</kbd> select</span>
          <span><kbd>Esc</kbd> close</span>
        </div>
      </div>
    `;

    document.body.appendChild(this._overlay);

    // Focus input
    const input = this._overlay.querySelector('.picanvas-cmd-input') as HTMLInputElement;
    requestAnimationFrame(() => input.focus());

    // Render initial results
    this._renderResults();

    // Bind events
    input.addEventListener('input', () => {
      this._filter(input.value);
    });

    this._overlay.querySelector('.picanvas-cmd-backdrop')?.addEventListener('click', () => this.close());

    const bound = this._handleKeyDown.bind(this);
    this._onKeyDownBound = bound;
    document.addEventListener('keydown', bound, true);
  }

  public close(): void {
    if (!this._overlay) return;
    this._overlay.remove();
    this._overlay = null;
    if (this._onKeyDownBound) {
      document.removeEventListener('keydown', this._onKeyDownBound, true);
      this._onKeyDownBound = null;
    }
  }

  public isOpen(): boolean {
    return this._overlay !== null;
  }

  private _handleKeyDown(e: KeyboardEvent): void {
    if (!this._overlay) return;

    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        e.stopPropagation();
        this.close();
        break;
      case 'ArrowDown':
        e.preventDefault();
        this._selectedIndex = Math.min(this._selectedIndex + 1, this._filteredItems.length - 1);
        this._renderResults();
        this._scrollToSelected();
        break;
      case 'ArrowUp':
        e.preventDefault();
        this._selectedIndex = Math.max(this._selectedIndex - 1, 0);
        this._renderResults();
        this._scrollToSelected();
        break;
      case 'Enter':
        e.preventDefault();
        if (this._filteredItems[this._selectedIndex]) {
          const item = this._filteredItems[this._selectedIndex];
          this.close();
          item.execute();
        }
        break;
    }
  }

  private _filter(query: string): void {
    const q = query.toLowerCase().trim();

    if (!q) {
      this._filteredItems = this._allItems.slice(0, 12);
    } else {
      // Fuzzy matching with scoring
      const scored = this._allItems.map(item => {
        const score = this._fuzzyScore(q, item);
        return { item, score };
      }).filter(s => s.score > 0);

      scored.sort((a, b) => b.score - a.score);
      this._filteredItems = scored.slice(0, 12).map(s => s.item);
    }

    this._selectedIndex = 0;
    this._renderResults();
  }

  private _fuzzyScore(query: string, item: ICommandItem): number {
    let score = 0;
    const label = item.label.toLowerCase();
    const desc = (item.description || '').toLowerCase();
    const category = item.category.toLowerCase();
    const keywords = (item.keywords || []).join(' ').toLowerCase();
    const section = (item.section || '').toLowerCase();

    // Exact substring match in label (highest)
    if (label.includes(query)) {
      score += 100;
      // Bonus for starts-with
      if (label.startsWith(query)) score += 50;
    }

    // Exact match in description
    if (desc.includes(query)) score += 40;

    // Exact match in keywords
    if (keywords.includes(query)) score += 60;

    // Exact match in section
    if (section.includes(query)) score += 20;

    // Exact match in category
    if (category.includes(query)) score += 15;

    // Fuzzy character-by-character matching for typo tolerance
    if (score === 0) {
      const allText = `${label} ${desc} ${keywords} ${section}`;
      let qi = 0;
      let consecutive = 0;
      for (let i = 0; i < allText.length && qi < query.length; i++) {
        if (allText[i] === query[qi]) {
          qi++;
          consecutive++;
          score += consecutive; // Reward consecutive matches
        } else {
          consecutive = 0;
        }
      }
      // Only count if we matched all query characters
      if (qi < query.length) score = 0;
    }

    return score;
  }

  private _renderResults(): void {
    if (!this._overlay) return;
    const resultsEl = this._overlay.querySelector('.picanvas-cmd-results') as HTMLElement;
    if (!resultsEl) return;

    if (this._filteredItems.length === 0) {
      resultsEl.innerHTML = `<div class="picanvas-cmd-empty">No results found</div>`;
      return;
    }

    // Group by category
    const groups: Record<string, ICommandItem[]> = {};
    const categoryOrder = ['navigation', 'setting', 'template', 'action'];
    const categoryLabels: Record<string, string> = {
      navigation: 'Navigate',
      setting: 'Settings',
      template: 'Templates',
      action: 'Actions'
    };

    this._filteredItems.forEach(item => {
      if (!groups[item.category]) groups[item.category] = [];
      groups[item.category].push(item);
    });

    let html = '';
    let globalIndex = 0;

    categoryOrder.forEach(cat => {
      const items = groups[cat];
      if (!items || items.length === 0) return;

      html += `<div class="picanvas-cmd-category">${categoryLabels[cat]}</div>`;
      items.forEach(item => {
        const isSelected = globalIndex === this._selectedIndex;
        html += `
          <div class="picanvas-cmd-item${isSelected ? ' selected' : ''}" data-index="${globalIndex}">
            <span class="picanvas-cmd-item-icon">${item.icon || this._getCategoryIcon(item.category)}</span>
            <div class="picanvas-cmd-item-text">
              <span class="picanvas-cmd-item-label">${this._escapeHtml(item.label)}</span>
              ${item.description ? `<span class="picanvas-cmd-item-desc">${this._escapeHtml(item.description)}</span>` : ''}
            </div>
            ${item.section ? `<span class="picanvas-cmd-item-section">${item.section}</span>` : ''}
          </div>
        `;
        globalIndex++;
      });
    });

    resultsEl.innerHTML = html;

    // Bind click events
    resultsEl.querySelectorAll('.picanvas-cmd-item').forEach(el => {
      el.addEventListener('click', () => {
        const idx = parseInt((el as HTMLElement).dataset.index || '0', 10);
        if (this._filteredItems[idx]) {
          this.close();
          this._filteredItems[idx].execute();
        }
      });
      el.addEventListener('mouseenter', () => {
        const idx = parseInt((el as HTMLElement).dataset.index || '0', 10);
        this._selectedIndex = idx;
        resultsEl.querySelectorAll('.picanvas-cmd-item').forEach(r => r.classList.remove('selected'));
        el.classList.add('selected');
      });
    });
  }

  private _scrollToSelected(): void {
    if (!this._overlay) return;
    const selected = this._overlay.querySelector('.picanvas-cmd-item.selected');
    if (selected) {
      selected.scrollIntoView({ block: 'nearest' });
    }
  }

  private _getCategoryIcon(category: string): string {
    switch (category) {
      case 'navigation': return '&#8594;';
      case 'setting': return '&#9881;';
      case 'template': return '&#127912;';
      case 'action': return '&#9889;';
      default: return '&#8226;';
    }
  }

  private _escapeHtml(str: string): string {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  public dispose(): void {
    this.close();
  }
}

/**
 * Build the full command item registry from the config panel state.
 * This connects every setting, section, template, and action to the palette.
 */
export function buildCommandItems(opts: {
  navigateTo: (section: string) => void;
  getProperty: (key: string) => string | number | boolean | undefined;
  setProperty: (key: string, value: string | number | boolean | undefined) => void;
  getTabCount: () => number;
  applyTemplate: (id: string) => void;
  getTemplates: () => Array<{ id: string; name: string; description: string }>;
  resetAllStyles: () => void;
  onChanged: () => void;
  undo?: () => void;
  redo?: () => void;
}): ICommandItem[] {
  const items: ICommandItem[] = [];

  // ── Navigation items ──
  const sections = [
    { id: 'tabs', label: 'Tabs', desc: 'Manage tab content and order' },
    { id: 'appearance', label: 'Appearance', desc: 'Style, alignment, orientation' },
    { id: 'colors', label: 'Colors', desc: 'Color pickers and theme presets' },
    { id: 'typography', label: 'Typography', desc: 'Font size, spacing, effects' },
    { id: 'templates', label: 'Templates', desc: 'Apply and manage templates' },
    { id: 'advanced', label: 'Advanced', desc: 'Lock defaults, selectors, reset' },
    { id: 'editbutton', label: 'Edit Button', desc: 'Floating edit button appearance' }
  ];

  sections.forEach(s => {
    items.push({
      id: `nav-${s.id}`,
      label: `Go to ${s.label}`,
      description: s.desc,
      category: 'navigation',
      section: s.label,
      keywords: [s.id, 'navigate', 'go', 'open', 'section'],
      execute: () => opts.navigateTo(s.id)
    });
  });

  // ── Setting items (all the key properties) ──
  const settings: Array<{ key: string; label: string; section: string; keywords?: string[] }> = [
    { key: 'tabStyle', label: 'Tab Style', section: 'Appearance', keywords: ['pills', 'underline', 'boxed', 'default', 'style'] },
    { key: 'tabAlignment', label: 'Tab Alignment', section: 'Appearance', keywords: ['left', 'center', 'right', 'stretch', 'align'] },
    { key: 'tabOrientation', label: 'Tab Orientation', section: 'Appearance', keywords: ['horizontal', 'vertical', 'layout', 'direction'] },
    { key: 'themeMode', label: 'Theme Mode', section: 'Appearance', keywords: ['light', 'dark', 'auto', 'theme', 'mode'] },
    { key: 'accentColor', label: 'Accent Color', section: 'Colors', keywords: ['color', 'primary', 'brand', 'accent', 'blue'] },
    { key: 'tabTextColor', label: 'Tab Text Color', section: 'Colors', keywords: ['font', 'text', 'color'] },
    { key: 'tabActiveTextColor', label: 'Active Tab Text Color', section: 'Colors', keywords: ['active', 'selected', 'text'] },
    { key: 'tabBackgroundColor', label: 'Tab Background', section: 'Colors', keywords: ['background', 'bg', 'fill'] },
    { key: 'tabActiveBackgroundColor', label: 'Active Tab Background', section: 'Colors', keywords: ['active', 'selected', 'bg'] },
    { key: 'tabHoverBackgroundColor', label: 'Hover Background', section: 'Colors', keywords: ['hover', 'mouseover', 'bg'] },
    { key: 'activeIndicatorColor', label: 'Indicator Color', section: 'Colors', keywords: ['indicator', 'underline', 'bar'] },
    { key: 'tabSeparatorColor', label: 'Separator Color', section: 'Colors', keywords: ['separator', 'divider', 'line', 'border'] },
    { key: 'tabFontSize', label: 'Font Size', section: 'Typography', keywords: ['font', 'size', 'text', 'px', 'large', 'small'] },
    { key: 'tabFontWeight', label: 'Font Weight', section: 'Typography', keywords: ['bold', 'weight', 'medium', 'semibold', 'normal'] },
    { key: 'tabPaddingVertical', label: 'Vertical Padding', section: 'Typography', keywords: ['padding', 'spacing', 'height', 'vertical'] },
    { key: 'tabPaddingHorizontal', label: 'Horizontal Padding', section: 'Typography', keywords: ['padding', 'spacing', 'width', 'horizontal'] },
    { key: 'tabGap', label: 'Tab Gap', section: 'Typography', keywords: ['gap', 'space', 'between', 'margin'] },
    { key: 'tabContentGap', label: 'Content Gap', section: 'Typography', keywords: ['content', 'gap', 'space', 'below'] },
    { key: 'tabBorderRadius', label: 'Corner Radius', section: 'Typography', keywords: ['border', 'radius', 'rounded', 'corner', 'pill'] },
    { key: 'activeIndicatorWidth', label: 'Indicator Width', section: 'Typography', keywords: ['indicator', 'thickness', 'width', 'bar'] },
    { key: 'tabShadow', label: 'Shadow Effect', section: 'Typography', keywords: ['shadow', 'elevation', 'depth', 'glow'] },
    { key: 'enableTransitions', label: 'Animations', section: 'Typography', keywords: ['animation', 'transition', 'motion'] },
    { key: 'showActiveIndicator', label: 'Active Indicator', section: 'Typography', keywords: ['indicator', 'underline', 'show', 'hide'] },
    { key: 'showTabSeparator', label: 'Tab Separator', section: 'Typography', keywords: ['separator', 'divider', 'line', 'show', 'hide'] },
    { key: 'enableDeepLinking', label: 'URL Deep Linking', section: 'Appearance', keywords: ['deep', 'link', 'url', 'hash', 'anchor'] },
    { key: 'enableLazyLoading', label: 'Lazy Loading', section: 'Appearance', keywords: ['lazy', 'load', 'performance', 'defer'] },
    { key: 'enableFullWidthFix', label: 'Banner Full Width', section: 'Appearance', keywords: ['banner', 'full', 'width', 'edge'] },
    { key: 'verticalTabPosition', label: 'Vertical Tab Position', section: 'Appearance', keywords: ['vertical', 'left', 'right', 'side'] },
    { key: 'verticalTabWidth', label: 'Vertical Tab Width', section: 'Appearance', keywords: ['vertical', 'width', 'narrow', 'wide'] },
    { key: 'labelImageHeight', label: 'Label Image Size', section: 'Appearance', keywords: ['image', 'icon', 'size', 'height', 'label'] },
    { key: 'lockUnlockTtlMinutes', label: 'Unlock Duration', section: 'Advanced', keywords: ['lock', 'unlock', 'ttl', 'duration', 'timeout'] },
    { key: 'sectionClass', label: 'Section CSS Selector', section: 'Advanced', keywords: ['section', 'css', 'selector', 'class'] },
    { key: 'webpartClass', label: 'WebPart CSS Selector', section: 'Advanced', keywords: ['webpart', 'css', 'selector', 'class'] },
    { key: 'editButtonEnabled', label: 'Edit Button Visibility', section: 'Edit Button', keywords: ['edit', 'button', 'show', 'hide', 'enabled', 'visible'] },
    { key: 'editButtonPosition', label: 'Edit Button Position', section: 'Edit Button', keywords: ['edit', 'button', 'position', 'corner', 'top', 'bottom', 'left', 'right'] },
    { key: 'editButtonStyle', label: 'Edit Button Style', section: 'Edit Button', keywords: ['edit', 'button', 'style', 'icon', 'dot', 'text', 'label'] },
    { key: 'editButtonSize', label: 'Edit Button Size', section: 'Edit Button', keywords: ['edit', 'button', 'size', 'small', 'medium', 'large'] },
    { key: 'editButtonOpacity', label: 'Edit Button Opacity', section: 'Edit Button', keywords: ['edit', 'button', 'opacity', 'transparency', 'fade'] },
    { key: 'editButtonBgColor', label: 'Edit Button Background', section: 'Edit Button', keywords: ['edit', 'button', 'background', 'color', 'bg'] },
    { key: 'editButtonIconColor', label: 'Edit Button Icon Color', section: 'Edit Button', keywords: ['edit', 'button', 'icon', 'text', 'color', 'pencil'] },
    { key: 'editButtonLabel', label: 'Edit Button Label', section: 'Edit Button', keywords: ['edit', 'button', 'label', 'text', 'name'] }
  ];

  settings.forEach(s => {
    const currentValue = opts.getProperty(s.key);
    const valueStr = currentValue !== undefined && currentValue !== '' ? ` (${currentValue})` : '';
    items.push({
      id: `setting-${s.key}`,
      label: s.label + valueStr,
      description: `Change ${s.label.toLowerCase()}`,
      category: 'setting',
      section: s.section,
      keywords: s.keywords || [],
      execute: () => {
        const sectionMap: Record<string, string> = {
          'Appearance': 'appearance', 'Colors': 'colors',
          'Typography': 'typography', 'Advanced': 'advanced', 'Tabs': 'tabs',
          'Edit Button': 'editbutton'
        };
        opts.navigateTo(sectionMap[s.section] || 'appearance');
      }
    });
  });

  // ── Tab items ──
  const tabCount = opts.getTabCount();
  for (let i = 1; i <= tabCount; i++) {
    const label = (opts.getProperty(`tab${i}Label`) as string) || `Tab ${i}`;
    items.push({
      id: `tab-${i}`,
      label: `Edit Tab ${i}: "${label}"`,
      description: `Configure tab ${i} settings`,
      category: 'setting',
      section: 'Tabs',
      keywords: ['tab', label.toLowerCase(), `tab${i}`, 'edit', 'configure'],
      execute: () => opts.navigateTo('tabs')
    });
  }

  // ── Template items ──
  const templates = opts.getTemplates();
  templates.forEach(t => {
    items.push({
      id: `template-${t.id}`,
      label: `Apply: ${t.name}`,
      description: t.description,
      category: 'template',
      keywords: [t.name.toLowerCase(), 'template', 'preset', 'theme', 'apply'],
      execute: () => { opts.applyTemplate(t.id); opts.onChanged(); }
    });
  });

  // ── Action items ──
  items.push({
    id: 'action-reset',
    label: 'Reset All Styles',
    description: 'Restore all visual settings to defaults',
    category: 'action',
    keywords: ['reset', 'default', 'clear', 'restore'],
    execute: () => { opts.resetAllStyles(); opts.onChanged(); }
  });

  if (opts.undo) {
    items.push({
      id: 'action-undo',
      label: 'Undo',
      description: 'Undo the last change',
      category: 'action',
      icon: '&#8617;',
      keywords: ['undo', 'back', 'revert'],
      execute: () => { if (opts.undo) opts.undo(); }
    });
  }

  if (opts.redo) {
    items.push({
      id: 'action-redo',
      label: 'Redo',
      description: 'Redo the last undone change',
      category: 'action',
      icon: '&#8618;',
      keywords: ['redo', 'forward', 'repeat'],
      execute: () => { if (opts.redo) opts.redo(); }
    });
  }

  return items;
}
