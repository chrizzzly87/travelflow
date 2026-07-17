import {
  JOURNEY_SPEC_VERSION,
  normalizeJourneySpec,
  validateJourneySpec,
  type JourneyPace,
  type JourneyPlaceSelection,
  type JourneySpec,
  type JourneyType,
} from './journeySpec';
import type { TravelDestinationPack, TravelEntityCatalogItem } from './travelKnowledge';
import {
  getTravelKnowledgeChildren,
  getTravelKnowledgeIndex,
} from './travelKnowledgeIndex';

export const JOURNEY_SHAPE_WIZARD_TYPES = [
  'city_break',
  'hub_and_day_trips',
  'single_country_circuit',
] as const;

export type JourneyShapeWizardType = (typeof JOURNEY_SHAPE_WIZARD_TYPES)[number];
export type JourneyShapeWizardDateMode = 'flexible' | 'exact';

export interface JourneyShapeWizardDraft {
  journeyType: JourneyShapeWizardType;
  dateMode: JourneyShapeWizardDateMode;
  durationDays: number;
  month: number;
  startDate?: string;
  endDate?: string;
  pace: JourneyPace;
  interestTags: string[];
  maxBaseChanges: number;
  selectedCitySlug?: string;
  selectedNeighborhoodSlugs: string[];
}

export interface JourneyShapePlaceSearchResult {
  entity: TravelEntityCatalogItem;
  city: TravelEntityCatalogItem;
  matchKind: 'city' | 'neighborhood';
  score: number;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const toEntitySelection = (
  entity: TravelEntityCatalogItem,
  role: JourneyPlaceSelection['role'],
  order: number,
  locked: boolean,
): JourneyPlaceSelection => ({
  entity: {
    entityId: entity.entityId,
    canonicalSlug: entity.canonicalSlug,
    entityType: entity.entityType,
    countryCode: entity.countryCode,
    name: entity.name,
    resolution: 'canonical',
  },
  role,
  order,
  locked,
});

const exactDurationDays = (startDate: string, endDate: string): number => {
  if (!DATE_PATTERN.test(startDate) || !DATE_PATTERN.test(endDate)) {
    throw new Error('Exact trip dates must use YYYY-MM-DD values.');
  }
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    throw new Error('Exact trip end date must be after its start date.');
  }
  return Math.round((end - start) / 86_400_000);
};

const templateBaseSlugs = (pack: TravelDestinationPack, journeyType: JourneyType): Set<string> => new Set(
  pack.templates
    .filter((template) => template.journeyType === journeyType)
    .flatMap((template) => template.stops)
    .filter((stop) => stop.stopRole === 'base')
    .map((stop) => stop.entitySlug),
);

export const getJourneyShapeAnchorCities = (
  pack: TravelDestinationPack,
  journeyType: JourneyShapeWizardType,
): TravelEntityCatalogItem[] => {
  const baseSlugs = templateBaseSlugs(pack, journeyType);
  const index = getTravelKnowledgeIndex(pack);
  return [...(index.byType.get('city') ?? [])]
    .filter((entity) => baseSlugs.has(entity.canonicalSlug))
    .sort((left, right) => right.popularityScore - left.popularityScore || left.name.localeCompare(right.name));
};

export const getJourneyShapeNeighborhoods = (
  pack: TravelDestinationPack,
  citySlug?: string,
): TravelEntityCatalogItem[] => {
  if (!citySlug) return [];
  const index = getTravelKnowledgeIndex(pack);
  const city = index.bySlug.get(citySlug);
  if (city?.entityType !== 'city' || !city.entityId) return [];
  return [...getTravelKnowledgeChildren(index, city.entityId, 'neighborhood')]
    .sort((left, right) => right.popularityScore - left.popularityScore || left.name.localeCompare(right.name));
};

const normalizePlaceSearchText = (value: string): string => value
  .normalize('NFKD')
  .replace(/\p{M}/gu, '')
  .toLocaleLowerCase()
  .replace(/[^\p{L}\p{N}]+/gu, ' ')
  .trim();

const placeSearchScore = (entity: TravelEntityCatalogItem, query: string): number | null => {
  const names = [entity.name, entity.localName, ...entity.names.map((name) => name.name)]
    .filter((name): name is string => Boolean(name?.trim()))
    .map(normalizePlaceSearchText);
  let bestScore: number | null = null;
  for (const name of names) {
    const score = name === query
      ? 0
      : name.startsWith(query)
        ? 1
        : name.split(' ').some((word) => word.startsWith(query))
          ? 2
          : name.includes(query)
            ? 3
            : null;
    if (score !== null && (bestScore === null || score < bestScore)) bestScore = score;
  }
  return bestScore;
};

export const searchJourneyShapePlaces = (
  pack: TravelDestinationPack,
  journeyType: JourneyShapeWizardType,
  rawQuery: string,
  limit = 8,
): JourneyShapePlaceSearchResult[] => {
  const query = normalizePlaceSearchText(rawQuery);
  if (!query) return [];
  const index = getTravelKnowledgeIndex(pack);
  const supportedCities = getJourneyShapeAnchorCities(pack, journeyType);
  const matches: JourneyShapePlaceSearchResult[] = [];

  for (const city of supportedCities) {
    const cityScore = placeSearchScore(city, query);
    if (cityScore !== null) {
      matches.push({ entity: city, city, matchKind: 'city', score: cityScore });
    }
    if (!city.entityId) continue;
    for (const neighborhood of getTravelKnowledgeChildren(index, city.entityId, 'neighborhood')) {
      const neighborhoodScore = placeSearchScore(neighborhood, query);
      if (neighborhoodScore !== null) {
        matches.push({
          entity: neighborhood,
          city,
          matchKind: 'neighborhood',
          score: neighborhoodScore,
        });
      }
    }
  }

  return matches
    .sort((left, right) => (
      left.score - right.score
      || (left.matchKind === right.matchKind ? 0 : left.matchKind === 'city' ? -1 : 1)
      || right.entity.popularityScore - left.entity.popularityScore
      || left.entity.name.localeCompare(right.entity.name)
    ))
    .slice(0, Math.max(1, Math.min(20, Math.round(limit))));
};

export const buildJourneySpecFromShapeWizard = (
  draft: JourneyShapeWizardDraft,
  pack: TravelDestinationPack,
): JourneySpec => {
  const index = getTravelKnowledgeIndex(pack);
  const country = (index.byType.get('country') ?? []).find((entity) => entity.countryCode === pack.countryCode);
  if (!country) throw new Error(`Travel knowledge for ${pack.countryCode} has no canonical country entity.`);

  const selectedCity = draft.selectedCitySlug
    ? index.bySlug.get(draft.selectedCitySlug)
    : undefined;
  if (draft.selectedCitySlug && selectedCity?.entityType !== 'city') throw new Error('The selected anchor city is not in the destination pack.');
  if (draft.journeyType !== 'single_country_circuit' && !selectedCity) {
    throw new Error('City breaks and base trips require an anchor city.');
  }

  const neighborhoodEntities = draft.selectedNeighborhoodSlugs.map((slug) => {
    const entity = index.bySlug.get(slug);
    if (entity?.entityType !== 'neighborhood' || !selectedCity || entity.parentId !== selectedCity.entityId) {
      throw new Error('A selected neighborhood is outside the anchor city.');
    }
    return entity;
  });

  const durationDays = draft.dateMode === 'exact'
    ? exactDurationDays(draft.startDate ?? '', draft.endDate ?? '')
    : Math.max(1, Math.round(draft.durationDays));
  const places: JourneyPlaceSelection[] = [toEntitySelection(country, 'country_scope', 0, true)];
  if (selectedCity) {
    places.push(toEntitySelection(
      selectedCity,
      draft.journeyType === 'single_country_circuit' ? 'must_visit' : 'base',
      places.length,
      true,
    ));
  }
  for (const neighborhood of neighborhoodEntities) {
    places.push(toEntitySelection(neighborhood, 'must_visit', places.length, true));
  }

  const spec = normalizeJourneySpec({
    version: JOURNEY_SPEC_VERSION,
    journeyType: draft.journeyType,
    countryCodes: [pack.countryCode],
    dateWindow: draft.dateMode === 'exact'
      ? { mode: 'exact', startDate: draft.startDate!, endDate: draft.endDate! }
      : { mode: 'flexible', durationDays, months: [draft.month] },
    durationDays,
    places,
    constraints: {
      roundTrip: false,
      routeLocked: false,
      maxBaseChanges: draft.journeyType === 'single_country_circuit'
        ? Math.max(1, Math.round(draft.maxBaseChanges))
        : 0,
      transportPreferences: [],
    },
    preferences: {
      pace: draft.pace,
      interestTags: draft.interestTags,
      vibeTags: [],
    },
    createdFrom: 'wizard_shape_v1',
    experimentVersion: 'thailand-shape-lab-v1',
  });

  const validation = validateJourneySpec(spec, { phase: 'intent' });
  if (!validation.valid) {
    throw new Error(`Shape wizard produced an invalid JourneySpec: ${validation.errors.join(' ')}`);
  }
  return spec;
};
