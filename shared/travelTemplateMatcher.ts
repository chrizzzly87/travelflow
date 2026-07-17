import {
  normalizeJourneySpec,
  validateJourneySpec,
  type JourneyPace,
  type JourneyPlaceRole,
  type JourneyPlaceSelection,
  type JourneySpec,
} from './journeySpec';
import type {
  TravelDestinationPack,
  TravelEntityCatalogItem,
  TravelTemplateCatalogItem,
  TravelTemplateStop,
} from './travelKnowledge';
import { getTravelKnowledgeIndex } from './travelKnowledgeIndex';

export const TRAVEL_TEMPLATE_RANKER_VERSION = 'travel-template-ranker-v1' as const;

export const TRAVEL_TEMPLATE_MATCH_REASON_VALUES = [
  'duration_fit',
  'pace_fit',
  'season_fit',
  'interest_fit',
  'selected_places_fit',
] as const;

export type TravelTemplateMatchReason = (typeof TRAVEL_TEMPLATE_MATCH_REASON_VALUES)[number];

export const TRAVEL_TEMPLATE_TRADEOFF_VALUES = [
  'duration_shorter_than_template',
  'duration_longer_than_template',
  'pace_adjustment',
  'seasonal_tradeoff',
  'partial_place_match',
] as const;

export type TravelTemplateTradeoff = (typeof TRAVEL_TEMPLATE_TRADEOFF_VALUES)[number];

export interface TravelTemplateMatch {
  template: TravelTemplateCatalogItem;
  score: number;
  reasons: TravelTemplateMatchReason[];
  tradeoffs: TravelTemplateTradeoff[];
  durationDeltaDays: number;
  matchedTagKeys: string[];
  selectedPlaceCoverage: number;
}

export interface MatchTravelTemplatesOptions {
  limit?: number;
}

export interface AppliedTravelTemplate {
  spec: JourneySpec;
  template: TravelTemplateCatalogItem;
  allocatedNights: number;
  unallocatedNights: number;
  overflowNights: number;
}

const PACE_INDEX: Record<JourneyPace, number> = {
  relaxed: 0,
  balanced: 1,
  full: 2,
};

const ROUTE_SELECTION_ROLES = new Set<JourneyPlaceRole>([
  'entry',
  'exit',
  'base',
  'must_visit',
  'day_trip',
]);

const unique = <T>(values: readonly T[]): T[] => Array.from(new Set(values));

const roundedScore = (value: number): number => Math.round(value * 10) / 10;

const getJourneyMonths = (spec: JourneySpec): number[] => {
  if (spec.dateWindow.mode === 'flexible') return unique(spec.dateWindow.months);

  const start = new Date(`${spec.dateWindow.startDate}T00:00:00Z`);
  const end = new Date(`${spec.dateWindow.endDate}T00:00:00Z`);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return [];

  const months: number[] = [];
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
  while (cursor <= last && months.length < 12) {
    months.push(cursor.getUTCMonth() + 1);
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return unique(months);
};

const durationDelta = (durationDays: number, template: TravelTemplateCatalogItem): number => {
  if (durationDays < template.minDays) return template.minDays - durationDays;
  if (durationDays > template.maxDays) return durationDays - template.maxDays;
  return 0;
};

const durationScore = (delta: number): number => Math.max(0, 35 - (delta * 6));

const paceScore = (requested: JourneyPace, preferred: JourneyPace): number => {
  const distance = Math.abs(PACE_INDEX[requested] - PACE_INDEX[preferred]);
  if (distance === 0) return 15;
  if (distance === 1) return 8;
  return 2;
};

const seasonScore = (journeyMonths: number[], idealMonths: number[]): { score: number; overlap: number } => {
  if (journeyMonths.length === 0 || idealMonths.length === 0) return { score: 8, overlap: 0 };
  const ideal = new Set(idealMonths);
  const overlapCount = journeyMonths.filter((month) => ideal.has(month)).length;
  const overlap = overlapCount / journeyMonths.length;
  return { score: 15 * overlap, overlap };
};

const tagScore = (
  desiredTags: Set<string>,
  template: TravelTemplateCatalogItem,
): { score: number; matchedTagKeys: string[] } => {
  if (desiredTags.size === 0) return { score: 12, matchedTagKeys: [] };
  const matchedTagKeys: string[] = [];
  let matchedWeight = 0;
  let totalWeight = 0;
  for (const tag of template.tags) {
    const weight = Math.max(0, tag.weight);
    totalWeight += weight;
    if (desiredTags.has(tag.tagKey)) {
      matchedTagKeys.push(tag.tagKey);
      matchedWeight += weight;
    }
  }
  const desiredCoverage = matchedTagKeys.length / desiredTags.size;
  const templateCoverage = totalWeight > 0 ? matchedWeight / totalWeight : 0;
  return {
    score: 25 * ((desiredCoverage * 0.7) + (templateCoverage * 0.3)),
    matchedTagKeys: unique(matchedTagKeys).sort(),
  };
};

const selectedRouteSlugs = (spec: JourneySpec): string[] => unique(
  spec.places
    .filter((place) => ROUTE_SELECTION_ROLES.has(place.role))
    .map((place) => place.entity.canonicalSlug),
);

const lockedRouteSlugs = (spec: JourneySpec): string[] => unique(
  spec.places
    .filter((place) => ROUTE_SELECTION_ROLES.has(place.role) && (place.locked || spec.constraints.routeLocked))
    .map((place) => place.entity.canonicalSlug),
);

const templateStopSlugs = (template: TravelTemplateCatalogItem): Set<string> =>
  new Set(template.stops.map((stop) => stop.entitySlug));

const baseChangeCount = (template: TravelTemplateCatalogItem): number => {
  const bases = unique(
    template.stops
      .filter((stop) => stop.stopRole === 'base' && !stop.isOptional)
      .map((stop) => stop.entitySlug),
  );
  return Math.max(0, bases.length - 1);
};

const isTemplateEligible = (spec: JourneySpec, template: TravelTemplateCatalogItem): boolean => {
  if (!spec.countryCodes.includes(template.countryCode)) return false;
  if (template.journeyType !== spec.journeyType) return false;
  if (spec.constraints.maxBaseChanges !== undefined
    && baseChangeCount(template) > spec.constraints.maxBaseChanges) return false;

  const stopSlugs = templateStopSlugs(template);
  const avoidedSlugs = spec.places
    .filter((place) => place.role === 'avoid')
    .map((place) => place.entity.canonicalSlug);
  if (avoidedSlugs.some((slug) => stopSlugs.has(slug))) return false;
  return lockedRouteSlugs(spec).every((slug) => stopSlugs.has(slug));
};

export const matchTravelTemplates = (
  spec: JourneySpec,
  pack: TravelDestinationPack,
  options: MatchTravelTemplatesOptions = {},
): TravelTemplateMatch[] => {
  const limit = Math.max(1, Math.floor(options.limit ?? 3));
  const desiredTags = new Set([
    ...spec.preferences.interestTags,
    ...spec.preferences.vibeTags,
  ]);
  const journeyMonths = getJourneyMonths(spec);
  const selectedSlugs = selectedRouteSlugs(spec);

  const matches = pack.templates.flatMap((template): TravelTemplateMatch[] => {
    if (!isTemplateEligible(spec, template)) return [];

    const delta = durationDelta(spec.durationDays, template);
    const stopSlugs = templateStopSlugs(template);
    const selectedMatches = selectedSlugs.filter((slug) => stopSlugs.has(slug)).length;
    const selectedPlaceCoverage = selectedSlugs.length > 0 ? selectedMatches / selectedSlugs.length : 1;
    const selectedScore = selectedSlugs.length > 0 ? selectedPlaceCoverage * 10 : 5;
    const seasonal = seasonScore(journeyMonths, template.idealMonths);
    const tags = tagScore(desiredTags, template);
    const pace = paceScore(spec.preferences.pace, template.preferredPace);
    const reasons: TravelTemplateMatchReason[] = [];
    const tradeoffs: TravelTemplateTradeoff[] = [];

    if (delta === 0) reasons.push('duration_fit');
    if (spec.preferences.pace === template.preferredPace) reasons.push('pace_fit');
    if (seasonal.overlap > 0) reasons.push('season_fit');
    if (tags.matchedTagKeys.length > 0) reasons.push('interest_fit');
    if (selectedSlugs.length > 0 && selectedPlaceCoverage === 1) reasons.push('selected_places_fit');

    if (spec.durationDays < template.minDays) tradeoffs.push('duration_shorter_than_template');
    if (spec.durationDays > template.maxDays) tradeoffs.push('duration_longer_than_template');
    if (spec.preferences.pace !== template.preferredPace) tradeoffs.push('pace_adjustment');
    if (journeyMonths.length > 0 && seasonal.overlap === 0) tradeoffs.push('seasonal_tradeoff');
    if (selectedSlugs.length > 0 && selectedPlaceCoverage < 1) tradeoffs.push('partial_place_match');

    return [{
      template,
      score: roundedScore(durationScore(delta) + pace + seasonal.score + tags.score + selectedScore),
      reasons,
      tradeoffs,
      durationDeltaDays: delta,
      matchedTagKeys: tags.matchedTagKeys,
      selectedPlaceCoverage: roundedScore(selectedPlaceCoverage),
    }];
  });

  return matches
    .sort((left, right) => (
      right.score - left.score
      || left.durationDeltaDays - right.durationDeltaDays
      || left.template.templateKey.localeCompare(right.template.templateKey)
    ))
    .slice(0, limit);
};

interface NightAllocation {
  nightsBySequence: Map<number, number>;
  allocatedNights: number;
  unallocatedNights: number;
  overflowNights: number;
}

const allocateTemplateNights = (
  stops: TravelTemplateStop[],
  durationDays: number,
): NightAllocation => {
  const stayStops = stops
    .filter((stop) => stop.maxNights > 0)
    .sort((left, right) => left.sequence - right.sequence);
  const requiredStops = stayStops.filter((stop) => !stop.isOptional);
  const optionalStops = stayStops.filter((stop) => stop.isOptional);
  const nightsBySequence = new Map<number, number>();

  for (const stop of requiredStops) nightsBySequence.set(stop.sequence, Math.max(1, stop.minNights));
  let allocatedNights = Array.from(nightsBySequence.values()).reduce((sum, nights) => sum + nights, 0);

  if (allocatedNights > durationDays) {
    const reducible = [...requiredStops].reverse();
    while (allocatedNights > durationDays) {
      const stop = reducible.find((candidate) => (nightsBySequence.get(candidate.sequence) ?? 0) > 1);
      if (!stop) break;
      nightsBySequence.set(stop.sequence, (nightsBySequence.get(stop.sequence) ?? 1) - 1);
      allocatedNights -= 1;
    }
  }

  for (const stop of optionalStops) {
    const minimum = Math.max(1, stop.minNights);
    if (allocatedNights + minimum <= durationDays) {
      nightsBySequence.set(stop.sequence, minimum);
      allocatedNights += minimum;
    }
  }

  const includedStops = stayStops.filter((stop) => nightsBySequence.has(stop.sequence));
  let madeProgress = true;
  while (allocatedNights < durationDays && madeProgress) {
    madeProgress = false;
    for (const stop of includedStops) {
      const current = nightsBySequence.get(stop.sequence) ?? 0;
      if (current >= stop.maxNights || allocatedNights >= durationDays) continue;
      nightsBySequence.set(stop.sequence, current + 1);
      allocatedNights += 1;
      madeProgress = true;
    }
  }

  return {
    nightsBySequence,
    allocatedNights,
    unallocatedNights: Math.max(0, durationDays - allocatedNights),
    overflowNights: Math.max(0, allocatedNights - durationDays),
  };
};

const toPlaceRole = (role: TravelTemplateStop['stopRole']): JourneyPlaceRole => role;

const toCanonicalPlace = (
  stop: TravelTemplateStop,
  entity: TravelEntityCatalogItem,
  order: number,
  allocatedNights?: number,
  locked = false,
): JourneyPlaceSelection => ({
  entity: {
    entityId: entity.entityId,
    canonicalSlug: entity.canonicalSlug,
    entityType: entity.entityType,
    countryCode: entity.countryCode,
    name: entity.name,
    resolution: 'canonical',
  },
  role: toPlaceRole(stop.stopRole),
  order,
  nights: allocatedNights,
  locked,
});

export const applyTravelTemplateToJourneySpec = (
  spec: JourneySpec,
  pack: TravelDestinationPack,
  template: TravelTemplateCatalogItem,
): AppliedTravelTemplate => {
  const index = getTravelKnowledgeIndex(pack);
  const allocation = allocateTemplateNights(template.stops, spec.durationDays);
  const templateSlugs = templateStopSlugs(template);
  const preservedPlaces = spec.places.flatMap((place): JourneyPlaceSelection[] => {
    if (place.role === 'country_scope' || place.role === 'avoid') return [place];
    if (templateSlugs.has(place.entity.canonicalSlug)) return [];
    if (place.role === 'entry' || place.role === 'exit') return [place];
    return [{ ...place, role: 'consider', nights: undefined }];
  });
  const templatePlaces = template.stops.flatMap((stop, stopIndex): JourneyPlaceSelection[] => {
    const entity = index.byId.get(stop.entityId) ?? index.bySlug.get(stop.entitySlug);
    if (!entity) return [];
    const nights = allocation.nightsBySequence.get(stop.sequence);
    const locked = spec.places.some((place) => (
      place.locked === true && place.entity.canonicalSlug === stop.entitySlug
    ));
    if (stop.isOptional && stop.maxNights > 0 && nights === undefined) {
      return [toCanonicalPlace(
        { ...stop, stopRole: 'consider' },
        entity,
        preservedPlaces.length + stopIndex,
        undefined,
        locked,
      )];
    }
    return [toCanonicalPlace(stop, entity, preservedPlaces.length + stopIndex, nights, locked)];
  });

  const appliedSpec = normalizeJourneySpec({
    ...spec,
    places: [...preservedPlaces, ...templatePlaces].map((place, order) => ({ ...place, order })),
    knowledgeContext: {
      datasetKey: pack.dataset?.datasetKey || `${pack.countryCode.toLowerCase()}-travel-knowledge`,
      datasetVersion: pack.dataset?.version || template.datasetVersion,
      templateKey: template.templateKey,
      templateVersion: template.version,
    },
    createdFrom: 'wizard_shape_v1',
    experimentVersion: 'thailand-template-v1',
  });

  const validation = validateJourneySpec(appliedSpec);
  if (!validation.valid) {
    throw new Error(`Travel template ${template.templateKey} produced an invalid JourneySpec: ${validation.errors.join(' ')}`);
  }

  return {
    spec: appliedSpec,
    template,
    allocatedNights: allocation.allocatedNights,
    unallocatedNights: allocation.unallocatedNights,
    overflowNights: allocation.overflowNights,
  };
};
