/**
 * RSS Proxy Utilities for PiCanvas
 *
 * Fetches RSS feeds directly from the browser. PiCanvas deliberately does not
 * transmit tenant-configured feed URLs or feed contents to public proxy services.
 */

// Domains known to block CORS - skip direct fetch to save time
const CORS_BLOCKED_DOMAINS = [
    'techcommunity.microsoft.com',
    'azure.microsoft.com',
    'blogs.microsoft.com',
    'devblogs.microsoft.com',
    'microsoft.com',
    'sharepoint.com',
    'news.google.com',
    'google.com',
    'reddit.com'
];

/**
 * Check if domain is known to block CORS
 */
const isKnownCorsBlocked = (url: string): boolean => {
    try {
        const hostname = new URL(url).hostname;
        return CORS_BLOCKED_DOMAINS.some(domain => hostname.includes(domain));
    } catch {
        return false;
    }
};

/**
 * Fetch with timeout support
 */
const fetchWithTimeout = async (
    url: string,
    options: RequestInit,
    timeout: number
): Promise<Response> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        if ((error as Error).name === 'AbortError') {
            throw new Error('Request timed out');
        }
        throw error;
    }
};

/**
 * Check if content is valid XML
 */
const isValidXML = (content: string): boolean => {
    if (!content || typeof content !== 'string') return false;

    const trimmed = content.trim();
    if (!trimmed.startsWith('<?xml') && !trimmed.startsWith('<rss') && !trimmed.startsWith('<feed')) {
        if (!trimmed.includes('<channel') && !trimmed.includes('<feed') && !trimmed.includes('<entry')) {
            return false;
        }
    }

    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(content, 'text/xml');
        return !doc.querySelector('parsererror');
    } catch {
        return false;
    }
};

/**
 * RSS2JSON response structure
 */
export interface IRss2JsonResponse {
    __isRss2Json: true;
    feed: {
        title?: string;
        url?: string;
        link?: string;
        description?: string;
        image?: string;
    };
    items: Array<{
        title?: string;
        link?: string;
        description?: string;
        content?: string;
        pubDate?: string;
        author?: string;
        thumbnail?: string;
        categories?: string[];
        enclosure?: { link?: string };
        guid?: string;
    }>;
}

export type FetchResult = string | IRss2JsonResponse;

/**
 * Fetch RSS feed with automatic CORS proxy handling
 */
export const fetchFeedWithProxy = async (
    feedUrl: string,
    options: { timeout?: number; retryCount?: number } = {}
): Promise<FetchResult> => {
    const { timeout = 15000 } = options;

    console.log(`[PiCanvas RSS] Starting fetch for ${feedUrl}`);

    // Skip direct fetch for known CORS-blocked domains
    if (!isKnownCorsBlocked(feedUrl)) {
        try {
            console.log(`[PiCanvas RSS] Trying direct fetch`);
            const directResult = await fetchWithTimeout(feedUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml'
                }
            }, timeout);

            if (directResult.ok) {
                const text = await directResult.text();
                if (isValidXML(text)) {
                    console.log(`[PiCanvas RSS] Direct fetch succeeded`);
                    return text;
                }
            }
        } catch (directError) {
            console.log(`[PiCanvas RSS] Direct fetch failed:`, (directError as Error).message);
        }
    } else {
        console.log(`[PiCanvas RSS] Skipping direct fetch for CORS-blocked domain`);
    }

    throw new Error(
        `Failed to fetch feed directly: ${feedUrl}. The feed must permit browser CORS access or be served through a tenant-controlled integration.`
    );
};

/**
 * Validate feed URL
 */
export const isValidFeedUrl = (url: string): boolean => {
    try {
        const parsed = new URL(url);
        return ['http:', 'https:'].includes(parsed.protocol);
    } catch {
        return false;
    }
};

/**
 * Normalize feed URL
 */
export const normalizeFeedUrl = (url: string): string => {
    if (!url) return '';

    let normalized = url.trim();

    if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
        normalized = 'https://' + normalized;
    }

    if (normalized.endsWith('/')) {
        normalized = normalized.slice(0, -1);
    }

    return normalized;
};

/**
 * Reset proxy health tracking
 */
export const resetProxyHealth = (): void => {
    // Kept as a compatibility no-op for existing callers.
};

/**
 * Get proxy health status (for debugging)
 */
export const getProxyHealth = (): Record<string, { healthy: boolean; failedAt?: number; lastSuccess?: number }> => {
    return {};
};
