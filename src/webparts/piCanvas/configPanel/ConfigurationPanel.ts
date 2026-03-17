/**
 * ConfigurationPanel — Full-screen overlay configuration editor for PiCanvas.
 * Creates a DOM overlay with sidebar navigation, section-based content,
 * live preview, Command Palette (Cmd+K), Undo/Redo, and Done/Cancel with snapshot rollback.
 */
import { IDropdownOption } from './controls/DropdownControl';
import { LivePreview } from './controls/LivePreview';
import { CommandPalette, buildCommandItems } from './controls/CommandPalette';
import { TabBuilderSection } from './sections/TabBuilderSection';
import { AppearanceSection } from './sections/AppearanceSection';
import { ColorsSection } from './sections/ColorsSection';
import { TypographySection } from './sections/TypographySection';
import { TemplatesSection, ITemplateInfo } from './sections/TemplatesSection';
import { AdvancedSection } from './sections/AdvancedSection';
import { NavigationSection } from './sections/NavigationSection';
import { ChromeSection } from './sections/ChromeSection';
import { HelpSection } from './sections/HelpSection';
import { HistorySection, IHistoryEntry } from './sections/HistorySection';

export interface IConfigurationPanelOptions {
  /** Read a webpart property */
  getProperty: (key: string) => string | number | boolean | undefined;
  /** Write a single webpart property */
  setProperty: (key: string, value: string | number | boolean | undefined) => void;
  /** Write multiple webpart properties at once */
  setProperties: (updates: Record<string, string | number | boolean | undefined>) => void;
  /** Re-render the webpart */
  reRender: () => void;
  /** Refresh the SharePoint property pane */
  refreshPropertyPane: () => void;
  /** Tab management */
  getTabCount: () => number;
  addTab: () => void;
  deleteTab: (index: number) => void;
  moveTabUp: (index: number) => void;
  moveTabDown: (index: number) => void;
  duplicateTab: (index: number) => void;
  /** Page context queries */
  getZones: () => Array<[string, string, number]>;
  getSections: () => Array<[string, string, number]>;
  getTextWebPartOptions: (tabIndex: number) => IDropdownOption[];
  /** Browse SharePoint files for a tab */
  browseFiles: (tabIndex: number, onSelected: (url: string) => void) => void;
  /** Template management */
  getTemplates: () => ITemplateInfo[];
  applyTemplate: (templateId: string) => void;
  exportConfig: () => void;
  importConfig: () => void;
  saveAsTemplate: () => void;
  /** Theme presets for color section */
  getThemePresets: () => Array<{
    id: string;
    name: string;
    accentColor: string;
    tabStyle?: string;
    properties: Record<string, string | number | boolean | undefined>;
  }>;
  /** Reset all styles */
  resetAllStyles: () => void;
  /** Constants */
  maxTabs: number;
  tabPropertySuffixes: ReadonlyArray<string>;
  /** Get detected SP chrome CSS conflicts from content */
  getSpChromeConflicts?: () => string[];
}

interface ISidebarItem {
  id: string;
  icon: string;
  label: string;
}

const SIDEBAR_ITEMS: ISidebarItem[] = [
  { id: 'tabs', icon: '&#128209;', label: 'Tabs' },
  { id: 'appearance', icon: '&#127912;', label: 'Appearance' },
  { id: 'colors', icon: '&#127912;', label: 'Colors' },
  { id: 'typography', icon: '&#128208;', label: 'Typography' },
  { id: 'templates', icon: '&#128203;', label: 'Templates' },
  { id: 'advanced', icon: '&#9881;', label: 'Advanced' },
  { id: 'chrome', icon: '&#128065;', label: 'Page Chrome' },
  { id: 'navigation', icon: '&#128279;', label: 'Navigation' },
  { id: 'history', icon: '&#128340;', label: 'History' },
  { id: 'help', icon: '&#10067;', label: 'Help & Docs' }
];

export class ConfigurationPanel {
  private _options: IConfigurationPanelOptions;
  private _overlay: HTMLElement | null = null;
  private _currentSection: string = 'tabs';
  private _propertySnapshot: Record<string, string | number | boolean | undefined> = {};
  private _bodyOverflow: string = '';

  // Section instances
  private _tabBuilder: TabBuilderSection | null = null;
  private _appearance: AppearanceSection | null = null;
  private _colors: ColorsSection | null = null;
  private _typography: TypographySection | null = null;
  private _templates: TemplatesSection | null = null;
  private _advanced: AdvancedSection | null = null;
  private _navigation: NavigationSection | null = null;
  private _chrome: ChromeSection | null = null;
  private _history: HistorySection | null = null;
  private _help: HelpSection | null = null;
  private _preview: LivePreview | null = null;

  // Command Palette
  private _commandPalette: CommandPalette | null = null;

  // Undo/Redo
  private _undoStack: IHistoryEntry[] = [];
  private _redoStack: IHistoryEntry[] = [];
  private _isUndoRedoing: boolean = false;

  constructor(options: IConfigurationPanelOptions) {
    this._options = options;
  }

  /**
   * Open the configuration panel overlay
   */
  public open(): void {
    if (this._overlay) return; // Already open

    // Snapshot all properties for Cancel rollback
    this._snapshotProperties();

    // Reset undo/redo
    this._undoStack = [];
    this._redoStack = [];

    // Lock body scroll
    this._bodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const modKey = isMac ? '&#8984;' : 'Ctrl';

    // Create overlay
    this._overlay = document.createElement('div');
    this._overlay.className = 'picanvas-config-overlay';

    this._overlay.innerHTML = `
      <div class="picanvas-config-header">
        <div class="picanvas-config-header-left">
          <div class="picanvas-config-header-logo">Pi</div>
          <span class="picanvas-config-header-title">PiCanvas Configuration</span>
        </div>
        <div class="picanvas-config-header-actions">
          <button type="button" class="picanvas-config-search-btn" data-action="search" title="Search settings (${isMac ? 'Cmd' : 'Ctrl'}+K)">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="5.5" stroke="currentColor" stroke-width="1.5"/><line x1="11" y1="11" x2="14.5" y2="14.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
            Search
            <kbd>${modKey}+K</kbd>
          </button>
          <button type="button" class="picanvas-config-history-btn" data-action="undo" title="Undo (${isMac ? 'Cmd' : 'Ctrl'}+Z)" disabled>&#8617;</button>
          <button type="button" class="picanvas-config-history-btn" data-action="redo" title="Redo (${isMac ? 'Cmd+Shift' : 'Ctrl+Shift'}+Z)" disabled>&#8618;</button>
          <button type="button" class="picanvas-config-btn picanvas-config-btn-cancel" data-action="cancel">Cancel</button>
          <button type="button" class="picanvas-config-btn picanvas-config-btn-done" data-action="done">Done</button>
        </div>
      </div>
      <div class="picanvas-config-body">
        <nav class="picanvas-config-sidebar">
          ${SIDEBAR_ITEMS.map(item => `
            <div class="picanvas-config-sidebar-item${item.id === this._currentSection ? ' active' : ''}" data-section="${item.id}">
              <span class="picanvas-config-sidebar-icon">${item.icon}</span>
              <span>${item.label}</span>
            </div>
          `).join('')}
        </nav>
        <div class="picanvas-config-content">
          <div class="picanvas-config-content-scroll">
            ${SIDEBAR_ITEMS.map(item => `
              <div class="picanvas-config-section${item.id === this._currentSection ? ' active' : ''}" data-section-content="${item.id}"></div>
            `).join('')}
          </div>
          <div data-preview-container></div>
        </div>
      </div>
    `;

    document.body.appendChild(this._overlay);

    // Bind header buttons
    this._overlay.querySelector('[data-action="cancel"]')?.addEventListener('click', () => this.close(false));
    this._overlay.querySelector('[data-action="done"]')?.addEventListener('click', () => this.close(true));
    this._overlay.querySelector('[data-action="search"]')?.addEventListener('click', () => this._openCommandPalette());
    this._overlay.querySelector('[data-action="undo"]')?.addEventListener('click', () => this._undo());
    this._overlay.querySelector('[data-action="redo"]')?.addEventListener('click', () => this._redo());

    // Bind sidebar navigation
    this._overlay.querySelectorAll('.picanvas-config-sidebar-item').forEach(item => {
      item.addEventListener('click', () => {
        const sectionId = (item as HTMLElement).dataset.section || 'tabs';
        this.navigateTo(sectionId);
      });
    });

    // Bind keyboard shortcuts
    this._onKeyDown = this._onKeyDown.bind(this);
    document.addEventListener('keydown', this._onKeyDown);

    // Initialize command palette
    this._commandPalette = new CommandPalette({
      getItems: () => buildCommandItems({
        navigateTo: (s) => this.navigateTo(s),
        getProperty: this._options.getProperty,
        setProperty: this._options.setProperty,
        getTabCount: this._options.getTabCount,
        applyTemplate: this._options.applyTemplate,
        getTemplates: () => this._options.getTemplates().map(t => ({
          id: t.id, name: t.name, description: t.description
        })),
        resetAllStyles: this._options.resetAllStyles,
        onChanged: () => this._onChanged(),
        undo: () => this._undo(),
        redo: () => this._redo()
      })
    });

    // Initialize sections
    this._initSections();
  }

  /**
   * Close the configuration panel
   * @param save If false, restore the property snapshot (Cancel behavior)
   */
  public close(save: boolean): void {
    if (!this._overlay) return;

    if (!save) {
      // Restore snapshot
      this._restoreProperties();
    }

    // Dispose
    this._disposeSections();
    if (this._commandPalette) { this._commandPalette.dispose(); this._commandPalette = null; }

    // Remove overlay
    this._overlay.remove();
    this._overlay = null;

    // Restore body scroll
    document.body.style.overflow = this._bodyOverflow;

    // Remove keyboard handler
    document.removeEventListener('keydown', this._onKeyDown);

    // Refresh the property pane to reflect changes
    this._options.refreshPropertyPane();
    this._options.reRender();
  }

  /**
   * Navigate to a specific section, optionally expanding a tab in the Tabs section.
   */
  public navigateTo(sectionId: string, tabIndex?: number): void {
    if (!this._overlay) return;
    this._currentSection = sectionId;

    // Update sidebar active state
    this._overlay.querySelectorAll('.picanvas-config-sidebar-item').forEach(item => {
      item.classList.toggle('active', (item as HTMLElement).dataset.section === sectionId);
    });

    // Show/hide sections
    this._overlay.querySelectorAll('.picanvas-config-section').forEach(section => {
      section.classList.toggle('active', (section as HTMLElement).dataset.sectionContent === sectionId);
    });

    // If navigating to tabs with a specific tab index, expand that tab
    if (sectionId === 'tabs' && tabIndex && tabIndex > 0 && this._tabBuilder) {
      this._tabBuilder.expandTab(tabIndex);
    }
  }

  /**
   * Dispose the panel and all resources
   */
  public dispose(): void {
    if (this._overlay) {
      this.close(true);
    }
  }

  // ── Private methods ──────────────────────────────────────

  private _onKeyDown(e: KeyboardEvent): void {
    const isMod = e.metaKey || e.ctrlKey;

    // Cmd+K / Ctrl+K — Command Palette
    if (isMod && e.key === 'k') {
      e.preventDefault();
      e.stopPropagation();
      this._openCommandPalette();
      return;
    }

    // Cmd+Z / Ctrl+Z — Undo
    if (isMod && e.key === 'z' && !e.shiftKey) {
      if (this._commandPalette?.isOpen()) return;
      e.preventDefault();
      this._undo();
      return;
    }

    // Cmd+Shift+Z / Ctrl+Shift+Z — Redo
    if (isMod && e.key === 'z' && e.shiftKey) {
      if (this._commandPalette?.isOpen()) return;
      e.preventDefault();
      this._redo();
      return;
    }

    // ESC — close (only if command palette is not open)
    if (e.key === 'Escape') {
      if (this._commandPalette?.isOpen()) return; // Command palette handles its own ESC
      this.close(false);
    }
  }

  private _openCommandPalette(): void {
    if (this._commandPalette) {
      if (this._commandPalette.isOpen()) {
        this._commandPalette.close();
      } else {
        this._commandPalette.open();
      }
    }
  }

  // ── Undo/Redo ──

  /**
   * Wrapped setProperty that tracks changes for undo/redo
   */
  private _trackedSetProperty(key: string, value: string | number | boolean | undefined): void {
    if (this._isUndoRedoing) {
      this._options.setProperty(key, value);
      return;
    }

    const oldValue = this._options.getProperty(key);
    if (oldValue === value) return; // No change

    this._options.setProperty(key, value);

    // Push to undo stack
    this._undoStack.push({
      key,
      oldValue,
      newValue: value,
      label: key
    });

    // Clear redo stack on new change
    this._redoStack = [];
    this._updateHistoryButtons();
    this._refreshHistorySection();
  }

  private _undo(): void {
    if (this._undoStack.length === 0) return;

    const entry = this._undoStack.pop()!;
    this._isUndoRedoing = true;
    this._options.setProperty(entry.key, entry.oldValue);
    this._isUndoRedoing = false;

    this._redoStack.push(entry);
    this._updateHistoryButtons();
    this._refreshHistorySection();
    this._onChanged();
    this._showToast(`Undo: ${this._formatKey(entry.key)}`);
  }

  private _redo(): void {
    if (this._redoStack.length === 0) return;

    const entry = this._redoStack.pop()!;
    this._isUndoRedoing = true;
    this._options.setProperty(entry.key, entry.newValue);
    this._isUndoRedoing = false;

    this._undoStack.push(entry);
    this._updateHistoryButtons();
    this._refreshHistorySection();
    this._onChanged();
    this._showToast(`Redo: ${this._formatKey(entry.key)}`);
  }

  /** Undo all changes back to (and including) the given undo stack index */
  private _undoToIndex(targetIndex: number): void {
    this._isUndoRedoing = true;
    while (this._undoStack.length > targetIndex) {
      const entry = this._undoStack.pop()!;
      this._options.setProperty(entry.key, entry.oldValue);
      this._redoStack.push(entry);
    }
    this._isUndoRedoing = false;
    this._updateHistoryButtons();
    this._refreshHistorySection();
    this._onChanged();
    this._showToast(`Reverted to change #${targetIndex}`);
  }

  /** Redo changes up to (and including) the given redo stack index */
  private _redoToIndex(targetIndex: number): void {
    this._isUndoRedoing = true;
    for (let i = this._redoStack.length - 1; i >= targetIndex; i--) {
      const entry = this._redoStack.pop()!;
      this._options.setProperty(entry.key, entry.newValue);
      this._undoStack.push(entry);
    }
    this._isUndoRedoing = false;
    this._updateHistoryButtons();
    this._refreshHistorySection();
    this._onChanged();
    this._showToast(`Reapplied changes`);
  }

  private _refreshHistorySection(): void {
    if (this._history) this._history.rebuild();
  }

  private _updateHistoryButtons(): void {
    if (!this._overlay) return;
    const undoBtn = this._overlay.querySelector('[data-action="undo"]') as HTMLButtonElement;
    const redoBtn = this._overlay.querySelector('[data-action="redo"]') as HTMLButtonElement;
    if (undoBtn) undoBtn.disabled = this._undoStack.length === 0;
    if (redoBtn) redoBtn.disabled = this._redoStack.length === 0;
  }

  private _formatKey(key: string): string {
    // Convert camelCase to readable: "tabFontSize" → "Tab Font Size"
    return key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();
  }

  private _showToast(message: string): void {
    // Remove existing toast
    document.querySelectorAll('.picanvas-config-toast').forEach(t => t.remove());

    const toast = document.createElement('div');
    toast.className = 'picanvas-config-toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 300);
    }, 1500);
  }

  // ── onChanged helper ──

  private _onChanged(): void {
    this._options.reRender();
    if (this._preview) {
      this._preview.refresh();
    }
  }

  // ── Property snapshot ──

  private _snapshotProperties(): void {
    this._propertySnapshot = {};
    const opts = this._options;

    const styleKeys = [
      'tabCount', 'tabStyle', 'tabAlignment', 'tabOrientation',
      'verticalTabPosition', 'verticalTabWidth', 'labelImageHeight', 'themeMode',
      'accentColor', 'tabTextColor', 'tabActiveTextColor',
      'tabBackgroundColor', 'tabActiveBackgroundColor', 'tabHoverBackgroundColor',
      'tabFontSize', 'tabFontWeight', 'tabPaddingVertical', 'tabPaddingHorizontal',
      'tabGap', 'tabContentGap', 'tabBorderRadius', 'activeIndicatorWidth',
      'tabShadow', 'enableTransitions',
      'showActiveIndicator', 'activeIndicatorColor',
      'showTabSeparator', 'tabSeparatorColor',
      'enableDeepLinking', 'enableLazyLoading', 'enableFullWidthFix',
      'sectionClass', 'webpartClass',
      'lockDefaultTemplateEnabled', 'lockDefaultTemplate',
      'lockDefaultMessagesEnabled', 'lockDefaultMessagePrompt',
      'lockDefaultMessageError', 'lockDefaultMessageMissing',
      'lockDefaultMessageSuccess', 'lockUnlockTtlMinutes',
      'enableSiteNavigation', 'hideSpHorizontalNav', 'hideSpSuiteHeader', 'hideSpAppBar',
      'hideSpSearch', 'hideSpBranding', 'chromeConfigOverridesContent'
    ];

    styleKeys.forEach(key => {
      this._propertySnapshot[key] = opts.getProperty(key);
    });

    const tabCount = opts.getTabCount();
    for (let i = 1; i <= tabCount; i++) {
      opts.tabPropertySuffixes.forEach(suffix => {
        const key = `tab${i}${suffix}`;
        this._propertySnapshot[key] = opts.getProperty(key);
      });
    }
  }

  private _restoreProperties(): void {
    const opts = this._options;
    Object.entries(this._propertySnapshot).forEach(([key, value]) => {
      opts.setProperty(key, value);
    });
  }

  // ── Section initialization ──

  private _initSections(): void {
    if (!this._overlay) return;
    const opts = this._options;

    // Create a tracked setProperty for undo/redo
    const trackedSet = (key: string, value: string | number | boolean | undefined): void => {
      this._trackedSetProperty(key, value);
    };

    const onChanged = (): void => this._onChanged();

    // Tab Builder
    const tabsContainer = this._overlay.querySelector('[data-section-content="tabs"]') as HTMLElement;
    if (tabsContainer) {
      this._tabBuilder = new TabBuilderSection({
        getProperty: opts.getProperty,
        setProperty: trackedSet,
        getTabCount: opts.getTabCount,
        maxTabs: opts.maxTabs,
        addTab: opts.addTab,
        deleteTab: opts.deleteTab,
        moveTabUp: opts.moveTabUp,
        moveTabDown: opts.moveTabDown,
        duplicateTab: opts.duplicateTab,
        getZones: opts.getZones,
        getSections: opts.getSections,
        getTextWebPartOptions: opts.getTextWebPartOptions,
        browseFiles: opts.browseFiles,
        onChanged
      });
      this._tabBuilder.render(tabsContainer);
    }

    // Appearance
    const appearanceContainer = this._overlay.querySelector('[data-section-content="appearance"]') as HTMLElement;
    if (appearanceContainer) {
      this._appearance = new AppearanceSection({
        getProperty: opts.getProperty,
        setProperty: trackedSet,
        onChanged
      });
      this._appearance.render(appearanceContainer);
    }

    // Colors
    const colorsContainer = this._overlay.querySelector('[data-section-content="colors"]') as HTMLElement;
    if (colorsContainer) {
      this._colors = new ColorsSection({
        getProperty: opts.getProperty,
        setProperty: trackedSet,
        onChanged,
        getThemePresets: opts.getThemePresets
      });
      this._colors.render(colorsContainer);
    }

    // Typography
    const typographyContainer = this._overlay.querySelector('[data-section-content="typography"]') as HTMLElement;
    if (typographyContainer) {
      this._typography = new TypographySection({
        getProperty: opts.getProperty,
        setProperty: trackedSet,
        onChanged
      });
      this._typography.render(typographyContainer);
    }

    // Templates
    const templatesContainer = this._overlay.querySelector('[data-section-content="templates"]') as HTMLElement;
    if (templatesContainer) {
      this._templates = new TemplatesSection({
        getTemplates: opts.getTemplates,
        applyTemplate: opts.applyTemplate,
        exportConfig: opts.exportConfig,
        importConfig: opts.importConfig,
        saveAsTemplate: opts.saveAsTemplate,
        onChanged
      });
      this._templates.render(templatesContainer);
    }

    // Advanced
    const advancedContainer = this._overlay.querySelector('[data-section-content="advanced"]') as HTMLElement;
    if (advancedContainer) {
      this._advanced = new AdvancedSection({
        getProperty: opts.getProperty,
        setProperty: trackedSet,
        onChanged,
        resetAllStyles: opts.resetAllStyles
      });
      this._advanced.render(advancedContainer);
    }

    // Page Chrome
    const chromeContainer = this._overlay.querySelector('[data-section-content="chrome"]') as HTMLElement;
    if (chromeContainer) {
      this._chrome = new ChromeSection({
        getProperty: opts.getProperty,
        setProperty: trackedSet,
        onChanged,
        getSpChromeConflicts: opts.getSpChromeConflicts
      });
      this._chrome.render(chromeContainer);
    }

    // Navigation
    const navContainer = this._overlay.querySelector('[data-section-content="navigation"]') as HTMLElement;
    if (navContainer) {
      this._navigation = new NavigationSection({
        getProperty: opts.getProperty,
        setProperty: trackedSet,
        onChanged,
        getSpChromeConflicts: opts.getSpChromeConflicts
      });
      this._navigation.render(navContainer);
    }

    // History
    const historyContainer = this._overlay.querySelector('[data-section-content="history"]') as HTMLElement;
    if (historyContainer) {
      this._history = new HistorySection({
        getUndoStack: () => this._undoStack,
        getRedoStack: () => this._redoStack,
        undoToIndex: (idx: number) => this._undoToIndex(idx),
        redoToIndex: (idx: number) => this._redoToIndex(idx),
        onChanged
      });
      this._history.render(historyContainer);
    }

    // Help & Docs
    const helpContainer = this._overlay.querySelector('[data-section-content="help"]') as HTMLElement;
    if (helpContainer) {
      this._help = new HelpSection({ onChanged });
      this._help.render(helpContainer);
    }

    // Live Preview
    const previewContainer = this._overlay.querySelector('[data-preview-container]') as HTMLElement;
    if (previewContainer) {
      this._preview = new LivePreview({
        getProperty: opts.getProperty,
        getTabCount: opts.getTabCount
      });
      this._preview.render(previewContainer);
    }
  }

  private _disposeSections(): void {
    if (this._tabBuilder) { this._tabBuilder.dispose(); this._tabBuilder = null; }
    if (this._appearance) { this._appearance.dispose(); this._appearance = null; }
    if (this._colors) { this._colors.dispose(); this._colors = null; }
    if (this._typography) { this._typography.dispose(); this._typography = null; }
    if (this._templates) { this._templates.dispose(); this._templates = null; }
    if (this._advanced) { this._advanced.dispose(); this._advanced = null; }
    if (this._navigation) { this._navigation.dispose(); this._navigation = null; }
    if (this._chrome) { this._chrome.dispose(); this._chrome = null; }
    if (this._history) { this._history.dispose(); this._history = null; }
    if (this._help) { this._help.dispose(); this._help = null; }
    if (this._preview) { this._preview.dispose(); this._preview = null; }
  }
}
