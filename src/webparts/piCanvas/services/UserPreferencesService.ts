/**
 * UserPreferencesService
 * Per-user preferences stored as a JSON file in SiteAssets/PiCanvas/.
 * Each user gets their own file: userprefs-{userId}.json
 *
 * Follows the file I/O patterns from TemplateService.ts and the caching
 * conventions from ListNavigationService.ts / UserShortcutsService.ts.
 */

import { SPHttpClient } from '@microsoft/sp-http';
import { WebPartContext } from '@microsoft/sp-webpart-base';

// ── Interfaces ──────────────────────────────────────────

export interface IUserShortcutPref {
  id: string;             // client-generated "sc-{timestamp}"
  title: string;
  url: string;
  icon: string;
  openInNewWindow: boolean;
  sortOrder: number;
}

export interface IDisplayPrefs {
  showBadges: boolean;
  theme: string;          // "dark" | "light" | "hc"
  fontSize: number;       // 10–20
}

export interface IUserPreferences {
  schemaVersion: string;
  userId: number;
  lastModified: string;
  shortcuts: IUserShortcutPref[];
  hiddenNavItems: number[];
  navOrder: number[];
  display: IDisplayPrefs;
}

// ── Constants ───────────────────────────────────────────

const SCHEMA_VERSION = '1.0';
const FOLDER_PATH = 'SiteAssets/PiCanvas';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const SAVE_DEBOUNCE_MS = 500;

// ── Service ─────────────────────────────────────────────

export class UserPreferencesService {
  private _cache: IUserPreferences | null = null;
  private _cacheTimestamp: number = 0;
  private _isWorkbench: boolean;
  private _userId: number;
  private _siteUrl: string;
  private _serverRelativeUrl: string;
  private _saveTimer: ReturnType<typeof setTimeout> | null = null;
  private _pendingSave: IUserPreferences | null = null;

  constructor(private context: WebPartContext) {
    const url = window.location.href.toLowerCase();
    this._isWorkbench = url.indexOf('workbench') > -1 || url.indexOf('localhost') > -1;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this._userId = (context.pageContext.legacyPageContext as any)?.userId || 0;
    this._siteUrl = context.pageContext.web.absoluteUrl;
    const rel = context.pageContext.web.serverRelativeUrl;
    this._serverRelativeUrl = rel === '/' ? '' : rel;
  }

  // ── File path helpers ───────────────────────────────

  private get _folderPath(): string {
    return `${this._serverRelativeUrl}/${FOLDER_PATH}`;
  }

  private get _fileName(): string {
    return `userprefs-${this._userId}.json`;
  }

  // ── Public API ──────────────────────────────────────

  /**
   * Load preferences. Returns cached value, file content, or defaults.
   * Never throws — returns defaults on any error.
   */
  public async getPreferences(): Promise<IUserPreferences> {
    if (this._isWorkbench) {
      return this._cache || this._createDefaults();
    }

    // Return cache if fresh
    if (this._cache && (Date.now() - this._cacheTimestamp) < CACHE_TTL_MS) {
      return this._cache;
    }

    try {
      const fileUrl = `${this._siteUrl}/_api/web/GetFileByServerRelativeUrl('${encodeURIComponent(this._folderPath)}/${encodeURIComponent(this._fileName)}')/$value`;
      const resp = await this.context.spHttpClient.get(
        fileUrl,
        SPHttpClient.configurations.v1
      );

      if (resp.ok) {
        const prefs: IUserPreferences = await resp.json();
        this._cache = this._migrate(prefs);
        this._cacheTimestamp = Date.now();
        return this._cache;
      }

      // File not found — return defaults (don't create file until first save)
      console.log('[PiCanvas] UserPreferences: no prefs file, using defaults');
      const defaults = this._createDefaults();
      this._cache = defaults;
      this._cacheTimestamp = Date.now();
      return defaults;
    } catch (err) {
      console.warn('[PiCanvas] UserPreferences: read failed:', err);
      return this._cache || this._createDefaults();
    }
  }

  /**
   * Write preferences to the JSON file. Debounced for rapid changes.
   */
  public async savePreferences(prefs: IUserPreferences): Promise<boolean> {
    prefs.lastModified = new Date().toISOString();
    prefs.userId = this._userId;
    this._cache = prefs;
    this._cacheTimestamp = Date.now();

    if (this._isWorkbench) {
      return true;
    }

    return this._debouncedSave(prefs);
  }

  // ── Convenience mutators (load → mutate → save → return) ──

  public async addShortcut(title: string, url: string, icon: string, openInNewWindow: boolean): Promise<IUserPreferences> {
    const prefs = await this.getPreferences();
    const maxOrder = prefs.shortcuts.reduce((max, s) => Math.max(max, s.sortOrder), -1);
    prefs.shortcuts.push({
      id: 'sc-' + Date.now(),
      title,
      url,
      icon: icon || '\u2605',
      openInNewWindow,
      sortOrder: maxOrder + 1
    });
    await this.savePreferences(prefs);
    return prefs;
  }

  public async deleteShortcut(id: string): Promise<IUserPreferences> {
    const prefs = await this.getPreferences();
    prefs.shortcuts = prefs.shortcuts.filter(s => s.id !== id);
    await this.savePreferences(prefs);
    return prefs;
  }

  public async reorderShortcuts(orderedIds: string[]): Promise<IUserPreferences> {
    const prefs = await this.getPreferences();
    const map = new Map(prefs.shortcuts.map(s => [s.id, s]));
    const reordered: IUserShortcutPref[] = [];
    for (const id of orderedIds) {
      const s = map.get(id);
      if (s) {
        s.sortOrder = reordered.length;
        reordered.push(s);
        map.delete(id);
      }
    }
    // Append any remaining (shouldn't happen but be safe)
    map.forEach(s => { s.sortOrder = reordered.length; reordered.push(s); });
    prefs.shortcuts = reordered;
    await this.savePreferences(prefs);
    return prefs;
  }

  public async toggleNavItem(navId: number, visible: boolean): Promise<IUserPreferences> {
    const prefs = await this.getPreferences();
    const idx = prefs.hiddenNavItems.indexOf(navId);
    if (visible && idx !== -1) {
      prefs.hiddenNavItems.splice(idx, 1);
    } else if (!visible && idx === -1) {
      prefs.hiddenNavItems.push(navId);
    }
    await this.savePreferences(prefs);
    return prefs;
  }

  public async setNavOrder(orderedIds: number[]): Promise<IUserPreferences> {
    const prefs = await this.getPreferences();
    prefs.navOrder = orderedIds;
    await this.savePreferences(prefs);
    return prefs;
  }

  public async setDisplayPref(key: string, value: string | number | boolean): Promise<IUserPreferences> {
    const prefs = await this.getPreferences();
    if (key === 'showBadges' || key === 'theme' || key === 'fontSize') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (prefs.display as any)[key] = value;
    }
    await this.savePreferences(prefs);
    return prefs;
  }

  public async resetToDefaults(): Promise<IUserPreferences> {
    const prefs = this._createDefaults();
    await this.savePreferences(prefs);
    return prefs;
  }

  public clearCache(): void {
    this._cache = null;
    this._cacheTimestamp = 0;
  }

  // ── Migration helper ──────────────────────────────

  /**
   * One-time import of shortcuts from the old UserShortcutsService list.
   * Called by PiCanvasWebPart after detecting a fresh defaults file.
   */
  public async migrateFromShortcutsList(
    legacyShortcuts: Array<{ Title: string; ShortcutUrl: string; ShortcutIcon: string; SortOrder: number; OpenInNewWindow: boolean }>
  ): Promise<IUserPreferences> {
    const prefs = await this.getPreferences();
    if (prefs.shortcuts.length > 0) return prefs; // already has data

    prefs.shortcuts = legacyShortcuts.map((s, i) => ({
      id: 'sc-migrated-' + i + '-' + Date.now(),
      title: s.Title,
      url: s.ShortcutUrl,
      icon: s.ShortcutIcon || '\u2605',
      openInNewWindow: s.OpenInNewWindow,
      sortOrder: s.SortOrder
    }));
    await this.savePreferences(prefs);
    return prefs;
  }

  // ── Private helpers ─────────────────────────────────

  private _createDefaults(): IUserPreferences {
    return {
      schemaVersion: SCHEMA_VERSION,
      userId: this._userId,
      lastModified: new Date().toISOString(),
      shortcuts: [],
      hiddenNavItems: [],
      navOrder: [],
      display: {
        showBadges: true,
        theme: 'dark',
        fontSize: 13
      }
    };
  }

  /** Forward-compat: add missing fields if schema evolves. */
  private _migrate(prefs: IUserPreferences): IUserPreferences {
    if (!prefs.display) {
      prefs.display = { showBadges: true, theme: 'dark', fontSize: 13 };
    }
    if (!prefs.hiddenNavItems) prefs.hiddenNavItems = [];
    if (!prefs.navOrder) prefs.navOrder = [];
    if (!prefs.shortcuts) prefs.shortcuts = [];
    prefs.schemaVersion = SCHEMA_VERSION;
    return prefs;
  }

  /**
   * Debounced file write. Coalesces rapid saves into a single write.
   */
  private _debouncedSave(prefs: IUserPreferences): Promise<boolean> {
    this._pendingSave = prefs;

    if (this._saveTimer) {
      clearTimeout(this._saveTimer);
    }

    return new Promise<boolean>((resolve) => {
      this._saveTimer = setTimeout(async () => {
        this._saveTimer = null;
        const toSave = this._pendingSave;
        this._pendingSave = null;
        if (toSave) {
          const ok = await this._writeFile(toSave);
          resolve(ok);
        } else {
          resolve(true);
        }
      }, SAVE_DEBOUNCE_MS);
    });
  }

  private async _ensureFolder(): Promise<boolean> {
    try {
      const checkUrl = `${this._siteUrl}/_api/web/GetFolderByServerRelativeUrl('${encodeURIComponent(this._folderPath)}')`;
      const resp = await this.context.spHttpClient.get(
        checkUrl,
        SPHttpClient.configurations.v1,
        { headers: { 'Accept': 'application/json;odata=nometadata' } }
      );
      if (resp.ok) return true;

      // Create folder
      const createUrl = `${this._siteUrl}/_api/web/folders`;
      const createResp = await this.context.spHttpClient.post(
        createUrl,
        SPHttpClient.configurations.v1,
        {
          headers: {
            'Accept': 'application/json;odata=nometadata',
            'Content-Type': 'application/json;odata=nometadata'
          },
          body: JSON.stringify({ ServerRelativeUrl: this._folderPath })
        }
      );
      return createResp.ok;
    } catch (err) {
      console.warn('[PiCanvas] UserPreferences: ensureFolder failed:', err);
      return false;
    }
  }

  private async _writeFile(prefs: IUserPreferences): Promise<boolean> {
    try {
      await this._ensureFolder();

      const content = JSON.stringify(prefs, null, 2);
      const uploadUrl = `${this._siteUrl}/_api/web/GetFolderByServerRelativeUrl('${encodeURIComponent(this._folderPath)}')/Files/add(url='${encodeURIComponent(this._fileName)}',overwrite=true)`;

      const resp = await this.context.spHttpClient.post(
        uploadUrl,
        SPHttpClient.configurations.v1,
        {
          headers: { 'Accept': 'application/json;odata=nometadata' },
          body: content
        }
      );

      if (!resp.ok) {
        console.warn(`[PiCanvas] UserPreferences: save failed (${resp.status})`);
      }
      return resp.ok;
    } catch (err) {
      console.warn('[PiCanvas] UserPreferences: write failed:', err);
      return false;
    }
  }
}
