import { SPHttpClient } from '@microsoft/sp-http';

export interface IAAHubWebPartProps {
  siteIconUrl: string;
  siteTitle: string;
}

export interface IAAHubAppProps {
  siteTitle: string;
  siteIconUrl: string;
  siteUrl: string;
  spHttpClient: SPHttpClient;
  isWorkbench: boolean;
}

export type ThemeMode = 'dark' | 'light' | 'hc';

export interface IThemeState {
  mode: ThemeMode;
  fontSize: number;
  showBadges: boolean;
}

export interface INavNode {
  Id: number;
  Title: string;
  Url: string;
  OpenInNewWindow: boolean;
  IsNew?: boolean;
  Icon?: string;
  IconOnly?: boolean;
  Children: INavNode[];
}

export interface INewsItem {
  id: number;
  title: string;
  url: string;
  isNew?: boolean;
}

export interface IQuickAccessItem {
  id: number;
  title: string;
  url: string;
  category: string;
  icon?: string;
}

export interface IQuickAccessCategory {
  name: string;
  items: IQuickAccessItem[];
}
