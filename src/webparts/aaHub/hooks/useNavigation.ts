import * as React from 'react';
import { SPHttpClient } from '@microsoft/sp-http';
import { useServices } from '../contexts/ServiceContext';

// Re-export the interfaces from ListNavigationService for convenience.
// We duplicate the interface here to avoid a cross-webpart import path
// that could break if the piCanvas webpart is refactored.

export interface INavNode {
  Id: number;
  Title: string;
  Url: string;
  IsExternal: boolean;
  OpenInNewWindow?: boolean;
  IsNew?: boolean;
  Icon?: string;
  IconOnly?: boolean;
  Audience?: string;
  Children: INavNode[];
}

interface IListNavItem {
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

const LIST_TITLE = 'PiCanvasNavigation';
const CACHE_TTL_MS = 5 * 60 * 1000;
const SELECT_FIELDS = 'Id,Title,NavUrl,ParentId0,SortOrder,IsNew,Icon,IconOnly,OpenInNewWindow,Audience,IsEnabled';

/**
 * React hook that fetches the PiCanvasNavigation SharePoint list
 * and builds a tree of INavNode[].
 * Mirrors the logic from ListNavigationService but in a React-friendly way.
 */
export function useNavigation(): {
  nodes: INavNode[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
} {
  const { spHttpClient, siteUrl, isWorkbench } = useServices();
  const [nodes, setNodes] = React.useState<INavNode[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const cacheRef = React.useRef<{ data: INavNode[]; timestamp: number } | null>(null);

  const fetchNav = React.useCallback(async (force?: boolean) => {
    // Workbench: return mock data
    if (isWorkbench) {
      setNodes(getMockNavigation());
      setLoading(false);
      return;
    }

    // Check cache
    if (!force && cacheRef.current && (Date.now() - cacheRef.current.timestamp) < CACHE_TTL_MS) {
      setNodes(cacheRef.current.data);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const apiUrl = `${siteUrl}/_api/web/lists/getbytitle('${LIST_TITLE}')/items` +
        `?$select=${SELECT_FIELDS}&$orderby=SortOrder,Id&$top=500`;

      const resp = await spHttpClient.get(apiUrl, SPHttpClient.configurations.v1);

      if (!resp.ok) {
        throw new Error(`Fetch returned ${resp.status}`);
      }

      const data = await resp.json();
      const rawItems: IListNavItem[] = (data.value || []).map((item: Record<string, unknown>) => ({
        Id: item.Id as number,
        Title: (item.Title as string) || '',
        NavUrl: parseNavUrl(item.NavUrl),
        ParentId0: (item.ParentId0 as number | null) || null,
        SortOrder: (item.SortOrder as number) || 0,
        IsNew: item.IsNew === true,
        Icon: (item.Icon as string) || '',
        IconOnly: item.IconOnly === true,
        OpenInNewWindow: item.OpenInNewWindow !== false,
        Audience: (item.Audience as string) || '',
        IsEnabled: item.IsEnabled !== false,
      }));

      const enabledItems = rawItems.filter(i => i.IsEnabled);
      const tree = buildTree(enabledItems);

      cacheRef.current = { data: tree, timestamp: Date.now() };
      setNodes(tree);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[AAHub] useNavigation: fetch failed:', msg);
      setError(msg);
      // Fall back to cached data if available
      if (cacheRef.current) {
        setNodes(cacheRef.current.data);
      }
    } finally {
      setLoading(false);
    }
  }, [spHttpClient, siteUrl, isWorkbench]);

  React.useEffect(() => {
    fetchNav();
  }, [fetchNav]);

  const refresh = React.useCallback(() => {
    fetchNav(true);
  }, [fetchNav]);

  return { nodes, loading, error, refresh };
}

// ── URL field parser (handles both string and {Url, Description} object) ──

function parseNavUrl(value: unknown): string {
  if (typeof value === 'string') return value || '#';
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (typeof obj.Url === 'string') return obj.Url || '#';
  }
  return '#';
}

// ── Tree builder ──

function buildTree(items: IListNavItem[]): INavNode[] {
  const nodeMap = new Map<number, INavNode>();
  const roots: INavNode[] = [];

  for (const item of items) {
    nodeMap.set(item.Id, {
      Id: item.Id,
      Title: item.Title,
      Url: item.NavUrl,
      IsExternal: isExternal(item.NavUrl),
      OpenInNewWindow: item.OpenInNewWindow,
      IsNew: item.IsNew,
      Icon: item.Icon,
      IconOnly: item.IconOnly,
      Audience: item.Audience,
      Children: [],
    });
  }

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

function isExternal(url: string): boolean {
  if (!url || url === '#' || url.startsWith('#')) return false;
  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.hostname !== window.location.hostname;
  } catch {
    return false;
  }
}

// ── Workbench mock data ──

function getMockNavigation(): INavNode[] {
  return [
    {
      Id: 1, Title: 'Strategic Initiatives', Url: '#', IsExternal: false,
      Children: [
        { Id: 2, Title: 'Business AI', Url: '#', IsExternal: false, IsNew: true, Children: [
          { Id: 3, Title: 'AI Agents', Url: '#', IsExternal: false, Children: [] },
          { Id: 31, Title: 'Joule', Url: '#', IsExternal: false, Children: [] },
          { Id: 32, Title: 'Custom AI', Url: '#', IsExternal: false, Children: [] },
        ]},
        { Id: 4, Title: 'Account Planning 2026', Url: '#', IsExternal: false, Children: [] },
        { Id: 5, Title: 'SAP Business Suite', Url: '#', IsExternal: false, Children: [
          { Id: 51, Title: 'Switch Motions', Url: '#', IsExternal: false, Children: [] },
        ]},
        { Id: 6, Title: 'GROW with SAP', Url: '#', IsExternal: false, Children: [] },
        { Id: 7, Title: 'RISE with SAP', Url: '#', IsExternal: false, Children: [] },
        { Id: 8, Title: 'Business Data Cloud', Url: '#', IsExternal: false, Children: [] },
      ]
    },
    {
      Id: 10, Title: 'Resources / Tools', Url: '#', IsExternal: false,
      Children: [
        { Id: 11, Title: 'Melody Activity Reporting', Url: '#', IsExternal: false, Children: [] },
        { Id: 12, Title: 'LeanIX', Url: '#', IsExternal: false, Children: [
          { Id: 121, Title: 'Delivery Workspace', Url: '#', IsExternal: false, Children: [] },
          { Id: 122, Title: 'Request Workspace', Url: '#', IsExternal: false, Children: [] },
        ]},
        { Id: 13, Title: 'Customer One 360', Url: '#', IsExternal: false, Children: [] },
        { Id: 14, Title: 'Totango', Url: '#', IsExternal: false, Children: [] },
        { Id: 15, Title: 'Cloud Reporting', Url: '#', IsExternal: false, Children: [] },
      ]
    },
    {
      Id: 20, Title: 'Deliverables', Url: '#', IsExternal: false,
      Children: [
        { Id: 21, Title: 'Select Phase Core Deliverables', Url: '#', IsExternal: false, Children: [
          { Id: 211, Title: 'Business Capability Map', Url: '#', IsExternal: false, Children: [] },
          { Id: 212, Title: 'Product Map', Url: '#', IsExternal: false, Children: [] },
          { Id: 213, Title: 'AAOD', Url: '#', IsExternal: false, Children: [] },
        ]},
        { Id: 22, Title: 'AI Discovery Workshop', Url: '#', IsExternal: false, IsNew: true, Children: [] },
        { Id: 23, Title: 'DDA', Url: '#', IsExternal: false, Children: [] },
      ]
    },
    {
      Id: 30, Title: 'AA Generated Content', Url: '#', IsExternal: false,
      Children: [
        { Id: 31, Title: 'Regional Content', Url: '#', IsExternal: false, Children: [] },
        { Id: 33, Title: 'Enablement Recordings', Url: '#', IsExternal: false, Children: [] },
      ]
    },
    {
      Id: 40, Title: 'Reference Content', Url: '#', IsExternal: false,
      Children: [
        { Id: 41, Title: 'Customer Value Journey', Url: '#', IsExternal: false, Children: [] },
        { Id: 42, Title: 'Industry Content', Url: '#', IsExternal: false, Children: [] },
        { Id: 43, Title: 'Architecture Center', Url: '#', IsExternal: false, Children: [] },
      ]
    },
    {
      Id: 50, Title: 'Communities', Url: '#', IsExternal: false,
      Children: [
        { Id: 51, Title: 'Global Architecture Advisory', Url: '#', IsExternal: false, Children: [] },
        { Id: 52, Title: 'SAP EAM Community', Url: '#', IsExternal: false, Children: [] },
      ]
    },
    {
      Id: 60, Title: 'Learning Paths', Url: '#', IsExternal: false,
      Children: [
        { Id: 61, Title: 'Cohort Training', Url: '#', IsExternal: false, IsNew: true, Children: [
          { Id: 611, Title: 'Module 1', Url: '#', IsExternal: false, Children: [] },
          { Id: 612, Title: 'Module 2', Url: '#', IsExternal: false, Children: [] },
        ]},
        { Id: 62, Title: 'SuccessMap Learning', Url: '#', IsExternal: false, Children: [] },
      ]
    },
    {
      Id: 70, Title: 'Communications', Url: '#', IsExternal: false,
      Children: [
        { Id: 71, Title: 'Site Feedback', Url: '#', IsExternal: false, Children: [] },
        { Id: 72, Title: 'STACK@SAP', Url: '#', IsExternal: false, Children: [] },
        { Id: 73, Title: 'AA Newsletters', Url: '#', IsExternal: false, Children: [] },
      ]
    },
  ];
}
