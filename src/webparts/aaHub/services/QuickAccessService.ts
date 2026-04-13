/**
 * QuickAccessService
 * Fetches categorized quick access items from the PiCanvasQuickAccess SharePoint list.
 * Groups items by QACategory, applies NEW badge freshness logic.
 */

import { SPHttpClient } from '@microsoft/sp-http';

export interface IQuickAccessItem {
  id: number;
  title: string;
  url: string;
  category: string;
  sortOrder: number;
  categoryOrder: number;
  publishedDate: string | null;
  badgeDays: number;
  badgeLabel: string;
  isNew: boolean;
}

export interface IQuickAccessCategory {
  name: string;
  order: number;
  items: IQuickAccessItem[];
}

const LIST_TITLE = 'PiCanvasQuickAccess';
const SELECT_FIELDS = 'Id,Title,QALinkUrl,QACategory,QASortOrder,QACategoryOrder,QAPublishedDate,QABadgeDays,QABadgeLabel';

export async function fetchQuickAccess(
  spHttpClient: SPHttpClient,
  siteUrl: string
): Promise<IQuickAccessCategory[]> {
  const apiUrl = `${siteUrl}/_api/web/lists/getbytitle('${LIST_TITLE}')/items` +
    `?$select=${SELECT_FIELDS}&$orderby=QACategoryOrder,QASortOrder,Id&$top=200`;

  const resp = await spHttpClient.get(apiUrl, SPHttpClient.configurations.v1);
  if (!resp.ok) {
    throw new Error(`QuickAccess fetch returned ${resp.status}`);
  }

  const data = await resp.json();
  const rawItems = (data.value || []) as Record<string, unknown>[];
  const now = Date.now();

  // Parse items
  const items: IQuickAccessItem[] = rawItems.map(item => {
    const publishedDate = (item.QAPublishedDate as string) || null;
    const badgeDays = (item.QABadgeDays as number) || 30;
    let isNew = false;

    if (publishedDate) {
      const pub = new Date(publishedDate).getTime();
      const ageMs = now - pub;
      isNew = ageMs <= badgeDays * 86400000;
    }

    return {
      id: item.Id as number,
      title: (item.Title as string) || '',
      url: (item.QALinkUrl as string) || '#',
      category: (item.QACategory as string) || 'Other',
      sortOrder: (item.QASortOrder as number) || 0,
      categoryOrder: (item.QACategoryOrder as number) || 99,
      publishedDate,
      badgeDays,
      badgeLabel: (item.QABadgeLabel as string) || 'NEW',
      isNew,
    };
  });

  // Group by category
  const catMap = new Map<string, IQuickAccessCategory>();
  for (const item of items) {
    if (!catMap.has(item.category)) {
      catMap.set(item.category, { name: item.category, order: item.categoryOrder, items: [] });
    }
    catMap.get(item.category)!.items.push(item);
  }

  // Sort categories by order
  const categories = Array.from(catMap.values());
  categories.sort((a, b) => a.order - b.order);

  return categories;
}

// ── Workbench mock data ──

export function getMockQuickAccess(): IQuickAccessCategory[] {
  return [
    {
      name: 'Internal Assignment', order: 1,
      items: [
        { id: 1, title: 'CRM Assignment', url: '#', category: 'Internal Assignment', sortOrder: 1, categoryOrder: 1, publishedDate: null, badgeDays: 30, badgeLabel: 'NEW', isNew: false },
        { id: 2, title: 'Melody Activity / Time Entry', url: '#', category: 'Internal Assignment', sortOrder: 2, categoryOrder: 1, publishedDate: null, badgeDays: 30, badgeLabel: 'NEW', isNew: false },
        { id: 3, title: 'Request LeanIX Workspace', url: '#', category: 'Internal Assignment', sortOrder: 3, categoryOrder: 1, publishedDate: null, badgeDays: 30, badgeLabel: 'NEW', isNew: false },
        { id: 4, title: 'Harmony Lookup', url: '#', category: 'Internal Assignment', sortOrder: 4, categoryOrder: 1, publishedDate: null, badgeDays: 30, badgeLabel: 'NEW', isNew: false },
      ],
    },
    {
      name: 'Background / Research', order: 2,
      items: [
        { id: 10, title: 'Customer 360', url: '#', category: 'Background / Research', sortOrder: 1, categoryOrder: 2, publishedDate: null, badgeDays: 30, badgeLabel: 'NEW', isNew: false },
        { id: 11, title: 'SAP4ME', url: '#', category: 'Background / Research', sortOrder: 2, categoryOrder: 2, publishedDate: null, badgeDays: 30, badgeLabel: 'NEW', isNew: false },
        { id: 12, title: 'Innovation Dashboard', url: '#', category: 'Background / Research', sortOrder: 3, categoryOrder: 2, publishedDate: null, badgeDays: 30, badgeLabel: 'NEW', isNew: false },
        { id: 13, title: 'Joule 4 Consultants', url: '#', category: 'Background / Research', sortOrder: 4, categoryOrder: 2, publishedDate: null, badgeDays: 30, badgeLabel: 'NEW', isNew: false },
        { id: 14, title: 'GenAI Lab (w/ Grounding)', url: '#', category: 'Background / Research', sortOrder: 5, categoryOrder: 2, publishedDate: new Date().toISOString(), badgeDays: 30, badgeLabel: 'NEW', isNew: true },
      ],
    },
    {
      name: 'Transformation Tools', order: 3,
      items: [
        { id: 20, title: 'Digital Discovery Assessment', url: '#', category: 'Transformation Tools', sortOrder: 1, categoryOrder: 3, publishedDate: null, badgeDays: 30, badgeLabel: 'NEW', isNew: false },
        { id: 21, title: 'AI Workshop Adoption Plans', url: '#', category: 'Transformation Tools', sortOrder: 2, categoryOrder: 3, publishedDate: null, badgeDays: 30, badgeLabel: 'NEW', isNew: false },
        { id: 22, title: 'AI Roadmap Builder', url: '#', category: 'Transformation Tools', sortOrder: 3, categoryOrder: 3, publishedDate: new Date().toISOString(), badgeDays: 30, badgeLabel: 'NEW', isNew: true },
        { id: 23, title: 'LeanIX Deliverables', url: '#', category: 'Transformation Tools', sortOrder: 4, categoryOrder: 3, publishedDate: null, badgeDays: 30, badgeLabel: 'NEW', isNew: false },
      ],
    },
    {
      name: 'Customer Resources', order: 4,
      items: [
        { id: 30, title: 'SAP Business Hub (API)', url: '#', category: 'Customer Resources', sortOrder: 1, categoryOrder: 4, publishedDate: null, badgeDays: 30, badgeLabel: 'NEW', isNew: false },
        { id: 31, title: 'Discovery Center (BTP)', url: '#', category: 'Customer Resources', sortOrder: 2, categoryOrder: 4, publishedDate: null, badgeDays: 30, badgeLabel: 'NEW', isNew: false },
        { id: 32, title: 'Architecture Center', url: '#', category: 'Customer Resources', sortOrder: 3, categoryOrder: 4, publishedDate: null, badgeDays: 30, badgeLabel: 'NEW', isNew: false },
        { id: 33, title: 'SAP Trust Center', url: '#', category: 'Customer Resources', sortOrder: 4, categoryOrder: 4, publishedDate: null, badgeDays: 30, badgeLabel: 'NEW', isNew: false },
      ],
    },
    {
      name: 'Sales Support', order: 5,
      items: [
        { id: 40, title: 'Pricing App', url: '#', category: 'Sales Support', sortOrder: 1, categoryOrder: 5, publishedDate: null, badgeDays: 30, badgeLabel: 'NEW', isNew: false },
        { id: 41, title: 'BomVoyage', url: '#', category: 'Sales Support', sortOrder: 2, categoryOrder: 5, publishedDate: null, badgeDays: 30, badgeLabel: 'NEW', isNew: false },
        { id: 42, title: 'Material Mapping', url: '#', category: 'Sales Support', sortOrder: 3, categoryOrder: 5, publishedDate: null, badgeDays: 30, badgeLabel: 'NEW', isNew: false },
      ],
    },
  ];
}
