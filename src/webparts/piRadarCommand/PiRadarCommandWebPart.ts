import { Version } from '@microsoft/sp-core-library';
import {
  type IPropertyPaneConfiguration,
  PropertyPaneTextField
} from '@microsoft/sp-property-pane';
import { BaseClientSideWebPart } from '@microsoft/sp-webpart-base';
import { SPHttpClient, type SPHttpClientResponse } from '@microsoft/sp-http';
import * as React from 'react';
import * as ReactDom from 'react-dom';

import { PiRadarCommand } from './components/PiRadarCommand';
import type { IPiRadarCommandProps, ISignalItem, IReportFile } from './components/IPiRadarCommandProps';
import * as strings from 'PiRadarCommandWebPartStrings';

export interface IPiRadarCommandWebPartProps {
  heroHeadline: string;
  appPageUrl: string;
  libraryName: string;
}

export default class PiRadarCommandWebPart extends BaseClientSideWebPart<IPiRadarCommandWebPartProps> {

  private _companyCount: number = 0;
  private _recentSignals: ISignalItem[] = [];
  private _reportFiles: IReportFile[] = [];

  public async onInit(): Promise<void> {
    await super.onInit();
    if (!this._isWorkbench()) {
      await this._fetchData();
    }
  }

  public render(): void {
    const element = React.createElement(PiRadarCommand, {
      heroHeadline: this.properties.heroHeadline || 'Programmatic Business Intelligence',
      appPageUrl: this.properties.appPageUrl || '',
      companyCount: this._companyCount,
      recentSignals: this._recentSignals,
      reportFiles: this._reportFiles,
      spHttpClient: this.context.spHttpClient,
      siteUrl: this.context.pageContext.web.absoluteUrl,
      libraryName: this.properties.libraryName || 'Profiles',
    } as IPiRadarCommandProps);

    ReactDom.render(element, this.domElement);
  }

  protected onDispose(): void {
    ReactDom.unmountComponentAtNode(this.domElement);
  }

  protected get dataVersion(): Version {
    return Version.parse('1.0');
  }

  protected getPropertyPaneConfiguration(): IPropertyPaneConfiguration {
    return {
      pages: [
        {
          header: {
            description: strings.PropertyPaneDescription,
          },
          groups: [
            {
              groupName: strings.BasicGroupName,
              groupFields: [
                PropertyPaneTextField('heroHeadline', {
                  label: strings.HeroHeadlineFieldLabel,
                }),
                PropertyPaneTextField('appPageUrl', {
                  label: strings.AppPageUrlFieldLabel,
                  placeholder: 'https://yoursite.sharepoint.com/sites/yoursite/SitePages/App.aspx',
                }),
                PropertyPaneTextField('libraryName', {
                  label: strings.LibraryNameFieldLabel,
                  placeholder: 'Profiles',
                }),
              ],
            },
          ],
        },
      ],
    };
  }

  private _isWorkbench(): boolean {
    const hostname = window.location.hostname.toLowerCase();
    const pathname = window.location.pathname.toLowerCase();
    return pathname.indexOf('workbench') !== -1 || hostname === 'localhost' || hostname === '127.0.0.1';
  }

  private async _fetchData(): Promise<void> {
    try {
      await Promise.all([
        this._fetchCompanyCount(),
        this._fetchRecentSignals(),
        this._fetchReportFiles(),
      ]);
    } catch (e) {
      console.warn('PiRadarCommand: failed to fetch SharePoint data', e);
    }
  }

  private async _fetchCompanyCount(): Promise<void> {
    try {
      const url = `${this.context.pageContext.web.absoluteUrl}/_api/web/lists/getbytitle('Pi_Companies')/ItemCount`;
      const response: SPHttpClientResponse = await this.context.spHttpClient.get(
        url,
        SPHttpClient.configurations.v1,
        { headers: { Accept: 'application/json;odata=nometadata' } }
      );
      if (response.ok) {
        const data = await response.json();
        this._companyCount = data.value || 0;
      }
    } catch {
      // List may not exist
    }
  }

  private async _fetchRecentSignals(): Promise<void> {
    try {
      const url = `${this.context.pageContext.web.absoluteUrl}/_api/web/lists/getbytitle('Pi_Companies')/items?$select=Title,Modified,Industry&$orderby=Modified desc&$top=3`;
      const response: SPHttpClientResponse = await this.context.spHttpClient.get(
        url,
        SPHttpClient.configurations.v1,
        { headers: { Accept: 'application/json;odata=nometadata' } }
      );
      if (response.ok) {
        const data = await response.json();
        if (data.value && data.value.length > 0) {
          this._recentSignals = data.value.map((item: { Title: string; Modified: string; Industry?: string }) => ({
            title: `${item.Title} — Recent Activity Detected`,
            date: new Date(item.Modified).toLocaleDateString('en-US'),
            excerpt: `Latest update from ${item.Title}${item.Industry ? ` in the ${item.Industry} sector` : ''}. Growth signals detected through PiRadar's multi-tier verification system.`,
            tier: 4,
            eventType: 'expansion',
          } as ISignalItem));
        }
      }
    } catch {
      // List may not exist
    }
  }

  /**
   * Fetch report file listings from the Profiles library.
   * Scans both outputs/ (Method-K markdown) and final-html/ folders.
   * Uses GetFolderByServerRelativeUrl to bypass list view threshold.
   */
  private async _fetchReportFiles(): Promise<void> {
    const libraryName = (this.properties.libraryName || 'Profiles').replace(/[^a-zA-Z0-9 _-]/g, '');
    const webPath = this.context.pageContext.web.serverRelativeUrl;
    const base = webPath.endsWith('/') ? webPath : webPath + '/';
    const libPath = base + libraryName;
    const siteUrl = this.context.pageContext.web.absoluteUrl;

    const folders: Array<{ path: string; folder: 'outputs' | 'final-html'; ext: 'md' | 'html' }> = [
      { path: `${libPath}/outputs`, folder: 'outputs', ext: 'md' },
      { path: `${libPath}/final-html`, folder: 'final-html', ext: 'html' },
    ];

    const allFiles: IReportFile[] = [];

    await Promise.all(folders.map(async ({ path, folder, ext }) => {
      try {
        const apiUrl = `${siteUrl}/_api/web/GetFolderByServerRelativeUrl('${path}')/Files` +
          `?$select=Name,ServerRelativeUrl,TimeCreated&$top=5000`;
        const response: SPHttpClientResponse = await this.context.spHttpClient.get(
          apiUrl,
          SPHttpClient.configurations.v1,
          { headers: { Accept: 'application/json;odata.metadata=none' } }
        );
        if (!response.ok) return;

        const data = await response.json();
        const files = (data.value || []) as Array<{ Name: string; ServerRelativeUrl: string; TimeCreated: string }>;

        for (const f of files) {
          if (!f.Name || f.Name === '.DS_Store') continue;
          const parsed = this._parseReportFileName(f.Name);
          if (!parsed) continue;

          allFiles.push({
            name: f.Name,
            serverRelativeUrl: f.ServerRelativeUrl,
            created: f.TimeCreated || '',
            companyName: parsed.companyName,
            domain: parsed.domain,
            piRadarId: parsed.piRadarId,
            folder,
            fileType: ext,
          });
        }
      } catch {
        // Folder may not exist
      }
    }));

    // Sort by creation date descending (newest first)
    allFiles.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
    this._reportFiles = allFiles;
  }

  /**
   * Parse report file name patterns:
   *   {piRadarId}-{domain}-method-K.md   → PiRadarID-based
   *   {piRadarId}-{domain}-final-report.html
   *   {domain}.html                      → Legacy
   */
  private _parseReportFileName(name: string): { companyName: string; domain: string; piRadarId: number } | null {
    // Pattern: {id}-{domain}-method-K.md or {id}-{domain}-final-report.html
    const idMatch = name.match(/^(\d+)-([^-]+\.[a-z]+)-.+\.(md|html)$/i);
    if (idMatch) {
      const domain = idMatch[2];
      const companyName = domain.replace(/\.[^.]+$/, '').replace(/-/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
      return { piRadarId: parseInt(idMatch[1], 10), domain, companyName };
    }

    // Legacy: {domain}.html or {domain}.md
    const legacyMatch = name.match(/^([^/]+\.[a-z]+)\.(md|html)$/i);
    if (legacyMatch) {
      const domain = legacyMatch[1];
      const companyName = domain.replace(/\.[^.]+$/, '').replace(/-/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
      return { piRadarId: 0, domain, companyName };
    }

    return null;
  }
}
