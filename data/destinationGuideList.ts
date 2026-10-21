import destinationGuideListJson from './destinationGuideList.generated.json';
import type { DestinationSeasonality } from '../shared/destinationGuides';

/**
 * The list-shaped view of the country destination guides.
 *
 * `data/destinationGuides.json` (~450 KB) stays the source of truth and is still
 * what `services/destinationGuideService` reads for the detail pages. This module
 * exists so a page that only renders country cards, resolves a country name, or
 * links a festival to its guide does not pay for 137 KB of source links and 43 KB
 * of event prose it never shows. See `scripts/split-destination-guides.mjs`.
 *
 * `DestinationGuideEntry` is structurally assignable to `DestinationGuideSummary`,
 * so callers that already hold a full guide can keep passing it.
 */
export interface DestinationGuideSummary {
  id: string;
  name: string;
  slug: string;
  countryCode: string;
  region: string;
  tags: string[];
  priorityRank?: number;
  suggestedTripDays?: { min: number; max: number; recommended: number };
  seasonality?: DestinationSeasonality;
}

interface DestinationGuideListDocument {
  generatedAt: string;
  countries: DestinationGuideSummary[];
}

const DOCUMENT = destinationGuideListJson as unknown as DestinationGuideListDocument;

/** Already in `listDestinationGuides({ kind: 'country' })` order — see the generator. */
export const COUNTRY_GUIDE_SUMMARIES: DestinationGuideSummary[] = DOCUMENT.countries;

// Kept byte-identical to `destinationGuideService`'s lookup so the two agree on
// which guide a slug, name or country code resolves to.
const normalizeLookup = (value: string): string => value
  .trim()
  .normalize('NFKD')
  .replace(/[̀-ͯ]/g, '')
  .toLocaleLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const summariesByLookup = new Map(
  COUNTRY_GUIDE_SUMMARIES.flatMap((summary) => [
    [normalizeLookup(summary.slug), summary] as const,
    [normalizeLookup(summary.name), summary] as const,
    [normalizeLookup(summary.countryCode), summary] as const,
  ]),
);

/** Resolves a slug, display name or ISO country code to its country summary. */
export const getCountryGuideSummary = (value: string): DestinationGuideSummary | undefined => (
  summariesByLookup.get(normalizeLookup(value))
);

/** Country summaries in editorial priority order, capped at `limit`. */
export const listCountryGuideSummaries = (limit: number): DestinationGuideSummary[] => (
  COUNTRY_GUIDE_SUMMARIES.slice(0, Math.max(0, limit))
);
