/**
 * ProfileReportService
 * Fetches company data from either a Pi_Companies SharePoint list (preferred)
 * or by scanning a document library's condensed/ folder (legacy fallback).
 * Loads company profile files on demand — one company at a time.
 */

import { SPHttpClient } from '@microsoft/sp-http';
import { WebPartContext } from '@microsoft/sp-webpart-base';
import { ICompanyProfile, ICompanyEntry, IMetadataFileEntry, ICompanyIntel } from './ContentRenderer';

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
    const selectFields = 'Title,PiRadarID,CompanyDomain,Ticker,Industry,Sector,Revenue,Employees,AccountOwner,OwnerEmail,OwnerRegion,Status,SearchTerms';
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
          piRadarId: item.PiRadarID ? Number(item.PiRadarID) : undefined,
          industry: item.Industry || undefined,
          sector: item.Sector || undefined,
          accountOwner: item.AccountOwner || undefined,
          ownerEmail: item.OwnerEmail || undefined,
          ownerRegion: item.OwnerRegion || undefined,
          ticker: item.Ticker || undefined,
          revenue: item.Revenue || undefined,
          employees: item.Employees || undefined,
          searchTerms: item.SearchTerms || undefined
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
  public async fetchCompanyProfile(libraryName: string, entry: ICompanyEntry, metadataConfig?: IMetadataDiscoveryConfig): Promise<ICompanyProfile> {
    return this.loadCompanyProfile(libraryName, entry, metadataConfig);
  }

  /**
   * Load a single company's full profile.
   * Uses PiRadarID-based file paths when available (list-based entries),
   * otherwise falls back to domain-based lookup (legacy folder entries).
   */
  public async loadCompanyProfile(libraryName: string, entry: ICompanyEntry, metadataConfig?: IMetadataDiscoveryConfig): Promise<ICompanyProfile> {
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
      piRadarId: entry.piRadarId,
      industry: entry.industry,
      sector: entry.sector,
      accountOwner: entry.accountOwner,
      ownerRegion: entry.ownerRegion
    };

    // Determine file prefix: "{piRadarId}-{domain}" for list-based, just "{domain}" for legacy
    const hasPiRadarId = entry.piRadarId !== undefined && entry.piRadarId !== null;

    // 1. Fetch condensed JSON (direct path)
    const jsonUrl = `${libPath}/condensed/${companyDomain}.json`;
    try {
      const content = await this.fetchFileContent(jsonUrl);
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
              earnings: typeof metrics.earnings === 'number' ? metrics.earnings : 0
            };
          }
        }
      } catch (jsonError) {
        console.warn(`ProfileReportService: Invalid JSON for ${companyDomain}`, jsonError);
        profile.methodK = content; // fallback: show raw content
      }
    } catch (error) {
      console.warn(`ProfileReportService: No condensed JSON for ${companyDomain}`, error);
    }

    // 2. Find Method-K file
    if (hasPiRadarId) {
      // List-based: use PiRadarID-domain pattern in outputs/ folder
      const mkFileName = `${entry.piRadarId}-${companyDomain}-method-K.md`;
      const mkUrl = `${libPath}/outputs/${mkFileName}`;
      try {
        profile.methodK = await this.fetchFileContent(mkUrl);
      } catch {
        // Try outputs-method-l/ as fallback
        const mkUrlAlt = `${libPath}/outputs-method-l/${mkFileName}`;
        try {
          profile.methodK = await this.fetchFileContent(mkUrlAlt);
        } catch {
          console.warn(`ProfileReportService: Method-K not found for ${companyDomain} (ID: ${entry.piRadarId})`);
        }
      }
    } else {
      // Legacy: scan outputs-method-l/ folder
      try {
        const methodKFiles = await this.getFolderFiles(sanitized, 'outputs-method-l');
        const kFile = methodKFiles.find(f =>
          f.Name.toLowerCase().includes(companyDomain.toLowerCase()) && f.Name.endsWith('.md')
        );
        if (kFile) {
          profile.methodK = await this.fetchFileContent(kFile.ServerRelativeUrl);
        }
      } catch (error) {
        console.warn(`ProfileReportService: Method-K lookup failed for ${companyDomain}`, error);
      }
    }

    // 3. Find Method-L file (hydrated research data)
    if (hasPiRadarId) {
      // List-based: use PiRadarID-domain pattern in outputs-method-l/ folder
      const mlFileName = `${entry.piRadarId}-${companyDomain}-method-K.md`;
      const mlUrl = `${libPath}/outputs-method-l/${mlFileName}`;
      try {
        profile.methodL = await this.fetchFileContent(mlUrl);
      } catch {
        console.warn(`ProfileReportService: Method-L not found for ${companyDomain} (ID: ${entry.piRadarId})`);
      }
    } else {
      // Legacy: scan hydrated/ folder
      try {
        const hydratedFiles = await this.getFolderFiles(sanitized, 'hydrated');
        const companyHydrated = hydratedFiles.filter(f =>
          f.Name.toLowerCase().startsWith(shortName + '-method-')
        );
        if (companyHydrated.length > 0) {
          const contents: string[] = [];
          for (const hf of companyHydrated) {
            try {
              const c = await this.fetchFileContent(hf.ServerRelativeUrl);
              const methodMatch = hf.Name.match(/-method-([A-Z]+)\./i);
              const label = methodMatch ? `Method ${methodMatch[1].toUpperCase()}` : hf.Name;
              contents.push(`## ${label}\n\n${c}`);
            } catch { /* skip individual failures */ }
          }
          if (contents.length > 0) {
            profile.methodL = contents.join('\n\n---\n\n');
          }
        }
      } catch (error) {
        console.warn(`ProfileReportService: Hydrated lookup failed for ${companyDomain}`, error);
      }
    }

    // 4. Find Final Report (Method-M) in final-html/
    if (hasPiRadarId) {
      const fhFileName = `${entry.piRadarId}-${companyDomain}-final-report.html`;
      const fhUrl = `${libPath}/final-html/${fhFileName}`;
      try {
        profile.methodM = await this.fetchFileContent(fhUrl);
      } catch {
        // Fallback: try domain-only pattern
        const fhUrlAlt = `${libPath}/final-html/${companyDomain}.html`;
        try {
          profile.methodM = await this.fetchFileContent(fhUrlAlt);
        } catch {
          // No final-html file — that's fine
        }
      }
    } else {
      // Legacy: try domain-based path
      const htmlUrl = `${libPath}/final-html/${companyDomain}.html`;
      try {
        profile.methodM = await this.fetchFileContent(htmlUrl);
      } catch {
        // No final-html file — that's fine
      }
    }

    // 5. Fetch company-profile reports (executive-brief, competitive-landscape, investor-memo, full-dossier-narrative)
    // These are stored as {domain}.md in subfolders of company-profile/
    const companyProfileTypes: Array<{ folder: string; field: keyof ICompanyProfile }> = [
      { folder: 'company-profile/executive-brief', field: 'executiveBrief' },
      { folder: 'company-profile/competitive-landscape', field: 'competitiveLandscape' },
      { folder: 'company-profile/investor-memo', field: 'investorMemo' },
      { folder: 'company-profile/full-dossier-narrative', field: 'fullDossierNarrative' }
    ];

    // Fetch all company-profile types in parallel for speed
    const cpResults = await Promise.allSettled(
      companyProfileTypes.map(async ({ folder, field }) => {
        const url = `${libPath}/${folder}/${companyDomain}.md`;
        try {
          const content = await this.fetchFileContent(url);
          return { field, content };
        } catch {
          return { field, content: null };
        }
      })
    );
    for (const result of cpResults) {
      if (result.status === 'fulfilled' && result.value.content) {
        (profile as any)[result.value.field] = result.value.content;
      }
    }

    // 6. Fetch growth propensity score (te-growth-propensity/method-A/{domain}.md)
    {
      const gpUrl = `${libPath}/te-growth-propensity/method-A/${companyDomain}.md`;
      try {
        profile.growthPropensity = await this.fetchFileContent(gpUrl);
      } catch { /* no growth propensity — fine */ }
    }

    // 7. Fetch AI Synthesis (final-html/ai-synthesis/{id}-{domain}-method-M-final.md)
    if (hasPiRadarId) {
      const asFileName = `${entry.piRadarId}-${companyDomain}-method-M-final.md`;
      const asUrl = `${libPath}/final-html/ai-synthesis/${asFileName}`;
      try {
        profile.aiSynthesis = await this.fetchFileContent(asUrl);
      } catch {
        // Try domain-only fallback
        try {
          profile.aiSynthesis = await this.fetchFileContent(`${libPath}/final-html/ai-synthesis/${companyDomain}-method-M-final.md`);
        } catch { /* no AI synthesis — fine */ }
      }
    }

    // 8. Fetch T&E Relevance report (te-relevance/method-I/{domain}.md)
    {
      const trUrl = `${libPath}/te-relevance/method-I/${companyDomain}.md`;
      try {
        profile.teRelevance = await this.fetchFileContent(trUrl);
      } catch { /* no T&E relevance — fine */ }
    }

    // 9. Fetch metadata-tagged files (if metadata discovery is enabled)
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
   * Fetch company intelligence JSON from the Pi_Companies list.
   * Uses $filter on indexed PiRadarID column to stay under list view threshold.
   * Returns null gracefully on any error (intel is optional/enrichment data).
   */
  public async fetchCompanyIntel(listName: string, piRadarId: number): Promise<ICompanyIntel | null> {
    if (this.detectWorkbenchEnvironment()) return null;
    if (!listName || !piRadarId) return null;

    const sanitized = this.sanitizeLibraryName(listName);
    if (!sanitized) return null;

    const siteUrl = this.context.pageContext.web.absoluteUrl;
    const apiUrl = `${siteUrl}/_api/web/lists/getbytitle('${sanitized}')/items` +
      `?$filter=PiRadarID eq ${piRadarId}` +
      `&$select=CompanyIntel` +
      `&$top=1`;

    try {
      const response = await this.context.spHttpClient.get(
        apiUrl,
        SPHttpClient.configurations.v1,
        { headers: { 'Accept': 'application/json;odata.metadata=none' } }
      );

      if (!response.ok) {
        console.warn(`ProfileReportService: CompanyIntel query returned ${response.status} for PiRadarID=${piRadarId}`);
        return null;
      }

      const data = await response.json();
      if (!data.value || data.value.length === 0) return null;

      const intelJson = data.value[0].CompanyIntel;
      if (!intelJson || typeof intelJson !== 'string') return null;

      return JSON.parse(intelJson) as ICompanyIntel;
    } catch (error) {
      console.warn(`ProfileReportService: fetchCompanyIntel error for PiRadarID=${piRadarId}`, error);
      return null;
    }
  }

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
