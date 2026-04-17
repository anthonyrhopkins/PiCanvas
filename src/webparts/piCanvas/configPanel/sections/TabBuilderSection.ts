/**
 * TabBuilderSection — Visual tab management with drag-and-drop reordering,
 * visual content type cards, expandable per-tab settings.
 */
import { DropdownControl, IDropdownOption } from '../controls/DropdownControl';
import { ToggleControl } from '../controls/ToggleControl';
import { SliderControl } from '../controls/SliderControl';
import { ColorPicker } from '../controls/ColorPicker';
import { TOC_STYLE_PRESETS, TocPresetKey } from '../../data/TocStylePresets';
import { REGISTRY_ID_TO_LEGACY_PROP, CATEGORY_LABELS, getRegistryByCategory } from '../../data/ReportTypeRegistry';

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
  browseFiles: (tabIndex: number, onSelected: (url: string) => void) => void;
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
  { key: 'profilereport', icon: '&#128200;', label: 'Profile Report' },
  { key: 'github', icon: '&#128025;', label: 'GitHub Repo' }
];

export class TabBuilderSection {
  private _el: HTMLElement | null = null;
  private _options: ITabBuilderOptions;
  private _expandedTab: number = -1;
  private _dragSourceIndex: number = -1;
  private _controls: Array<{ dispose: () => void }> = [];
  private _clickHandlerBound: boolean = false;

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

    // Click delegation — bind only once to avoid duplicate handlers on rebuild
    if (!this._clickHandlerBound) {
      this._clickHandlerBound = true;
      el.addEventListener('click', (e: Event) => {
        const target = (e.target as HTMLElement).closest('[data-action]') as HTMLElement;
        if (!target) return;
        // Ignore clicks on detached elements (from a previous rebuild)
        if (!el.contains(target)) return;

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
    }

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

      this._renderTextField(accordion.body, tabIndex, 'WebPartLabel', 'Label (for identification)', 'e.g., "Main Hero Banner", "Team Links"');

      const bannerToggle = new ToggleControl({
        label: 'Banner Layout',
        checked: opts.getProperty(`tab${tabIndex}FullWidthBanner`) as boolean ?? true,
        onText: 'Full Width (edge-to-edge)',
        offText: 'Contained (with margins)',
        onChange: (v) => { opts.setProperty(`tab${tabIndex}FullWidthBanner`, v); opts.onChanged(); }
      });
      bannerToggle.render(accordion.body);
      this._controls.push(bannerToggle);
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

      const bannerToggle = new ToggleControl({
        label: 'Banner Layout',
        checked: opts.getProperty(`tab${tabIndex}FullWidthBanner`) as boolean ?? true,
        onText: 'Full Width (edge-to-edge)',
        offText: 'Contained (with margins)',
        onChange: (v) => { opts.setProperty(`tab${tabIndex}FullWidthBanner`, v); opts.onChanged(); }
      });
      bannerToggle.render(accordion.body);
      this._controls.push(bannerToggle);
    } else if (contentType === 'markdown' || contentType === 'html') {
      const sourceType = (opts.getProperty(`tab${tabIndex}ContentSourceType`) as string) || 'manual';
      const sourceDd = new DropdownControl({
        label: 'Content Source',
        value: sourceType,
        options: [
          { key: 'manual', text: 'Manual Input' },
          { key: 'webpart', text: 'Text WebPart on Page' },
          { key: 'url', text: 'SharePoint File' }
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
      } else if (sourceType === 'url') {
        this._renderFileUrlField(accordion.body, tabIndex);
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

      const mermaidFwToggle = new ToggleControl({
        label: 'Diagram Width',
        checked: opts.getProperty(`tab${tabIndex}MermaidFullWidth`) === true,
        onText: 'Full Width',
        offText: 'Contained',
        onChange: (v) => { opts.setProperty(`tab${tabIndex}MermaidFullWidth`, v); opts.onChanged(); }
      });
      mermaidFwToggle.render(accordion.body);
      this._controls.push(mermaidFwToggle);

      this._renderTextField(accordion.body, tabIndex, 'MermaidMaxWidth', 'Max Width', 'e.g. 800px, 100%, 60vw');
      this._renderTextField(accordion.body, tabIndex, 'MermaidHeight', 'Height', 'e.g. 500px, auto, 80vh');
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
      this._renderTextField(accordion.body, tabIndex, 'FileUrl', 'File URL', '/sites/.../SiteAssets/file.html or sharing link');
      this._renderListBindings(accordion.body, tabIndex);
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

      const graphToggle = new ToggleControl({
        label: 'Enable Graph API',
        checked: opts.getProperty(`tab${tabIndex}JavaScriptEnableGraph`) === true,
        onText: 'Enabled (graphFetch available)',
        offText: 'Disabled (no Graph access)',
        onChange: (v) => { opts.setProperty(`tab${tabIndex}JavaScriptEnableGraph`, v); opts.onChanged(); }
      });
      graphToggle.render(accordion.body);
      this._controls.push(graphToggle);
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
      info.textContent = 'Displays company profile reports. Configure library sources below — files in each {domain}/ folder become tabs automatically.';
      accordion.body.appendChild(info);

      // === Library Sources list editor ===
      const sourcesLabel = document.createElement('div');
      sourcesLabel.className = 'picanvas-config-field-label';
      sourcesLabel.style.marginTop = '8px';
      sourcesLabel.style.fontWeight = '600';
      sourcesLabel.textContent = 'Library Sources';
      accordion.body.appendChild(sourcesLabel);

      const sourcesHint = document.createElement('div');
      sourcesHint.className = 'picanvas-config-info';
      sourcesHint.style.fontSize = '12px';
      sourcesHint.style.marginBottom = '8px';
      sourcesHint.textContent = 'Each source scans {library}/{domain}/ for files. Leave Site URL empty for the current site. Adding sources enables discovery mode.';
      accordion.body.appendChild(sourcesHint);

      const sourcesContainer = document.createElement('div');
      sourcesContainer.className = 'picanvas-library-sources';
      accordion.body.appendChild(sourcesContainer);

      // Parse existing sources
      let currentSources: Array<{ siteUrl: string; libraryName: string; label?: string }> = [];
      const sourcesJsonRaw = (opts.getProperty(`tab${tabIndex}ProfileReportLibrarySources`) as string) || '';
      if (sourcesJsonRaw) {
        try { currentSources = JSON.parse(sourcesJsonRaw); } catch { /* ignore */ }
      }

      const saveSources = (): void => {
        opts.setProperty(`tab${tabIndex}ProfileReportLibrarySources`, currentSources.length > 0 ? JSON.stringify(currentSources) : '');
        opts.onChanged();
      };

      const renderSourcesList = (): void => {
        sourcesContainer.innerHTML = '';
        currentSources.forEach((source, idx) => {
          const row = document.createElement('div');
          row.style.cssText = 'display:flex;gap:6px;align-items:center;margin-bottom:6px;';
          row.innerHTML = `
            <input type="text" class="picanvas-config-text-field" placeholder="Site URL (empty = current)" value="${source.siteUrl || ''}" data-field="siteUrl" style="flex:1;min-width:0;" />
            <input type="text" class="picanvas-config-text-field" placeholder="Library name" value="${source.libraryName || ''}" data-field="libraryName" style="flex:1;min-width:0;" />
            <button class="picanvas-config-btn-sm picanvas-source-remove" data-idx="${idx}" title="Remove" style="flex-shrink:0;cursor:pointer;">&#10005;</button>
          `;
          sourcesContainer.appendChild(row);

          // Wire up inputs
          row.querySelectorAll('input').forEach(input => {
            input.addEventListener('input', () => {
              const field = input.getAttribute('data-field') as 'siteUrl' | 'libraryName';
              currentSources[idx][field] = input.value;
              saveSources();
            });
          });
          row.querySelector('.picanvas-source-remove')!.addEventListener('click', () => {
            currentSources.splice(idx, 1);
            saveSources();
            renderSourcesList();
          });
        });

        // Add button
        const addBtn = document.createElement('button');
        addBtn.className = 'picanvas-config-btn-sm';
        addBtn.textContent = '+ Add Library Source';
        addBtn.style.cssText = 'margin-top:4px;cursor:pointer;';
        addBtn.addEventListener('click', () => {
          currentSources.push({ siteUrl: '', libraryName: 'Profiles' });
          saveSources();
          renderSourcesList();
        });
        sourcesContainer.appendChild(addBtn);
      };
      renderSourcesList();

      // === Report Type Column (discovery mode) ===
      const fileTypeWrapper = document.createElement('div');
      fileTypeWrapper.className = 'picanvas-config-field';
      fileTypeWrapper.style.marginTop = '12px';
      fileTypeWrapper.innerHTML = `
        <label class="picanvas-config-field-label">Report Type Column</label>
        <input type="text" class="picanvas-config-text-field" placeholder="e.g. ReportType" value="${(opts.getProperty(`tab${tabIndex}ProfileReportFileTypeColumn`) as string) || ''}" />
        <div style="font-size:11px;color:#888;margin-top:2px;">SP column internal name that identifies the file type (e.g., "Growth Propensity", "Company Profile"). Used as the tab label. Discovery mode only.</div>
      `;
      accordion.body.appendChild(fileTypeWrapper);
      const fileTypeInput = fileTypeWrapper.querySelector('input') as HTMLInputElement;
      fileTypeInput.addEventListener('input', () => {
        opts.setProperty(`tab${tabIndex}ProfileReportFileTypeColumn`, fileTypeInput.value);
        opts.onChanged();
      });

      // === Display Columns (discovery mode) ===
      const displayColsWrapper = document.createElement('div');
      displayColsWrapper.className = 'picanvas-config-field';
      displayColsWrapper.innerHTML = `
        <label class="picanvas-config-field-label">Display Columns</label>
        <input type="text" class="picanvas-config-text-field" placeholder="e.g. Author,Status,ReviewDate" value="${(opts.getProperty(`tab${tabIndex}ProfileReportDisplayColumns`) as string) || ''}" />
        <div style="font-size:11px;color:#888;margin-top:2px;">Comma-separated SP column internal names to show as metadata in each tab. Discovery mode only.</div>
      `;
      accordion.body.appendChild(displayColsWrapper);
      const displayColsInput = displayColsWrapper.querySelector('input') as HTMLInputElement;
      displayColsInput.addEventListener('input', () => {
        opts.setProperty(`tab${tabIndex}ProfileReportDisplayColumns`, displayColsInput.value);
        opts.onChanged();
      });

      // Library name text field (legacy / fallback when no sources configured)
      const libraryWrapper = document.createElement('div');
      libraryWrapper.className = 'picanvas-config-field';
      libraryWrapper.style.marginTop = '12px';
      libraryWrapper.innerHTML = `
        <label class="picanvas-config-field-label">Fallback Library Name</label>
        <input type="text" class="picanvas-config-text-field" placeholder="Profiles" value="${(opts.getProperty(`tab${tabIndex}ProfileReportLibrary`) as string) || 'Profiles'}" data-prop="ProfileReportLibrary" />
        <div style="font-size:11px;color:#888;margin-top:2px;">Used when no Library Sources are configured (registry mode).</div>
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

      // === Registry-driven toggles (only shown when discovery mode is not active) ===
      const togglesHeader = document.createElement('div');
      togglesHeader.className = 'picanvas-config-field-label';
      togglesHeader.style.marginTop = '12px';
      togglesHeader.style.fontWeight = '600';
      togglesHeader.textContent = 'Report Type Toggles (Registry Mode)';
      accordion.body.appendChild(togglesHeader);

      const togglesHint = document.createElement('div');
      togglesHint.className = 'picanvas-config-info';
      togglesHint.style.fontSize = '12px';
      togglesHint.style.marginBottom = '4px';
      togglesHint.textContent = 'These toggles only apply when Library Sources is empty (registry/fallback mode). In discovery mode, all files in the folder become tabs.';
      accordion.body.appendChild(togglesHint);

      const grouped = getRegistryByCategory();
      for (const [category, reportTypes] of Object.entries(grouped)) {
        const catLabel = CATEGORY_LABELS[category] || category;
        const catHeader = document.createElement('div');
        catHeader.className = 'picanvas-config-field-label';
        catHeader.style.marginTop = '12px';
        catHeader.style.fontWeight = '600';
        catHeader.textContent = catLabel;
        accordion.body.appendChild(catHeader);

        for (const rt of reportTypes) {
          const legacyProp = REGISTRY_ID_TO_LEGACY_PROP[rt.id];
          if (!legacyProp) continue;

          const toggle = new ToggleControl({
            label: `Show ${rt.label}`,
            checked: opts.getProperty(`tab${tabIndex}${legacyProp}`) !== false,
            onText: 'Show',
            offText: 'Hide',
            onChange: (v) => {
              opts.setProperty(`tab${tabIndex}${legacyProp}`, v);
              opts.onChanged();
            }
          });
          toggle.render(accordion.body);
          this._controls.push(toggle);
        }
      }

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

      // === Label Hints (advanced, collapsed) ===
      const hintsAcc = this._createAccordion('Label Hints (Advanced)', false);
      accordion.body.appendChild(hintsAcc.wrapper);

      const hintsInfo = document.createElement('div');
      hintsInfo.className = 'picanvas-config-info';
      hintsInfo.style.fontSize = '12px';
      hintsInfo.textContent = 'Optional JSON mapping filenames to labels and sort order. Discovery mode only.';
      hintsAcc.body.appendChild(hintsInfo);

      const hintsTextarea = document.createElement('textarea');
      hintsTextarea.className = 'picanvas-config-text-field';
      hintsTextarea.style.cssText = 'width:100%;min-height:80px;font-family:monospace;font-size:11px;resize:vertical;';
      hintsTextarea.placeholder = '{"method-K.md": {"label": "Method-K", "order": 10}}';
      hintsTextarea.value = (opts.getProperty(`tab${tabIndex}ProfileReportLabelHints`) as string) || '';
      hintsAcc.body.appendChild(hintsTextarea);
      hintsTextarea.addEventListener('input', () => {
        opts.setProperty(`tab${tabIndex}ProfileReportLabelHints`, hintsTextarea.value);
        opts.onChanged();
      });

    } else if (contentType === 'github') {
      const info = document.createElement('div');
      info.className = 'picanvas-config-info';
      info.textContent = 'Embed a GitHub repository with README, file tree, stats, and action buttons. Just paste the repo URL.';
      accordion.body.appendChild(info);

      // GitHub repo URL text field
      const urlWrapper = document.createElement('div');
      urlWrapper.className = 'picanvas-config-field';
      urlWrapper.innerHTML = `
        <label class="picanvas-config-field-label">GitHub Repository URL</label>
        <input type="text" class="picanvas-config-text-field" placeholder="https://github.com/owner/repo" value="${(opts.getProperty(`tab${tabIndex}GitHubRepoUrl`) as string) || ''}" data-prop="GitHubRepoUrl" />
      `;
      accordion.body.appendChild(urlWrapper);
      const urlInput = urlWrapper.querySelector('input') as HTMLInputElement;
      urlInput.addEventListener('input', () => {
        opts.setProperty(`tab${tabIndex}GitHubRepoUrl`, urlInput.value);
        opts.onChanged();
      });
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

    const labelType = (opts.getProperty(`tab${tabIndex}LabelType`) as string) || 'text';

    const labelTypeDd = new DropdownControl({
      label: 'Label Type',
      value: labelType,
      options: [
        { key: 'text', text: 'Text' },
        { key: 'webpart', text: 'WebPart Label' },
        { key: 'hidden', text: 'Hidden (Content Only)' }
      ],
      onChange: (v) => { opts.setProperty(`tab${tabIndex}LabelType`, v); opts.onChanged(); }
    });
    labelTypeDd.render(accordion.body);
    this._controls.push(labelTypeDd);

    if (labelType === 'webpart') {
      // Show web part selector for label
      const zones = opts.getZones();
      const zoneOptions: IDropdownOption[] = [
        { key: '', text: '(Select a web part for label)' },
        ...zones.map(z => ({ key: z[0], text: z[1] }))
      ];
      const labelWpDd = new DropdownControl({
        label: 'Label Web Part',
        value: (opts.getProperty(`tab${tabIndex}LabelWebPartID`) as string) || '',
        options: zoneOptions,
        onChange: (v) => { opts.setProperty(`tab${tabIndex}LabelWebPartID`, v); opts.onChanged(); }
      });
      labelWpDd.render(accordion.body);
      this._controls.push(labelWpDd);

      // Label image size — controls --pi-label-image-height (global setting surfaced here for convenience)
      const imgSizeDd = new DropdownControl({
        label: 'Label Image Size',
        value: (opts.getProperty('labelImageHeight') as string) || '60px',
        options: [
          { key: 'original', text: 'Original (as configured on page)' },
          { key: '40px', text: 'Small (40px)' },
          { key: '60px', text: 'Medium (60px)' },
          { key: '80px', text: 'Large (80px)' },
          { key: '100px', text: 'Extra Large (100px)' },
          { key: '120px', text: 'Huge (120px)' },
          { key: 'none', text: 'No limit (full size)' }
        ],
        onChange: (v) => { opts.setProperty('labelImageHeight', v); opts.onChanged(); }
      });
      imgSizeDd.render(accordion.body);
      this._controls.push(imgSizeDd);
    } else if (labelType === 'hidden') {
      // Info text for hidden mode
      const info = document.createElement('div');
      info.style.cssText = 'color:#666;font-size:12px;margin:8px 0 12px';
      info.textContent = 'Tab bar will be hidden when all tabs use "Hidden" label type.';
      accordion.body.appendChild(info);
    } else {
      // Text label mode - show label, icon, image fields
      this._renderTextField(accordion.body, tabIndex, 'Label', 'Tab Label', `Tab ${tabIndex}`);
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

  // Helper: render a file URL field with Browse button
  private _renderFileUrlField(container: HTMLElement, tabIndex: number): void {
    const opts = this._options;
    const wrapper = document.createElement('div');
    wrapper.style.marginBottom = '12px';
    wrapper.innerHTML = `
      <label class="picanvas-config-field-label">File URL</label>
      <div style="display:flex;gap:8px;align-items:center">
        <input type="text" class="picanvas-config-text-input" style="flex:1" value="${this._escapeAttr((opts.getProperty(`tab${tabIndex}FileUrl`) as string) || '')}" placeholder="/sites/.../SiteAssets/file.html or sharing link" />
        <button type="button" style="padding:6px 14px;border:1px solid rgba(0,0,0,0.2);border-radius:4px;background:#f3f2f1;cursor:pointer;white-space:nowrap;font-size:13px">Browse</button>
      </div>
    `;
    const input = wrapper.querySelector('input') as HTMLInputElement;
    input.addEventListener('change', () => {
      opts.setProperty(`tab${tabIndex}FileUrl`, input.value);
      opts.onChanged();
    });
    const btn = wrapper.querySelector('button') as HTMLButtonElement;
    btn.addEventListener('click', () => {
      opts.browseFiles(tabIndex, (url: string) => {
        input.value = url;
        opts.setProperty(`tab${tabIndex}FileUrl`, url);
        opts.onChanged();
      });
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

  /**
   * Render the List Bindings editor for File content type.
   * Storage: tab{N}FileListBindings as a JSON array of { key, listTitle }.
   * UI: textarea with line-per-binding format `key=ListTitle` for simplicity.
   */
  private _renderListBindings(container: HTMLElement, tabIndex: number): void {
    const opts = this._options;
    const propName = `tab${tabIndex}FileListBindings`;
    const raw = (opts.getProperty(propName) as string) || '';

    // Convert stored JSON → line-per-binding text for the textarea
    let textValue = '';
    try {
      const parsed = raw ? JSON.parse(raw) : [];
      textValue = Array.isArray(parsed)
        ? parsed.map((b: { key?: string; listTitle?: string }) => `${b.key || ''}=${b.listTitle || ''}`).join('\n')
        : '';
    } catch {
      textValue = raw; // Show raw if malformed, so user can repair
    }

    const wrapper = document.createElement('div');
    wrapper.style.marginBottom = '12px';
    wrapper.innerHTML = `
      <label class="picanvas-config-field-label">List Bindings</label>
      <div style="font-size:11px;color:#666;margin-bottom:6px;line-height:1.4">
        One binding per line: <code>key=ListTitle</code>. The HTML file receives data via
        <code>picanvas:lists-ready</code> and can dispatch
        <code>picanvas:list-add|update|delete</code> events. SharePoint list permissions apply.
      </div>
      <textarea class="picanvas-config-textarea" style="font-family:monospace;font-size:12px" rows="4"
        placeholder="signoffs=DashboardSignOffs&#10;kpis=DashboardKPIs">${this._escapeHtml(textValue)}</textarea>
    `;
    const textarea = wrapper.querySelector('textarea') as HTMLTextAreaElement;
    textarea.addEventListener('change', () => {
      const lines = textarea.value.split('\n').map(l => l.trim()).filter(Boolean);
      const bindings = lines
        .map(line => {
          const eq = line.indexOf('=');
          if (eq < 0) return null;
          const key = line.slice(0, eq).trim();
          const listTitle = line.slice(eq + 1).trim();
          if (!key || !listTitle) return null;
          return { key, listTitle };
        })
        .filter(b => b !== null);
      opts.setProperty(propName, bindings.length > 0 ? JSON.stringify(bindings) : '');
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
    this._clickHandlerBound = false;
    this._el = null;
  }
}
