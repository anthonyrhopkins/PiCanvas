/**
 * NavigationService
 * Fetches SharePoint site navigation (Quick Launch, Top Nav, Hub Nav)
 * via REST API. Uses MenuState API for audience-targeting support
 * (nodes are pre-filtered server-side for the current user).
 */

import { SPHttpClient } from '@microsoft/sp-http';
import { WebPartContext } from '@microsoft/sp-webpart-base';

export interface INavNode {
  Id: number;
  Title: string;
  Url: string;
  IsExternal: boolean;
  Children: INavNode[];
  OpenInNewWindow?: boolean;
}

export type NavSource = 'quicklaunch' | 'topnav' | 'hub';

interface ICacheEntry {
  data: INavNode[];
  timestamp: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export class NavigationService {
  private _cache: Map<string, ICacheEntry> = new Map();
  private _isWorkbench: boolean;

  constructor(private context: WebPartContext) {
    const url = window.location.href.toLowerCase();
    this._isWorkbench = url.indexOf('/_layouts/15/workbench') > -1 ||
      url.indexOf('/temp/workbench.html') > -1;
  }

  /**
   * Fetch navigation nodes for the given source.
   * Returns cached data if available and fresh.
   */
  public async getNavigation(source: NavSource): Promise<INavNode[]> {
    if (this._isWorkbench) {
      return this._getMockNavigation();
    }

    const cacheKey = `${source}:${this.context.pageContext.web.absoluteUrl}`;
    const cached = this._cache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL_MS) {
      return cached.data;
    }

    let nodes: INavNode[];
    try {
      switch (source) {
        case 'quicklaunch':
          nodes = await this._fetchMenuState('CurrentNavigationSwitchableProvider');
          break;
        case 'topnav':
          nodes = await this._fetchMenuState('GlobalNavigationSwitchableProvider');
          break;
        case 'hub':
          nodes = await this._fetchHubNavigation();
          break;
        default:
          nodes = [];
      }
    } catch (error) {
      console.warn(`[PiCanvas] NavigationService: Failed to fetch ${source} navigation:`, error);
      // Fallback to simple API if MenuState fails
      try {
        nodes = source === 'quicklaunch'
          ? await this._fetchSimpleNav('quicklaunch')
          : source === 'topnav'
            ? await this._fetchSimpleNav('topnavigationbar')
            : [];
      } catch {
        console.warn(`[PiCanvas] NavigationService: Fallback also failed for ${source}`);
        nodes = [];
      }
    }

    this._cache.set(cacheKey, { data: nodes, timestamp: Date.now() });
    return nodes;
  }

  /**
   * MenuState API — returns navigation pre-filtered by audience targeting.
   */
  private async _fetchMenuState(provider: string): Promise<INavNode[]> {
    const siteUrl = this.context.pageContext.web.absoluteUrl;
    const url = `${siteUrl}/_api/navigation/MenuState?mapProviderName='${provider}'`;

    const response = await this.context.spHttpClient.get(
      url,
      SPHttpClient.configurations.v1,
      { headers: { 'Accept': 'application/json;odata.metadata=minimal' } }
    );

    if (!response.ok) {
      throw new Error(`MenuState API returned ${response.status}`);
    }

    const data = await response.json();
    return this._parseMenuState(data);
  }

  /**
   * Parse MenuState response into INavNode tree.
   * MenuState returns { MenuState: { Nodes: [{ Title, SimpleUrl, Nodes, ... }] } }
   */
  private _parseMenuState(data: any): INavNode[] {
    const menuState = data?.MenuState || data;
    const rawNodes = menuState?.Nodes || [];
    return this._convertMenuStateNodes(rawNodes);
  }

  private _convertMenuStateNodes(nodes: any[]): INavNode[] {
    if (!Array.isArray(nodes)) return [];

    return nodes
      .filter((n: any) => !n.IsHidden)
      .map((n: any, idx: number) => ({
        Id: n.Key ? parseInt(n.Key, 10) : idx,
        Title: n.Title || '',
        Url: n.SimpleUrl || n.FriendlyUrlSegment || '#',
        IsExternal: (n.SimpleUrl || '').indexOf('://') > -1 &&
          (n.SimpleUrl || '').indexOf(window.location.hostname) === -1,
        OpenInNewWindow: n.OpenInNewWindow === true,
        Children: this._convertMenuStateNodes(n.Nodes || [])
      }));
  }

  /**
   * Simple fallback — _api/web/navigation/quicklaunch or topnavigationbar.
   * Does NOT resolve audience targeting.
   */
  private async _fetchSimpleNav(endpoint: string): Promise<INavNode[]> {
    const siteUrl = this.context.pageContext.web.absoluteUrl;
    const url = `${siteUrl}/_api/web/navigation/${endpoint}?$select=Id,Title,Url,IsExternal,Children&$expand=Children`;

    const response = await this.context.spHttpClient.get(
      url,
      SPHttpClient.configurations.v1,
      { headers: { 'Accept': 'application/json;odata.metadata=minimal' } }
    );

    if (!response.ok) {
      throw new Error(`Navigation API returned ${response.status}`);
    }

    const data = await response.json();
    return this._convertSimpleNodes(data.value || []);
  }

  private _convertSimpleNodes(nodes: any[]): INavNode[] {
    if (!Array.isArray(nodes)) return [];

    return nodes.map((n: any) => ({
      Id: n.Id || 0,
      Title: n.Title || '',
      Url: n.Url || '#',
      IsExternal: n.IsExternal === true,
      OpenInNewWindow: false,
      Children: this._convertSimpleNodes(n.Children?.results || n.Children || [])
    }));
  }

  /**
   * Hub site navigation — fetches cross-site nav from the hub.
   */
  private async _fetchHubNavigation(): Promise<INavNode[]> {
    const legacyCtx = this.context.pageContext.legacyPageContext;
    const hubSiteId = legacyCtx?.hubSiteId;
    if (!hubSiteId || hubSiteId === '00000000-0000-0000-0000-000000000000') {
      console.log('[PiCanvas] NavigationService: No hub site associated');
      return [];
    }

    const siteUrl = this.context.pageContext.web.absoluteUrl;
    const url = `${siteUrl}/_api/navigation/MenuState?mapProviderName='GlobalNavigationSwitchableProvider'`;

    const response = await this.context.spHttpClient.get(
      url,
      SPHttpClient.configurations.v1,
      { headers: { 'Accept': 'application/json;odata.metadata=minimal' } }
    );

    if (!response.ok) {
      throw new Error(`Hub Navigation API returned ${response.status}`);
    }

    const data = await response.json();
    return this._parseMenuState(data);
  }

  /**
   * Mock navigation for workbench testing.
   */
  private _getMockNavigation(): INavNode[] {
    return [
      {
        Id: 1, Title: 'Home', Url: '#', IsExternal: false, Children: []
      },
      {
        Id: 2, Title: 'Documents', Url: '#documents', IsExternal: false, Children: [
          { Id: 21, Title: 'Shared Documents', Url: '#shared', IsExternal: false, Children: [] },
          { Id: 22, Title: 'Templates', Url: '#templates', IsExternal: false, Children: [] },
          { Id: 23, Title: 'Archive', Url: '#archive', IsExternal: false, Children: [] }
        ]
      },
      {
        Id: 3, Title: 'Projects', Url: '#projects', IsExternal: false, Children: [
          { Id: 31, Title: 'Active Projects', Url: '#active', IsExternal: false, Children: [] },
          { Id: 32, Title: 'Completed', Url: '#completed', IsExternal: false, Children: [] }
        ]
      },
      {
        Id: 4, Title: 'Team', Url: '#team', IsExternal: false, Children: []
      },
      {
        Id: 5, Title: 'Reports', Url: '#reports', IsExternal: false, Children: [
          { Id: 51, Title: 'Monthly Report', Url: '#monthly', IsExternal: false, Children: [] },
          { Id: 52, Title: 'Analytics', Url: '#analytics', IsExternal: false, Children: [] }
        ]
      },
      {
        Id: 6, Title: 'External Link', Url: 'https://example.com', IsExternal: true, OpenInNewWindow: true, Children: []
      }
    ];
  }

  /**
   * Clear the navigation cache (e.g., after property change).
   */
  public clearCache(): void {
    this._cache.clear();
  }
}
