import { Version } from '@microsoft/sp-core-library';
import {
  type IPropertyPaneConfiguration,
  PropertyPaneTextField
} from '@microsoft/sp-property-pane';
import { BaseClientSideWebPart } from '@microsoft/sp-webpart-base';
import * as React from 'react';
import * as ReactDom from 'react-dom';

import { AAHubApp } from './components/AAHubApp';
import type { IAAHubWebPartProps, IAAHubAppProps } from './models/types';
import * as strings from 'AAHubWebPartStrings';

export default class AAHubWebPart extends BaseClientSideWebPart<IAAHubWebPartProps> {

  public render(): void {
    const element = React.createElement(AAHubApp, {
      siteTitle: this.properties.siteTitle || 'Architecture Advisory Hub',
      siteIconUrl: this.properties.siteIconUrl || '',
      siteUrl: this.context.pageContext.web.absoluteUrl,
      spHttpClient: this.context.spHttpClient,
      isWorkbench: this._isWorkbench(),
    } as IAAHubAppProps);

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
                PropertyPaneTextField('siteTitle', {
                  label: strings.SiteTitleFieldLabel,
                  placeholder: 'Architecture Advisory Hub',
                }),
                PropertyPaneTextField('siteIconUrl', {
                  label: strings.SiteIconUrlFieldLabel,
                  placeholder: 'https://sap.sharepoint.com/teams/AAHUB/SiteAssets/__siteIcon__.png',
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
}
