import * as React from 'react';
import { SPHttpClient } from '@microsoft/sp-http';

export interface IServiceContext {
  spHttpClient: SPHttpClient;
  siteUrl: string;
  isWorkbench: boolean;
}

export const ServiceContext = React.createContext<IServiceContext | null>(null);

export function useServices(): IServiceContext {
  const ctx = React.useContext(ServiceContext);
  if (!ctx) {
    throw new Error('useServices must be used within a ServiceContext.Provider');
  }
  return ctx;
}
