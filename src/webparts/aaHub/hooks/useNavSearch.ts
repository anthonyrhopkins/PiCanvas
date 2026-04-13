import * as React from 'react';
import { INavNode } from './useNavigation';

export interface INavSearchResult {
  node: INavNode;
  breadcrumb: string;
}

interface IFlatItem {
  node: INavNode;
  breadcrumb: string;
  searchText: string; // lowercase title + breadcrumb for matching
}

/**
 * Flattens the nav tree once (memoized) and provides real-time filtering.
 * Returns matching items with breadcrumb paths like "Strategic Initiatives > Business AI > Joule".
 */
export function useNavSearch(nodes: INavNode[]): {
  query: string;
  setQuery: (q: string) => void;
  results: INavSearchResult[];
  totalCount: number;
} {
  const [query, setQuery] = React.useState('');

  // Flatten tree once, memoized on nodes reference
  const flatItems = React.useMemo<IFlatItem[]>(() => {
    const items: IFlatItem[] = [];

    function walk(node: INavNode, ancestors: string[]): void {
      const breadcrumb = ancestors.length > 0 ? ancestors.join(' > ') : '';
      const searchText = `${node.Title} ${breadcrumb}`.toLowerCase();
      items.push({ node, breadcrumb, searchText });

      if (node.Children) {
        for (const child of node.Children) {
          walk(child, [...ancestors, node.Title]);
        }
      }
    }

    for (const root of nodes) {
      walk(root, []);
    }

    return items;
  }, [nodes]);

  // Filter results
  const results = React.useMemo<INavSearchResult[]>(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase().trim();
    const matched: INavSearchResult[] = [];

    for (const item of flatItems) {
      if (item.searchText.includes(q)) {
        matched.push({ node: item.node, breadcrumb: item.breadcrumb });
        if (matched.length >= 20) break; // cap results for performance
      }
    }

    return matched;
  }, [query, flatItems]);

  return { query, setQuery, results, totalCount: flatItems.length };
}
