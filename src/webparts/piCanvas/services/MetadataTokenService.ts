/**
 * MetadataTokenService
 * Handles fetching SharePoint page metadata and substituting tokens in content
 */

import { SPHttpClient, SPHttpClientResponse } from '@microsoft/sp-http';
import { WebPartContext } from '@microsoft/sp-webpart-base';
import {
  IMetadataToken,
  IPageMetadata,
  IResolvedToken,
  MetadataTokenCategory,
  SHAREPOINT_PAGE_TOKENS,
  TOKEN_PATTERN,
  getAllBuiltInTokens
} from '../models/MetadataTokenModels';

/**
 * Configuration for token substitution
 */
export interface ITokenSubstitutionOptions {
  /** Text to show for missing/unresolved tokens */
  fallbackText?: string;
  /** Whether to sanitize HTML in token values */
  sanitizeHtml?: boolean;
  /** Date format for date tokens */
  dateFormat?: 'short' | 'medium' | 'long' | 'iso';
  /** Locale for date formatting */
  locale?: string;
}

/**
 * Custom field definition from SharePoint
 */
export interface ICustomFieldDefinition {
  InternalName: string;
  Title: string;
  TypeAsString: string;
  Description?: string;
}

/**
 * Service for managing page metadata tokens
 */
export class MetadataTokenService {
  private context: WebPartContext;
  private cachedMetadata: IPageMetadata | null = null;
  private cachedCustomFields: IMetadataToken[] | null = null;
  private metadataFetchPromise: Promise<IPageMetadata> | null = null;

  constructor(context: WebPartContext) {
    this.context = context;
  }

  /**
   * Get all available tokens (built-in + custom fields)
   */
  public async getAllTokens(): Promise<IMetadataToken[]> {
    const builtIn = getAllBuiltInTokens();
    const custom = await this.getCustomFieldTokens();
    return [...builtIn, ...custom];
  }

  /**
   * Get tokens organized by category with current values
   */
  public async getResolvedTokensByCategory(): Promise<Record<MetadataTokenCategory, IResolvedToken[]>> {
    const metadata = await this.fetchPageMetadata();
    const customFields = await this.getCustomFieldTokens();

    const result: Record<MetadataTokenCategory, IResolvedToken[]> = {
      page: [],
      people: [],
      dates: [],
      site: [],
      custom: []
    };

    // Process built-in tokens
    for (const category of Object.keys(SHAREPOINT_PAGE_TOKENS) as MetadataTokenCategory[]) {
      const tokens = SHAREPOINT_PAGE_TOKENS[category];
      result[category] = tokens.map(token => this.resolveToken(token, metadata));
    }

    // Add custom fields
    result.custom = customFields.map(token => this.resolveToken(token, metadata));

    return result;
  }

  /**
   * Resolve a single token to get its current value
   */
  private resolveToken(token: IMetadataToken, metadata: IPageMetadata): IResolvedToken {
    const value = this.getValueByPath(metadata, token.valuePath);
    const formattedValue = this.formatTokenValue(value, token.type);

    return {
      ...token,
      currentValue: formattedValue,
      hasValue: value !== null && value !== undefined && value !== ''
    };
  }

  /**
   * Fetch page metadata from SharePoint
   */
  public async fetchPageMetadata(): Promise<IPageMetadata> {
    // Return cached if available
    if (this.cachedMetadata) {
      return this.cachedMetadata;
    }

    // Return existing promise if fetch is in progress
    if (this.metadataFetchPromise) {
      return this.metadataFetchPromise;
    }

    this.metadataFetchPromise = this.doFetchPageMetadata();
    return this.metadataFetchPromise;
  }

  /**
   * Internal fetch implementation
   */
  private async doFetchPageMetadata(): Promise<IPageMetadata> {
    try {
      const pageContext = this.context.pageContext;
      const siteUrl = pageContext.web.absoluteUrl;
      const pageId = pageContext.listItem?.id;

      // Start with context-based metadata (always available)
      const metadata: IPageMetadata = {
        // Site context
        SiteTitle: pageContext.web.title,
        SiteUrl: pageContext.site.absoluteUrl,
        WebTitle: pageContext.web.title,
        WebUrl: pageContext.web.serverRelativeUrl,
        // Page basics from context
        // Note: listItem doesn't expose title directly, we get it from API call below
        Title: (pageContext.listItem as unknown as { title?: string })?.title || document.title || '',
        FileRef: pageContext.site.serverRequestPath,
        FileLeafRef: pageContext.site.serverRequestPath?.split('/').pop() || ''
      };

      // If we have a page ID, fetch full metadata from REST API
      if (pageId) {
        const apiUrl = `${siteUrl}/_api/web/lists/getbytitle('Site Pages')/items(${pageId})?$select=*,Author/Title,Author/EMail,Editor/Title,Editor/EMail&$expand=Author,Editor`;

        const response: SPHttpClientResponse = await this.context.spHttpClient.get(
          apiUrl,
          SPHttpClient.configurations.v1
        );

        if (response.ok) {
          const data = await response.json();

          // Merge API data with context data
          Object.assign(metadata, {
            // Page properties
            Title: data.Title || metadata.Title,
            Description: data.Description || data.OData__x005f_Description || '',
            BannerImageUrl: data.BannerImageUrl?.Url || '',
            PageLayoutType: data.PageLayoutType || '',

            // People
            Author: data.Author ? {
              Title: data.Author.Title,
              EMail: data.Author.EMail,
              Id: data.AuthorId
            } : undefined,
            Editor: data.Editor ? {
              Title: data.Editor.Title,
              EMail: data.Editor.EMail,
              Id: data.EditorId
            } : undefined,

            // Dates
            Created: data.Created,
            Modified: data.Modified,
            FirstPublishedDate: data.FirstPublishedDate,

            // System
            Id: data.Id,
            UniqueId: data.UniqueId,
            FileRef: data.FileRef || metadata.FileRef,
            FileDirRef: data.FileDirRef,
            FileLeafRef: data.FileLeafRef || metadata.FileLeafRef
          });

          // Add any custom fields (fields not in our built-in list)
          const builtInFields = new Set([
            'Title', 'Description', 'BannerImageUrl', 'PageLayoutType',
            'Author', 'AuthorId', 'Editor', 'EditorId',
            'Created', 'Modified', 'FirstPublishedDate',
            'Id', 'UniqueId', 'FileRef', 'FileDirRef', 'FileLeafRef',
            'CanvasContent1', 'LayoutWebpartsContent', 'ContentTypeId',
            'OData__x005f_UIVersionString', 'GUID', 'ComplianceAssetId'
          ]);

          for (const [key, value] of Object.entries(data)) {
            if (!builtInFields.has(key) && !key.startsWith('OData_') && !key.startsWith('@odata')) {
              (metadata as Record<string, unknown>)[key] = value;
            }
          }
        }
      }

      this.cachedMetadata = metadata;
      return metadata;

    } catch (error) {
      console.error('[PiCanvas] Error fetching page metadata:', error);
      // Return basic metadata from context on error
      const pageContext = this.context.pageContext;
      return {
        Title: (pageContext.listItem as unknown as { title?: string })?.title || document.title || '',
        SiteTitle: pageContext.web.title,
        SiteUrl: pageContext.site.absoluteUrl,
        WebTitle: pageContext.web.title,
        WebUrl: pageContext.web.serverRelativeUrl
      };
    }
  }

  /**
   * Get custom field tokens from Site Pages library
   */
  public async getCustomFieldTokens(): Promise<IMetadataToken[]> {
    if (this.cachedCustomFields) {
      return this.cachedCustomFields;
    }

    try {
      const siteUrl = this.context.pageContext.web.absoluteUrl;
      const apiUrl = `${siteUrl}/_api/web/lists/getbytitle('Site Pages')/fields?$filter=Hidden eq false and ReadOnlyField eq false and FieldTypeKind ne 12&$select=InternalName,Title,TypeAsString,Description`;

      const response: SPHttpClientResponse = await this.context.spHttpClient.get(
        apiUrl,
        SPHttpClient.configurations.v1
      );

      if (!response.ok) {
        console.warn('[PiCanvas] Could not fetch custom fields');
        return [];
      }

      const data = await response.json();
      const fields: ICustomFieldDefinition[] = data.value || [];

      // Filter out built-in fields and system fields
      const excludeFields = new Set([
        'Title', 'FileLeafRef', 'FileRef', 'FileDirRef', 'ContentType',
        'Created', 'Modified', 'Author', 'Editor', 'CheckoutUser',
        '_ModerationStatus', '_ModerationComments', 'LinkTitle', 'LinkTitleNoMenu',
        'Edit', 'DocIcon', 'ServerUrl', 'EncodedAbsUrl', 'BaseName',
        'FileSizeDisplay', 'ItemChildCount', 'FolderChildCount', 'Attachments',
        'BannerImageUrl', 'Description', 'CanvasContent1', 'LayoutWebpartsContent',
        'PageLayoutType', 'FirstPublishedDate', 'PromotedState', 'ClientSideApplicationId'
      ]);

      const customTokens: IMetadataToken[] = fields
        .filter(field => !excludeFields.has(field.InternalName))
        .map(field => ({
          id: `custom_${field.InternalName}`,
          label: field.Title || field.InternalName,
          valuePath: field.InternalName,
          type: this.mapSharePointTypeToTokenType(field.TypeAsString),
          category: 'custom' as MetadataTokenCategory,
          description: field.Description || `Custom field: ${field.Title}`,
          apiFieldName: field.InternalName,
          isCustomField: true
        }));

      this.cachedCustomFields = customTokens;
      return customTokens;

    } catch (error) {
      console.error('[PiCanvas] Error fetching custom fields:', error);
      return [];
    }
  }

  /**
   * Map SharePoint field type to token type
   */
  private mapSharePointTypeToTokenType(spType: string): IMetadataToken['type'] {
    switch (spType) {
      case 'DateTime':
        return 'date';
      case 'URL':
        return 'url';
      case 'User':
        return 'user';
      case 'Number':
      case 'Currency':
        return 'number';
      case 'Boolean':
        return 'boolean';
      case 'Note':
        return 'html';
      default:
        return 'string';
    }
  }

  /**
   * Substitute tokens in content with actual values
   */
  public async substituteTokens(
    content: string,
    options: ITokenSubstitutionOptions = {}
  ): Promise<string> {
    if (!content || typeof content !== 'string') {
      return content;
    }

    // Check if content contains any tokens
    if (!content.includes('{{')) {
      return content;
    }

    const metadata = await this.fetchPageMetadata();
    const {
      fallbackText = '',
      sanitizeHtml = true,
      dateFormat = 'medium',
      locale = 'en-US'
    } = options;

    return content.replace(TOKEN_PATTERN, (match, path, fallback) => {
      const trimmedPath = path.trim();
      const value = this.getValueByPath(metadata, trimmedPath);

      if (value === null || value === undefined || value === '') {
        return fallback?.trim() || fallbackText;
      }

      // Determine token type from path
      const token = this.findTokenByPath(trimmedPath);
      const tokenType = token?.type || 'string';

      // Format the value
      let formattedValue = this.formatTokenValue(value, tokenType, { dateFormat, locale });

      // Sanitize if needed
      if (sanitizeHtml && typeof formattedValue === 'string') {
        formattedValue = this.sanitizeHtml(formattedValue);
      }

      return formattedValue;
    });
  }

  /**
   * Substitute tokens synchronously using cached metadata
   * Use this when you need sync substitution and metadata has been pre-fetched
   * Returns content unchanged if metadata not cached
   */
  public substituteTokensSync(
    content: string,
    options: ITokenSubstitutionOptions = {}
  ): string {
    if (!content || typeof content !== 'string') {
      return content;
    }

    // Check if content contains any tokens
    if (!content.includes('{{')) {
      return content;
    }

    // Return unchanged if metadata not cached
    if (!this.cachedMetadata) {
      console.warn('[MetadataTokenService] Metadata not cached, tokens will not be substituted. Call fetchPageMetadata() first.');
      return content;
    }

    const metadata = this.cachedMetadata;
    const {
      fallbackText = '',
      sanitizeHtml = true,
      dateFormat = 'medium',
      locale = 'en-US'
    } = options;

    return content.replace(TOKEN_PATTERN, (match, path, fallback) => {
      const trimmedPath = path.trim();
      const value = this.getValueByPath(metadata, trimmedPath);

      if (value === null || value === undefined || value === '') {
        return fallback?.trim() || fallbackText;
      }

      // Determine token type from path
      const token = this.findTokenByPath(trimmedPath);
      const tokenType = token?.type || 'string';

      // Format the value
      let formattedValue = this.formatTokenValue(value, tokenType, { dateFormat, locale });

      // Sanitize if needed
      if (sanitizeHtml && typeof formattedValue === 'string') {
        formattedValue = this.sanitizeHtml(formattedValue);
      }

      return formattedValue;
    });
  }

  /**
   * Get value from object by dot-notation path
   */
  private getValueByPath(obj: Record<string, unknown>, path: string): unknown {
    if (!obj || !path) return undefined;

    return path.split('.').reduce((current: unknown, prop: string) => {
      if (current === null || current === undefined) return undefined;
      return (current as Record<string, unknown>)[prop];
    }, obj);
  }

  /**
   * Find a token definition by its value path
   */
  private findTokenByPath(path: string): IMetadataToken | undefined {
    const allBuiltIn = getAllBuiltInTokens();
    return allBuiltIn.find(t => t.valuePath === path) ||
           this.cachedCustomFields?.find(t => t.valuePath === path);
  }

  /**
   * Format token value based on type
   */
  private formatTokenValue(
    value: unknown,
    type: IMetadataToken['type'],
    options: { dateFormat?: string; locale?: string } = {}
  ): string {
    if (value === null || value === undefined) {
      return '';
    }

    switch (type) {
      case 'date':
        return this.formatDate(value, options.dateFormat, options.locale);

      case 'url':
        return String(value);

      case 'user':
        if (typeof value === 'object' && value !== null) {
          return (value as { Title?: string }).Title || String(value);
        }
        return String(value);

      case 'number':
        if (typeof value === 'number') {
          return value.toLocaleString();
        }
        return String(value);

      case 'boolean':
        return value ? 'Yes' : 'No';

      case 'html':
        // HTML values are returned as-is (will be sanitized later if needed)
        return String(value);

      case 'string':
      default:
        return String(value);
    }
  }

  /**
   * Format date value
   */
  private formatDate(
    value: unknown,
    format: string = 'medium',
    locale: string = 'en-US'
  ): string {
    try {
      const date = new Date(value as string);
      if (isNaN(date.getTime())) {
        return String(value);
      }

      const formatOptions: Record<string, Intl.DateTimeFormatOptions> = {
        short: { month: 'numeric', day: 'numeric', year: '2-digit' },
        medium: { month: 'short', day: 'numeric', year: 'numeric' },
        long: { month: 'long', day: 'numeric', year: 'numeric', weekday: 'long' },
        iso: {} // Will use toISOString instead
      };

      if (format === 'iso') {
        return date.toISOString().split('T')[0];
      }

      return date.toLocaleDateString(locale, formatOptions[format] || formatOptions.medium);
    } catch {
      return String(value);
    }
  }

  /**
   * Basic HTML sanitization
   */
  private sanitizeHtml(html: string): string {
    if (!html) return '';
    const div = document.createElement('div');
    div.textContent = html;
    return div.innerHTML;
  }

  /**
   * Clear cached metadata (call when page changes)
   */
  public clearCache(): void {
    this.cachedMetadata = null;
    this.cachedCustomFields = null;
    this.metadataFetchPromise = null;
  }

  /**
   * Check if content contains any tokens
   */
  public static hasTokens(content: string): boolean {
    return content?.includes('{{') || false;
  }

  /**
   * Extract all token paths from content
   */
  public static extractTokenPaths(content: string): string[] {
    if (!content) return [];

    const tokens: string[] = [];
    const regex = new RegExp(TOKEN_PATTERN.source, 'g');
    let match;

    while ((match = regex.exec(content)) !== null) {
      tokens.push(match[1].trim());
    }

    return [...new Set(tokens)]; // Remove duplicates
  }
}
