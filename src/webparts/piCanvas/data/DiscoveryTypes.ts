/**
 * Discovery-based report content types.
 *
 * Admins configure one or more library sources; the service scans
 * `{library}/{domain}/` and whatever files exist become tabs automatically.
 * Adding a new report = uploading a file. Zero code changes.
 */

/** A library source configured by the admin */
export interface ILibrarySource {
  siteUrl: string;       // empty = current site
  libraryName: string;   // e.g., "Profiles"
  label?: string;        // optional display label
}

/** Discovery metadata configuration */
export interface IDiscoveryColumnConfig {
  /** SP column that identifies the report type (used as tab label). e.g., "ReportType" */
  fileTypeColumn?: string;
  /** Additional SP columns to display as metadata in each tab. e.g., ["Author", "Status", "ReviewDate"] */
  displayColumns?: string[];
}

/** A file discovered by folder scanning */
export interface IDiscoveredFile {
  name: string;              // "method-K.md"
  serverRelativeUrl: string; // full path for content fetch
  siteUrl: string;           // site to fetch from
  extension: string;         // "md"
  label: string;             // "Method-K" (from SP column, hints, or auto-generated)
  format: 'md' | 'html' | 'json' | 'txt';
  size: number;
  modified: string;
  sourceLabel?: string;      // which library this came from
  order: number;             // sort order (from hints or 999)
  reportType?: string;       // value from the fileTypeColumn (e.g., "Growth Propensity")
  metadata?: Record<string, string>;  // additional SP column values for display
}

/** Label hints: known filenames → nice labels + sort order */
export interface ILabelHint { label: string; order: number; }

export const DEFAULT_LABEL_HINTS: Record<string, ILabelHint> = {
  'condensed.json':            { label: 'Profile JSON',          order: 5 },
  'method-K.md':               { label: 'Method-K',              order: 10 },
  'method-L.md':               { label: 'Method-L',              order: 20 },
  'final-report.html':         { label: 'Final Report',          order: 30 },
  'ai-synthesis.md':           { label: 'AI Synthesis',          order: 40 },
  'te-relevance-method-I.md':  { label: 'T&E Relevance',        order: 50 },
  'te-growth-propensity.md':   { label: 'Growth Propensity',     order: 60 },
  'executive-brief.md':        { label: 'Growth Profile',        order: 70 },
  'competitive-landscape.md':  { label: 'Competitive Landscape', order: 80 },
  'investor-memo.md':          { label: 'Investor Memo',         order: 90 },
  'full-dossier-narrative.md': { label: 'Full Dossier',          order: 100 },
  'company-summary.md':        { label: 'Company Summary',       order: 110 },
  'financial-scorecard.md':    { label: 'Financial Scorecard',   order: 120 },
  'leadership-directory.md':   { label: 'Leadership Directory',  order: 130 },
};

export function fileNameToLabel(filename: string, hints?: Record<string, ILabelHint>): string {
  const hint = (hints ?? DEFAULT_LABEL_HINTS)[filename];
  if (hint) return hint.label;
  // Auto-generate label: strip extension, replace separators, title-case
  return filename
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

export function detectFormat(ext: string): 'md' | 'html' | 'json' | 'txt' {
  switch (ext.toLowerCase()) {
    case 'md': case 'markdown': return 'md';
    case 'html': case 'htm': return 'html';
    case 'json': return 'json';
    default: return 'txt';
  }
}

/** Files to ignore during folder scanning */
const IGNORED_FILES = new Set(['.DS_Store', 'Thumbs.db', 'desktop.ini']);

export function isIgnoredFile(filename: string): boolean {
  if (IGNORED_FILES.has(filename)) return true;
  if (filename.startsWith('~$')) return true; // Office temp files
  return false;
}
