/**
 * Report Type Registry — single source of truth for all built-in report types.
 *
 * Adding a new report type = adding one entry to REPORT_TYPE_REGISTRY.
 * No changes needed in ProfileReportService, ContentRenderer, PiCanvasWebPart, or TabBuilderSection.
 */

export interface IReportTypeDefinition {
  /** Matches ICompanyProfile property name (e.g., 'methodK') */
  id: string;
  /** Tab label (e.g., 'Method-K') */
  label: string;
  /** Badge text ('MD', 'HTML', 'JSON') */
  flag: string;
  /** File format */
  format: 'md' | 'html' | 'json';
  /** Grouping category */
  category: 'analysis' | 'profile' | 'intelligence' | 'data';
  /** Whether enabled by default (only appears if file exists) */
  defaultEnabled: boolean;
  /** New primary path template: '{domain}/method-K.md' */
  pathTemplate: string;
  /** Legacy fallback paths tried on 404 */
  fallbackPaths: string[];
  /** Sort order within category */
  order: number;
}

/**
 * All built-in report types. Order determines tab order within each category.
 */
export const REPORT_TYPE_REGISTRY: readonly IReportTypeDefinition[] = [
  // === Data ===
  {
    id: 'profileJson',
    label: 'Profile JSON',
    flag: 'JSON',
    format: 'json',
    category: 'data',
    defaultEnabled: true,
    pathTemplate: '{domain}/condensed.json',
    fallbackPaths: ['condensed/{domain}.json'],
    order: 10,
  },

  // === Analysis ===
  {
    id: 'methodK',
    label: 'Method-K',
    flag: 'MD',
    format: 'md',
    category: 'analysis',
    defaultEnabled: true,
    pathTemplate: '{domain}/method-K.md',
    fallbackPaths: [
      'outputs/{piRadarId}-{domain}-method-K.md',
      'outputs-method-l/{piRadarId}-{domain}-method-K.md',
    ],
    order: 10,
  },
  {
    id: 'methodL',
    label: 'Method-L',
    flag: 'MD',
    format: 'md',
    category: 'analysis',
    defaultEnabled: true,
    pathTemplate: '{domain}/method-L.md',
    fallbackPaths: ['outputs-method-l/{piRadarId}-{domain}-method-K.md'],
    order: 20,
  },
  {
    id: 'methodM',
    label: 'Method-M',
    flag: 'HTML',
    format: 'html',
    category: 'analysis',
    defaultEnabled: true,
    pathTemplate: '{domain}/final-report.html',
    fallbackPaths: [
      'final-html/{piRadarId}-{domain}-final-report.html',
      'final-html/{domain}.html',
    ],
    order: 30,
  },
  {
    id: 'aiSynthesis',
    label: 'AI Synthesis',
    flag: 'MD',
    format: 'md',
    category: 'analysis',
    defaultEnabled: true,
    pathTemplate: '{domain}/ai-synthesis.md',
    fallbackPaths: [
      'final-html/ai-synthesis/{piRadarId}-{domain}-method-M-final.md',
      'final-html/ai-synthesis/{domain}-method-M-final.md',
    ],
    order: 40,
  },
  {
    id: 'teRelevance',
    label: 'T&E Relevance',
    flag: 'MD',
    format: 'md',
    category: 'analysis',
    defaultEnabled: true,
    pathTemplate: '{domain}/te-relevance-method-I.md',
    fallbackPaths: ['te-relevance/method-I/{domain}.md'],
    order: 50,
  },
  {
    id: 'growthPropensity',
    label: 'Growth Propensity',
    flag: 'MD',
    format: 'md',
    category: 'analysis',
    defaultEnabled: true,
    pathTemplate: '{domain}/te-growth-propensity.md',
    fallbackPaths: ['te-growth-propensity/method-A/{domain}.md'],
    order: 60,
  },

  // === Profile ===
  {
    id: 'executiveBrief',
    label: 'Growth Profile',
    flag: 'MD',
    format: 'md',
    category: 'profile',
    defaultEnabled: true,
    pathTemplate: '{domain}/growth-profile-{domain}.md',
    fallbackPaths: [
      '{domain}/executive-brief.md',
      'company-profile/executive-brief/{domain}.md',
    ],
    order: 10,
  },
  {
    id: 'competitiveLandscape',
    label: 'Competitive Landscape',
    flag: 'MD',
    format: 'md',
    category: 'profile',
    defaultEnabled: true,
    pathTemplate: '{domain}/competitive-landscape.md',
    fallbackPaths: ['company-profile/competitive-landscape/{domain}.md'],
    order: 20,
  },
  {
    id: 'investorMemo',
    label: 'Investor Memo',
    flag: 'MD',
    format: 'md',
    category: 'profile',
    defaultEnabled: true,
    pathTemplate: '{domain}/investor-memo.md',
    fallbackPaths: ['company-profile/investor-memo/{domain}.md'],
    order: 30,
  },
  {
    id: 'fullDossierNarrative',
    label: 'Full Dossier',
    flag: 'MD',
    format: 'md',
    category: 'profile',
    defaultEnabled: true,
    pathTemplate: '{domain}/full-dossier-narrative.md',
    fallbackPaths: ['company-profile/full-dossier-narrative/{domain}.md'],
    order: 40,
  },
  {
    id: 'companySummary',
    label: 'Company Summary',
    flag: 'MD',
    format: 'md',
    category: 'profile',
    defaultEnabled: true,
    pathTemplate: '{domain}/company-summary.md',
    fallbackPaths: [],
    order: 50,
  },

  // === Intelligence ===
  {
    id: 'financialScorecard',
    label: 'Financial Scorecard',
    flag: 'MD',
    format: 'md',
    category: 'intelligence',
    defaultEnabled: true,
    pathTemplate: '{domain}/financial-scorecard.md',
    fallbackPaths: [],
    order: 10,
  },
  {
    id: 'leadershipDirectory',
    label: 'Leadership Directory',
    flag: 'MD',
    format: 'md',
    category: 'intelligence',
    defaultEnabled: true,
    pathTemplate: '{domain}/leadership-directory.md',
    fallbackPaths: [],
    order: 20,
  },
];

/**
 * Resolve path template tokens.
 * Replaces {domain}, {piRadarId}, {shortName} with actual values.
 * Paths containing unresolved {piRadarId} (when piRadarId is not available) are skipped.
 */
export function resolveReportPath(
  template: string,
  ctx: { domain: string; piRadarId?: number | null; shortName?: string }
): string | null {
  let result = template.replace(/\{domain\}/g, ctx.domain);
  if (ctx.shortName) {
    result = result.replace(/\{shortName\}/g, ctx.shortName);
  }
  if (ctx.piRadarId !== undefined && ctx.piRadarId !== null) {
    result = result.replace(/\{piRadarId\}/g, String(ctx.piRadarId));
  }
  // If there are still unresolved {piRadarId} tokens, skip this path
  if (result.includes('{piRadarId}')) return null;
  return result;
}

/**
 * Maps legacy `showXxx` property suffixes to registry IDs for backward compatibility.
 * Key = property suffix (e.g., 'ProfileReportShowMethodK'), Value = registry id.
 */
export const LEGACY_SHOW_PROPERTY_MAP: Record<string, string> = {
  'ProfileReportShowMethodK': 'methodK',
  'ProfileReportShowMethodL': 'methodL',
  'ProfileReportShowMethodM': 'methodM',
  'ProfileReportShowProfileJson': 'profileJson',
  'ProfileReportShowExecBrief': 'executiveBrief',
  'ProfileReportShowCompLandscape': 'competitiveLandscape',
  'ProfileReportShowInvestorMemo': 'investorMemo',
  'ProfileReportShowFullDossier': 'fullDossierNarrative',
  'ProfileReportShowGrowthProp': 'growthPropensity',
  'ProfileReportShowTeRelevance': 'teRelevance',
  'ProfileReportShowAiSynthesis': 'aiSynthesis',
  'ProfileReportShowGrowthProfile': 'executiveBrief',
  'ProfileReportShowCompanySummary': 'companySummary',
  'ProfileReportShowFinScorecard': 'financialScorecard',
  'ProfileReportShowLeadershipDir': 'leadershipDirectory',
};

/** Reverse map: registry ID → legacy property suffix */
export const REGISTRY_ID_TO_LEGACY_PROP: Record<string, string> = Object.fromEntries(
  Object.entries(LEGACY_SHOW_PROPERTY_MAP).map(([prop, id]) => [id, prop])
);

/** Get sorted registry entries */
export function getRegistrySorted(): IReportTypeDefinition[] {
  return [...REPORT_TYPE_REGISTRY].sort((a, b) => {
    const catOrder = ['data', 'analysis', 'profile', 'intelligence'];
    const catDiff = catOrder.indexOf(a.category) - catOrder.indexOf(b.category);
    if (catDiff !== 0) return catDiff;
    return a.order - b.order;
  });
}

/** Get registry entries grouped by category */
export function getRegistryByCategory(): Record<string, IReportTypeDefinition[]> {
  const grouped: Record<string, IReportTypeDefinition[]> = {};
  for (const rt of getRegistrySorted()) {
    if (!grouped[rt.category]) grouped[rt.category] = [];
    grouped[rt.category].push(rt);
  }
  return grouped;
}

/** Category display labels */
export const CATEGORY_LABELS: Record<string, string> = {
  analysis: 'Analysis Reports',
  profile: 'Company Profiles',
  intelligence: 'Intelligence',
  data: 'Raw Data',
};

/**
 * Export the registry as discovery-compatible label hints.
 * Maps filename (from pathTemplate) → { label, order }.
 */
export function registryToLabelHints(): Record<string, { label: string; order: number }> {
  const hints: Record<string, { label: string; order: number }> = {};
  for (const rt of REPORT_TYPE_REGISTRY) {
    // Extract filename from pathTemplate (e.g., '{domain}/method-K.md' → 'method-K.md')
    const parts = rt.pathTemplate.split('/');
    const filename = parts[parts.length - 1];
    if (filename && !filename.includes('{')) {
      hints[filename] = { label: rt.label, order: rt.order };
    }
  }
  return hints;
}

/**
 * Build a map from filename → registry ID for discovery mode filtering.
 * Allows discovered files to be matched against Show/Hide toggles.
 */
export function buildFilenameToIdMap(): Map<string, string> {
  const map = new Map<string, string>();
  for (const rt of REPORT_TYPE_REGISTRY) {
    const parts = rt.pathTemplate.split('/');
    const filename = parts[parts.length - 1];
    if (filename && !filename.includes('{')) {
      map.set(filename, rt.id);
    }
  }
  return map;
}
