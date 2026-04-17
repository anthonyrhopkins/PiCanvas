/**
 * ListBindingService
 * Generic SharePoint list read/write bridge for PiCanvas File content type.
 * HTML pages bound to lists receive data via custom events (picanvas:lists-ready)
 * and trigger mutations via (picanvas:list-add | picanvas:list-update | picanvas:list-delete).
 *
 * Auth: uses spHttpClient (signed-in user context). SharePoint enforces list
 * permissions natively — Read = view only, Contribute = write.
 */

import { SPHttpClient, ISPHttpClientOptions } from '@microsoft/sp-http';
import { WebPartContext } from '@microsoft/sp-webpart-base';

export interface IListBinding {
  /** Friendly key the HTML uses to refer to the list (e.g. "signoffs") */
  key: string;
  /** List title (human-readable name in SharePoint) */
  listTitle: string;
}

export interface IListItem {
  /** SharePoint list item ID */
  id: number;
  /** All selected list item fields */
  fields: Record<string, unknown>;
}

export interface IListPickerOption {
  id: string;
  title: string;
}

export class ListBindingService {
  constructor(private context: WebPartContext) {}

  private get _siteUrl(): string {
    return this.context.pageContext.web.absoluteUrl;
  }

  /**
   * Fetch all lists on the current site (for config-panel list picker).
   * Excludes hidden / catalog / system lists.
   */
  public async getSiteLists(): Promise<IListPickerOption[]> {
    try {
      const apiUrl = `${this._siteUrl}/_api/web/lists?$select=Id,Title,Hidden,IsCatalog,BaseTemplate` +
        `&$filter=Hidden eq false and IsCatalog eq false and BaseTemplate eq 100&$top=500`;

      const resp = await this.context.spHttpClient.get(apiUrl, SPHttpClient.configurations.v1);
      if (!resp.ok) {
        console.warn(`[PiCanvas] ListBindingService: getSiteLists returned ${resp.status}`);
        return [];
      }
      const data = await resp.json();
      return (data.value || []).map((l: Record<string, unknown>) => ({
        id: String(l.Id),
        title: String(l.Title)
      })).sort((a: IListPickerOption, b: IListPickerOption) => a.title.localeCompare(b.title));
    } catch (err) {
      console.warn('[PiCanvas] ListBindingService: getSiteLists failed:', err);
      return [];
    }
  }

  /**
   * Fetch all items from a list.
   * Returns normalized { id, fields } shape — `fields` contains all non-system columns.
   */
  public async getItems(listTitle: string): Promise<IListItem[]> {
    try {
      const apiUrl = `${this._siteUrl}/_api/web/lists/getbytitle('${encodeURIComponent(listTitle)}')/items?$top=5000`;
      const resp = await this.context.spHttpClient.get(apiUrl, SPHttpClient.configurations.v1);
      if (!resp.ok) {
        console.warn(`[PiCanvas] ListBindingService: getItems(${listTitle}) returned ${resp.status}`);
        return [];
      }
      const data = await resp.json();
      return (data.value || []).map((item: Record<string, unknown>) => ({
        id: item.Id as number,
        fields: this._stripSystemFields(item)
      }));
    } catch (err) {
      console.warn(`[PiCanvas] ListBindingService: getItems(${listTitle}) failed:`, err);
      return [];
    }
  }

  /**
   * Create a new list item. Returns the created item (with server-assigned ID).
   * Auto-appends the signed-in user's email to `_SignedInUserEmail` if not set —
   * cheaper than adding a person column lookup, and auditable.
   */
  public async addItem(listTitle: string, fields: Record<string, unknown>): Promise<IListItem | null> {
    try {
      const apiUrl = `${this._siteUrl}/_api/web/lists/getbytitle('${encodeURIComponent(listTitle)}')/items`;
      const opts: ISPHttpClientOptions = {
        headers: {
          'Accept': 'application/json;odata=nometadata',
          'Content-Type': 'application/json;odata=nometadata',
          'odata-version': ''
        },
        body: JSON.stringify(fields)
      };
      const resp = await this.context.spHttpClient.post(apiUrl, SPHttpClient.configurations.v1, opts);
      if (!resp.ok) {
        const errText = await resp.text();
        console.warn(`[PiCanvas] ListBindingService: addItem(${listTitle}) returned ${resp.status}: ${errText}`);
        return null;
      }
      const item = await resp.json();
      return { id: item.Id as number, fields: this._stripSystemFields(item) };
    } catch (err) {
      console.warn(`[PiCanvas] ListBindingService: addItem(${listTitle}) failed:`, err);
      return null;
    }
  }

  /**
   * Update an existing list item (PATCH / MERGE).
   */
  public async updateItem(listTitle: string, itemId: number, fields: Record<string, unknown>): Promise<boolean> {
    try {
      const apiUrl = `${this._siteUrl}/_api/web/lists/getbytitle('${encodeURIComponent(listTitle)}')/items(${itemId})`;
      const opts: ISPHttpClientOptions = {
        headers: {
          'Accept': 'application/json;odata=nometadata',
          'Content-Type': 'application/json;odata=nometadata',
          'odata-version': '',
          'IF-MATCH': '*',
          'X-HTTP-Method': 'MERGE'
        },
        body: JSON.stringify(fields)
      };
      const resp = await this.context.spHttpClient.post(apiUrl, SPHttpClient.configurations.v1, opts);
      if (!resp.ok) {
        const errText = await resp.text();
        console.warn(`[PiCanvas] ListBindingService: updateItem(${listTitle}, ${itemId}) returned ${resp.status}: ${errText}`);
        return false;
      }
      return true;
    } catch (err) {
      console.warn(`[PiCanvas] ListBindingService: updateItem(${listTitle}, ${itemId}) failed:`, err);
      return false;
    }
  }

  /**
   * Delete a list item.
   */
  public async deleteItem(listTitle: string, itemId: number): Promise<boolean> {
    try {
      const apiUrl = `${this._siteUrl}/_api/web/lists/getbytitle('${encodeURIComponent(listTitle)}')/items(${itemId})`;
      const opts: ISPHttpClientOptions = {
        headers: {
          'Accept': 'application/json;odata=nometadata',
          'IF-MATCH': '*',
          'X-HTTP-Method': 'DELETE'
        }
      };
      const resp = await this.context.spHttpClient.post(apiUrl, SPHttpClient.configurations.v1, opts);
      if (!resp.ok) {
        console.warn(`[PiCanvas] ListBindingService: deleteItem(${listTitle}, ${itemId}) returned ${resp.status}`);
        return false;
      }
      return true;
    } catch (err) {
      console.warn(`[PiCanvas] ListBindingService: deleteItem(${listTitle}, ${itemId}) failed:`, err);
      return false;
    }
  }

  /**
   * Remove SharePoint system/metadata fields that aren't useful to HTML consumers.
   */
  private _stripSystemFields(item: Record<string, unknown>): Record<string, unknown> {
    const SYSTEM_FIELDS = new Set([
      'odata.etag', 'odata.id', 'odata.type', 'odata.editLink',
      'FileSystemObjectType', 'ServerRedirectedEmbedUri', 'ServerRedirectedEmbedUrl',
      'ContentTypeId', 'ComplianceAssetId', 'GUID', 'OData__UIVersionString',
      'Attachments', 'AuthorId', 'EditorId'
    ]);
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(item)) {
      if (SYSTEM_FIELDS.has(k)) continue;
      if (k.startsWith('odata.')) continue;
      out[k] = v;
    }
    return out;
  }
}
