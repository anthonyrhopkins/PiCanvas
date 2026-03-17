/**
 * HistorySection — Visual change log with undo-to-point support.
 */

export interface IHistoryEntry {
  key: string;
  oldValue: string | number | boolean | undefined;
  newValue: string | number | boolean | undefined;
  label: string;
}

export interface IHistorySectionOptions {
  getUndoStack: () => IHistoryEntry[];
  getRedoStack: () => IHistoryEntry[];
  undoToIndex: (index: number) => void;
  redoToIndex: (index: number) => void;
  onChanged: () => void;
}

export class HistorySection {
  private _el: HTMLElement | null = null;
  private _options: IHistorySectionOptions;

  constructor(options: IHistorySectionOptions) {
    this._options = options;
  }

  public render(container: HTMLElement): void {
    this._el = container;
    this.rebuild();
  }

  public rebuild(): void {
    if (!this._el) return;

    const undoStack = this._options.getUndoStack();
    const redoStack = this._options.getRedoStack();
    const totalChanges = undoStack.length + redoStack.length;

    this._el.innerHTML = `
      <div class="picanvas-config-section-title">Change History</div>
      <div class="picanvas-config-section-desc">All changes made in this session. Click any entry to revert to that point.</div>

      <div class="picanvas-history-container">
        ${totalChanges === 0
          ? `<div class="picanvas-history-empty">
               <span class="picanvas-history-empty-icon">&#128203;</span>
               <span>No changes yet. Edit settings to see your change history here.</span>
             </div>`
          : this._renderTimeline(undoStack, redoStack)
        }
      </div>
    `;

    this._bindEvents();
  }

  private _renderTimeline(undoStack: IHistoryEntry[], redoStack: IHistoryEntry[]): string {
    const rows: string[] = [];

    // Current state marker
    rows.push(`
      <div class="picanvas-history-item picanvas-history-current">
        <div class="picanvas-history-marker">&#9679;</div>
        <div class="picanvas-history-detail">
          <span class="picanvas-history-label">Current State</span>
          <span class="picanvas-history-badge">${undoStack.length} change${undoStack.length !== 1 ? 's' : ''}</span>
        </div>
      </div>
    `);

    // Redo stack (future changes — most recent redo first)
    for (let i = 0; i < redoStack.length; i++) {
      const entry = redoStack[i];
      rows.push(`
        <div class="picanvas-history-item picanvas-history-undone" data-redo-index="${i}">
          <div class="picanvas-history-marker">&#9675;</div>
          <div class="picanvas-history-detail">
            <span class="picanvas-history-label">${this._formatKey(entry.key)}</span>
            <span class="picanvas-history-values">${this._formatValue(entry.oldValue)} &rarr; ${this._formatValue(entry.newValue)}</span>
            <span class="picanvas-history-action">Click to redo</span>
          </div>
        </div>
      `);
    }

    // Undo stack (applied changes — most recent first)
    for (let i = undoStack.length - 1; i >= 0; i--) {
      const entry = undoStack[i];
      const num = i + 1;
      rows.push(`
        <div class="picanvas-history-item picanvas-history-applied" data-undo-index="${i}">
          <div class="picanvas-history-marker">&#9679;</div>
          <div class="picanvas-history-detail">
            <span class="picanvas-history-num">#${num}</span>
            <span class="picanvas-history-label">${this._formatKey(entry.key)}</span>
            <span class="picanvas-history-values">${this._formatValue(entry.oldValue)} &rarr; ${this._formatValue(entry.newValue)}</span>
            <span class="picanvas-history-action">Click to undo to here</span>
          </div>
        </div>
      `);
    }

    // Original state marker
    rows.push(`
      <div class="picanvas-history-item picanvas-history-origin">
        <div class="picanvas-history-marker">&#9632;</div>
        <div class="picanvas-history-detail">
          <span class="picanvas-history-label">Original (Session Start)</span>
        </div>
      </div>
    `);

    return `<div class="picanvas-history-timeline">${rows.join('')}</div>`;
  }

  private _bindEvents(): void {
    if (!this._el) return;

    // Undo-to-point
    this._el.querySelectorAll('[data-undo-index]').forEach(el => {
      el.addEventListener('click', () => {
        const idx = parseInt((el as HTMLElement).dataset.undoIndex || '0', 10);
        this._options.undoToIndex(idx);
        this.rebuild();
      });
    });

    // Redo-to-point
    this._el.querySelectorAll('[data-redo-index]').forEach(el => {
      el.addEventListener('click', () => {
        const idx = parseInt((el as HTMLElement).dataset.redoIndex || '0', 10);
        this._options.redoToIndex(idx);
        this.rebuild();
      });
    });
  }

  private _formatKey(key: string): string {
    return key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();
  }

  private _formatValue(val: string | number | boolean | undefined): string {
    if (val === undefined || val === '') return '<em>empty</em>';
    if (typeof val === 'boolean') return val ? 'On' : 'Off';
    const str = String(val);
    if (str.length > 24) return str.substring(0, 24) + '&hellip;';
    return this._escapeHtml(str);
  }

  private _escapeHtml(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  public dispose(): void {
    this._el = null;
  }
}
