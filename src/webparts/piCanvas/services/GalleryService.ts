/**
 * GalleryService
 * Fetches images with rich metadata from a SharePoint document library.
 * Uses list items API to access all custom columns (AI tags, SAP DAM fields).
 * Supports cross-site calls within the same tenant via spHttpClient.
 */

import { SPHttpClient, SPHttpClientResponse } from '@microsoft/sp-http';
import { WebPartContext } from '@microsoft/sp-webpart-base';

// Rich metadata from AI analysis
export interface IGalleryAIMetadata {
  altText: string;
  summary: string;
  mood: string;
  style: string;
  lighting: string;
  composition: string;
  useCases: string;
  technicalAspects: string;
  overallNarrative: string;
  compatibility: string;
  containsHumans: boolean;
  textPresence: string;
  imageTypes: string[];
  artisticStyles: string[];
  colorTags: string[];
  primaryColors: string[];
  primaryCategories: string[];
  subCategories: string[];
  suggestedKeywords: string[];
  keyObjects: string;
}

// SAP DAM metadata
export interface IGallerySAPMetadata {
  assetId: string;
  tags: string;
  imageType: string;
  orientation: string;
  mood: string;
  objects: string;
  location: string;
  themes: string;
  event: string;
  genre: string;
  rights: string;
  permissions: string;
  expiryDate: string;
  restricted: boolean;
  peopleAge: string;
  peopleEthnicity: string;
  peopleGender: string;
  peopleRole: string;
  industry: string;
  lineOfBusiness: string;
  iconCategory: string;
  region: string;
  photographer: string;
  producer: string;
  gettyId: string;
  adobeId: string;
  importedAt: string;
  modifiedAt: string;
  workflowStatus: string;
  approvalState: string;
  notes: string;
  downloadUrls: string;
  fileSize: string;
  oldId: string;
}

export interface IGalleryImage {
  id: number;
  name: string;
  serverRelativeUrl: string;
  absoluteUrl: string;
  thumbnailUrl: string;
  size: number;
  modified: string;
  title: string;
  description: string;
  extension: string;
  folderPath: string;
  ai: IGalleryAIMetadata;
  sap: IGallerySAPMetadata;
  // Computed search index
  searchText: string;
}

export interface IGalleryFolder {
  name: string;
  serverRelativeUrl: string;
  itemCount: number;
}

export interface IGalleryFetchResult {
  images: IGalleryImage[];
  folders: IGalleryFolder[];
  currentPath: string;
  parentPath: string | null;
}

export interface IGalleryConfig {
  siteUrl: string;
  libraryPath: string;
  layout: 'grid' | 'masonry' | 'justified' | 'list';
  columns: number;
  imageSize: 'small' | 'medium' | 'large';
  showFilenames: boolean;
  showDates: boolean;
  showSizes: boolean;
  enableSearch: boolean;
  enableFolders: boolean;
  sortBy: 'name' | 'date' | 'size';
  sortOrder: 'asc' | 'desc';
  theme: 'light' | 'dark' | 'auto';
  maxImages: number;
}

// Facet data for filter sidebar
export interface IGalleryFacets {
  categories: Map<string, number>;
  imageTypes: Map<string, number>;
  colors: Map<string, number>;
  orientations: Map<string, number>;
  keywords: Map<string, number>;
  events: Map<string, number>;
  industries: Map<string, number>;
  regions: Map<string, number>;
}

const IMAGE_EXTENSIONS = new Set([
  'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'ico', 'tiff', 'tif', 'avif'
]);

// Select fields for the list items query (all metadata columns)
const SELECT_FIELDS = [
  'Id', 'FileLeafRef', 'FileRef', 'File_x0020_Size', 'Modified', 'Title',
  '_ExtendedDescription',
  // AI fields
  'ai__accessibility_alt_text', 'ai__summary_description', 'ai__mood_tone',
  'ai__style', 'ai__lighting', 'ai__composition', 'ai__potential_use_cases',
  'ai__technical_aspects', 'ai__overall_message_narrative', 'ai__compatibility',
  'ai__contains_human_elements', 'ai__text_presence', 'ai__image_type',
  'ai__artistic_style', 'ai__color_tags', 'ai__primary_colors',
  'ai__primary_category', 'ai__sub_categories', 'ai__suggested_keywords',
  'ai__key_objects_subjects',
  // SAP DAM fields
  'SAP_AssetID', 'SAP_Tags', 'SAP_ImageType', 'SAP_Orientation',
  'SAP_Mood', 'SAP_Objects', 'SAP_Location', 'SAP_Themes',
  'SAP_Event', 'SAP_Genre', 'SAP_Rights', 'SAP_Permissions',
  'SAP_ExpiryDate', 'SAP_Restricted', 'SAP_PeopleAge', 'SAP_PeopleEthnicity',
  'SAP_PeopleGender', 'SAP_PeopleRole', 'SAP_Industry', 'SAP_LineOfBusiness',
  'SAP_IconCategory', 'SAP_Region', 'SAP_Photographer', 'SAP_Producer',
  'SAP_GettyID', 'SAP_AdobeID', 'SAP_ImportedAt', 'SAP_ModifiedAt',
  'SAP_WorkflowStatus', 'SAP_ApprovalState', 'SAP_Notes',
  'SAP_DownloadURLs', 'SAP_FileSize', 'SAP_OldID'
].join(',');

export class GalleryService {
  constructor(private context: WebPartContext) {}

  private resolveSiteUrl(siteUrl: string): string {
    if (siteUrl) return siteUrl.replace(/\/+$/, '');
    return this.context.pageContext.web.absoluteUrl;
  }

  public resolveLibraryPath(siteUrl: string, libraryPath: string): string {
    if (libraryPath.startsWith('/')) return libraryPath;
    try {
      const url = new URL(siteUrl || this.context.pageContext.web.absoluteUrl);
      return `${url.pathname.replace(/\/+$/, '')}/${libraryPath}`;
    } catch {
      return `${this.context.pageContext.web.serverRelativeUrl.replace(/\/+$/, '')}/${libraryPath}`;
    }
  }

  /**
   * Fetch ALL images from the library with full metadata.
   * Uses list items API with @odata.nextLink pagination for >5000 items.
   */
  public async fetchAllImagesWithMetadata(
    siteUrl: string,
    libraryPath: string
  ): Promise<IGalleryImage[]> {
    const resolvedSiteUrl = this.resolveSiteUrl(siteUrl);
    // Extract just the library name from the path
    const libraryName = libraryPath.replace(/^\/.*\//, '').replace(/\/$/, '');

    const allImages: IGalleryImage[] = [];
    let apiUrl = `${resolvedSiteUrl}/_api/web/lists/getbytitle('${encodeURIComponent(libraryName)}')/items?$select=${SELECT_FIELDS}&$top=5000`;

    let pageCount = 0;
    while (apiUrl) {
      pageCount++;
      console.log(`[GalleryService] Fetching page ${pageCount}...`);

      try {
        const response: SPHttpClientResponse = await this.context.spHttpClient.get(
          apiUrl,
          SPHttpClient.configurations.v1,
          { headers: { 'Accept': 'application/json;odata=nometadata' } }
        );

        if (!response.ok) {
          console.warn(`GalleryService: List items request failed: ${response.status}`);
          // Fallback to file-based fetch if list query fails
          if (pageCount === 1) {
            console.log('[GalleryService] Falling back to folder-based file fetch...');
            return this.fetchAllImagesFallback(siteUrl, libraryPath);
          }
          break;
        }

        const data = await response.json();
        const items = data.value || [];

        for (const item of items) {
          const name: string = item.FileLeafRef || '';
          const ext = name.split('.').pop()?.toLowerCase() || '';
          if (!IMAGE_EXTENSIONS.has(ext)) continue;

          const serverRelativeUrl: string = item.FileRef || '';
          const origin = new URL(resolvedSiteUrl).origin;
          const basePath = this.resolveLibraryPath(siteUrl, libraryPath);
          const folderPath = serverRelativeUrl.substring(0, serverRelativeUrl.lastIndexOf('/'));
          const relativeFolderPath = folderPath.startsWith(basePath)
            ? folderPath.substring(basePath.length).replace(/^\//, '')
            : '';

          const ai = this.parseAIMetadata(item);
          const sap = this.parseSAPMetadata(item);

          // Build search text for instant filtering
          const searchParts = [
            name, item.Title || '', item._ExtendedDescription || '',
            ai.altText, ai.summary, ai.keyObjects, ai.mood,
            ...ai.suggestedKeywords, ...ai.primaryCategories, ...ai.subCategories,
            ...ai.imageTypes, ...ai.colorTags,
            sap.tags, sap.event, sap.location, sap.themes,
            sap.industry, sap.region, sap.photographer, sap.genre,
            sap.objects, sap.mood, relativeFolderPath
          ].filter(Boolean);

          allImages.push({
            id: item.Id,
            name,
            serverRelativeUrl,
            absoluteUrl: `${origin}${serverRelativeUrl}`,
            thumbnailUrl: `${resolvedSiteUrl}/_layouts/15/getpreview.ashx?path=${encodeURIComponent(serverRelativeUrl)}&resolution=6`,
            size: parseInt(item.File_x0020_Size, 10) || 0,
            modified: item.Modified || '',
            title: item.Title || name,
            description: item._ExtendedDescription || '',
            extension: ext,
            folderPath: relativeFolderPath,
            ai,
            sap,
            searchText: searchParts.join(' ').toLowerCase()
          });
        }

        // Follow pagination link
        apiUrl = data['@odata.nextLink'] || data['odata.nextLink'] || '';
      } catch (error) {
        console.error('GalleryService: Error fetching list items page:', error);
        break;
      }
    }

    console.log(`[GalleryService] Fetched ${allImages.length} images across ${pageCount} pages`);
    return allImages;
  }

  /**
   * Fallback: fetch images via folder/files API (no metadata).
   */
  private async fetchAllImagesFallback(siteUrl: string, libraryPath: string): Promise<IGalleryImage[]> {
    const resolvedSiteUrl = this.resolveSiteUrl(siteUrl);
    const basePath = this.resolveLibraryPath(siteUrl, libraryPath);
    return this.fetchFilesRecursive(resolvedSiteUrl, basePath);
  }

  private async fetchFilesRecursive(siteUrl: string, folderPath: string): Promise<IGalleryImage[]> {
    const [files, folders] = await Promise.all([
      this.fetchFiles(siteUrl, folderPath),
      this.fetchFolders(siteUrl, folderPath)
    ]);
    const subResults = await Promise.all(
      folders.map(f => this.fetchFilesRecursive(siteUrl, f.serverRelativeUrl))
    );
    return [...files, ...subResults.flat()];
  }

  private async fetchFiles(siteUrl: string, folderPath: string): Promise<IGalleryImage[]> {
    const encodedPath = encodeURIComponent(folderPath);
    const apiUrl = `${siteUrl}/_api/web/GetFolderByServerRelativeUrl('${encodedPath}')/Files?$select=Name,ServerRelativeUrl,Length,TimeLastModified,Title&$top=5000`;
    try {
      const response = await this.context.spHttpClient.get(apiUrl, SPHttpClient.configurations.v1,
        { headers: { 'Accept': 'application/json;odata=nometadata' } });
      if (!response.ok) return [];
      const data = await response.json();
      const files: IGalleryImage[] = [];
      const origin = new URL(siteUrl).origin;
      for (const item of (data.value || [])) {
        const name: string = item.Name || '';
        const ext = name.split('.').pop()?.toLowerCase() || '';
        if (!IMAGE_EXTENSIONS.has(ext)) continue;
        const serverRelativeUrl: string = item.ServerRelativeUrl || '';
        files.push({
          id: 0, name, serverRelativeUrl,
          absoluteUrl: `${origin}${serverRelativeUrl}`,
          thumbnailUrl: `${siteUrl}/_layouts/15/getpreview.ashx?path=${encodeURIComponent(serverRelativeUrl)}&resolution=6`,
          size: parseInt(item.Length, 10) || 0,
          modified: item.TimeLastModified || '',
          title: item.Title || name, description: '', extension: ext,
          folderPath: '',
          ai: this.emptyAI(), sap: this.emptySAP(),
          searchText: name.toLowerCase()
        });
      }
      return files;
    } catch { return []; }
  }

  public async fetchFolders(siteUrl: string, folderPath: string): Promise<IGalleryFolder[]> {
    const resolvedSiteUrl = this.resolveSiteUrl(siteUrl);
    const encodedPath = encodeURIComponent(folderPath);
    const apiUrl = `${resolvedSiteUrl}/_api/web/GetFolderByServerRelativeUrl('${encodedPath}')/Folders?$select=Name,ServerRelativeUrl,ItemCount&$filter=Name ne 'Forms'&$top=500`;
    try {
      const response = await this.context.spHttpClient.get(apiUrl, SPHttpClient.configurations.v1,
        { headers: { 'Accept': 'application/json;odata=nometadata' } });
      if (!response.ok) return [];
      const data = await response.json();
      return (data.value || []).map((item: { Name: string; ServerRelativeUrl: string; ItemCount: number }) => ({
        name: item.Name || '', serverRelativeUrl: item.ServerRelativeUrl || '', itemCount: item.ItemCount || 0
      }));
    } catch { return []; }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private parseAIMetadata(item: any): IGalleryAIMetadata {
    const parseMultiChoice = (val: unknown): string[] => {
      if (!val) return [];
      if (Array.isArray(val)) return val.map(String);
      if (typeof val === 'string') {
        if (val.startsWith('[')) { try { return JSON.parse(val); } catch { /* fall through */ } }
        return val.split(';').map(s => s.trim()).filter(Boolean);
      }
      return [];
    };

    return {
      altText: item.ai__accessibility_alt_text || '',
      summary: item.ai__summary_description || '',
      mood: item.ai__mood_tone || '',
      style: item.ai__style || '',
      lighting: item.ai__lighting || '',
      composition: item.ai__composition || '',
      useCases: item.ai__potential_use_cases || '',
      technicalAspects: item.ai__technical_aspects || '',
      overallNarrative: item.ai__overall_message_narrative || '',
      compatibility: item.ai__compatibility || '',
      containsHumans: item.ai__contains_human_elements === true,
      textPresence: item.ai__text_presence || '',
      imageTypes: parseMultiChoice(item.ai__image_type),
      artisticStyles: parseMultiChoice(item.ai__artistic_style),
      colorTags: parseMultiChoice(item.ai__color_tags),
      primaryColors: parseMultiChoice(item.ai__primary_colors),
      primaryCategories: parseMultiChoice(item.ai__primary_category),
      subCategories: parseMultiChoice(item.ai__sub_categories),
      suggestedKeywords: parseMultiChoice(item.ai__suggested_keywords),
      keyObjects: item.ai__key_objects_subjects || ''
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private parseSAPMetadata(item: any): IGallerySAPMetadata {
    return {
      assetId: item.SAP_AssetID || '',
      tags: item.SAP_Tags || '',
      imageType: item.SAP_ImageType || '',
      orientation: item.SAP_Orientation || '',
      mood: item.SAP_Mood || '',
      objects: item.SAP_Objects || '',
      location: item.SAP_Location || '',
      themes: item.SAP_Themes || '',
      event: item.SAP_Event || '',
      genre: item.SAP_Genre || '',
      rights: item.SAP_Rights || '',
      permissions: item.SAP_Permissions || '',
      expiryDate: item.SAP_ExpiryDate || '',
      restricted: item.SAP_Restricted === true,
      peopleAge: item.SAP_PeopleAge || '',
      peopleEthnicity: item.SAP_PeopleEthnicity || '',
      peopleGender: item.SAP_PeopleGender || '',
      peopleRole: item.SAP_PeopleRole || '',
      industry: item.SAP_Industry || '',
      lineOfBusiness: item.SAP_LineOfBusiness || '',
      iconCategory: item.SAP_IconCategory || '',
      region: item.SAP_Region || '',
      photographer: item.SAP_Photographer || '',
      producer: item.SAP_Producer || '',
      gettyId: item.SAP_GettyID || '',
      adobeId: item.SAP_AdobeID || '',
      importedAt: item.SAP_ImportedAt || '',
      modifiedAt: item.SAP_ModifiedAt || '',
      workflowStatus: item.SAP_WorkflowStatus || '',
      approvalState: item.SAP_ApprovalState || '',
      notes: item.SAP_Notes || '',
      downloadUrls: item.SAP_DownloadURLs || '',
      fileSize: item.SAP_FileSize || '',
      oldId: item.SAP_OldID || ''
    };
  }

  private emptyAI(): IGalleryAIMetadata {
    return {
      altText: '', summary: '', mood: '', style: '', lighting: '', composition: '',
      useCases: '', technicalAspects: '', overallNarrative: '', compatibility: '',
      containsHumans: false, textPresence: '',
      imageTypes: [], artisticStyles: [], colorTags: [], primaryColors: [],
      primaryCategories: [], subCategories: [], suggestedKeywords: [], keyObjects: ''
    };
  }

  private emptySAP(): IGallerySAPMetadata {
    return {
      assetId: '', tags: '', imageType: '', orientation: '', mood: '', objects: '',
      location: '', themes: '', event: '', genre: '', rights: '', permissions: '',
      expiryDate: '', restricted: false, peopleAge: '', peopleEthnicity: '',
      peopleGender: '', peopleRole: '', industry: '', lineOfBusiness: '',
      iconCategory: '', region: '', photographer: '', producer: '', gettyId: '',
      adobeId: '', importedAt: '', modifiedAt: '', workflowStatus: '',
      approvalState: '', notes: '', downloadUrls: '', fileSize: '', oldId: ''
    };
  }

  /**
   * Build facet data for filter sidebar.
   */
  public static buildFacets(images: IGalleryImage[]): IGalleryFacets {
    const facets: IGalleryFacets = {
      categories: new Map(), imageTypes: new Map(), colors: new Map(),
      orientations: new Map(), keywords: new Map(), events: new Map(),
      industries: new Map(), regions: new Map()
    };

    const inc = (map: Map<string, number>, key: string): void => {
      if (!key) return;
      map.set(key, (map.get(key) || 0) + 1);
    };

    for (const img of images) {
      img.ai.primaryCategories.forEach(c => inc(facets.categories, c));
      img.ai.imageTypes.forEach(t => inc(facets.imageTypes, t));
      img.ai.primaryColors.forEach(c => inc(facets.colors, c));
      img.ai.suggestedKeywords.forEach(k => inc(facets.keywords, k));
      if (img.sap.orientation) inc(facets.orientations, img.sap.orientation);
      if (img.sap.event) inc(facets.events, img.sap.event);
      if (img.sap.industry) inc(facets.industries, img.sap.industry);
      if (img.sap.region) inc(facets.regions, img.sap.region);
    }

    return facets;
  }

  public static formatSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  public static formatDate(dateStr: string): string {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch { return dateStr; }
  }
}
