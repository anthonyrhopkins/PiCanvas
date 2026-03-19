/**
 * RSS Parser for PiCanvas
 *
 * Parses both RSS 2.0 and Atom feed formats into normalized article structure.
 * Handles rss2json.com JSON responses and extracts thumbnails from content.
 * Ported from PiSpace RSS Hub.
 */

import { IRss2JsonResponse, FetchResult } from './rssProxy';

/**
 * Parsed RSS feed item
 */
export interface IRssItem {
    id: string;
    guid: string;
    title: string;
    link: string;
    description: string;
    content: string;
    publishedDate: Date;
    author: string;
    categories: string[];
    thumbnail: string | null;
}

/**
 * Parsed RSS feed
 */
export interface IRssFeed {
    title: string;
    description: string;
    link: string;
    image: string;
    lastBuildDate: Date;
    items: IRssItem[];
    itemCount: number;
}

/**
 * Feed metadata for display
 */
export interface IRssFeedMeta {
    name?: string;
    icon?: string;
    color?: string;
}

/**
 * Parse RSS or Atom feed content into normalized structure
 */
export const parseRSSFeed = (
    content: FetchResult,
    feedId: string,
    feedMeta: IRssFeedMeta = {}
): IRssFeed => {
    // Handle pre-parsed JSON from rss2json proxy
    if (typeof content === 'object' && content.__isRss2Json) {
        return parseRss2JsonResponse(content, feedId, feedMeta);
    }

    const xmlString = content as string;
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

    // Check for parse errors
    const parseError = xmlDoc.querySelector('parsererror');
    if (parseError) {
        console.error('[PiCanvas RSS] XML Parse Error:', parseError.textContent);
        throw new Error('Failed to parse RSS feed XML');
    }

    // Detect feed type and parse accordingly
    const isAtom = xmlDoc.querySelector('feed');
    const isRSS = xmlDoc.querySelector('rss, channel');

    if (isAtom) {
        return parseAtomFeed(xmlDoc, feedId, feedMeta);
    } else if (isRSS) {
        return parseRSS2Feed(xmlDoc, feedId, feedMeta);
    } else {
        throw new Error('Unknown feed format - not RSS or Atom');
    }
};

/**
 * Parse rss2json.com JSON response
 */
const parseRss2JsonResponse = (
    jsonData: IRss2JsonResponse,
    feedId: string,
    feedMeta: IRssFeedMeta
): IRssFeed => {
    const { feed, items } = jsonData;

    const feedTitle = feed?.title || feedMeta.name || 'RSS Feed';
    const feedDescription = feed?.description || '';
    const feedLink = feed?.link || '';
    const feedImage = feed?.image || '';

    const parsedItems: IRssItem[] = [];

    (items || []).forEach((item, index) => {
        try {
            const guid = item.guid || item.link || `${feedId}-${index}`;
            const title = cleanText(item.title || '');
            const link = item.link || '';
            const description = item.description || '';
            const content = item.content || description;
            const pubDate = item.pubDate;
            const author = item.author || '';
            const thumbnail = item.thumbnail || item.enclosure?.link || extractImageFromContent(content);
            const categories = item.categories || [];

            parsedItems.push({
                id: `${feedId}::${hashString(guid)}`,
                guid,
                title: title || 'Untitled',
                link,
                description: cleanText(description),
                content,
                publishedDate: pubDate ? new Date(pubDate) : new Date(),
                author: author || feedMeta.name || '',
                categories,
                thumbnail
            });
        } catch (error) {
            console.error('[PiCanvas RSS] Error parsing rss2json item:', error);
        }
    });

    return {
        title: feedTitle,
        description: feedDescription,
        link: feedLink,
        image: feedImage,
        lastBuildDate: new Date(),
        items: parsedItems,
        itemCount: parsedItems.length
    };
};

/**
 * Parse RSS 2.0 feed format
 */
const parseRSS2Feed = (
    xmlDoc: Document,
    feedId: string,
    feedMeta: IRssFeedMeta
): IRssFeed => {
    const channel = xmlDoc.querySelector('channel');
    if (!channel) {
        throw new Error('Invalid RSS feed - no channel element');
    }

    const feedTitle = getTextContent(channel, 'title') || feedMeta.name || 'RSS Feed';
    const feedDescription = getTextContent(channel, 'description') || '';
    const feedLink = getTextContent(channel, 'link') || '';
    const feedImage = channel.querySelector('image > url')?.textContent || '';
    const lastBuildDate = getTextContent(channel, 'lastBuildDate');

    const items = channel.querySelectorAll('item');
    const parsedItems: IRssItem[] = [];

    items.forEach((item, index) => {
        try {
            const guid = getTextContent(item, 'guid') || getTextContent(item, 'link') || `${feedId}-${index}`;
            const title = cleanText(getTextContent(item, 'title'));
            const link = getTextContent(item, 'link');
            const description = getTextContent(item, 'description');
            const content = getTextContent(item, 'content:encoded') || getTextContent(item, 'content') || description;
            const pubDate = getTextContent(item, 'pubDate');
            const author = getTextContent(item, 'author') || getTextContent(item, 'dc:creator');

            const categoryNodes = item.querySelectorAll('category');
            const categories = Array.from(categoryNodes).map(node => node.textContent?.trim() || '');

            const thumbnail = extractThumbnail(item, content);

            parsedItems.push({
                id: `${feedId}::${hashString(guid)}`,
                guid,
                title: title || 'Untitled',
                link,
                description: cleanText(description),
                content,
                publishedDate: pubDate ? new Date(pubDate) : new Date(),
                author: author || feedMeta.name || '',
                categories,
                thumbnail
            });
        } catch (error) {
            console.error('[PiCanvas RSS] Error parsing RSS item:', error);
        }
    });

    return {
        title: feedTitle,
        description: feedDescription,
        link: feedLink,
        image: feedImage,
        lastBuildDate: lastBuildDate ? new Date(lastBuildDate) : new Date(),
        items: parsedItems,
        itemCount: parsedItems.length
    };
};

/**
 * Parse Atom feed format
 */
const parseAtomFeed = (
    xmlDoc: Document,
    feedId: string,
    feedMeta: IRssFeedMeta
): IRssFeed => {
    const feed = xmlDoc.querySelector('feed');
    if (!feed) {
        throw new Error('Invalid Atom feed - no feed element');
    }

    const feedTitle = getTextContent(feed, 'title') || feedMeta.name || 'RSS Feed';
    const feedSubtitle = getTextContent(feed, 'subtitle') || '';
    const feedLinkNode = feed.querySelector('link[rel="alternate"], link:not([rel])');
    const feedLink = feedLinkNode?.getAttribute('href') || '';
    const feedIcon = getTextContent(feed, 'icon') || getTextContent(feed, 'logo') || '';
    const feedUpdated = getTextContent(feed, 'updated');

    const entries = feed.querySelectorAll('entry');
    const parsedItems: IRssItem[] = [];

    entries.forEach((entry, index) => {
        try {
            const id = getTextContent(entry, 'id') || `${feedId}-${index}`;
            const title = cleanText(getTextContent(entry, 'title'));
            const linkNode = entry.querySelector('link[rel="alternate"], link:not([rel])');
            const link = linkNode?.getAttribute('href') || '';
            const summary = getTextContent(entry, 'summary') || '';
            const content = getTextContent(entry, 'content') || summary;
            const published = getTextContent(entry, 'published') || getTextContent(entry, 'updated');
            const authorNode = entry.querySelector('author');
            const author = authorNode ? getTextContent(authorNode, 'name') : '';

            const categoryNodes = entry.querySelectorAll('category');
            const categories = Array.from(categoryNodes).map(node =>
                node.getAttribute('term') || node.getAttribute('label') || node.textContent?.trim() || ''
            );

            const thumbnail = extractThumbnail(entry, content);

            parsedItems.push({
                id: `${feedId}::${hashString(id)}`,
                guid: id,
                title: title || 'Untitled',
                link,
                description: cleanText(summary),
                content,
                publishedDate: published ? new Date(published) : new Date(),
                author: author || feedMeta.name || '',
                categories,
                thumbnail
            });
        } catch (error) {
            console.error('[PiCanvas RSS] Error parsing Atom entry:', error);
        }
    });

    return {
        title: feedTitle,
        description: feedSubtitle,
        link: feedLink,
        image: feedIcon,
        lastBuildDate: feedUpdated ? new Date(feedUpdated) : new Date(),
        items: parsedItems,
        itemCount: parsedItems.length
    };
};

/**
 * Get text content from XML node (handles namespaced elements)
 */
const getTextContent = (element: Element, tagName: string): string => {
    // Handle namespaced elements (e.g., content:encoded, dc:creator)
    if (tagName.includes(':')) {
        const [prefix, localName] = tagName.split(':');

        const namespaces: Record<string, string> = {
            'content': 'http://purl.org/rss/1.0/modules/content/',
            'dc': 'http://purl.org/dc/elements/1.1/',
            'media': 'http://search.yahoo.com/mrss/',
            'atom': 'http://www.w3.org/2005/Atom'
        };

        const ns = namespaces[prefix];
        if (ns) {
            const nodes = element.getElementsByTagNameNS(ns, localName);
            if (nodes.length > 0) {
                return nodes[0].textContent || '';
            }
        }

        // Fallback: Try getElementsByTagName with full prefixed name
        const prefixedNodes = element.getElementsByTagName(tagName);
        if (prefixedNodes.length > 0) {
            return prefixedNodes[0].textContent || '';
        }

        // Fallback: Try just the local name
        const localNodes = element.getElementsByTagName(localName);
        if (localNodes.length > 0) {
            return localNodes[0].textContent || '';
        }

        return '';
    }

    const node = element.querySelector(tagName);
    return node?.textContent || '';
};

/**
 * Clean HTML entities and tags from text
 */
const cleanText = (text: string): string => {
    if (!text) return '';

    // Remove HTML tags first (before entity decoding to prevent XSS)
    const withoutTags = text.replace(/<[^>]*>/g, ' ');

    // Decode HTML entities safely using DOMParser (no script execution)
    try {
      const doc = new DOMParser().parseFromString(withoutTags, 'text/html');
      const decoded = doc.body.textContent || '';
      return decoded.trim().replace(/\s+/g, ' ');
    } catch {
      // Fallback: strip entities manually
      return withoutTags.replace(/&[^;]+;/g, ' ').trim().replace(/\s+/g, ' ');
    }
};

/**
 * Extract thumbnail image from feed item
 */
const extractThumbnail = (item: Element, content: string): string | null => {
    const mediaNamespace = 'http://search.yahoo.com/mrss/';

    // Try media:thumbnail
    const mediaThumbnails = item.getElementsByTagNameNS(mediaNamespace, 'thumbnail');
    if (mediaThumbnails.length > 0) {
        return mediaThumbnails[0].getAttribute('url') || mediaThumbnails[0].textContent || null;
    }

    // Fallback for non-namespaced
    const fallbackThumbnail = item.getElementsByTagName('media:thumbnail')[0] ||
        item.getElementsByTagName('thumbnail')[0];
    if (fallbackThumbnail) {
        return fallbackThumbnail.getAttribute('url') || fallbackThumbnail.textContent || null;
    }

    // Try media:content
    const mediaContents = item.getElementsByTagNameNS(mediaNamespace, 'content');
    if (mediaContents.length > 0) {
        for (let i = 0; i < mediaContents.length; i++) {
            const mc = mediaContents[i];
            const medium = mc.getAttribute('medium');
            const type = mc.getAttribute('type');
            if (medium === 'image' || (type && type.startsWith('image/'))) {
                const url = mc.getAttribute('url');
                if (url) return url;
            }
        }
        const firstUrl = mediaContents[0].getAttribute('url');
        if (firstUrl) return firstUrl;
    }

    // Try enclosure with image type
    const enclosures = item.getElementsByTagName('enclosure');
    for (let i = 0; i < enclosures.length; i++) {
        const type = enclosures[i].getAttribute('type');
        if (type && type.startsWith('image/')) {
            return enclosures[i].getAttribute('url');
        }
    }

    // Extract from content
    return extractImageFromContent(content);
};

/**
 * Extract first image from HTML content
 */
const extractImageFromContent = (content: string): string | null => {
    if (!content) return null;

    // Match img tags with src attribute
    const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (imgMatch) {
        return imgMatch[1];
    }

    // Try YouTube thumbnail from embedded videos
    const ytMatch = content.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]+)/i) ||
        content.match(/youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/i);
    if (ytMatch) {
        return `https://i.ytimg.com/vi/${ytMatch[1]}/hqdefault.jpg`;
    }

    return null;
};

/**
 * Simple string hash function
 */
const hashString = (str: string): string => {
    let hash = 0;
    if (str.length === 0) return hash.toString();
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
};

/**
 * Format date for display
 */
export const formatDate = (date: Date, format: string): string => {
    if (format === 'relative') {
        return formatRelativeDate(date);
    }

    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();

    if (format === 'DD/MM/YYYY') {
        return `${day}/${month}/${year}`;
    }
    // Default: MM/DD/YYYY
    return `${month}/${day}/${year}`;
};

/**
 * Format date as relative time (e.g., "2 hours ago")
 */
const formatRelativeDate = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return formatDate(date, 'MM/DD/YYYY');
};

/**
 * Truncate text to character limit
 */
export const truncateText = (text: string, limit: number): string => {
    if (!text || text.length <= limit) return text;
    return text.substring(0, limit).trim() + '...';
};
