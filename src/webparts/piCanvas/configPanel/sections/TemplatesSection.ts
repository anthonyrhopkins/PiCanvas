/**
 * TemplatesSection — Template gallery, apply, save, import/export.
 */
export interface ITemplateInfo {
  id: string;
  name: string;
  description: string;
  isBuiltIn: boolean;
}

export interface ITemplatesSectionOptions {
  getTemplates: () => ITemplateInfo[];
  applyTemplate: (templateId: string) => void;
  exportConfig: () => void;
  importConfig: () => void;
  saveAsTemplate: () => void;
  deleteTemplate?: (templateId: string) => void;
  onChanged: () => void;
}

export class TemplatesSection {
  private _el: HTMLElement | null = null;
  private _options: ITemplatesSectionOptions;
  private _selectedTemplate: string = '';

  constructor(options: ITemplatesSectionOptions) {
    this._options = options;
  }

  public render(container: HTMLElement): void {
    this._el = container;
    this.rebuild();
  }

  public rebuild(): void {
    if (!this._el) return;

    const templates = this._options.getTemplates();
    const builtIn = templates.filter(t => t.isBuiltIn);
    const saved = templates.filter(t => !t.isBuiltIn);

    let html = `
      <div class="picanvas-config-section-title">Templates</div>
      <div class="picanvas-config-section-desc">Apply pre-built templates or manage your saved configurations.</div>

      <div class="picanvas-config-field-group">
        <div class="picanvas-config-field-group-title">Built-in Templates</div>
        <div class="picanvas-config-template-gallery">
          ${builtIn.map(t => `
            <div class="picanvas-config-template-card${this._selectedTemplate === t.id ? ' active' : ''}" data-template="${t.id}">
              <div class="picanvas-config-template-name">${t.name}</div>
              <div class="picanvas-config-template-desc">${t.description}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    if (saved.length > 0) {
      html += `
        <div class="picanvas-config-field-group">
          <div class="picanvas-config-field-group-title">Saved Templates</div>
          <div class="picanvas-config-template-gallery">
            ${saved.map(t => `
              <div class="picanvas-config-template-card${this._selectedTemplate === t.id ? ' active' : ''}" data-template="${t.id}">
                <div class="picanvas-config-template-name">${t.name}</div>
                <div class="picanvas-config-template-desc">${t.description}</div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    html += `
      <div class="picanvas-config-template-actions">
        <button type="button" class="picanvas-config-btn picanvas-config-btn-done" data-action="apply"${!this._selectedTemplate ? ' disabled style="opacity:0.5"' : ''}>Apply Template</button>
        <button type="button" class="picanvas-config-btn picanvas-config-btn-cancel" data-action="save">Save Current</button>
        <button type="button" class="picanvas-config-btn picanvas-config-btn-cancel" data-action="export">Export</button>
        <button type="button" class="picanvas-config-btn picanvas-config-btn-cancel" data-action="import">Import</button>
      </div>
    `;

    this._el.innerHTML = html;

    // Bind template card clicks
    this._el.querySelectorAll('[data-template]').forEach(card => {
      card.addEventListener('click', () => {
        this._selectedTemplate = (card as HTMLElement).dataset.template || '';
        this.rebuild();
      });
    });

    // Bind action buttons
    this._el.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = (btn as HTMLElement).dataset.action;
        switch (action) {
          case 'apply':
            if (this._selectedTemplate) {
              this._options.applyTemplate(this._selectedTemplate);
              this._options.onChanged();
            }
            break;
          case 'save':
            this._options.saveAsTemplate();
            break;
          case 'export':
            this._options.exportConfig();
            break;
          case 'import':
            this._options.importConfig();
            break;
        }
      });
    });
  }

  public dispose(): void {
    this._el = null;
  }
}
