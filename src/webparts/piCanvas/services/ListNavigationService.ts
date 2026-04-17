/**
 * ListNavigationService
 * Fetches navigation from the PiCanvasNavigation SharePoint list,
 * builds a tree using ParentId0, and returns INavNode[].
 * Supports IsNew badges, Icon, Audience filtering, and IsEnabled gating.
 */

import { SPHttpClient } from '@microsoft/sp-http';
import { WebPartContext } from '@microsoft/sp-webpart-base';
import { INavNode } from './NavigationService';

export interface IListNavItem {
  Id: number;
  Title: string;
  NavUrl: string;
  ParentId0: number | null;
  SortOrder: number;
  IsNew: boolean;
  Icon: string;
  IconOnly: boolean;
  OpenInNewWindow: boolean;
  Audience: string;
  IsEnabled: boolean;
}

export interface IListNavNode extends INavNode {
  IsNew?: boolean;
  Icon?: string;
  IconOnly?: boolean;
  Audience?: string;
  Children: IListNavNode[];
}

const LIST_TITLE = 'PiCanvasNavigation';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const SELECT_FIELDS = 'Id,Title,NavUrl,ParentId0,SortOrder,IsNew,Icon,IconOnly,OpenInNewWindow,Audience,IsEnabled';

export class ListNavigationService {
  private _cache: IListNavNode[] | null = null;
  private _cacheTimestamp: number = 0;
  private _isWorkbench: boolean;

  constructor(private context: WebPartContext) {
    const url = window.location.href.toLowerCase();
    this._isWorkbench = url.indexOf('/_layouts/15/workbench') > -1 ||
      url.indexOf('/temp/workbench.html') > -1;
  }

  private get _siteUrl(): string {
    return this.context.pageContext.web.absoluteUrl;
  }

  /**
   * Fetch navigation tree from PiCanvasNavigation list.
   * Returns top-level nodes with Children populated recursively.
   */
  public async getNavigation(): Promise<IListNavNode[]> {
    if (this._isWorkbench) {
      return this._getMockNavigation();
    }

    // Check cache
    if (this._cache && (Date.now() - this._cacheTimestamp) < CACHE_TTL_MS) {
      return this._cache;
    }

    try {
      const apiUrl = `${this._siteUrl}/_api/web/lists/getbytitle('${LIST_TITLE}')/items` +
        `?$select=${SELECT_FIELDS}&$orderby=SortOrder,Id&$top=500`;

      const resp = await this.context.spHttpClient.get(
        apiUrl,
        SPHttpClient.configurations.v1
      );

      if (!resp.ok) {
        console.warn(`[PiCanvas] ListNavigationService: fetch returned ${resp.status}`);
        return this._cache || [];
      }

      const data = await resp.json();
      const rawItems: IListNavItem[] = (data.value || []).map((item: Record<string, unknown>) => ({
        Id: item.Id as number,
        Title: (item.Title as string) || '',
        NavUrl: (item.NavUrl as string) || '#',
        ParentId0: (item.ParentId0 as number | null) || null,
        SortOrder: (item.SortOrder as number) || 0,
        IsNew: item.IsNew === true,
        Icon: (item.Icon as string) || '',
        IconOnly: item.IconOnly === true,
        OpenInNewWindow: item.OpenInNewWindow !== false,
        Audience: (item.Audience as string) || '',
        IsEnabled: item.IsEnabled !== false
      }));

      // Filter out disabled items
      const enabledItems = rawItems.filter(item => item.IsEnabled);

      // Build tree
      const tree = this._buildTree(enabledItems);

      this._cache = tree;
      this._cacheTimestamp = Date.now();
      return tree;
    } catch (err) {
      console.warn('[PiCanvas] ListNavigationService: fetch failed:', err);
      return this._cache || [];
    }
  }

  /**
   * Build tree from flat list using ParentId0 references.
   */
  private _buildTree(items: IListNavItem[]): IListNavNode[] {
    // Create a map of id -> node
    const nodeMap = new Map<number, IListNavNode>();
    const roots: IListNavNode[] = [];

    // First pass: create all nodes
    for (const item of items) {
      const node: IListNavNode = {
        Id: item.Id,
        Title: item.Title,
        Url: item.NavUrl,
        IsExternal: this._isExternal(item.NavUrl),
        Children: [],
        OpenInNewWindow: item.OpenInNewWindow,
        IsNew: item.IsNew,
        Icon: item.Icon,
        IconOnly: item.IconOnly,
        Audience: item.Audience
      };
      nodeMap.set(item.Id, node);
    }

    // Second pass: build parent-child relationships
    for (const item of items) {
      const node = nodeMap.get(item.Id);
      if (!node) continue;

      if (item.ParentId0 && nodeMap.has(item.ParentId0)) {
        nodeMap.get(item.ParentId0)!.Children.push(node);
      } else {
        roots.push(node);
      }
    }

    return roots;
  }

  private _isExternal(url: string): boolean {
    if (!url || url === '#' || url.startsWith('#')) return false;
    try {
      const parsed = new URL(url, window.location.origin);
      return parsed.hostname !== window.location.hostname;
    } catch {
      return false;
    }
  }

  public clearCache(): void {
    this._cache = null;
    this._cacheTimestamp = 0;
  }

  private _getMockNavigation(): IListNavNode[] {
    return [
      {
        Id: 1, Title: 'Strategic Initiatives', Url: '#', IsExternal: false,
        Children: [
          { Id: 2, Title: 'Business AI', Url: '#', IsExternal: false, IsNew: true, Children: [
            { Id: 3, Title: 'AI Agents', Url: '#', IsExternal: false, Children: [] }
          ]},
          { Id: 4, Title: 'RISE with SAP', Url: '#', IsExternal: false, Children: [] }
        ]
      },
      {
        Id: 10, Title: 'Resources / Tools', Url: '#', IsExternal: false,
        Children: [
          { Id: 11, Title: 'LeanIX', Url: '#', IsExternal: false, Children: [] },
          { Id: 12, Title: 'Totango', Url: '#', IsExternal: false, Children: [] }
        ]
      },
      {
        Id: 20, Title: 'Learning Paths', Url: '#', IsExternal: false,
        Children: [
          { Id: 21, Title: 'Cohort Training', Url: '#', IsExternal: false, IsNew: true, Children: [
            { Id: 22, Title: 'Module 1', Url: '#', IsExternal: false, Children: [] }
          ]}
        ]
      }
    ];
  }
}
