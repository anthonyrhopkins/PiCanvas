/**
 * PiCanvas Metadata Token Models
 * Defines interfaces and token definitions for page metadata interpolation
 */

/**
 * Data type for a metadata token value
 */
export type MetadataTokenType = 'string' | 'date' | 'url' | 'html' | 'user' | 'number' | 'boolean';

/**
 * Category for organizing metadata tokens
 */
export type MetadataTokenCategory = 'page' | 'site' | 'people' | 'dates' | 'custom';

/**
 * Individual metadata token definition
 */
export interface IMetadataToken {
  /** Unique identifier for the token */
  id: string;
  /** Human-readable label */
  label: string;
  /** Dot-notation path to value (e.g., "page.Title", "Author.Title") */
  valuePath: string;
  /** Data type for rendering */
  type: MetadataTokenType;
  /** Category for UI grouping */
  category: MetadataTokenCategory;
  /** Description of what this token represents */
  description: string;
  /** Example value for preview */
  exampleValue?: string;
  /** REST API field name (internal name) */
  apiFieldName: string;
  /** Whether this is a custom field (dynamically discovered) */
  isCustomField?: boolean;
}

/**
 * Resolved metadata values from the page
 */
export interface IPageMetadata {
  // Page properties
  Title?: string;
  Description?: string;
  BannerImageUrl?: string;
  CanvasContent1?: string;
  PageLayoutType?: string;

  // People
  Author?: {
    Title?: string;
    EMail?: string;
    Id?: number;
  };
  Editor?: {
    Title?: string;
    EMail?: string;
    Id?: number;
  };
  CheckoutUser?: {
    Title?: string;
    EMail?: string;
  };

  // Dates
  Created?: string;
  Modified?: string;
  FirstPublishedDate?: string;

  // Site context
  SiteTitle?: string;
  SiteUrl?: string;
  WebTitle?: string;
  WebUrl?: string;

  // System
  Id?: number;
  FileRef?: string;
  FileDirRef?: string;
  FileLeafRef?: string;
  UniqueId?: string;

  // Custom fields (dynamically added)
  [key: string]: unknown;
}

/**
 * Token with resolved current value
 */
export interface IResolvedToken extends IMetadataToken {
  /** Current value from the page */
  currentValue?: string;
  /** Whether the value could be resolved */
  hasValue: boolean;
}

/**
 * Built-in SharePoint page metadata tokens
 * Organized by category for easy discovery
 */
export const SHAREPOINT_PAGE_TOKENS: Record<MetadataTokenCategory, IMetadataToken[]> = {
  page: [
    {
      id: 'pageTitle',
      label: 'Page Title',
      valuePath: 'Title',
      type: 'string',
      category: 'page',
      description: 'The title of the SharePoint page',
      apiFieldName: 'Title',
      exampleValue: 'Welcome to Our Site'
    },
    {
      id: 'pageDescription',
      label: 'Page Description',
      valuePath: 'Description',
      type: 'string',
      category: 'page',
      description: 'The description/summary of the page',
      apiFieldName: 'Description',
      exampleValue: 'This page contains important information...'
    },
    {
      id: 'bannerImageUrl',
      label: 'Banner Image URL',
      valuePath: 'BannerImageUrl',
      type: 'url',
      category: 'page',
      description: 'URL of the page banner image',
      apiFieldName: 'BannerImageUrl',
      exampleValue: '/sites/team/SiteAssets/banner.jpg'
    },
    {
      id: 'pageLayoutType',
      label: 'Page Layout',
      valuePath: 'PageLayoutType',
      type: 'string',
      category: 'page',
      description: 'The layout type of the page (Article, Home, etc.)',
      apiFieldName: 'PageLayoutType',
      exampleValue: 'Article'
    },
    {
      id: 'fileRef',
      label: 'Page URL Path',
      valuePath: 'FileRef',
      type: 'url',
      category: 'page',
      description: 'Server-relative URL of the page',
      apiFieldName: 'FileRef',
      exampleValue: '/sites/team/SitePages/Home.aspx'
    },
    {
      id: 'fileName',
      label: 'Page File Name',
      valuePath: 'FileLeafRef',
      type: 'string',
      category: 'page',
      description: 'File name of the page',
      apiFieldName: 'FileLeafRef',
      exampleValue: 'Home.aspx'
    }
  ],

  people: [
    {
      id: 'authorName',
      label: 'Author Name',
      valuePath: 'Author.Title',
      type: 'user',
      category: 'people',
      description: 'Display name of the page author',
      apiFieldName: 'Author/Title',
      exampleValue: 'John Smith'
    },
    {
      id: 'authorEmail',
      label: 'Author Email',
      valuePath: 'Author.EMail',
      type: 'string',
      category: 'people',
      description: 'Email address of the page author',
      apiFieldName: 'Author/EMail',
      exampleValue: 'john.smith@company.com'
    },
    {
      id: 'editorName',
      label: 'Last Editor Name',
      valuePath: 'Editor.Title',
      type: 'user',
      category: 'people',
      description: 'Display name of the last person who edited the page',
      apiFieldName: 'Editor/Title',
      exampleValue: 'Jane Doe'
    },
    {
      id: 'editorEmail',
      label: 'Last Editor Email',
      valuePath: 'Editor.EMail',
      type: 'string',
      category: 'people',
      description: 'Email address of the last editor',
      apiFieldName: 'Editor/EMail',
      exampleValue: 'jane.doe@company.com'
    }
  ],

  dates: [
    {
      id: 'createdDate',
      label: 'Created Date',
      valuePath: 'Created',
      type: 'date',
      category: 'dates',
      description: 'Date and time when the page was created',
      apiFieldName: 'Created',
      exampleValue: 'January 15, 2026'
    },
    {
      id: 'modifiedDate',
      label: 'Last Modified Date',
      valuePath: 'Modified',
      type: 'date',
      category: 'dates',
      description: 'Date and time when the page was last modified',
      apiFieldName: 'Modified',
      exampleValue: 'January 20, 2026'
    },
    {
      id: 'publishedDate',
      label: 'First Published Date',
      valuePath: 'FirstPublishedDate',
      type: 'date',
      category: 'dates',
      description: 'Date when the page was first published',
      apiFieldName: 'FirstPublishedDate',
      exampleValue: 'January 16, 2026'
    }
  ],

  site: [
    {
      id: 'siteTitle',
      label: 'Site Title',
      valuePath: 'SiteTitle',
      type: 'string',
      category: 'site',
      description: 'Title of the SharePoint site',
      apiFieldName: '_context.site.title',
      exampleValue: 'Marketing Team'
    },
    {
      id: 'siteUrl',
      label: 'Site URL',
      valuePath: 'SiteUrl',
      type: 'url',
      category: 'site',
      description: 'Full URL of the SharePoint site',
      apiFieldName: '_context.site.absoluteUrl',
      exampleValue: 'https://company.sharepoint.com/sites/marketing'
    },
    {
      id: 'webTitle',
      label: 'Web Title',
      valuePath: 'WebTitle',
      type: 'string',
      category: 'site',
      description: 'Title of the current web (subsite)',
      apiFieldName: '_context.web.title',
      exampleValue: 'Marketing Team'
    },
    {
      id: 'webUrl',
      label: 'Web URL',
      valuePath: 'WebUrl',
      type: 'url',
      category: 'site',
      description: 'Server-relative URL of the current web',
      apiFieldName: '_context.web.serverRelativeUrl',
      exampleValue: '/sites/marketing'
    }
  ],

  custom: [
    // Custom fields are dynamically discovered from the Site Pages library
    // This array will be populated at runtime
  ]
};

/**
 * Get all built-in tokens as a flat array
 */
export function getAllBuiltInTokens(): IMetadataToken[] {
  return Object.values(SHAREPOINT_PAGE_TOKENS).flat();
}

/**
 * Get tokens by category
 */
export function getTokensByCategory(category: MetadataTokenCategory): IMetadataToken[] {
  return SHAREPOINT_PAGE_TOKENS[category] || [];
}

/**
 * Find a token by its ID
 */
export function getTokenById(tokenId: string): IMetadataToken | undefined {
  return getAllBuiltInTokens().find(t => t.id === tokenId);
}

/**
 * Generate the token syntax for insertion
 */
export function getTokenSyntax(token: IMetadataToken): string {
  return `{{${token.valuePath}}}`;
}

/**
 * Token regex pattern for matching tokens in content
 * Matches: {{valuePath}}, {{ valuePath }}, {{valuePath|fallback}}
 */
export const TOKEN_PATTERN = /\{\{\s*([^}|]+?)(?:\s*\|\s*([^}]*))?\s*\}\}/g;

/**
 * Category display names and icons
 */
export const TOKEN_CATEGORY_INFO: Record<MetadataTokenCategory, { label: string; icon: string; description: string }> = {
  page: {
    label: 'Page',
    icon: 'Page',
    description: 'Page title, description, and properties'
  },
  people: {
    label: 'People',
    icon: 'People',
    description: 'Author, editor, and user information'
  },
  dates: {
    label: 'Dates',
    icon: 'Calendar',
    description: 'Created, modified, and published dates'
  },
  site: {
    label: 'Site',
    icon: 'Globe',
    description: 'Site and web information'
  },
  custom: {
    label: 'Custom Fields',
    icon: 'Tag',
    description: 'Custom metadata columns from Site Pages library'
  }
};
