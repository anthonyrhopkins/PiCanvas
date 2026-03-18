/**
 * Custom Report Source type definition.
 *
 * Admins configure report sources entirely through the config panel
 * (Tab Builder → Report Sources). No code changes needed.
 *
 * New installs start with an empty list — admins add sources
 * pointing to any SharePoint folder, with any label/content type.
 */

export interface ICustomReportSource {
  id: string;
  label: string;
  folderPath: string;                    // Filename mode: folder within library. Metadata mode: library/list title to query.
  filePattern: 'domain' | 'piRadarId';   // Only used in filename mode
  fileSuffix?: string;                   // Only used in filename mode with piRadarId
  contentType: 'md' | 'html' | 'json';
  enabled: boolean;

  // Metadata-based lookup (when lookupMode === 'metadata')
  lookupMode?: 'filename' | 'metadata';          // How to find files (default: 'filename')
  metadataColumn?: string;                        // Column to filter by (e.g., "Pi_CompanyID")
  metadataValue?: 'domain' | 'piRadarId' | 'companyName'; // What value to match against
  categoryColumn?: string;                        // Column that tags file category
  categoryFilter?: string;                        // Only files where category = this value
  resultMode?: 'single' | 'list';                 // 'single': inline content. 'list': file browser (default: 'single')
}

/**
 * Adapter: convert an ICustomReportSource into an IReportTypeDefinition
 * so custom admin-added sources feed into the same rendering pipeline
 * as built-in registry entries.
 */
import type { IReportTypeDefinition } from './ReportTypeRegistry';

export function toReportTypeDefinition(source: ICustomReportSource, order: number = 100): IReportTypeDefinition {
  return {
    id: source.id,
    label: source.label,
    flag: source.contentType.toUpperCase(),
    format: source.contentType,
    category: 'analysis',
    defaultEnabled: source.enabled,
    pathTemplate: source.filePattern === 'domain'
      ? `${source.folderPath}/{domain}.${source.contentType}`
      : `${source.folderPath}/{piRadarId}-{domain}${source.fileSuffix || ''}.${source.contentType}`,
    fallbackPaths: [],
    order,
  };
}
