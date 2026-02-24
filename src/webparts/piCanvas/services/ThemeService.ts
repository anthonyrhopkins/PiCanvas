/**
 * ThemeService — Fetches, validates, and applies Profile Report themes.
 * Supports built-in themes and external JSON themes from a SharePoint document library.
 */

import { SPHttpClient } from '@microsoft/sp-http';
import { WebPartContext } from '@microsoft/sp-webpart-base';
import {
  IProfileReportTheme,
  BUILTIN_THEMES,
  CORE_TOKEN_NAMES
} from '../models/ProfileReportThemes';

const STORAGE_PREFIX = 'picanvas-pr-theme-';

export class ThemeService {
  constructor(private context: WebPartContext) {}

  /**
   * Fetch external theme JSON files from {library}/themes/ folder.
   * Returns [] gracefully if the folder doesn't exist or contains no valid themes.
   */
  public async fetchExternalThemes(libraryName: string): Promise<IProfileReportTheme[]> {
    if (this.detectWorkbenchEnvironment()) return [];

    const sanitized = this.sanitizeLibraryName(libraryName);
    if (!sanitized) return [];

    const webServerRelativeUrl = this.context.pageContext.web.serverRelativeUrl;
    const base = webServerRelativeUrl.endsWith('/') ? webServerRelativeUrl : webServerRelativeUrl + '/';
    const folderPath = `${base}${sanitized}/themes`;
    const siteUrl = this.context.pageContext.web.absoluteUrl;

    // List JSON files in the themes/ folder
    const encodedFolderPath = encodeURIComponent(folderPath);
    const listUrl = `${siteUrl}/_api/web/GetFolderByServerRelativeUrl('${encodedFolderPath}')/Files` +
      `?$select=Name,ServerRelativeUrl&$filter=substringof('.json',Name)&$top=100`;

    try {
      const response = await this.context.spHttpClient.get(
        listUrl,
        SPHttpClient.configurations.v1,
        { headers: { 'Accept': 'application/json;odata.metadata=none' } }
      );

      if (!response.ok) {
        // 404 = no themes folder, that's fine
        if (response.status === 404) return [];
        console.warn(`ThemeService: themes folder returned ${response.status}`);
        return [];
      }

      const data = await response.json();
      if (!data.value || data.value.length === 0) return [];

      // Fetch and validate each theme file in parallel
      const themePromises = data.value.map(async (file: { Name: string; ServerRelativeUrl: string }) => {
        try {
          return await this.fetchAndValidateTheme(file.ServerRelativeUrl);
        } catch (error) {
          console.warn(`ThemeService: Skipping invalid theme "${file.Name}"`, error);
          return null;
        }
      });

      const results = await Promise.all(themePromises);
      return results.filter((t): t is IProfileReportTheme => t !== null);

    } catch (error) {
      console.warn('ThemeService: fetchExternalThemes error', error);
      return [];
    }
  }

  /**
   * Get all available themes: built-in + external, deduplicated by ID, sorted by order.
   */
  public async getAllThemes(libraryName: string): Promise<IProfileReportTheme[]> {
    const external = await this.fetchExternalThemes(libraryName);
    return this.mergeThemes(BUILTIN_THEMES, external);
  }

  /**
   * Merge built-in and external themes. External themes with the same ID override built-ins.
   */
  public mergeThemes(
    builtin: readonly IProfileReportTheme[],
    external: IProfileReportTheme[]
  ): IProfileReportTheme[] {
    const themeMap = new Map<string, IProfileReportTheme>();

    // Add built-ins first
    for (const theme of builtin) {
      themeMap.set(theme.id, theme);
    }

    // External themes override built-ins with same ID
    for (const theme of external) {
      themeMap.set(theme.id, theme);
    }

    // Sort by order, then by name
    return Array.from(themeMap.values()).sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order;
      return a.name.localeCompare(b.name);
    });
  }

  /**
   * Apply a theme's tokens as inline CSS custom properties on the target element.
   * Inline style.setProperty takes precedence over CSS stylesheet rules.
   */
  public applyTheme(element: HTMLElement, theme: IProfileReportTheme): void {
    // Set data-theme attribute for CSS fallback selectors
    element.setAttribute('data-theme', theme.id);

    // Apply core tokens
    for (const [key, value] of Object.entries(theme.tokens)) {
      element.style.setProperty('--' + key, value);
    }

    // Apply component tokens if present
    if (theme.componentTokens) {
      for (const [key, value] of Object.entries(theme.componentTokens)) {
        element.style.setProperty('--' + key, value);
      }
    }
  }

  /**
   * Remove all --pr-* inline custom properties from the element.
   */
  public clearTheme(element: HTMLElement): void {
    const style = element.style;
    const toRemove: string[] = [];
    for (let i = 0; i < style.length; i++) {
      const prop = style[i];
      if (prop.startsWith('--pr-')) {
        toRemove.push(prop);
      }
    }
    for (const prop of toRemove) {
      style.removeProperty(prop);
    }
  }

  /**
   * Set up auto mode: listen for OS prefers-color-scheme changes and apply
   * the appropriate light/dark theme. Returns a cleanup function.
   */
  public setupAutoMode(
    element: HTMLElement,
    lightTheme: IProfileReportTheme,
    darkTheme: IProfileReportTheme
  ): () => void {
    const mql = window.matchMedia('(prefers-color-scheme: dark)');

    const applyAutoTheme = (): void => {
      const theme = mql.matches ? darkTheme : lightTheme;
      this.clearTheme(element);
      this.applyTheme(element, theme);
      // Keep data-theme as "auto" so the CSS @media fallback still works
      element.setAttribute('data-theme', 'auto');
    };

    // Apply immediately
    applyAutoTheme();

    // Listen for changes
    const handler = (): void => applyAutoTheme();
    mql.addEventListener('change', handler);

    // Return cleanup function
    return () => mql.removeEventListener('change', handler);
  }

  /**
   * Persist the user's theme choice to localStorage.
   * @param reportId Unique identifier for the report instance
   * @param themeId The chosen theme ID (e.g. 'dark', 'auto', 'corporate-dark')
   */
  public persistChoice(reportId: string, themeId: string): void {
    try {
      localStorage.setItem(STORAGE_PREFIX + reportId, themeId);
    } catch {
      // localStorage may be unavailable (private browsing, quota, etc.)
    }
  }

  /**
   * Load the persisted theme choice from localStorage.
   * Returns null if no choice was saved.
   */
  public loadPersistedChoice(reportId: string): string | null {
    try {
      return localStorage.getItem(STORAGE_PREFIX + reportId);
    } catch {
      return null;
    }
  }

  // ---- Private helpers ----

  /**
   * Fetch a single theme JSON file and validate its structure.
   */
  private async fetchAndValidateTheme(serverRelativeUrl: string): Promise<IProfileReportTheme | null> {
    const siteUrl = this.context.pageContext.web.absoluteUrl;
    const apiUrl = `${siteUrl}/_api/web/GetFileByServerRelativeUrl('${encodeURIComponent(serverRelativeUrl)}')/$value`;

    const response = await this.context.spHttpClient.get(
      apiUrl,
      SPHttpClient.configurations.v1
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const text = await response.text();
    const raw = JSON.parse(text);

    return this.validateTheme(raw);
  }

  /**
   * Validate a raw JSON object as a valid theme.
   * Returns the validated theme or null if invalid.
   */
  private validateTheme(raw: any): IProfileReportTheme | null {
    if (!raw || typeof raw !== 'object') return null;
    if (typeof raw.id !== 'string' || !raw.id) return null;
    if (typeof raw.name !== 'string' || !raw.name) return null;
    if (typeof raw.version !== 'number') return null;
    if (!['light', 'dark', 'high-contrast'].includes(raw.mode)) return null;
    if (typeof raw.order !== 'number') return null;
    if (!raw.tokens || typeof raw.tokens !== 'object') return null;

    // Validate that all core tokens are present
    for (const tokenName of CORE_TOKEN_NAMES) {
      if (typeof raw.tokens[tokenName] !== 'string') {
        console.warn(`ThemeService: Theme "${raw.id}" missing core token "${tokenName}"`);
        return null;
      }
    }

    // Sanitize token values to prevent CSS injection
    const tokens: Record<string, string> = {};
    for (const [key, value] of Object.entries(raw.tokens)) {
      if (typeof value === 'string') {
        tokens[this.sanitizeTokenName(key)] = this.sanitizeTokenValue(value);
      }
    }

    const componentTokens: Record<string, string> | undefined =
      raw.componentTokens && typeof raw.componentTokens === 'object'
        ? Object.fromEntries(
            Object.entries(raw.componentTokens)
              .filter(([, v]) => typeof v === 'string')
              .map(([k, v]) => [this.sanitizeTokenName(k), this.sanitizeTokenValue(v as string)])
          )
        : undefined;

    return {
      id: String(raw.id).replace(/[^a-zA-Z0-9-_]/g, ''),
      name: String(raw.name).slice(0, 100),
      version: Number(raw.version),
      mode: raw.mode as 'light' | 'dark' | 'high-contrast',
      icon: typeof raw.icon === 'string' ? raw.icon.slice(0, 500) : undefined,
      order: Number(raw.order),
      tokens,
      componentTokens: componentTokens && Object.keys(componentTokens).length > 0
        ? componentTokens
        : undefined
    };
  }

  /**
   * Sanitize a CSS custom property name — only allow alphanumeric, hyphens.
   */
  private sanitizeTokenName(name: string): string {
    return name.replace(/[^a-zA-Z0-9-]/g, '');
  }

  /**
   * Sanitize a CSS custom property value — strip dangerous patterns.
   */
  private sanitizeTokenValue(value: string): string {
    // Remove any potential CSS injection vectors
    return value
      .replace(/[;{}]/g, '')
      .replace(/url\s*\(/gi, '')
      .replace(/expression\s*\(/gi, '')
      .replace(/javascript\s*:/gi, '')
      .slice(0, 200);
  }

  private sanitizeLibraryName(name: string): string {
    return name.replace(/[^a-zA-Z0-9 _-]/g, '').replace(/'/g, "''");
  }

  private detectWorkbenchEnvironment(): boolean {
    const hostname = window.location.hostname.toLowerCase();
    const pathname = window.location.pathname.toLowerCase();
    return pathname.indexOf('workbench') !== -1 || hostname === 'localhost' || hostname === '127.0.0.1';
  }
}
