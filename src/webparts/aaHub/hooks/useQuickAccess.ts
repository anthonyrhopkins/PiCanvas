import * as React from 'react';
import { useServices } from '../contexts/ServiceContext';
import { fetchQuickAccess, getMockQuickAccess, IQuickAccessCategory } from '../services/QuickAccessService';

const CACHE_TTL_MS = 5 * 60 * 1000;

export function useQuickAccess(): {
  categories: IQuickAccessCategory[];
  loading: boolean;
  error: string | null;
} {
  const { spHttpClient, siteUrl, isWorkbench } = useServices();
  const [categories, setCategories] = React.useState<IQuickAccessCategory[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const cacheRef = React.useRef<{ data: IQuickAccessCategory[]; timestamp: number } | null>(null);

  React.useEffect(() => {
    if (isWorkbench) {
      setCategories(getMockQuickAccess());
      setLoading(false);
      return;
    }

    // Check cache
    if (cacheRef.current && (Date.now() - cacheRef.current.timestamp) < CACHE_TTL_MS) {
      setCategories(cacheRef.current.data);
      setLoading(false);
      return;
    }

    const load = async (): Promise<void> => {
      try {
        const result = await fetchQuickAccess(spHttpClient, siteUrl);
        cacheRef.current = { data: result, timestamp: Date.now() };
        setCategories(result);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn('[AAHub] useQuickAccess: fetch failed:', msg);
        setError(msg);
        // Fall back to static data on error
        setCategories(getMockQuickAccess());
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [spHttpClient, siteUrl, isWorkbench]);

  return { categories, loading, error };
}
