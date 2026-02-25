/**
 * TabBuilderSection — Visual tab management with drag-and-drop reordering,
 * visual content type cards, expandable per-tab settings.
 */
import { DropdownControl, IDropdownOption } from '../controls/DropdownControl';
import { ToggleControl } from '../controls/ToggleControl';
import { SliderControl } from '../controls/SliderControl';
import { ColorPicker } from '../controls/ColorPicker';
import { TOC_STYLE_PRESETS, TocPresetKey } from '../../data/TocStylePresets';

export interface ITabBuilderOptions {
  getProperty: (key: string) => string | number | boolean | undefined;
  setProperty: (key: string, value: string | number | boolean | undefined) => void;
  getTabCount: () => number;
  maxTabs: number;
  addTab: () => void;
  deleteTab: (index: number) => void;
  moveTabUp: (index: number) => void;
  moveTabDown: (index: number) => void;
  duplicateTab: (index: number) => void;
  getZones: () => Array<[string, string, number]>;
  getSections: () => Array<[string, string, number]>;
  getTextWebPartOptions: (tabIndex: number) => IDropdownOption[];
  onChanged: () => void;
}

interface IContentTypeInfo {
  key: string;
  icon: string;
  label: string;
}

const CONTENT_TYPES: IContentTypeInfo[] = [
  { key: 'webpart', icon: '&#9635;', label: 'Web Part' },
  { key: 'section', icon: '&#9638;', label: 'Section' },
  { key: 'markdown', icon: '&#119872;', label: 'Markdown' },
  { key: 'html', icon: '&lt;/&gt;', label: 'HTML' },
  { key: 'mermaid', icon: '&#9670;', label: 'Mermaid' },
  { key: 'embed', icon: '&#9655;', label: 'Embed' },
  { key: 'rss', icon: '&#128225;', label: 'RSS' },
  { key: 'file', icon: '&#128196;', label: 'File' },
  { key: 'javascript', icon: 'JS', label: 'JavaScript' },
  { key: 'toc', icon: '&#9776;', label: 'TOC' },
  { key: 'profilereport', icon: '&#128200;', label: 'Profile Report' }
];

export class TabBuilderSection {
  private _el: HTMLElement | null = null;
  private _options: ITabBuilderOptions;
  private _expandedTab: number = -1;
  private _dragSourceIndex: number = -1;
  private _controls: Array<{ dispose: () => void }> = [];

  constructor(options: ITabBuilderOptions) {
    this._options = options;
  }

  public render(container: HTMLElement): void {
    this._el = container;
    this.rebuild();
  }

  /**
   * Expand a specific tab card by index, scrolling it into view.
   */
  public expandTab(tabIndex: number): void {
    this._expandedTab = tabIndex;
    this.rebuild();

    // Scroll the expanded card into view
    if (this._el) {
      const card = this._el.querySelector(`[data-tab-index="${tabIndex}"]`) as HTMLElement;
      if (card) {
        setTimeout(() => card.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);
      }
    }
  }

  public rebuild(): void {
    if (!this._el) return;
    this._disposeControls();

    const opts = this._options;
    const tabCount = opts.getTabCount();

    let html = `
      <div class="picanvas-config-section-title">Tab Builder</div>
      <div class="picanvas-config-section-desc">Add, remove, reorder, and configure your tabs. Drag to reorder.</div>
      <div class="picanvas-config-tab-list" data-role="tab-list">
    `;

    for (let i = 1; i <= tabCount; i++) {
      const label = (opts.getProperty(`tab${i}Label`) as string) || `Tab ${i}`;
      const contentType = (opts.getProperty(`tab${i}ContentType`) as string) || 'webpart';
      const ctInfo = CONTENT_TYPES.find(c => c.key === contentType) || CONTENT_TYPES[0];

      html += `
        <div class="picanvas-config-tab-card${this._expandedTab === i ? ' expanded' : ''}" data-tab-index="${i}" draggable="true">
          <div class="picanvas-config-tab-card-header" data-action="toggle" data-tab="${i}">
            <span class="picanvas-config-tab-drag-handle" title="Drag to reorder">&#8942;&#8942;</span>
            ${i === 1 ? '<span class="picanvas-config-tab-home-icon" title="Default tab">&#9679;</span>' : ''}
            <span class="picanvas-config-tab-card-title">Tab ${i}: "${this._escapeHtml(label)}"</span>
            <span class="picanvas-config-tab-card-subtitle">${ctInfo.label}</span>
            <div class="picanvas-config-tab-card-actions">
              <button type="button" class="picanvas-config-tab-action-btn" data-action="duplicate" data-tab="${i}" title="Duplicate"${tabCount >= opts.maxTabs ? ' disabled style="opacity:0.3"' : ''}>&#10697;</button>
              <button type="button" class="picanvas-config-tab-action-btn delete" data-action="delete" data-tab="${i}" title="Delete"${tabCount <= 1 ? ' disabled style="opacity:0.3"' : ''}>&#10005;</button>
            </div>
            <span class="picanvas-config-tab-card-chevron">&#9660;</span>
          </div>
          <div class="picanvas-config-tab-card-body" data-body="tab${i}">
          </div>
        </div>
      `;
    }

    html += `</div>`;

    // Add tab button
    if (tabCount < opts.maxTabs) {
      html += `<button type="button" class="picanvas-config-add-tab-btn" data-action="add-tab">+ Add Tab</button>`;
    }

    this._el.innerHTML = html;

    // Bind events
    this._bindEvents();

    // Render expanded tab body if any
    if (this._expandedTab >= 1 && this._expandedTab <= tabCount) {
      this._renderTabBody(this._expandedTab);
    }
  }

  private _bindEvents(): void {
    if (!this._el) return;
    const el = this._el;

    // Click delegation
    el.addEventListener('click', (e: Event) => {
      const target = (e.target as HTMLElement).closest('[data-action]') as HTMLElement;
      if (!target) return;

      const action = target.dataset.action;
      const tabIndex = parseInt(target.dataset.tab || '0', 10);

      switch (action) {
        case 'toggle':
          e.stopPropagation();
          if (this._expandedTab === tabIndex) {
            this._expandedTab = -1;
          } else {
            this._expandedTab = tabIndex;
          }
          this.rebuild();
          break;
        case 'duplicate':
          e.stopPropagation();
          this._options.duplicateTab(tabIndex);
          this._expandedTab = -1;
          this.rebuild();
          this._options.onChanged();
          break;
        case 'delete':
          e.stopPropagation();
          this._options.deleteTab(tabIndex);
          this._expandedTab = -1;
          this.rebuild();
          this._options.onChanged();
          break;
        case 'add-tab':
          this._options.addTab();
          this._expandedTab = this._options.getTabCount();
          this.rebuild();
          this._options.onChanged();
          break;
      }
    });

    // Drag-and-drop
    const cards = el.querySelectorAll('.picanvas-config-tab-card');
    cards.forEach(card => {
      card.addEventListener('dragstart', (e: Event) => {
        const de = e as DragEvent;
        this._dragSourceIndex = parseInt((card as HTMLElement).dataset.tabIndex || '0', 10);
        (card as HTMLElement).classList.add('dragging');
        if (de.dataTransfer) {
          de.dataTransfer.effectAllowed = 'move';
        }
      });
      card.addEventListener('dragend', () => {
        (card as HTMLElement).classList.remove('dragging');
        el.querySelectorAll('.drag-over').forEach(c => c.classList.remove('drag-over'));
        this._dragSourceIndex = -1;
      });
      card.addEventListener('dragover', (e: Event) => {
        e.preventDefault();
        const de = e as DragEvent;
        if (de.dataTransfer) de.dataTransfer.dropEffect = 'move';
        const targetIndex = parseInt((card as HTMLElement).dataset.tabIndex || '0', 10);
        if (targetIndex !== this._dragSourceIndex) {
          el.querySelectorAll('.drag-over').forEach(c => c.classList.remove('drag-over'));
          (card as HTMLElement).classList.add('drag-over');
        }
      });
      card.addEventListener('dragleave', () => {
        (card as HTMLElement).classList.remove('drag-over');
      });
      card.addEventListener('drop', (e: Event) => {
        e.preventDefault();
        (card as HTMLElement).classList.remove('drag-over');
        const targetIndex = parseInt((card as HTMLElement).dataset.tabIndex || '0', 10);
        if (this._dragSourceIndex > 0 && targetIndex > 0 && this._dragSourceIndex !== targetIndex) {
          // Move source to target position by doing step-by-step swaps
          const src = this._dragSourceIndex;
          const tgt = targetIndex;
          if (src < tgt) {
            for (let i = src; i < tgt; i++) {
              this._options.moveTabDown(i);
            }
          } else {
            for (let i = src; i > tgt; i--) {
              this._options.moveTabUp(i);
            }
          }
          this._expandedTab = -1;
          this.rebuild();
          this._options.onChanged();
        }
      });
    });
  }

  private _renderTabBody(tabIndex: number): void {
    if (!this._el) return;
    const body = this._el.querySelector(`[data-body="tab${tabIndex}"]`) as HTMLElement;
    if (!body) return;

    const opts = this._options;
    const contentType = (opts.getProperty(`tab${tabIndex}ContentType`) as string) || 'webpart';

    // Content type grid
    let html = `
      <div style="margin-top:12px">
        <label class="picanvas-config-field-label">Content Type</label>
        <div class="picanvas-config-content-type-grid">
          ${CONTENT_TYPES.map(ct => `
            <div class="picanvas-config-content-type-card${ct.key === contentType ? ' active' : ''}" data-ct="${ct.key}" data-tab-ct="${tabIndex}">
              <span class="picanvas-config-content-type-icon">${ct.icon}</span>
              <span class="picanvas-config-content-type-label">${ct.label}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    // Accordion sections
    html += `<div data-tab-fields="tab${tabIndex}"></div>`;

    body.innerHTML = html;

    // Bind content type clicks
    body.querySelectorAll('[data-tab-ct]').forEach(card => {
      card.addEventListener('click', () => {
        const newType = (card as HTMLElement).dataset.ct || 'webpart';
        opts.setProperty(`tab${tabIndex}ContentType`, newType);
        this._renderTabBody(tabIndex);
        opts.onChanged();
      });
    });

    // Render conditional fields
    const fieldsContainer = body.querySelector(`[data-tab-fields="tab${tabIndex}"]`) as HTMLElement;
    if (fieldsContainer) {
      this._renderContentFields(tabIndex, contentType, fieldsContainer);
      this._renderLabelAccordion(tabIndex, fieldsContainer);
      this._renderPermissionAccordion(tabIndex, fieldsContainer);
      this._renderLockAccordion(tabIndex, fieldsContainer);
    }
  }

  private _renderContentFields(tabIndex: number, contentType: string, container: HTMLElement): void {
    const opts = this._options;

    const accordion = this._createAccordion('Content Settings', true);
    container.appendChild(accordion.wrapper);

    if (contentType === 'webpart') {
      const zones = opts.getZones();
      const zoneOptions: IDropdownOption[] = [
        { key: '', text: '(Select a Web Part)' },
        ...zones.map(z => ({ key: z[0], text: z[1] }))
      ];
      const dd = new DropdownControl({
        label: 'Web Part',
        value: (opts.getProperty(`tab${tabIndex}WebPartID`) as string) || '',
        options: zoneOptions,
        onChange: (v) => { opts.setProperty(`tab${tabIndex}WebPartID`, v); opts.onChanged(); }
      });
      dd.render(accordion.body);
      this._controls.push(dd);
    } else if (contentType === 'section') {
      const sections = opts.getSections();
      const sectionOptions: IDropdownOption[] = [
        { key: '', text: '(Select a Section)' },
        ...sections.map(s => ({ key: s[0], text: s[1] }))
      ];
      const dd = new DropdownControl({
        label: 'Section',
        value: (opts.getProperty(`tab${tabIndex}WebPartID`) as string) || '',
        options: sectionOptions,
        onChange: (v) => { opts.setProperty(`tab${tabIndex}WebPartID`, v); opts.onChanged(); }
      });
      dd.render(accordion.body);
      this._controls.push(dd);
    } else if (contentType === 'markdown' || contentType === 'html') {
      const sourceType = (opts.getProperty(`tab${tabIndex}ContentSourceType`) as string) || 'manual';
      const sourceDd = new DropdownControl({
        label: 'Content Source',
        value: sourceType,
        options: [
          { key: 'manual', text: 'Manual Input' },
          { key: 'webpart', text: 'Text WebPart on Page' }
        ],
        onChange: (v) => {
          opts.setProperty(`tab${tabIndex}ContentSourceType`, v);
          this._renderTabBody(tabIndex);
          opts.onChanged();
        }
      });
      sourceDd.render(accordion.body);
      this._controls.push(sourceDd);

      if (sourceType === 'webpart') {
        const wpOptions = opts.getTextWebPartOptions(tabIndex);
        const wpDd = new DropdownControl({
          label: 'Select Text WebPart',
          value: (opts.getProperty(`tab${tabIndex}ContentSourceWebPartID`) as string) || '',
          options: wpOptions,
          onChange: (v) => { opts.setProperty(`tab${tabIndex}ContentSourceWebPartID`, v); opts.onChanged(); }
        });
        wpDd.render(accordion.body);
        this._controls.push(wpDd);
      } else {
        this._renderTextArea(accordion.body, tabIndex, 'CustomContent', 'Content',
          contentType === 'markdown' ? '# Heading\n\nYour **markdown** content...' : '<div>\n  <p>Your HTML content...</p>\n</div>');
      }

      const fwToggle = new ToggleControl({
        label: 'Content Width',
        checked: opts.getProperty(`tab${tabIndex}ContentFullWidth`) === true,
        onText: 'Full Width',
        offText: 'Contained',
        onChange: (v) => { opts.setProperty(`tab${tabIndex}ContentFullWidth`, v); opts.onChanged(); }
      });
      fwToggle.render(accordion.body);
      this._controls.push(fwToggle);
    } else if (contentType === 'mermaid') {
      this._renderTextArea(accordion.body, tabIndex, 'CustomContent', 'Mermaid Code',
        'graph TD\n    A[Start] --> B[End]');
    } else if (contentType === 'embed') {
      this._renderTextField(accordion.body, tabIndex, 'EmbedUrl', 'Embed URL', 'https://www.youtube.com/embed/...');

      const fpToggle = new ToggleControl({
        label: 'Embed Layout',
        checked: opts.getProperty(`tab${tabIndex}EmbedFullPage`) === true,
        onText: 'Full Page',
        offText: 'Custom',
        onChange: (v) => { opts.setProperty(`tab${tabIndex}EmbedFullPage`, v); opts.onChanged(); }
      });
      fpToggle.render(accordion.body);
      this._controls.push(fpToggle);

      const fwToggle = new ToggleControl({
        label: 'Full Width',
        checked: opts.getProperty(`tab${tabIndex}EmbedFullWidth`) === true,
        onText: 'Full Width',
        offText: 'Contained',
        onChange: (v) => { opts.setProperty(`tab${tabIndex}EmbedFullWidth`, v); opts.onChanged(); }
      });
      fwToggle.render(accordion.body);
      this._controls.push(fwToggle);

      const fhToggle = new ToggleControl({
        label: 'Full Height',
        checked: opts.getProperty(`tab${tabIndex}EmbedFullHeight`) === true,
        onText: 'Full Height (100vh)',
        offText: 'Custom Height',
        onChange: (v) => { opts.setProperty(`tab${tabIndex}EmbedFullHeight`, v); opts.onChanged(); }
      });
      fhToggle.render(accordion.body);
      this._controls.push(fhToggle);

      if (!opts.getProperty(`tab${tabIndex}EmbedFullHeight`) && !opts.getProperty(`tab${tabIndex}EmbedFullPage`)) {
        this._renderTextField(accordion.body, tabIndex, 'EmbedHeight', 'Embed Height', '400px');
      }
    } else if (contentType === 'rss') {
      this._renderTextField(accordion.body, tabIndex, 'RssFeedUrl', 'Feed URL', 'https://example.com/feed.xml');
      const layoutDd = new DropdownControl({
        label: 'Layout',
        value: (opts.getProperty(`tab${tabIndex}RssLayout`) as string) || 'list',
        options: [
          { key: 'list', text: 'List' },
          { key: 'cards', text: 'Cards' },
          { key: 'compact', text: 'Compact' }
        ],
        onChange: (v) => { opts.setProperty(`tab${tabIndex}RssLayout`, v); opts.onChanged(); }
      });
      layoutDd.render(accordion.body);
      this._controls.push(layoutDd);

      const maxDd = new DropdownControl({
        label: 'Max Items',
        value: (opts.getProperty(`tab${tabIndex}RssMaxItems`) as string) || '10',
        options: [
          { key: '5', text: '5 items' }, { key: '10', text: '10 items' },
          { key: '15', text: '15 items' }, { key: '20', text: '20 items' }
        ],
        onChange: (v) => { opts.setProperty(`tab${tabIndex}RssMaxItems`, v); opts.onChanged(); }
      });
      maxDd.render(accordion.body);
      this._controls.push(maxDd);

      ['RssShowDate', 'RssShowDescription', 'RssShowImage', 'RssShowAuthor'].forEach(prop => {
        const label = prop.replace('Rss', '').replace(/([A-Z])/g, ' $1').trim();
        const defaultOn = prop !== 'RssShowAuthor';
        const toggle = new ToggleControl({
          label,
          checked: defaultOn ? opts.getProperty(`tab${tabIndex}${prop}`) !== false : opts.getProperty(`tab${tabIndex}${prop}`) === true,
          onText: 'Yes',
          offText: 'No',
          onChange: (v) => { opts.setProperty(`tab${tabIndex}${prop}`, v); opts.onChanged(); }
        });
        toggle.render(accordion.body);
        this._controls.push(toggle);
      });
    } else if (contentType === 'file') {
      this._renderTextField(accordion.body, tabIndex, 'FileUrl', 'File URL', '/sites/yoursite/SiteAssets/content.html');
    } else if (contentType === 'javascript') {
      this._renderTextArea(accordion.body, tabIndex, 'CustomContent', 'JavaScript Code',
        "container.innerHTML = '<h1>Hello!</h1>';");
      const modeDd = new DropdownControl({
        label: 'Display Mode',
        value: (opts.getProperty(`tab${tabIndex}JavaScriptDisplayMode`) as string) || 'contained',
        options: [
          { key: 'contained', text: 'Contained' },
          { key: 'fullSection', text: 'Full Section' },
          { key: 'fullScreen', text: 'Full Screen' }
        ],
        onChange: (v) => { opts.setProperty(`tab${tabIndex}JavaScriptDisplayMode`, v); opts.onChanged(); }
      });
      modeDd.render(accordion.body);
      this._controls.push(modeDd);
    } else if (contentType === 'toc') {
      const info = document.createElement('div');
      info.className = 'picanvas-config-info';
      info.textContent = 'Scans the page for headings and generates a navigable table of contents.';
      accordion.body.appendChild(info);

      ['TocSearchText', 'TocSearchMarkdown', 'TocSearchCollapsible'].forEach(prop => {
        const label = prop.replace('Toc', '').replace(/([A-Z])/g, ' $1').trim();
        const toggle = new ToggleControl({
          label: `Scan ${label}`,
          checked: opts.getProperty(`tab${tabIndex}${prop}`) !== false,
          onText: 'Yes',
          offText: 'No',
          onChange: (v) => { opts.setProperty(`tab${tabIndex}${prop}`, v); opts.onChanged(); }
        });
        toggle.render(accordion.body);
        this._controls.push(toggle);
      });

      ['TocShowH2', 'TocShowH3', 'TocShowH4', 'TocShowH5'].forEach(prop => {
        const level = prop.replace('TocShow', '');
        const toggle = new ToggleControl({
          label: `Show ${level} Headings`,
          checked: opts.getProperty(`tab${tabIndex}${prop}`) !== false,
          onText: 'Yes',
          offText: 'No',
          onChange: (v) => { opts.setProperty(`tab${tabIndex}${prop}`, v); opts.onChanged(); }
        });
        toggle.render(accordion.body);
        this._controls.push(toggle);
      });

      // ===== TOC Style sub-accordion =====
      this._renderTocStyleAccordion(tabIndex, accordion.body);

      // ===== Typography sub-accordion =====
      this._renderTocTypographyAccordion(tabIndex, accordion.body);

      // ===== Colors sub-accordion =====
      this._renderTocColorsAccordion(tabIndex, accordion.body);

      // ===== Spacing sub-accordion =====
      this._renderTocSpacingAccordion(tabIndex, accordion.body);

      // ===== Interactions sub-accordion =====
      this._renderTocInteractionsAccordion(tabIndex, accordion.body);

    } else if (contentType === 'profilereport') {
      const info = document.createElement('div');
      info.className = 'picanvas-config-info';
      info.textContent = 'Displays company profile reports from a SharePoint document library with Method-K, Method-L, Method-M, and JSON data.';
      accordion.body.appendChild(info);

      // Library name text field (simple HTML)
      const libraryWrapper = document.createElement('div');
      libraryWrapper.className = 'picanvas-config-field';
      libraryWrapper.innerHTML = `
        <label class="picanvas-config-field-label">Document Library Name</label>
        <input type="text" class="picanvas-config-text-field" placeholder="Profiles" value="${(opts.getProperty(`tab${tabIndex}ProfileReportLibrary`) as string) || 'Profiles'}" data-prop="ProfileReportLibrary" />
      `;
      accordion.body.appendChild(libraryWrapper);
      const libraryInput = libraryWrapper.querySelector('input') as HTMLInputElement;
      libraryInput.addEventListener('input', () => {
        opts.setProperty(`tab${tabIndex}ProfileReportLibrary`, libraryInput.value);
        opts.onChanged();
      });

      // Layout dropdown
      const layoutOptions: IDropdownOption[] = [
        { key: 'tabbed', text: 'Tabbed (Company Tabs → Method Tabs)' },
        { key: 'accordion', text: 'Accordion (Collapsible Companies)' },
        { key: 'cards', text: 'Cards (Grid of Companies)' }
      ];
      const layoutDropdown = new DropdownControl({
        label: 'Layout Style',
        options: layoutOptions,
        value: (opts.getProperty(`tab${tabIndex}ProfileReportLayout`) as string) || 'tabbed',
        onChange: (value: string) => {
          opts.setProperty(`tab${tabIndex}ProfileReportLayout`, value);
          opts.onChanged();
        }
      });
      layoutDropdown.render(accordion.body);
      this._controls.push(layoutDropdown);

      // Method visibility toggles
      const methodToggles = [
        { prop: 'ProfileReportShowMethodK', label: 'Show Method-K Analysis' },
        { prop: 'ProfileReportShowMethodL', label: 'Show Method-L Analysis' },
        { prop: 'ProfileReportShowMethodM', label: 'Show Method-M (AI Synthesis)' },
        { prop: 'ProfileReportShowProfileJson', label: 'Show Profile JSON Data' }
      ];

      methodToggles.forEach(({ prop, label }) => {
        const toggle = new ToggleControl({
          label,
          checked: opts.getProperty(`tab${tabIndex}${prop}`) !== false,
          onText: 'Show',
          offText: 'Hide',
          onChange: (v) => {
            opts.setProperty(`tab${tabIndex}${prop}`, v);
            opts.onChanged();
          }
        });
        toggle.render(accordion.body);
        this._controls.push(toggle);
      });

      // Company limit slider
      const limitValue = (opts.getProperty(`tab${tabIndex}ProfileReportCompanyLimit`) as number) || 50;
      const limitSlider = new SliderControl({
        label: 'Maximum Companies to Display',
        min: 10,
        max: 200,
        step: 10,
        value: String(limitValue),
        onChange: (value: string) => {
          opts.setProperty(`tab${tabIndex}ProfileReportCompanyLimit`, parseInt(value, 10));
          opts.onChanged();
        }
      });
      limitSlider.render(accordion.body);
      this._controls.push(limitSlider);

      // Sort dropdown
      const sortOptions: IDropdownOption[] = [
        { key: 'name', text: 'Company Name (A-Z)' },
        { key: 'date', text: 'Date Generated (Newest First)' },
        { key: 'key', text: 'Company Key' }
      ];
      const sortDropdown = new DropdownControl({
        label: 'Sort Companies By',
        options: sortOptions,
        value: (opts.getProperty(`tab${tabIndex}ProfileReportSortBy`) as string) || 'name',
        onChange: (value: string) => {
          opts.setProperty(`tab${tabIndex}ProfileReportSortBy`, value);
          opts.onChanged();
        }
      });
      sortDropdown.render(accordion.body);
      this._controls.push(sortDropdown);

      // Theme dropdown
      const themeOptions: IDropdownOption[] = [
        { key: 'light', text: 'Light Theme' },
        { key: 'dark', text: 'Dark Theme' },
        { key: 'auto', text: 'Auto (Match Page Theme)' }
      ];
      const themeDropdown = new DropdownControl({
        label: 'Color Theme',
        options: themeOptions,
        value: (opts.getProperty(`tab${tabIndex}ProfileReportTheme`) as string) || 'auto',
        onChange: (value: string) => {
          opts.setProperty(`tab${tabIndex}ProfileReportTheme`, value);
          opts.onChanged();
        }
      });
      themeDropdown.render(accordion.body);
      this._controls.push(themeDropdown);
    }
  }

  // ===== TOC Styling Sub-Accordions =====

  private _renderTocStyleAccordion(tabIndex: number, container: HTMLElement): void {
    const opts = this._options;
    const acc = this._createAccordion('TOC Style', false);
    container.appendChild(acc.wrapper);

    // Style preset dropdown
    const presetOptions: IDropdownOption[] = [
      { key: '', text: '(Custom)' },
      ...TOC_STYLE_PRESETS.map(p => ({ key: p.key, text: `${p.label} — ${p.description}` }))
    ];
    const presetDd = new DropdownControl({
      label: 'Style Preset',
      value: (opts.getProperty(`tab${tabIndex}TocStylePreset`) as string) || '',
      options: presetOptions,
      onChange: (v) => {
        opts.setProperty(`tab${tabIndex}TocStylePreset`, v);
        if (v) {
          this._applyTocPreset(tabIndex, v as TocPresetKey);
        }
        // Rebuild the tab body so all controls reflect updated preset values
        this._renderTabBody(tabIndex);
        opts.onChanged();
      }
    });
    presetDd.render(acc.body);
    this._controls.push(presetDd);

    // List style dropdown (expanded)
    const listStyleDd = new DropdownControl({
      label: 'List Style',
      value: (opts.getProperty(`tab${tabIndex}TocListStyle`) as string) || 'disc',
      options: [
        { key: 'disc', text: 'Bullet Points' },
        { key: 'decimal', text: 'Numbered' },
        { key: 'none', text: 'No Markers' },
        { key: 'roman', text: 'Roman Numerals' },
        { key: 'alpha', text: 'Alphabetical' },
        { key: 'dash', text: 'Dashes' },
        { key: 'arrow', text: 'Arrows' },
        { key: 'custom-icon', text: 'Custom Icon' }
      ],
      onChange: (v) => { opts.setProperty(`tab${tabIndex}TocListStyle`, v); opts.onChanged(); }
    });
    listStyleDd.render(acc.body);
    this._controls.push(listStyleDd);

    // Custom icon field (only for custom-icon list style)
    if ((opts.getProperty(`tab${tabIndex}TocListStyle`) as string) === 'custom-icon') {
      this._renderTextField(acc.body, tabIndex, 'TocCustomIcon', 'Custom Icon', 'e.g. ▸ or ★');
    }
  }

  private _renderTocTypographyAccordion(tabIndex: number, container: HTMLElement): void {
    const opts = this._options;
    const acc = this._createAccordion('Typography', false);
    container.appendChild(acc.wrapper);

    // Font family
    const fontFamilyDd = new DropdownControl({
      label: 'Font Family',
      value: (opts.getProperty(`tab${tabIndex}TocFontFamily`) as string) || '',
      options: [
        { key: '', text: '(Default — Segoe UI)' },
        { key: '"Segoe UI", -apple-system, BlinkMacSystemFont, Roboto, sans-serif', text: 'Segoe UI' },
        { key: 'Inter, "Segoe UI", system-ui, sans-serif', text: 'Inter / System UI' },
        { key: 'system-ui, -apple-system, "Segoe UI", sans-serif', text: 'System UI' },
        { key: 'Georgia, "Times New Roman", serif', text: 'Georgia (Serif)' },
        { key: '"Courier New", Courier, monospace', text: 'Courier New (Mono)' },
        { key: 'Verdana, Geneva, sans-serif', text: 'Verdana' },
        { key: '"Trebuchet MS", Helvetica, sans-serif', text: 'Trebuchet MS' }
      ],
      onChange: (v) => { opts.setProperty(`tab${tabIndex}TocFontFamily`, v); opts.onChanged(); }
    });
    fontFamilyDd.render(acc.body);
    this._controls.push(fontFamilyDd);

    // Base font size
    const baseSizeSlider = new SliderControl({
      label: 'Base Font Size',
      value: String((opts.getProperty(`tab${tabIndex}TocBaseFontSize`) as number) || 14),
      min: 10, max: 24, step: 1, suffix: 'px',
      onChange: (v) => { opts.setProperty(`tab${tabIndex}TocBaseFontSize`, parseFloat(v)); opts.onChanged(); }
    });
    baseSizeSlider.render(acc.body);
    this._controls.push(baseSizeSlider);

    // Title font size
    const titleSizeSlider = new SliderControl({
      label: 'Title Font Size',
      value: String((opts.getProperty(`tab${tabIndex}TocTitleFontSize`) as number) || 16),
      min: 12, max: 32, step: 1, suffix: 'px',
      onChange: (v) => { opts.setProperty(`tab${tabIndex}TocTitleFontSize`, parseFloat(v)); opts.onChanged(); }
    });
    titleSizeSlider.render(acc.body);
    this._controls.push(titleSizeSlider);

    // Level size step
    const levelStepSlider = new SliderControl({
      label: 'Level Size Step',
      value: String((opts.getProperty(`tab${tabIndex}TocLevelSizeStep`) as number) ?? 1),
      min: 0, max: 4, step: 0.5, suffix: 'px',
      onChange: (v) => { opts.setProperty(`tab${tabIndex}TocLevelSizeStep`, parseFloat(v)); opts.onChanged(); }
    });
    levelStepSlider.render(acc.body);
    this._controls.push(levelStepSlider);

    // Font weight dropdowns
    const weightOptions: IDropdownOption[] = [
      { key: '300', text: 'Light (300)' },
      { key: '400', text: 'Normal (400)' },
      { key: '500', text: 'Medium (500)' },
      { key: '600', text: 'Semi-Bold (600)' },
      { key: '700', text: 'Bold (700)' }
    ];

    const titleWeightDd = new DropdownControl({
      label: 'Title Font Weight',
      value: (opts.getProperty(`tab${tabIndex}TocTitleFontWeight`) as string) || '600',
      options: weightOptions,
      onChange: (v) => { opts.setProperty(`tab${tabIndex}TocTitleFontWeight`, v); opts.onChanged(); }
    });
    titleWeightDd.render(acc.body);
    this._controls.push(titleWeightDd);

    const h2WeightDd = new DropdownControl({
      label: 'H2 Font Weight',
      value: (opts.getProperty(`tab${tabIndex}TocH2FontWeight`) as string) || '600',
      options: weightOptions,
      onChange: (v) => { opts.setProperty(`tab${tabIndex}TocH2FontWeight`, v); opts.onChanged(); }
    });
    h2WeightDd.render(acc.body);
    this._controls.push(h2WeightDd);

    const subWeightDd = new DropdownControl({
      label: 'Sub-heading Font Weight',
      value: (opts.getProperty(`tab${tabIndex}TocSubHeadingFontWeight`) as string) || '400',
      options: weightOptions,
      onChange: (v) => { opts.setProperty(`tab${tabIndex}TocSubHeadingFontWeight`, v); opts.onChanged(); }
    });
    subWeightDd.render(acc.body);
    this._controls.push(subWeightDd);

    // Line height
    const lineHeightSlider = new SliderControl({
      label: 'Line Height',
      value: String((opts.getProperty(`tab${tabIndex}TocLineHeight`) as number) || 1.6),
      min: 1.2, max: 2.2, step: 0.1, suffix: '',
      onChange: (v) => { opts.setProperty(`tab${tabIndex}TocLineHeight`, parseFloat(v)); opts.onChanged(); }
    });
    lineHeightSlider.render(acc.body);
    this._controls.push(lineHeightSlider);

    // Letter spacing
    const letterSpacingSlider = new SliderControl({
      label: 'Letter Spacing',
      value: String((opts.getProperty(`tab${tabIndex}TocLetterSpacing`) as number) || 0),
      min: 0, max: 2, step: 0.1, suffix: 'px',
      onChange: (v) => { opts.setProperty(`tab${tabIndex}TocLetterSpacing`, parseFloat(v)); opts.onChanged(); }
    });
    letterSpacingSlider.render(acc.body);
    this._controls.push(letterSpacingSlider);
  }

  private _renderTocColorsAccordion(tabIndex: number, container: HTMLElement): void {
    const opts = this._options;
    const acc = this._createAccordion('Colors', false);
    container.appendChild(acc.wrapper);

    const colorFields: Array<{ suffix: string; label: string; defaultValue: string }> = [
      { suffix: 'TocLinkColor', label: 'Link Color', defaultValue: '#0078d4' },
      { suffix: 'TocLinkHoverColor', label: 'Link Hover Color', defaultValue: '#106ebe' },
      { suffix: 'TocActiveColor', label: 'Active Link Color', defaultValue: '#005a9e' },
      { suffix: 'TocTitleColor', label: 'Title Color', defaultValue: '#323130' },
      { suffix: 'TocBackgroundColor', label: 'Background Color', defaultValue: '' },
      { suffix: 'TocBorderColor', label: 'Border Color', defaultValue: '' }
    ];

    colorFields.forEach(cf => {
      const currentValue = (opts.getProperty(`tab${tabIndex}${cf.suffix}`) as string) || cf.defaultValue;
      if (!currentValue) {
        // For optional colors (bg, border), show a text field for easy clearing
        this._renderTextField(acc.body, tabIndex, cf.suffix, cf.label, 'e.g. #faf9f8 or leave empty');
        return;
      }
      const picker = new ColorPicker({
        label: cf.label,
        value: currentValue,
        onChange: (v) => { opts.setProperty(`tab${tabIndex}${cf.suffix}`, v); opts.onChanged(); }
      });
      picker.render(acc.body);
      this._controls.push(picker);
    });

    // Level color dimming
    const dimmingSlider = new SliderControl({
      label: 'Level Color Dimming',
      value: String((opts.getProperty(`tab${tabIndex}TocLevelColorDimming`) as number) ?? 10),
      min: 0, max: 30, step: 1, suffix: '%',
      onChange: (v) => { opts.setProperty(`tab${tabIndex}TocLevelColorDimming`, parseFloat(v)); opts.onChanged(); }
    });
    dimmingSlider.render(acc.body);
    this._controls.push(dimmingSlider);
  }

  private _renderTocSpacingAccordion(tabIndex: number, container: HTMLElement): void {
    const opts = this._options;
    const acc = this._createAccordion('Spacing', false);
    container.appendChild(acc.wrapper);

    const paddingSlider = new SliderControl({
      label: 'Container Padding',
      value: String((opts.getProperty(`tab${tabIndex}TocContainerPadding`) as number) ?? 16),
      min: 0, max: 40, step: 2, suffix: 'px',
      onChange: (v) => { opts.setProperty(`tab${tabIndex}TocContainerPadding`, parseFloat(v)); opts.onChanged(); }
    });
    paddingSlider.render(acc.body);
    this._controls.push(paddingSlider);

    const itemSpacingSlider = new SliderControl({
      label: 'Item Spacing',
      value: String((opts.getProperty(`tab${tabIndex}TocItemSpacing`) as number) ?? 4),
      min: 0, max: 16, step: 1, suffix: 'px',
      onChange: (v) => { opts.setProperty(`tab${tabIndex}TocItemSpacing`, parseFloat(v)); opts.onChanged(); }
    });
    itemSpacingSlider.render(acc.body);
    this._controls.push(itemSpacingSlider);

    const indentSlider = new SliderControl({
      label: 'Indent Per Level',
      value: String((opts.getProperty(`tab${tabIndex}TocIndentPerLevel`) as number) ?? 20),
      min: 0, max: 40, step: 2, suffix: 'px',
      onChange: (v) => { opts.setProperty(`tab${tabIndex}TocIndentPerLevel`, parseFloat(v)); opts.onChanged(); }
    });
    indentSlider.render(acc.body);
    this._controls.push(indentSlider);

    // Max width
    const maxWidthDd = new DropdownControl({
      label: 'Max Width',
      value: (opts.getProperty(`tab${tabIndex}TocMaxWidth`) as string) || '',
      options: [
        { key: '', text: 'None (full width)' },
        { key: '400px', text: '400px' },
        { key: '500px', text: '500px' },
        { key: '600px', text: '600px' },
        { key: '800px', text: '800px' },
        { key: '50%', text: '50%' },
        { key: '75%', text: '75%' }
      ],
      onChange: (v) => { opts.setProperty(`tab${tabIndex}TocMaxWidth`, v); opts.onChanged(); }
    });
    maxWidthDd.render(acc.body);
    this._controls.push(maxWidthDd);
  }

  private _renderTocInteractionsAccordion(tabIndex: number, container: HTMLElement): void {
    const opts = this._options;
    const acc = this._createAccordion('Interactions', false);
    container.appendChild(acc.wrapper);

    const interactionToggles: Array<{ suffix: string; label: string }> = [
      { suffix: 'TocEnableScrollspy', label: 'Scrollspy (highlight active section)' },
      { suffix: 'TocEnableCollapsible', label: 'Collapsible Sections' },
      { suffix: 'TocEnableHoverBackground', label: 'Hover Background' },
      { suffix: 'TocEnableClickRipple', label: 'Click Ripple Effect' }
    ];

    interactionToggles.forEach(it => {
      const toggle = new ToggleControl({
        label: it.label,
        checked: opts.getProperty(`tab${tabIndex}${it.suffix}`) === true,
        onText: 'On',
        offText: 'Off',
        onChange: (v) => { opts.setProperty(`tab${tabIndex}${it.suffix}`, v); opts.onChanged(); }
      });
      toggle.render(acc.body);
      this._controls.push(toggle);
    });

    // Hover background color (only if hover background enabled)
    if (opts.getProperty(`tab${tabIndex}TocEnableHoverBackground`) === true) {
      this._renderTextField(acc.body, tabIndex, 'TocHoverBackgroundColor', 'Hover Background Color', 'e.g. rgba(0,120,212,0.06)');
    }
  }

  /**
   * Apply a TOC style preset — batch-sets all styling properties from the preset config
   */
  private _applyTocPreset(tabIndex: number, presetKey: TocPresetKey): void {
    const preset = TOC_STYLE_PRESETS.find(p => p.key === presetKey);
    if (!preset) return;

    const opts = this._options;
    const cfg = preset.config;

    // Map ITocConfig keys to property suffixes
    const mapping: Array<[string, keyof typeof cfg]> = [
      ['TocFontFamily', 'fontFamily'],
      ['TocBaseFontSize', 'baseFontSize'],
      ['TocTitleFontSize', 'titleFontSize'],
      ['TocLevelSizeStep', 'levelSizeStep'],
      ['TocTitleFontWeight', 'titleFontWeight'],
      ['TocH2FontWeight', 'h2FontWeight'],
      ['TocSubHeadingFontWeight', 'subHeadingFontWeight'],
      ['TocLineHeight', 'lineHeight'],
      ['TocLetterSpacing', 'letterSpacing'],
      ['TocLinkColor', 'linkColor'],
      ['TocLinkHoverColor', 'linkHoverColor'],
      ['TocActiveColor', 'activeColor'],
      ['TocTitleColor', 'titleColor'],
      ['TocLevelColorDimming', 'levelColorDimming'],
      ['TocBackgroundColor', 'backgroundColor'],
      ['TocBorderColor', 'borderColor'],
      ['TocContainerPadding', 'containerPadding'],
      ['TocItemSpacing', 'itemSpacing'],
      ['TocIndentPerLevel', 'indentPerLevel'],
      ['TocMaxWidth', 'maxWidth'],
      ['TocListStyle', 'listStyle'],
      ['TocCustomIcon', 'customIcon'],
      ['TocEnableScrollspy', 'enableScrollspy'],
      ['TocEnableCollapsible', 'enableCollapsible'],
      ['TocEnableHoverBackground', 'enableHoverBackground'],
      ['TocHoverBackgroundColor', 'hoverBackgroundColor'],
      ['TocEnableClickRipple', 'enableClickRipple']
    ];

    mapping.forEach(([suffix, key]) => {
      const value = cfg[key];
      if (value !== undefined) {
        opts.setProperty(`tab${tabIndex}${suffix}`, value as string | number | boolean);
      }
    });
  }

  private _renderLabelAccordion(tabIndex: number, container: HTMLElement): void {
    const opts = this._options;
    const accordion = this._createAccordion('Label & Appearance', false);
    container.appendChild(accordion.wrapper);

    this._renderTextField(accordion.body, tabIndex, 'Label', 'Tab Label', `Tab ${tabIndex}`);

    const labelTypeDd = new DropdownControl({
      label: 'Label Type',
      value: (opts.getProperty(`tab${tabIndex}LabelType`) as string) || 'text',
      options: [
        { key: 'text', text: 'Text' },
        { key: 'webpart', text: 'WebPart Label' }
      ],
      onChange: (v) => { opts.setProperty(`tab${tabIndex}LabelType`, v); opts.onChanged(); }
    });
    labelTypeDd.render(accordion.body);
    this._controls.push(labelTypeDd);

    this._renderTextField(accordion.body, tabIndex, 'Icon', 'Icon (emoji or text)', '');
    this._renderTextField(accordion.body, tabIndex, 'Image', 'Image URL', '');

    if (opts.getProperty(`tab${tabIndex}Image`)) {
      const posDd = new DropdownControl({
        label: 'Image Position',
        value: (opts.getProperty(`tab${tabIndex}ImagePosition`) as string) || 'left',
        options: [
          { key: 'left', text: 'Left of text' },
          { key: 'right', text: 'Right of text' },
          { key: 'top', text: 'Above text' },
          { key: 'background', text: 'Background image' }
        ],
        onChange: (v) => { opts.setProperty(`tab${tabIndex}ImagePosition`, v); opts.onChanged(); }
      });
      posDd.render(accordion.body);
      this._controls.push(posDd);
    }

    const dividerToggle = new ToggleControl({
      label: 'Divider After Tab',
      checked: opts.getProperty(`tab${tabIndex}DividerAfter`) === true,
      onText: 'Yes',
      offText: 'No',
      onChange: (v) => { opts.setProperty(`tab${tabIndex}DividerAfter`, v); opts.onChanged(); }
    });
    dividerToggle.render(accordion.body);
    this._controls.push(dividerToggle);
  }

  private _renderPermissionAccordion(tabIndex: number, container: HTMLElement): void {
    const opts = this._options;
    const accordion = this._createAccordion('Permissions', false);
    container.appendChild(accordion.wrapper);

    const permToggle = new ToggleControl({
      label: 'Restrict by Group',
      checked: opts.getProperty(`tab${tabIndex}PermissionEnabled`) === true,
      onText: 'Restricted',
      offText: 'Everyone',
      onChange: (v) => { opts.setProperty(`tab${tabIndex}PermissionEnabled`, v); opts.onChanged(); }
    });
    permToggle.render(accordion.body);
    this._controls.push(permToggle);

    if (opts.getProperty(`tab${tabIndex}PermissionEnabled`)) {
      const groupsDd = new DropdownControl({
        label: 'Visible to Groups',
        value: (opts.getProperty(`tab${tabIndex}PermissionGroups`) as string) || '',
        options: [
          { key: '', text: 'Everyone (no restriction)' },
          { key: 'owners', text: 'Site Owners' },
          { key: 'members', text: 'Site Members' },
          { key: 'visitors', text: 'Site Visitors' },
          { key: 'owners,members', text: 'Owners & Members' },
          { key: 'members,visitors', text: 'Members & Visitors' },
          { key: 'owners,members,visitors', text: 'All Site Groups' }
        ],
        onChange: (v) => { opts.setProperty(`tab${tabIndex}PermissionGroups`, v); opts.onChanged(); }
      });
      groupsDd.render(accordion.body);
      this._controls.push(groupsDd);

      this._renderTextField(accordion.body, tabIndex, 'PermissionCustomGroups', 'Custom Group IDs', 'e.g. 5, 12, 23');

      const placeholderToggle = new ToggleControl({
        label: 'Show Placeholder',
        checked: opts.getProperty(`tab${tabIndex}PermissionPlaceholder`) === true,
        onText: 'Placeholder',
        offText: 'Hidden',
        onChange: (v) => { opts.setProperty(`tab${tabIndex}PermissionPlaceholder`, v); opts.onChanged(); }
      });
      placeholderToggle.render(accordion.body);
      this._controls.push(placeholderToggle);

      if (opts.getProperty(`tab${tabIndex}PermissionPlaceholder`)) {
        this._renderTextField(accordion.body, tabIndex, 'PermissionPlaceholderText', 'Placeholder Message', 'Restricted');
      }
    }
  }

  private _renderLockAccordion(tabIndex: number, container: HTMLElement): void {
    const opts = this._options;
    const accordion = this._createAccordion('Password Lock', false);
    container.appendChild(accordion.wrapper);

    const lockToggle = new ToggleControl({
      label: 'Require Password',
      checked: opts.getProperty(`tab${tabIndex}LockEnabled`) === true,
      onText: 'Locked',
      offText: 'Unlocked',
      onChange: (v) => { opts.setProperty(`tab${tabIndex}LockEnabled`, v); opts.onChanged(); }
    });
    lockToggle.render(accordion.body);
    this._controls.push(lockToggle);

    if (opts.getProperty(`tab${tabIndex}LockEnabled`)) {
      const hasPassword = !!(opts.getProperty(`tab${tabIndex}LockPasswordHash`) as string);
      const statusEl = document.createElement('div');
      statusEl.className = 'picanvas-config-info';
      statusEl.textContent = hasPassword ? 'Password is set for this tab.' : 'No password set. Tab will stay locked.';
      accordion.body.appendChild(statusEl);

      this._renderTextField(accordion.body, tabIndex, 'LockPassword', 'Set or Update Password', '', 'password');
    }
  }

  // Helper: create an accordion
  private _createAccordion(title: string, openByDefault: boolean): { wrapper: HTMLElement; body: HTMLElement } {
    const wrapper = document.createElement('div');
    wrapper.className = `picanvas-config-accordion${openByDefault ? ' open' : ''}`;

    const header = document.createElement('div');
    header.className = 'picanvas-config-accordion-header';
    header.innerHTML = `<span>${title}</span><span class="picanvas-config-accordion-chevron">&#9660;</span>`;

    const body = document.createElement('div');
    body.className = 'picanvas-config-accordion-body';

    header.addEventListener('click', () => {
      wrapper.classList.toggle('open');
    });

    wrapper.appendChild(header);
    wrapper.appendChild(body);
    return { wrapper, body };
  }

  // Helper: render a text field
  private _renderTextField(container: HTMLElement, tabIndex: number, suffix: string, label: string, placeholder: string, type: string = 'text'): void {
    const opts = this._options;
    const wrapper = document.createElement('div');
    wrapper.style.marginBottom = '12px';
    wrapper.innerHTML = `
      <label class="picanvas-config-field-label">${label}</label>
      <input type="${type}" class="picanvas-config-text-input" value="${this._escapeAttr((opts.getProperty(`tab${tabIndex}${suffix}`) as string) || '')}" placeholder="${placeholder}" />
    `;
    const input = wrapper.querySelector('input') as HTMLInputElement;
    input.addEventListener('change', () => {
      opts.setProperty(`tab${tabIndex}${suffix}`, input.value);
      // If label changed, rebuild the card header
      if (suffix === 'Label') {
        this.rebuild();
      }
      opts.onChanged();
    });
    container.appendChild(wrapper);
  }

  // Helper: render a textarea
  private _renderTextArea(container: HTMLElement, tabIndex: number, suffix: string, label: string, placeholder: string): void {
    const opts = this._options;
    const wrapper = document.createElement('div');
    wrapper.style.marginBottom = '12px';
    wrapper.innerHTML = `
      <label class="picanvas-config-field-label">${label}</label>
      <textarea class="picanvas-config-textarea" placeholder="${this._escapeAttr(placeholder)}">${this._escapeHtml((opts.getProperty(`tab${tabIndex}${suffix}`) as string) || '')}</textarea>
    `;
    const textarea = wrapper.querySelector('textarea') as HTMLTextAreaElement;
    textarea.addEventListener('change', () => {
      opts.setProperty(`tab${tabIndex}${suffix}`, textarea.value);
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
