import destinationGuidesJson from '../data/destinationGuides.json';
import type {
  DestinationGuideDocument,
  DestinationGuideEntry,
  DestinationGuideKind,
} from '../shared/destinationGuides';

export interface DestinationGuideListOptions {
  kind?: DestinationGuideKind;
  countryCode?: string;
  parentSlug?: string;
  limit?: number;
}

export interface ResolvedDestinationGuide {
  guide: DestinationGuideEntry;
  country: DestinationGuideEntry;
  children: DestinationGuideEntry[];
  effectiveSeasonality: DestinationGuideEntry['seasonality'];
  effectiveEvents: DestinationGuideEntry['events'];
}

export const DESTINATION_GUIDE_DOCUMENT = destinationGuidesJson as DestinationGuideDocument;
export const DEFAULT_DESTINATION_GUIDE_LIMIT = 50;
export const MAX_DESTINATION_GUIDE_LIMIT = 100;

const normalizeLookup = (value: string): string => value
  .trim()
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const countryGuides = DESTINATION_GUIDE_DOCUMENT.guides
  .filter((guide) => guide.kind === 'country')
  .sort((left, right) => (left.priorityRank || Number.MAX_SAFE_INTEGER) - (right.priorityRank || Number.MAX_SAFE_INTEGER));

const countriesBySlug = new Map(countryGuides.map((guide) => [guide.slug, guide]));
const countriesByLookup = new Map(
  countryGuides.flatMap((guide) => [
    [normalizeLookup(guide.slug), guide] as const,
    [normalizeLookup(guide.name), guide] as const,
    [normalizeLookup(guide.countryCode), guide] as const,
  ]),
);
const childrenByParent = new Map<string, DestinationGuideEntry[]>();

DESTINATION_GUIDE_DOCUMENT.guides.forEach((guide) => {
  if (guide.kind === 'country' || !guide.parentSlug) return;
  const children = childrenByParent.get(guide.parentSlug) || [];
  children.push(guide);
  childrenByParent.set(guide.parentSlug, children);
});
childrenByParent.forEach((children) => children.sort((left, right) => left.name.localeCompare(right.name)));

export const clampDestinationGuideLimit = (value?: number | null): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_DESTINATION_GUIDE_LIMIT;
  return Math.max(1, Math.min(MAX_DESTINATION_GUIDE_LIMIT, Math.trunc(value)));
};

export const getCountryDestinationGuide = (value: string): DestinationGuideEntry | undefined => (
  countriesByLookup.get(normalizeLookup(value))
);

export const getDestinationGuideChildren = (
  countryValue: string,
  kind?: Exclude<DestinationGuideKind, 'country'>,
): DestinationGuideEntry[] => {
  const country = getCountryDestinationGuide(countryValue);
  if (!country) return [];
  const children = childrenByParent.get(country.slug) || [];
  return kind ? children.filter((guide) => guide.kind === kind) : [...children];
};

export const getChildDestinationGuide = (
  countryValue: string,
  childValue: string,
): DestinationGuideEntry | undefined => {
  const lookup = normalizeLookup(childValue);
  return getDestinationGuideChildren(countryValue).find((guide) => (
    normalizeLookup(guide.slug) === lookup || normalizeLookup(guide.name) === lookup
  ));
};

export const listDestinationGuides = (
  options: DestinationGuideListOptions = {},
): DestinationGuideEntry[] => {
  const kind = options.kind || 'country';
  const normalizedCountryCode = options.countryCode?.trim().toUpperCase();
  const normalizedParent = options.parentSlug ? normalizeLookup(options.parentSlug) : undefined;
  const limit = clampDestinationGuideLimit(options.limit);

  return DESTINATION_GUIDE_DOCUMENT.guides
    .filter((guide) => guide.kind === kind)
    .filter((guide) => !normalizedCountryCode || guide.countryCode === normalizedCountryCode)
    .filter((guide) => !normalizedParent || guide.parentSlug === normalizedParent)
    .sort((left, right) => {
      if (kind === 'country') {
        return (left.priorityRank || Number.MAX_SAFE_INTEGER) - (right.priorityRank || Number.MAX_SAFE_INTEGER);
      }
      return left.name.localeCompare(right.name);
    })
    .slice(0, limit);
};

export const resolveDestinationGuide = (
  countryValue: string,
  childValue?: string,
): ResolvedDestinationGuide | undefined => {
  const country = getCountryDestinationGuide(countryValue);
  if (!country) return undefined;
  const guide = childValue ? getChildDestinationGuide(country.slug, childValue) : country;
  if (!guide) return undefined;

  return {
    guide,
    country,
    children: guide.kind === 'country' ? getDestinationGuideChildren(country.slug) : [],
    effectiveSeasonality: guide.seasonality || country.seasonality,
    effectiveEvents: guide.events.length > 0 ? guide.events : country.events,
  };
};

export const getCountryGuideBySlug = (slug: string): DestinationGuideEntry | undefined => (
  countriesBySlug.get(normalizeLookup(slug))
);
