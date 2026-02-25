import { SPHttpClient } from '@microsoft/sp-http';

export interface IPiRadarCommandProps {
  heroHeadline: string;
  appPageUrl: string;
  companyCount: number;
  recentSignals: ISignalItem[];
  reportFiles: IReportFile[];
  spHttpClient: SPHttpClient;
  siteUrl: string;
  libraryName: string;
}

export interface ISignalItem {
  title: string;
  date: string;
  excerpt: string;
  tier: number;
  eventType: string;
}

export interface IReportFile {
  name: string;
  serverRelativeUrl: string;
  created: string;
  companyName: string;
  domain: string;
  piRadarId: number;
  folder: 'outputs' | 'final-html';
  fileType: 'md' | 'html';
}
