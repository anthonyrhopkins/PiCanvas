/**
 * ProfileReportService
 * Fetches company data from either a Pi_Companies SharePoint list (preferred)
 * or by scanning a document library's condensed/ folder (legacy fallback).
 * Loads company profile files on demand — one company at a time.
 */

import { SPHttpClient } from '@microsoft/sp-http';
import { WebPartContext } from '@microsoft/sp-webpart-base';
import { ICompanyProfile, ICompanyEntry, IMetadataFileEntry } from './ContentRenderer';
// Note: ICompanyIntel is still exported by ContentRenderer for use by the renderer itself
import { REPORT_TYPE_REGISTRY, resolveReportPath, IReportTypeDefinition } from '../data/ReportTypeRegistry';
import {
  ILibrarySource, IDiscoveredFile, ILabelHint, IDiscoveryColumnConfig,
  DEFAULT_LABEL_HINTS, fileNameToLabel, detectFormat, isIgnoredFile
} from '../data/DiscoveryTypes';

// Re-export so callers can import from either location
export type { ICompanyEntry } from './ContentRenderer';

export interface IMetadataDiscoveryConfig {
  companyColumn: string;          // e.g., "Pi_CompanyID"
  fileCategoryColumn: string;     // e.g., "FileCategory"
  visibilityColumn?: string;      // e.g., "ShowInProfile" — Yes/No column; only files where this is true are shown
  listSource?: string;            // e.g., "ProfileFiles" — if set, queries this SP list instead of the document library
}

export interface IMetadataFileInfo {
  name: string;
  serverRelativeUrl: string;
  category: string;
  title: string;
  modified: string;
  companyKey: string;
}

export interface IProfileFile {
  Name: string;
  ServerRelativeUrl: string;
  TimeCreated: string;
  CompanyKey: string;
  FileType: string;
  CompanyName: string;
}

export class ProfileReportService {
  private _folderCache: Map<string, IProfileFile[]> = new Map();

  constructor(private context: WebPartContext) {}

  /**
   * Get the library's server-relative path
   */
  private getLibraryPath(libraryName: string): string {
    const webServerRelativeUrl = this.context.pageContext.web.serverRelativeUrl;
    const base = webServerRelativeUrl.endsWith('/') ? webServerRelativeUrl : webServerRelativeUrl + '/';
    return base + libraryName;
  }

  /**
   * Fetch the company list.
   * If listName is provided, queries the Pi_Companies SharePoint list.
   * Otherwise, falls back to scanning the condensed/ folder in the library.
   */
  public async fetchCompanyList(libraryName: string, listName?: string): Promise<ICompanyEntry[]> {
    if (this.detectWorkbenchEnvironment()) {
      console.warn('ProfileReportService: Skipping API call in workbench environment');
      return [];
    }

    // Prefer list-based query if a list name is provided
    if (listName) {
      return this.fetchCompanyListFromList(listName);
    }

    // Legacy fallback: scan condensed/ folder
    return this.fetchCompanyListFromFolder(libraryName);
  }

  /**
   * Query the Pi_Companies SharePoint list for all companies.
   * Uses $top=5000 with @odata.nextLink pagination to handle 22K+ items.
   */
  private async fetchCompanyListFromList(listName: string): Promise<ICompanyEntry[]> {
    const sanitized = this.sanitizeLibraryName(listName);
    if (!sanitized) throw new Error('Invalid list name');

    const siteUrl = this.context.pageContext.web.absoluteUrl;
    const selectFields = 'Id,Title,CompanyID,CompanyDomain,Ticker,Industry,Sector,Revenue,Employees,AccountOwner,OwnerEmail,OwnerRegion,Status,SearchTerms,Headquarters,Founded,LegalName,SubIndustry,LogoUrl';
    // Note: $orderby is omitted to avoid the list view threshold on large lists (>5000 items).
    // Results are sorted client-side after all pages are fetched.
    const firstUrl = `${siteUrl}/_api/web/lists/getbytitle('${sanitized}')/items` +
      `?$select=${selectFields}&$top=5000`;

    try {
      const allItems: any[] = [];
      let nextUrl: string | null = firstUrl;
      let page = 0;
      const maxPages = 10; // Safety limit: 50,000 items max

      while (nextUrl && page < maxPages) {
        const response = await this.context.spHttpClient.get(
          nextUrl,
          SPHttpClient.configurations.v1,
          { headers: { 'Accept': 'application/json;odata.metadata=minimal' } }
        );

        if (!response.ok) {
          if (page === 0) {
            const errorText = await response.text();
            console.error(`ProfileReportService: Pi_Companies list error ${response.status}:`, errorText);
            throw new Error(`Unable to access list "${listName}". Please check that the list exists and has the required columns.`);
          }
          break;
        }

        const data = await response.json();
        if (data.value && data.value.length > 0) {
          allItems.push(...data.value);
        }

        nextUrl = data['odata.nextLink'] || data['@odata.nextLink'] || null;
        if (nextUrl && !nextUrl.startsWith('http')) {
          nextUrl = `${siteUrl}${nextUrl.startsWith('/') ? '' : '/'}${nextUrl}`;
        }

        page++;
        if (data.value && data.value.length > 0) {
          console.log(`ProfileReportService: List page ${page} (${allItems.length} items so far)`);
        }
      }

      if (allItems.length === 0) return [];

      return allItems
        .filter((item: any) => item.Title && item.CompanyDomain)
        .map((item: any) => ({
          domain: item.CompanyDomain || '',
          companyName: item.Title || '',
          jsonFileUrl: '', // Not used for list-based entries
          timeCreated: '',
          companyId: item.CompanyID ? Number(item.CompanyID) : undefined,
          spListItemId: item.Id ? Number(item.Id) : undefined,
          industry: item.Industry || undefined,
          sector: item.Sector || undefined,
          accountOwner: item.AccountOwner || undefined,
          ownerEmail: item.OwnerEmail || undefined,
          ownerRegion: item.OwnerRegion || undefined,
          ticker: item.Ticker || undefined,
          revenue: item.Revenue || undefined,
          employees: item.Employees || undefined,
          searchTerms: item.SearchTerms || undefined,
          headquarters: item.Headquarters || undefined,
          founded: item.Founded || undefined,
          legalName: item.LegalName || undefined,
          subIndustry: item.SubIndustry || undefined,
          status: item.Status || undefined,
          logoUrl: item.LogoUrl || undefined
        }))
        .sort((a, b) => a.companyName.localeCompare(b.companyName));

    } catch (error) {
      console.error('ProfileReportService: fetchCompanyListFromList error', error);
      throw new Error(`Unable to load company list from "${listName}". ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Legacy: Fetch the company list from the condensed/ folder.
   * Each .json file represents one company.
   */
  private async fetchCompanyListFromFolder(libraryName: string): Promise<ICompanyEntry[]> {
    const sanitized = this.sanitizeLibraryName(libraryName);
    if (!sanitized) throw new Error('Invalid library name');

    const libPath = this.getLibraryPath(sanitized);
    const siteUrl = this.context.pageContext.web.absoluteUrl;
    const folderPath = `${libPath}/condensed`;
    const firstUrl = `${siteUrl}/_api/web/GetFolderByServerRelativeUrl('${folderPath}')/Files` +
      `?$select=Name,ServerRelativeUrl,TimeCreated&$top=5000`;

    try {
      // Paginated fetch — handles libraries with >5000 files in condensed/
      const allFiles: any[] = [];
      let nextUrl: string | null = firstUrl;
      let page = 0;
      const maxPages = 10; // Safety limit: 50,000 files max

      while (nextUrl && page < maxPages) {
        const response = await this.context.spHttpClient.get(
          nextUrl,
          SPHttpClient.configurations.v1,
          { headers: { 'Accept': 'application/json;odata.metadata=minimal' } }
        );

        if (!response.ok) {
          if (page === 0) {
            const errorText = await response.text();
            console.error(`ProfileReportService: condensed folder error ${response.status}:`, errorText);
            throw new Error(`Unable to access "${libraryName}/condensed". Please check that the library exists.`);
          }
          break; // Non-first pages: stop paging on error
        }

        const data = await response.json();
        if (data.value && data.value.length > 0) {
          allFiles.push(...data.value);
        }

        // Check for next page link
        nextUrl = data['odata.nextLink'] || data['@odata.nextLink'] || null;
        if (nextUrl && !nextUrl.startsWith('http')) {
          nextUrl = `${siteUrl}${nextUrl.startsWith('/') ? '' : '/'}${nextUrl}`;
        }

        page++;
        if (data.value && data.value.length > 0) {
          console.log(`ProfileReportService: Fetched page ${page} (${allFiles.length} files so far)`);
        }
      }

      if (allFiles.length === 0) return [];

      return allFiles
        .filter((f: any) => f.Name && f.Name.endsWith('.json') && f.Name !== '.DS_Store')
        .map((f: any) => {
          const domain = f.Name.replace(/\.json$/i, '');
          const companyName = domain.replace(/\.(com|org|net|us|io|ai|dev|co|solutions)$/i, '');
          return {
            domain,
            companyName,
            jsonFileUrl: f.ServerRelativeUrl,
            timeCreated: f.TimeCreated || ''
          };
        })
        .sort((a: ICompanyEntry, b: ICompanyEntry) => a.companyName.localeCompare(b.companyName));

    } catch (error) {
      console.error('ProfileReportService: fetchCompanyListFromFolder error', error);
      throw new Error(`Unable to load company list from "${libraryName}". ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Load a single company's full profile on demand.
   * Called by WebPart when user clicks a company tab.
   */
  public async fetchCompanyProfile(
    libraryName: string,
    entry: ICompanyEntry,
    metadataConfig?: IMetadataDiscoveryConfig,
    pathOverrides?: Record<string, string>,
    librarySources?: ILibrarySource[],
    labelHints?: Record<string, ILabelHint>,
    columnConfig?: IDiscoveryColumnConfig
  ): Promise<ICompanyProfile> {
    return this.loadCompanyProfile(libraryName, entry, metadataConfig, pathOverrides, librarySources, labelHints, columnConfig);
  }

  /**
   * Load a single company's full profile.
   * Uses CompanyID-based file paths when available (list-based entries),
   * otherwise falls back to domain-based lookup (legacy folder entries).
   *
   * If `librarySources` is provided, uses discovery mode: scans `{domain}/` folders
   * and populates `profile.discoveredFiles` instead of fetching from the registry.
   */
  public async loadCompanyProfile(
    libraryName: string,
    entry: ICompanyEntry,
    metadataConfig?: IMetadataDiscoveryConfig,
    pathOverrides?: Record<string, string>,
    librarySources?: ILibrarySource[],
    labelHints?: Record<string, ILabelHint>,
    columnConfig?: IDiscoveryColumnConfig
  ): Promise<ICompanyProfile> {
    if (this.detectWorkbenchEnvironment()) {
      return { companyKey: entry.domain, companyName: entry.companyName, domain: entry.domain };
    }

    const sanitized = this.sanitizeLibraryName(libraryName);
    const libPath = this.getLibraryPath(sanitized);
    const companyDomain = entry.domain;
    const shortName = companyDomain.replace(/\.(com|org|net|us|io|ai|dev|co|solutions)$/i, '').toLowerCase();

    const profile: ICompanyProfile = {
      companyKey: companyDomain,
      companyName: entry.companyName || shortName,
      domain: companyDomain,
      companyId: entry.companyId,
      industry: entry.industry,
      sector: entry.sector,
      accountOwner: entry.accountOwner,
      ownerRegion: entry.ownerRegion,
      spListItemId: entry.spListItemId,
      headquarters: entry.headquarters,
      founded: entry.founded,
      legalName: entry.legalName,
      subIndustry: entry.subIndustry,
      status: entry.status,
      logoUrl: entry.logoUrl,
      ticker: entry.ticker,
      revenue: entry.revenue,
      employees: entry.employees,
    };

    // === Discovery mode: scan folders and return discovered files ===
    if (librarySources && librarySources.length > 0) {
      try {
        const discoveredFiles = await this.discoverCompanyFiles(librarySources, companyDomain, labelHints, columnConfig);
        if (discoveredFiles.length > 0) {
          profile.discoveredFiles = discoveredFiles;

          // Special handling: if condensed.json is among discovered files, fetch and parse it
          // for metrics and companyName (same as registry mode)
          const jsonFile = discoveredFiles.find(f => f.name === 'condensed.json');
          if (jsonFile) {
            try {
              const jsonContent = await this.fetchFileContentCrossSite(jsonFile.siteUrl, jsonFile.serverRelativeUrl);
              profile.profileJson = JSON.parse(jsonContent);
              if (profile.profileJson && typeof profile.profileJson === 'object') {
                if (profile.profileJson.company_name) {
                  profile.companyName = String(profile.profileJson.company_name);
                } else if (profile.profileJson.companyName) {
                  profile.companyName = String(profile.profileJson.companyName);
                }
                if (profile.profileJson.generated) {
                  profile.generated = new Date(profile.profileJson.generated);
                }
                const metrics = profile.profileJson.metrics;
                if (metrics && typeof metrics === 'object') {
                  profile.metrics = {
                    events: typeof metrics.events === 'number' ? metrics.events : 0,
                    entities: typeof metrics.entities === 'number' ? metrics.entities : 0,
                    relationships: typeof metrics.relationships === 'number' ? metrics.relationships : 0,
                    financials: typeof metrics.financials === 'number' ? metrics.financials : 0,
                    earnings: typeof metrics.earnings === 'number' ? metrics.earnings : 0,
                  };
                }
              }
            } catch (jsonError) {
              console.warn(`ProfileReportService: Failed to parse condensed.json for ${companyDomain}`, jsonError);
            }
          }
        }
      } catch (error) {
        console.warn(`ProfileReportService: Discovery scan failed for ${companyDomain}, falling through to registry`, error);
      }

      // If discovery found files, still fetch metadata files then return
      if (profile.discoveredFiles && profile.discoveredFiles.length > 0) {
        if (metadataConfig) {
          try {
            const metaFiles = await this.fetchMetadataFiles(sanitized, companyDomain, metadataConfig);
            if (metaFiles.length > 0) {
              profile.metadataFiles = metaFiles;
            }
          } catch (error) {
            console.warn(`ProfileReportService: Metadata file lookup failed for ${companyDomain}`, error);
          }
        }
        return profile;
      }
    }

    // === Registry mode (fallback): fetch all report types in parallel ===
    const pathCtx = {
      domain: companyDomain,
      companyId: entry.companyId,
      shortName,
    };

    const fetchResults = await Promise.allSettled(
      REPORT_TYPE_REGISTRY.map(async (rt) => {
        const content = await this.fetchReportContent(libPath, rt, pathCtx, pathOverrides?.[rt.id]);
        return { id: rt.id, content };
      })
    );

    for (const result of fetchResults) {
      if (result.status !== 'fulfilled' || !result.value.content) continue;
      const { id, content } = result.value;

      if (id === 'profileJson') {
        try {
          profile.profileJson = JSON.parse(content);
          if (profile.profileJson && typeof profile.profileJson === 'object') {
            if (profile.profileJson.company_name) {
              profile.companyName = String(profile.profileJson.company_name);
            } else if (profile.profileJson.companyName) {
              profile.companyName = String(profile.profileJson.companyName);
            }
            if (profile.profileJson.generated) {
              profile.generated = new Date(profile.profileJson.generated);
            }
            const metrics = profile.profileJson.metrics;
            if (metrics && typeof metrics === 'object') {
              profile.metrics = {
                events: typeof metrics.events === 'number' ? metrics.events : 0,
                entities: typeof metrics.entities === 'number' ? metrics.entities : 0,
                relationships: typeof metrics.relationships === 'number' ? metrics.relationships : 0,
                financials: typeof metrics.financials === 'number' ? metrics.financials : 0,
                earnings: typeof metrics.earnings === 'number' ? metrics.earnings : 0,
              };
            }
          }
        } catch (jsonError) {
          console.warn(`ProfileReportService: Invalid JSON for ${companyDomain}`, jsonError);
        }
      } else {
        (profile as any)[id] = content;
      }
    }

    // Fetch metadata-tagged files (if metadata discovery is enabled)
    if (metadataConfig) {
      try {
        const metaFiles = await this.fetchMetadataFiles(sanitized, companyDomain, metadataConfig);
        if (metaFiles.length > 0) {
          profile.metadataFiles = metaFiles;
        }
      } catch (error) {
        console.warn(`ProfileReportService: Metadata file lookup failed for ${companyDomain}`, error);
      }
    }

    return profile;
  }

  /**
   * Fetch content for a single report type.
   * Tries: user override path → primary path → fallback paths.
   * Returns content string or null if all paths fail.
   */
  public async fetchReportContent(
    libPath: string,
    reportType: IReportTypeDefinition,
    pathCtx: { domain: string; companyId?: number | null; shortName?: string },
    pathOverride?: string
  ): Promise<string | null> {
    // Build ordered path chain
    const paths: string[] = [];

    if (pathOverride) {
      const resolved = resolveReportPath(pathOverride, pathCtx);
      if (resolved) paths.push(resolved);
    }

    const primary = resolveReportPath(reportType.pathTemplate, pathCtx);
    if (primary) paths.push(primary);

    for (const fb of reportType.fallbackPaths) {
      const resolved = resolveReportPath(fb, pathCtx);
      if (resolved) paths.push(resolved);
    }

    // Try each path until one succeeds
    for (const relPath of paths) {
      const fullUrl = `${libPath}/${relPath}`;
      try {
        return await this.fetchFileContent(fullUrl);
      } catch {
        // Try next path
      }
    }

    return null;
  }

  /**
   * Check if a metadata column exists on a SharePoint list.
   * Returns true if the column exists, false otherwise.
   */
  public async checkColumnExists(libraryName: string, columnName: string): Promise<boolean> {
    if (this.detectWorkbenchEnvironment()) return false;

    const sanitized = this.sanitizeLibraryName(libraryName);
    const siteUrl = this.context.pageContext.web.absoluteUrl;
    const safeColumnName = encodeURIComponent(columnName);
    const apiUrl = `${siteUrl}/_api/web/lists/getbytitle('${sanitized}')/fields?$filter=InternalName eq '${safeColumnName}'&$select=InternalName&$top=1`;

    try {
      const response = await this.context.spHttpClient.get(
        apiUrl,
        SPHttpClient.configurations.v1,
        { headers: { 'Accept': 'application/json;odata.metadata=none' } }
      );
      if (!response.ok) return false;
      const data = await response.json();
      return data.value && data.value.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Fetch files tagged with metadata for a specific company.
   * Supports two sources:
   *   1. Document library (default) — queries files with metadata columns
   *   2. SharePoint list (listSource) — queries a custom list with file URL references
   * Optional visibilityColumn filters to only include items flagged as visible.
   */
  public async fetchMetadataFiles(
    libraryName: string,
    companyKey: string,
    metadataConfig: IMetadataDiscoveryConfig
  ): Promise<IMetadataFileEntry[]> {
    if (this.detectWorkbenchEnvironment()) return [];

    const siteUrl = this.context.pageContext.web.absoluteUrl;
    const safeCompanyKey = companyKey.replace(/'/g, "''");
    const companyCol = encodeURIComponent(metadataConfig.companyColumn);
    const categoryCol = encodeURIComponent(metadataConfig.fileCategoryColumn);

    // Determine source: custom SP list or the document library itself
    const sourceName = metadataConfig.listSource
      ? this.sanitizeLibraryName(metadataConfig.listSource)
      : this.sanitizeLibraryName(libraryName);

    // Build filter: company match + optional visibility flag
    let filter = `${companyCol} eq '${safeCompanyKey}'`;
    if (metadataConfig.visibilityColumn) {
      const visCol = encodeURIComponent(metadataConfig.visibilityColumn);
      filter += ` and ${visCol} eq 1`;
    }

    // Select columns — include FileLeafRef/FileRef for library items, FileUrl for list items
    const selectCols = metadataConfig.listSource
      ? `Title,${companyCol},${categoryCol},Modified,FileUrl,FileName${metadataConfig.visibilityColumn ? ',' + encodeURIComponent(metadataConfig.visibilityColumn) : ''}`
      : `FileLeafRef,FileRef,${companyCol},${categoryCol},Title,Modified${metadataConfig.visibilityColumn ? ',' + encodeURIComponent(metadataConfig.visibilityColumn) : ''}`;

    const apiUrl = `${siteUrl}/_api/web/lists/getbytitle('${sourceName}')/items` +
      `?$filter=${filter}` +
      `&$select=${selectCols}` +
      `&$top=500`;

    try {
      const response = await this.context.spHttpClient.get(
        apiUrl,
        SPHttpClient.configurations.v1,
        { headers: { 'Accept': 'application/json;odata.metadata=none' } }
      );

      if (!response.ok) {
        console.warn(`ProfileReportService: Metadata query returned ${response.status} for ${companyKey}`);
        return [];
      }

      const data = await response.json();
      if (!data.value || data.value.length === 0) return [];

      if (metadataConfig.listSource) {
        // List source: items have FileUrl and FileName columns (or Title as fallback)
        return data.value
          .filter((item: any) => item.FileUrl)
          .map((item: any) => ({
            name: item.FileName || item.Title || item.FileUrl.split('/').pop() || 'file',
            url: item.FileUrl,
            category: item[metadataConfig.fileCategoryColumn] || 'Uncategorized',
            title: item.Title || item.FileName || 'Untitled',
            modified: item.Modified ? new Date(item.Modified).toLocaleDateString() : ''
          }));
      }

      // Library source: items have FileLeafRef and FileRef
      return data.value
        .filter((item: any) => item.FileLeafRef && item.FileRef)
        .map((item: any) => ({
          name: item.FileLeafRef,
          url: item.FileRef,
          category: item[metadataConfig.fileCategoryColumn] || 'Uncategorized',
          title: item.Title || item.FileLeafRef,
          modified: item.Modified ? new Date(item.Modified).toLocaleDateString() : ''
        }));
    } catch (error) {
      console.warn(`ProfileReportService: fetchMetadataFiles error for ${companyKey}`, error);
      return [];
    }
  }

  /**
   * Fetch enrichment detail fields from the Pi_Companies list.
   * Returns the large Note fields (description, executives, competitors, etc.)
   * that are too heavy for the initial bulk list load.
   */
  public async fetchCompanyDetail(listName: string, companyId: number): Promise<Record<string, string> | null> {
    if (this.detectWorkbenchEnvironment()) return null;
    if (!listName || !companyId) return null;

    const sanitized = this.sanitizeLibraryName(listName);
    if (!sanitized) return null;

    const siteUrl = this.context.pageContext.web.absoluteUrl;
    const detailFields = 'CompanyDescription,Competitors,Products,Customers,Executives,ExecutiveSummary';
    const apiUrl = `${siteUrl}/_api/web/lists/getbytitle('${sanitized}')/items` +
      `?$filter=CompanyID eq ${companyId}` +
      `&$select=${detailFields}` +
      `&$top=1`;

    try {
      const response = await this.context.spHttpClient.get(
        apiUrl,
        SPHttpClient.configurations.v1,
        { headers: { 'Accept': 'application/json;odata.metadata=none' } }
      );

      if (!response.ok) return null;
      const data = await response.json();
      if (!data.value || data.value.length === 0) return null;

      return data.value[0] as Record<string, string>;
    } catch (error) {
      console.warn(`ProfileReportService: fetchCompanyDetail error for CompanyID=${companyId}`, error);
      return null;
    }
  }

  // fetchCompanyIntel removed — CompanyIntel column does not exist on the SP list.
  // Overview tab now relies solely on SP list detail fields (CompanyDescription, Executives, etc.).

  /**
   * Fetch and cache a folder's file listing (metadata only, no content).
   * Uses GetFolderByServerRelativeUrl to bypass list view threshold.
   */
  private async getFolderFiles(libraryName: string, folderName: string): Promise<IProfileFile[]> {
    const cacheKey = `${libraryName}/${folderName}`;
    if (this._folderCache.has(cacheKey)) {
      return this._folderCache.get(cacheKey)!;
    }

    const libPath = this.getLibraryPath(libraryName);
    const siteUrl = this.context.pageContext.web.absoluteUrl;
    const folderPath = `${libPath}/${folderName}`;
    const apiUrl = `${siteUrl}/_api/web/GetFolderByServerRelativeUrl('${folderPath}')/Files` +
      `?$select=Name,ServerRelativeUrl,TimeCreated&$top=5000`;

    const response = await this.context.spHttpClient.get(
      apiUrl,
      SPHttpClient.configurations.v1,
      { headers: { 'Accept': 'application/json;odata.metadata=none' } }
    );

    if (!response.ok) {
      console.warn(`ProfileReportService: Folder "${folderName}" returned ${response.status}`);
      return [];
    }

    const data = await response.json();
    const files: IProfileFile[] = (data.value || [])
      .filter((f: any) => f.Name && f.Name !== '.DS_Store')
      .map((f: any) => ({
        Name: f.Name,
        ServerRelativeUrl: f.ServerRelativeUrl,
        TimeCreated: f.TimeCreated || '',
        CompanyKey: '',
        FileType: '',
        CompanyName: ''
      }));

    this._folderCache.set(cacheKey, files);
    return files;
  }

  // ========== Discovery-based file scanning ==========

  /**
   * Resolve a site URL for cross-site calls.
   * Empty string = current site.
   */
  private resolveSiteUrl(siteUrl: string): string {
    if (siteUrl) return siteUrl.replace(/\/+$/, '');
    return this.context.pageContext.web.absoluteUrl;
  }

  /**
   * Resolve a library's server-relative path, supporting cross-site URLs.
   */
  private resolveLibPath(siteUrl: string, libraryName: string): string {
    if (libraryName.startsWith('/')) return libraryName;
    try {
      const url = new URL(siteUrl || this.context.pageContext.web.absoluteUrl);
      return `${url.pathname.replace(/\/+$/, '')}/${libraryName}`;
    } catch {
      return `${this.context.pageContext.web.serverRelativeUrl.replace(/\/+$/, '')}/${libraryName}`;
    }
  }

  /**
   * Discover all files in `{library}/{domain}/` across multiple library sources.
   * Returns a deduplicated, sorted list of discovered files.
   * If columnConfig is provided, fetches SP metadata columns (report type, display columns).
   */
  public async discoverCompanyFiles(
    sources: ILibrarySource[],
    domain: string,
    labelHints?: Record<string, ILabelHint>,
    columnConfig?: IDiscoveryColumnConfig
  ): Promise<IDiscoveredFile[]> {
    if (this.detectWorkbenchEnvironment()) return [];

    const hints = labelHints ?? DEFAULT_LABEL_HINTS;
    const seenNames = new Set<string>();
    const allFiles: IDiscoveredFile[] = [];

    // Collect all SP columns we need to fetch
    const metadataColumns: string[] = [];
    if (columnConfig?.fileTypeColumn) metadataColumns.push(columnConfig.fileTypeColumn);
    if (columnConfig?.displayColumns) metadataColumns.push(...columnConfig.displayColumns);

    // Scan each library source in parallel
    const results = await Promise.allSettled(
      sources.map(async (source) => {
        const siteUrl = this.resolveSiteUrl(source.siteUrl);
        const libPath = this.resolveLibPath(source.siteUrl, source.libraryName);
        const folderPath = `${libPath}/${domain}`;

        const files = await this.listFolderFilesCrossSite(siteUrl, folderPath, metadataColumns);
        return { files, siteUrl, sourceLabel: source.label || source.libraryName };
      })
    );

    for (const result of results) {
      if (result.status !== 'fulfilled') continue;
      const { files, siteUrl, sourceLabel } = result.value;

      for (const f of files) {
        if (isIgnoredFile(f.Name)) continue;
        if (seenNames.has(f.Name)) continue; // first source wins
        seenNames.add(f.Name);

        const ext = f.Name.split('.').pop()?.toLowerCase() || '';
        const hint = hints[f.Name];

        // Determine label: SP column value > filename hint > auto-generated
        const reportType = columnConfig?.fileTypeColumn
          ? (f.ListItemFields?.[columnConfig.fileTypeColumn] || '') as string
          : '';
        const label = reportType || fileNameToLabel(f.Name, hints);

        // Collect display column values
        let metadata: Record<string, string> | undefined;
        if (columnConfig?.displayColumns && columnConfig.displayColumns.length > 0 && f.ListItemFields) {
          metadata = {};
          for (const col of columnConfig.displayColumns) {
            const val = f.ListItemFields[col];
            if (val !== undefined && val !== null && val !== '') {
              metadata[col] = String(val);
            }
          }
          if (Object.keys(metadata).length === 0) metadata = undefined;
        }

        allFiles.push({
          name: f.Name,
          serverRelativeUrl: f.ServerRelativeUrl,
          siteUrl,
          extension: ext,
          label,
          format: detectFormat(ext),
          size: f.Length || 0,
          modified: f.TimeLastModified || '',
          sourceLabel,
          order: hint ? hint.order : 999,
          reportType: reportType || undefined,
          metadata,
        });
      }
    }

    // Sort by hint order, then alphabetically
    allFiles.sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order;
      return a.label.localeCompare(b.label);
    });

    return allFiles;
  }

  /** Return type for folder file listing, optionally including SP metadata fields */
  private static readonly FOLDER_FILE_BASE_SELECT = 'Name,ServerRelativeUrl,Length,TimeLastModified';

  /**
   * List files in a folder, supporting cross-site calls within the same tenant.
   * When metadataColumns is provided, attempts to expand ListItemAllFields.
   * Falls back to basic file listing (no metadata) if expansion fails
   * (e.g., list view threshold on large libraries).
   */
  private async listFolderFilesCrossSite(
    siteUrl: string,
    folderServerRelativePath: string,
    metadataColumns?: string[]
  ): Promise<Array<{ Name: string; ServerRelativeUrl: string; Length: number; TimeLastModified: string; ListItemFields?: Record<string, unknown> }>> {
    const encodedPath = encodeURIComponent(folderServerRelativePath);
    const needsMetadata = metadataColumns && metadataColumns.length > 0;

    // Try with metadata expansion first (if requested)
    if (needsMetadata) {
      try {
        const colSelects = metadataColumns.map(c => `ListItemAllFields/${c}`).join(',');
        const metaUrl = `${siteUrl}/_api/web/GetFolderByServerRelativeUrl('${encodedPath}')/Files` +
          `?$select=${ProfileReportService.FOLDER_FILE_BASE_SELECT},${colSelects}&$expand=ListItemAllFields&$top=5000`;
        const response = await this.context.spHttpClient.get(
          metaUrl, SPHttpClient.configurations.v1,
          { headers: { 'Accept': 'application/json;odata=nometadata' } }
        );
        if (response.ok) {
          const data = await response.json();
          return (data.value || []).map((f: any) => ({
            Name: f.Name || '',
            ServerRelativeUrl: f.ServerRelativeUrl || '',
            Length: parseInt(f.Length, 10) || 0,
            TimeLastModified: f.TimeLastModified || '',
            ListItemFields: f.ListItemAllFields || undefined,
          }));
        }
        // Metadata query failed (throttled/500) — fall through to basic listing
        console.warn(`ProfileReportService: Metadata-expanded query failed (${response.status}), falling back to basic listing`);
      } catch {
        console.warn('ProfileReportService: Metadata-expanded query threw, falling back to basic listing');
      }
    }

    // Basic file listing (no metadata) — always works
    const basicUrl = `${siteUrl}/_api/web/GetFolderByServerRelativeUrl('${encodedPath}')/Files` +
      `?$select=${ProfileReportService.FOLDER_FILE_BASE_SELECT}&$top=5000`;
    try {
      const response = await this.context.spHttpClient.get(
        basicUrl, SPHttpClient.configurations.v1,
        { headers: { 'Accept': 'application/json;odata=nometadata' } }
      );
      if (!response.ok) return [];
      const data = await response.json();
      return (data.value || []).map((f: any) => ({
        Name: f.Name || '',
        ServerRelativeUrl: f.ServerRelativeUrl || '',
        Length: parseInt(f.Length, 10) || 0,
        TimeLastModified: f.TimeLastModified || '',
      }));
    } catch {
      return [];
    }
  }

  /**
   * Fetch file content from a potentially cross-site SharePoint URL.
   */
  public async fetchFileContentCrossSite(siteUrl: string, serverRelativeUrl: string): Promise<string> {
    if (this.detectWorkbenchEnvironment()) return '';

    const resolvedSiteUrl = this.resolveSiteUrl(siteUrl);
    const apiUrl = `${resolvedSiteUrl}/_api/web/GetFileByServerRelativeUrl('${encodeURIComponent(serverRelativeUrl)}')/$value`;

    const response = await this.context.spHttpClient.get(
      apiUrl,
      SPHttpClient.configurations.v1
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.text();
  }

  /**
   * Fetch file content from SharePoint by server-relative URL
   */
  public async fetchFileContent(serverRelativeUrl: string): Promise<string> {
    if (this.detectWorkbenchEnvironment()) {
      return '';
    }

    const siteUrl = this.context.pageContext.web.absoluteUrl;
    const apiUrl = `${siteUrl}/_api/web/GetFileByServerRelativeUrl('${encodeURIComponent(serverRelativeUrl)}')/$value`;

    const response = await this.context.spHttpClient.get(
      apiUrl,
      SPHttpClient.configurations.v1
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.text();
  }

  /**
   * Sanitize library name to prevent injection
   */
  private sanitizeLibraryName(name: string): string {
    const sanitized = name.replace(/[^a-zA-Z0-9 _-]/g, '');
    return sanitized.replace(/'/g, "''");
  }

  /**
   * Detect if running in workbench environment
   */
  private detectWorkbenchEnvironment(): boolean {
    const hostname = window.location.hostname.toLowerCase();
    const pathname = window.location.pathname.toLowerCase();
    return pathname.indexOf('workbench') !== -1 || hostname === 'localhost' || hostname === '127.0.0.1';
  }
}
