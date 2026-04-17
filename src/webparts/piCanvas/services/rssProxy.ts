/**
 * RSS Proxy Utilities for PiCanvas
 *
 * Handles CORS issues when fetching RSS feeds by routing requests
 * through public proxy services. Ported from PiSpace RSS Hub.
 *
 * Proxy Chain: Direct → corsproxy.io → rss2json → thingproxy
 */

// Public CORS proxy services (fallback chain)
// Ordered by reliability - corsproxy.io is most reliable for Microsoft feeds
const PUBLIC_PROXIES = [
    {
        name: 'rss2json',
        // rss2json.com - free tier allows 10,000 requests/day, returns JSON
        // Most reliable proxy — works with Google News, Microsoft, Reddit
        buildUrl: (url: string) => `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(url)}`,
        headers: {} as Record<string, string>,
        isJson: true
    },
    {
        name: 'corsproxy.io',
        buildUrl: (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
        headers: {} as Record<string, string>
    },
    {
        name: 'allorigins',
        buildUrl: (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
        headers: {} as Record<string, string>
    }
];

// Track which proxies are working
const proxyHealth = new Map<string, { healthy: boolean; failedAt?: number; lastSuccess?: number }>();

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
    const { timeout = 15000, retryCount = 1 } = options;

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

    // Try proxies with fallback
    for (const proxy of PUBLIC_PROXIES) {
        // Skip proxies that have recently failed
        const health = proxyHealth.get(proxy.name);
        if (health && health.failedAt && Date.now() - health.failedAt < 60000) {
            console.log(`[PiCanvas RSS] Skipping ${proxy.name} (recently failed)`);
            continue;
        }

        for (let attempt = 0; attempt < retryCount; attempt++) {
            try {
                const proxyUrl = proxy.buildUrl(feedUrl);
                console.log(`[PiCanvas RSS] Trying ${proxy.name} (attempt ${attempt + 1})`);

                const response = await fetchWithTimeout(proxyUrl, {
                    method: 'GET',
                    headers: {
                        ...proxy.headers,
                        'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*'
                    }
                }, timeout);

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const text = await response.text();

                // Handle JSON responses from rss2json
                if (proxy.isJson) {
                    try {
                        const jsonData = JSON.parse(text);
                        if (jsonData.status === 'ok' && jsonData.items) {
                            console.log(`[PiCanvas RSS] ${proxy.name} returned JSON with ${jsonData.items.length} items`);
                            proxyHealth.set(proxy.name, { healthy: true, lastSuccess: Date.now() });
                            return {
                                __isRss2Json: true,
                                feed: jsonData.feed,
                                items: jsonData.items
                            } as IRss2JsonResponse;
                        } else {
                            throw new Error(`Invalid RSS2JSON response: ${jsonData.status || 'unknown error'}`);
                        }
                    } catch {
                        throw new Error('Failed to parse JSON response');
                    }
                }

                if (!isValidXML(text)) {
                    throw new Error('Response is not valid XML');
                }

                proxyHealth.set(proxy.name, { healthy: true, lastSuccess: Date.now() });
                console.log(`[PiCanvas RSS] ${proxy.name} succeeded`);
                return text;

            } catch (error) {
                console.warn(`[PiCanvas RSS] ${proxy.name} attempt ${attempt + 1} failed:`, (error as Error).message);
                if (attempt === retryCount - 1) {
                    proxyHealth.set(proxy.name, { healthy: false, failedAt: Date.now() });
                }
            }
        }
    }

    throw new Error(`Failed to fetch feed: ${feedUrl}. All proxies exhausted.`);
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
    proxyHealth.clear();
};

/**
 * Get proxy health status (for debugging)
 */
export const getProxyHealth = (): Record<string, { healthy: boolean; failedAt?: number; lastSuccess?: number }> => {
    const status: Record<string, { healthy: boolean; failedAt?: number; lastSuccess?: number }> = {};
    PUBLIC_PROXIES.forEach(proxy => {
        const health = proxyHealth.get(proxy.name);
        status[proxy.name] = health || { healthy: true };
    });
    return status;
};
