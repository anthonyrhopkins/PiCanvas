/**
 * UserShortcutsService
 * Per-user custom navigation shortcuts stored in a hidden SharePoint list
 * with item-level permissions (ReadSecurity/WriteSecurity = 2).
 * Each user can only see and edit their own shortcuts.
 */

import { SPHttpClient } from '@microsoft/sp-http';
import { WebPartContext } from '@microsoft/sp-webpart-base';

export interface IUserShortcut {
  Id: number;
  Title: string;
  ShortcutUrl: string;
  ShortcutIcon: string;
  SortOrder: number;
  OpenInNewWindow: boolean;
}

const LIST_TITLE = 'PiCanvasUserShortcuts';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export class UserShortcutsService {
  private _cache: IUserShortcut[] | null = null;
  private _cacheTimestamp: number = 0;
  private _listEnsured: boolean = false;
  private _listEntityType: string = '';
  private _isWorkbench: boolean;

  constructor(private context: WebPartContext) {
    const url = window.location.href.toLowerCase();
    this._isWorkbench = url.indexOf('/_layouts/15/workbench') > -1 ||
      url.indexOf('/temp/workbench.html') > -1;
  }

  private get _siteUrl(): string {
    return this.context.pageContext.web.absoluteUrl;
  }

  private get _listUrl(): string {
    return `${this._siteUrl}/_api/web/lists/getbytitle('${LIST_TITLE}')`;
  }

  /**
   * Ensure the list exists and has correct item-level permissions.
   * Creates it if missing. Returns false if creation fails (no permission).
   */
  public async ensureList(): Promise<boolean> {
    if (this._listEnsured) return true;
    if (this._isWorkbench) {
      this._listEnsured = true;
      return true;
    }

    try {
      // Check if list exists
      const resp = await this.context.spHttpClient.get(
        `${this._listUrl}?$select=ListItemEntityTypeFullName`,
        SPHttpClient.configurations.v1
      );

      if (resp.ok) {
        const data = await resp.json();
        this._listEntityType = data.ListItemEntityTypeFullName || '';
        this._listEnsured = true;
        return true;
      }

      if (resp.status !== 404) {
        console.warn(`[PiCanvas] UserShortcutsService: List check returned ${resp.status}`);
        return false;
      }

      // List doesn't exist — create it
      return await this._createList();
    } catch (err) {
      console.warn('[PiCanvas] UserShortcutsService: ensureList failed:', err);
      return false;
    }
  }

  private async _createList(): Promise<boolean> {
    try {
      // Create hidden list with item-level permissions
      const createResp = await this.context.spHttpClient.post(
        `${this._siteUrl}/_api/web/lists`,
        SPHttpClient.configurations.v1,
        {
          body: JSON.stringify({
            Title: LIST_TITLE,
            BaseTemplate: 100,
            Description: 'Per-user navigation shortcuts for PiCanvas',
            Hidden: true,
            ReadSecurity: 2,
            WriteSecurity: 2
          })
        }
      );

      if (!createResp.ok) {
        console.warn(`[PiCanvas] UserShortcutsService: List creation returned ${createResp.status}`);
        return false;
      }

      const listData = await createResp.json();
      this._listEntityType = listData.ListItemEntityTypeFullName || '';

      // Add custom fields
      await this._addField('ShortcutUrl', 2, true);   // Text, required
      await this._addField('ShortcutIcon', 2, false);  // Text, optional
      await this._addField('SortOrder', 9, false);     // Number
      await this._addFieldBoolean('OpenInNewWindow');   // Boolean

      this._listEnsured = true;
      console.log('[PiCanvas] UserShortcutsService: List created successfully');
      return true;
    } catch (err) {
      console.warn('[PiCanvas] UserShortcutsService: List creation failed:', err);
      return false;
    }
  }

  private async _addField(name: string, fieldTypeKind: number, required: boolean): Promise<void> {
    await this.context.spHttpClient.post(
      `${this._listUrl}/fields`,
      SPHttpClient.configurations.v1,
      {
        body: JSON.stringify({
          Title: name,
          FieldTypeKind: fieldTypeKind,
          Required: required
        })
      }
    );
  }

  private async _addFieldBoolean(name: string): Promise<void> {
    await this.context.spHttpClient.post(
      `${this._listUrl}/fields`,
      SPHttpClient.configurations.v1,
      {
        body: JSON.stringify({
          Title: name,
          FieldTypeKind: 8,
          DefaultValue: '1'
        })
      }
    );
  }

  /**
   * Fetch shortcuts for the current user (item-level permissions filter automatically).
   */
  public async getShortcuts(): Promise<IUserShortcut[]> {
    if (this._isWorkbench) {
      return this._getMockShortcuts();
    }

    const ok = await this.ensureList();
    if (!ok) return [];

    // Check cache
    if (this._cache && (Date.now() - this._cacheTimestamp) < CACHE_TTL_MS) {
      return this._cache;
    }

    try {
      const resp = await this.context.spHttpClient.get(
        `${this._listUrl}/items?$select=Id,Title,ShortcutUrl,ShortcutIcon,SortOrder,OpenInNewWindow&$top=50`,
        SPHttpClient.configurations.v1
      );

      if (!resp.ok) {
        console.warn(`[PiCanvas] UserShortcutsService: getShortcuts returned ${resp.status}`);
        return this._cache || [];
      }

      const data = await resp.json();
      const rawItems = data.value || [];
      const items: IUserShortcut[] = rawItems.map((item: any) => ({
        Id: item.Id,
        Title: item.Title || '',
        ShortcutUrl: item.ShortcutUrl || '',
        ShortcutIcon: item.ShortcutIcon || '',
        SortOrder: item.SortOrder || 0,
        OpenInNewWindow: item.OpenInNewWindow !== false
      }));

      this._cache = items;
      this._cacheTimestamp = Date.now();
      return items;
    } catch (err) {
      console.warn('[PiCanvas] UserShortcutsService: getShortcuts failed:', err);
      return this._cache || [];
    }
  }

  /**
   * Add a new shortcut for the current user.
   */
  public async addShortcut(
    title: string,
    url: string,
    icon?: string,
    openInNewWindow?: boolean
  ): Promise<IUserShortcut | null> {
    if (this._isWorkbench) {
      const mock: IUserShortcut = {
        Id: Date.now(),
        Title: title,
        ShortcutUrl: url,
        ShortcutIcon: icon || '\u2605',
        SortOrder: (this._cache?.length || 0),
        OpenInNewWindow: openInNewWindow !== false
      };
      this._cache = [...(this._cache || []), mock];
      this._cacheTimestamp = Date.now();
      return mock;
    }

    const ok = await this.ensureList();
    if (!ok) return null;

    // Determine next sort order
    const existing = await this.getShortcuts();
    const maxOrder = existing.reduce((m, s) => Math.max(m, s.SortOrder), -1);

    try {
      const body: Record<string, any> = {
        Title: title,
        ShortcutUrl: url,
        ShortcutIcon: icon || '\u2605',
        SortOrder: maxOrder + 1,
        OpenInNewWindow: openInNewWindow !== false
      };

      const resp = await this.context.spHttpClient.post(
        `${this._listUrl}/items`,
        SPHttpClient.configurations.v1,
        {
          body: JSON.stringify(body)
        }
      );

      if (!resp.ok) {
        console.warn(`[PiCanvas] UserShortcutsService: addShortcut returned ${resp.status}`);
        return null;
      }

      this.clearCache();
      const item = await resp.json();
      return {
        Id: item.Id,
        Title: item.Title || title,
        ShortcutUrl: item.ShortcutUrl || url,
        ShortcutIcon: item.ShortcutIcon || icon || '\u2605',
        SortOrder: item.SortOrder || maxOrder + 1,
        OpenInNewWindow: item.OpenInNewWindow !== false
      };
    } catch (err) {
      console.warn('[PiCanvas] UserShortcutsService: addShortcut failed:', err);
      return null;
    }
  }

  /**
   * Update an existing shortcut.
   */
  public async updateShortcut(id: number, updates: Partial<IUserShortcut>): Promise<boolean> {
    if (this._isWorkbench) {
      if (this._cache) {
        this._cache = this._cache.map(s => s.Id === id ? { ...s, ...updates } : s);
        this._cacheTimestamp = Date.now();
      }
      return true;
    }

    try {
      const body: Record<string, any> = {};
      if (updates.Title !== undefined) body.Title = updates.Title;
      if (updates.ShortcutUrl !== undefined) body.ShortcutUrl = updates.ShortcutUrl;
      if (updates.ShortcutIcon !== undefined) body.ShortcutIcon = updates.ShortcutIcon;
      if (updates.SortOrder !== undefined) body.SortOrder = updates.SortOrder;
      if (updates.OpenInNewWindow !== undefined) body.OpenInNewWindow = updates.OpenInNewWindow;

      const resp = await this.context.spHttpClient.post(
        `${this._listUrl}/items(${id})`,
        SPHttpClient.configurations.v1,
        {
          headers: {
            'X-HTTP-Method': 'MERGE',
            'If-Match': '*'
          },
          body: JSON.stringify(body)
        }
      );

      if (!resp.ok) {
        console.warn(`[PiCanvas] UserShortcutsService: updateShortcut returned ${resp.status}`);
        return false;
      }

      this.clearCache();
      return true;
    } catch (err) {
      console.warn('[PiCanvas] UserShortcutsService: updateShortcut failed:', err);
      return false;
    }
  }

  /**
   * Delete a shortcut.
   */
  public async deleteShortcut(id: number): Promise<boolean> {
    if (this._isWorkbench) {
      if (this._cache) {
        this._cache = this._cache.filter(s => s.Id !== id);
        this._cacheTimestamp = Date.now();
      }
      return true;
    }

    try {
      const resp = await this.context.spHttpClient.post(
        `${this._listUrl}/items(${id})`,
        SPHttpClient.configurations.v1,
        {
          headers: {
            'X-HTTP-Method': 'DELETE',
            'If-Match': '*'
          },
          body: ''
        }
      );

      if (!resp.ok) {
        console.warn(`[PiCanvas] UserShortcutsService: deleteShortcut returned ${resp.status}`);
        return false;
      }

      this.clearCache();
      return true;
    } catch (err) {
      console.warn('[PiCanvas] UserShortcutsService: deleteShortcut failed:', err);
      return false;
    }
  }

  /**
   * Reorder shortcuts by updating SortOrder for each item.
   */
  public async reorderShortcuts(orderedIds: number[]): Promise<boolean> {
    if (this._isWorkbench) {
      if (this._cache) {
        const reordered: IUserShortcut[] = [];
        for (let i = 0; i < orderedIds.length; i++) {
          const sc = this._cache.find(s => s.Id === orderedIds[i]);
          if (sc) reordered.push({ ...sc, SortOrder: i });
        }
        this._cache = reordered;
        this._cacheTimestamp = Date.now();
      }
      return true;
    }

    try {
      for (let i = 0; i < orderedIds.length; i++) {
        await this.context.spHttpClient.post(
          `${this._listUrl}/items(${orderedIds[i]})`,
          SPHttpClient.configurations.v1,
          {
            headers: {
              'X-HTTP-Method': 'MERGE',
              'If-Match': '*'
            },
            body: JSON.stringify({ SortOrder: i })
          }
        );
      }

      this.clearCache();
      return true;
    } catch (err) {
      console.warn('[PiCanvas] UserShortcutsService: reorderShortcuts failed:', err);
      return false;
    }
  }

  /**
   * Clear cached shortcuts (e.g., after CRUD operation).
   */
  public clearCache(): void {
    this._cache = null;
    this._cacheTimestamp = 0;
  }

  /**
   * Mock shortcuts for workbench testing.
   */
  private _getMockShortcuts(): IUserShortcut[] {
    if (this._cache) return this._cache;

    this._cache = [
      { Id: 1001, Title: 'Finance Hub', ShortcutUrl: '#finance', ShortcutIcon: '\uD83D\uDCCA', SortOrder: 0, OpenInNewWindow: false },
      { Id: 1002, Title: 'Monthly Reports', ShortcutUrl: '#reports', ShortcutIcon: '\uD83D\uDCC8', SortOrder: 1, OpenInNewWindow: false },
      { Id: 1003, Title: 'Team Wiki', ShortcutUrl: 'https://example.com/wiki', ShortcutIcon: '\uD83D\uDD17', SortOrder: 2, OpenInNewWindow: true }
    ];
    this._cacheTimestamp = Date.now();
    return this._cache;
  }
}
