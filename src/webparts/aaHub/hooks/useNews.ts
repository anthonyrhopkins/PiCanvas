import * as React from 'react';
import { SPHttpClient } from '@microsoft/sp-http';
import { useServices } from '../contexts/ServiceContext';

export interface INewsItem {
  id: number;
  title: string;
  url: string | null;
  content: string | null;
  section: 'Top News' | 'Good to Know';
  sortOrder: number;
  hoverText: string | null;
  publishedDate: string | null;
  newDays: number;
  isNew: boolean;
}

const LIST_TITLE = 'PiCanvasNews';
const SELECT_FIELDS = 'Id,Title,NewsUrl,NewsContent,NewsSection,NewsSortOrder,NewsHoverText,NewsPublishedDate,NewsNewDays';
const CACHE_TTL_MS = 5 * 60 * 1000;

export function useNews(): {
  topNews: INewsItem[];
  goodToKnow: INewsItem[];
  loading: boolean;
  error: string | null;
} {
  const { spHttpClient, siteUrl, isWorkbench } = useServices();
  const [topNews, setTopNews] = React.useState<INewsItem[]>([]);
  const [goodToKnow, setGoodToKnow] = React.useState<INewsItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const cacheRef = React.useRef<{ topNews: INewsItem[]; goodToKnow: INewsItem[]; timestamp: number } | null>(null);

  React.useEffect(() => {
    if (isWorkbench) {
      const mock = getMockNews();
      setTopNews(mock.filter(n => n.section === 'Top News'));
      setGoodToKnow(mock.filter(n => n.section === 'Good to Know'));
      setLoading(false);
      return;
    }

    // Check cache
    if (cacheRef.current && (Date.now() - cacheRef.current.timestamp) < CACHE_TTL_MS) {
      setTopNews(cacheRef.current.topNews);
      setGoodToKnow(cacheRef.current.goodToKnow);
      setLoading(false);
      return;
    }

    const fetchNews = async (): Promise<void> => {
      try {
        const apiUrl = `${siteUrl}/_api/web/lists/getbytitle('${LIST_TITLE}')/items` +
          `?$select=${SELECT_FIELDS}&$orderby=NewsSortOrder,Id&$top=100`;

        const resp = await spHttpClient.get(apiUrl, SPHttpClient.configurations.v1);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

        const data = await resp.json();
        const rawItems = (data.value || []) as Record<string, unknown>[];
        const now = Date.now();

        const items: INewsItem[] = rawItems.map(item => {
          const publishedDate = (item.NewsPublishedDate as string) || null;
          const newDays = (item.NewsNewDays as number) || 30;
          let isNew = false;

          if (publishedDate) {
            const pub = new Date(publishedDate).getTime();
            isNew = (now - pub) <= newDays * 86400000;
          }

          return {
            id: item.Id as number,
            title: (item.Title as string) || '',
            url: (item.NewsUrl as string) || null,
            content: (item.NewsContent as string) || null,
            section: ((item.NewsSection as string) || 'Top News') as INewsItem['section'],
            sortOrder: (item.NewsSortOrder as number) || 0,
            hoverText: (item.NewsHoverText as string) || null,
            publishedDate,
            newDays,
            isNew,
          };
        });

        const top = items.filter(n => n.section === 'Top News');
        const gtk = items.filter(n => n.section === 'Good to Know');

        cacheRef.current = { topNews: top, goodToKnow: gtk, timestamp: Date.now() };
        setTopNews(top);
        setGoodToKnow(gtk);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn('[AAHub] useNews: fetch failed:', msg);
        setError(msg);
      } finally {
        setLoading(false);
      }
    };

    fetchNews();
  }, [spHttpClient, siteUrl, isWorkbench]);

  return { topNews, goodToKnow, loading, error };
}

function getMockNews(): INewsItem[] {
  return [
    { id: 1, title: 'APM 2026 Account Planning Recap', url: '#', content: null, section: 'Top News', sortOrder: 1, hoverText: null, publishedDate: new Date().toISOString(), newDays: 30, isNew: true },
    { id: 2, title: 'RISE Summit \u2014 Key Takeaways for AAs', url: '#', content: null, section: 'Top News', sortOrder: 2, hoverText: null, publishedDate: null, newDays: 30, isNew: false },
    { id: 3, title: 'Business AI \u2014 Latest Updates', url: '#', content: null, section: 'Top News', sortOrder: 3, hoverText: null, publishedDate: null, newDays: 30, isNew: false },
    { id: 4, title: 'Business Data Cloud Overview', url: '#', content: null, section: 'Top News', sortOrder: 4, hoverText: null, publishedDate: null, newDays: 30, isNew: false },
    { id: 10, title: 'AA Playbook \u2014 Updated!', url: '#', content: null, section: 'Good to Know', sortOrder: 1, hoverText: null, publishedDate: new Date().toISOString(), newDays: 30, isNew: true },
    { id: 11, title: 'LeanIX Workspace Access', url: '#', content: null, section: 'Good to Know', sortOrder: 2, hoverText: null, publishedDate: null, newDays: 30, isNew: false },
    { id: 12, title: 'Site Feedback & Add/Edit Links', url: '#', content: null, section: 'Good to Know', sortOrder: 3, hoverText: null, publishedDate: null, newDays: 30, isNew: false },
    { id: 13, title: 'AA Q&A Resource \u2014 STACK@SAP', url: '#', content: null, section: 'Good to Know', sortOrder: 4, hoverText: null, publishedDate: null, newDays: 30, isNew: false },
    { id: 14, title: 'Global AA Newsletters Archive', url: '#', content: null, section: 'Good to Know', sortOrder: 5, hoverText: null, publishedDate: null, newDays: 30, isNew: false },
  ];
}
