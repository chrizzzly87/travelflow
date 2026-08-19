import { COUNTRY_TRAVEL_DATA, type CountryTravelEvent } from '../data/countryTravelData';
import { getCountryDestinationGuide } from './destinationGuideService';

/**
 * The festival catalog is the curated slice of `data/countryTravelData.json`:
 * an event qualifies only once it carries a researched `recurrence`, which is
 * what separates hand-checked festivals from the generic per-country filler
 * entries ("New Year Celebrations", "Seasonal Cultural Events", ...).
 */

export type FestivalRegionId =
  | 'africa'
  | 'asia'
  | 'europe'
  | 'middle-east'
  | 'north-america'
  | 'oceania'
  | 'south-america';

export interface FestivalCatalogEntry {
  /** Stable id, unique across countries (`TH-songkran`). */
  id: string;
  event: CountryTravelEvent;
  countryCode: string;
  countryName: string;
  regionId: FestivalRegionId;
  /** Slug of the matching destination guide, when one exists. */
  guideSlug?: string;
}

/**
 * Region per country code. Destination guides already carry a region, but the
 * catalog also covers countries without a guide yet, so this map is the
 * authority and the guide region is only a cross-check.
 */
const REGION_BY_COUNTRY_CODE: Record<string, FestivalRegionId> = {
  AE: 'middle-east', AR: 'south-america', AT: 'europe', AU: 'oceania',
  BE: 'europe', BR: 'south-america', CA: 'north-america', CH: 'europe',
  CL: 'south-america', CN: 'asia', CO: 'south-america', DE: 'europe',
  EG: 'africa', ES: 'europe', FR: 'europe', GB: 'europe', GR: 'europe',
  ID: 'asia', IE: 'europe', IN: 'asia', IT: 'europe', JP: 'asia',
  KR: 'asia', LK: 'asia', MA: 'africa', MX: 'north-america', MY: 'asia',
  NL: 'europe', NP: 'asia', NZ: 'oceania', PE: 'south-america',
  PH: 'asia', PT: 'europe', QA: 'middle-east', SA: 'middle-east',
  SG: 'asia', TH: 'asia', TR: 'europe', TW: 'asia', US: 'north-america',
  VN: 'asia', ZA: 'africa',
};

export const FESTIVAL_REGION_ORDER: FestivalRegionId[] = [
  'europe',
  'asia',
  'africa',
  'north-america',
  'south-america',
  'middle-east',
  'oceania',
];

const isCuratedFestival = (event: CountryTravelEvent): boolean => Boolean(event.recurrence);

const buildCatalog = (): FestivalCatalogEntry[] => {
  const entries: FestivalCatalogEntry[] = [];

  COUNTRY_TRAVEL_DATA.countries.forEach((country) => {
    const regionId = REGION_BY_COUNTRY_CODE[country.countryCode];
    if (!regionId) return;

    country.events.filter(isCuratedFestival).forEach((event) => {
      entries.push({
        id: `${country.countryCode}-${event.id}`,
        event,
        countryCode: country.countryCode,
        countryName: country.countryName,
        regionId,
        guideSlug: getCountryDestinationGuide(country.countryCode)?.slug,
      });
    });
  });

  return entries;
};

export const FESTIVAL_CATALOG: FestivalCatalogEntry[] = buildCatalog();

export const listFestivalRegions = (
  entries: FestivalCatalogEntry[] = FESTIVAL_CATALOG,
): FestivalRegionId[] => {
  const present = new Set(entries.map((entry) => entry.regionId));
  return FESTIVAL_REGION_ORDER.filter((region) => present.has(region));
};

export const listFestivalMonths = (
  entries: FestivalCatalogEntry[] = FESTIVAL_CATALOG,
): number[] => {
  const present = new Set(entries.map((entry) => entry.event.month));
  return Array.from({ length: 12 }, (_, index) => index + 1).filter((month) => present.has(month));
};
