import type { JourneySpec } from '../shared/journeySpec';
import {
  JOURNEY_AUDIENCE_SIGNAL_TAGS,
  JOURNEY_DESTINATION_BRIEF_VERSION,
  type JourneyAudienceSignal,
  type JourneyAudienceSignalTag,
  type JourneyBriefValue,
  type JourneyDestinationBrief,
  type JourneyDestinationCandidate,
} from '../shared/journeyDestinationBrief';
import type {
  TravelDestinationPack,
  TravelEntityCatalogItem,
  TravelEntityFact,
  TravelEntityReference,
  TravelEntityTag,
} from '../shared/travelKnowledge';
import {
  getTravelKnowledgeChildren,
  getTravelKnowledgeDescendants,
  getTravelKnowledgeIndex,
} from '../shared/travelKnowledgeIndex';

const AUDIENCE_SIGNAL_TAGS = new Set<string>(JOURNEY_AUDIENCE_SIGNAL_TAGS);

const toEntityReference = (entity: TravelEntityCatalogItem): TravelEntityReference => ({
  entityId: entity.entityId,
  canonicalSlug: entity.canonicalSlug,
  entityType: entity.entityType,
  countryCode: entity.countryCode,
  name: entity.name,
  resolution: entity.resolution,
});

const sourceUrlFromMetadata = (metadata: Record<string, unknown>): string | undefined => {
  const sourceUrl = metadata.sourceUrl;
  return typeof sourceUrl === 'string' && sourceUrl.length > 0 ? sourceUrl : undefined;
};

const toBriefValue = <T>(
  fact: TravelEntityFact | undefined,
  isValid: (value: unknown) => value is T,
): JourneyBriefValue<T> | undefined => {
  if (!fact || !isValid(fact.valueJson)) return undefined;
  return {
    value: fact.valueJson,
    unit: fact.unit,
    support: {
      sourceKey: fact.sourceKey,
      sourceUrl: sourceUrlFromMetadata(fact.metadata),
      confidence: fact.confidence,
      observedAt: fact.observedAt,
      validUntil: fact.validUntil,
    },
  };
};

const isString = (value: unknown): value is string => typeof value === 'string' && value.length > 0;
const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const isStringArray = (value: unknown): value is string[] => (
  Array.isArray(value) && value.every((entry) => typeof entry === 'string' && entry.length > 0)
);
const isMonthArray = (value: unknown): value is number[] => (
  Array.isArray(value)
  && value.every((entry) => Number.isInteger(entry) && entry >= 1 && entry <= 12)
);
const isRecommendedStay = (value: unknown): value is { min: number; max: number } => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as { min?: unknown; max?: unknown };
  return isFiniteNumber(candidate.min)
    && isFiniteNumber(candidate.max)
    && candidate.min >= 0
    && candidate.max >= candidate.min;
};

const findFact = (entity: TravelEntityCatalogItem, factKey: string): TravelEntityFact | undefined => (
  entity.facts.find((fact) => fact.factKey === factKey)
);

const toAudienceSignal = (tag: TravelEntityTag): JourneyAudienceSignal | undefined => {
  if (!AUDIENCE_SIGNAL_TAGS.has(tag.tagKey)) return undefined;
  return {
    tagKey: tag.tagKey as JourneyAudienceSignalTag,
    relevance: tag.relevance,
    evidenceLevel: tag.evidenceLevel,
    evidenceNote: tag.evidenceNote,
    sourceKey: tag.sourceKey,
    sourceUrl: sourceUrlFromMetadata(tag.metadata),
    validUntil: tag.validUntil,
  };
};

const audienceSignalsForEntity = (entity: TravelEntityCatalogItem): JourneyAudienceSignal[] => (
  entity.tags
    .map(toAudienceSignal)
    .filter((signal): signal is JourneyAudienceSignal => Boolean(signal))
    .sort((left, right) => right.relevance - left.relevance || left.tagKey.localeCompare(right.tagKey))
);

const generalTagsForEntity = (entity: TravelEntityCatalogItem): string[] => (
  entity.tags
    .filter((tag) => !AUDIENCE_SIGNAL_TAGS.has(tag.tagKey))
    .sort((left, right) => right.relevance - left.relevance || left.tagKey.localeCompare(right.tagKey))
    .map((tag) => tag.tagKey)
);

const scoreCandidate = (
  entity: TravelEntityCatalogItem,
  preferenceTags: ReadonlySet<string>,
  selectedSlugs: ReadonlySet<string>,
): number => {
  const tagMatches = entity.tags.reduce(
    (count, tag) => count + (preferenceTags.has(tag.tagKey) ? 1 : 0),
    0,
  );
  const score = (entity.popularityScore * 0.52)
    + (entity.hiddenGemScore * 0.16)
    + Math.min(24, tagMatches * 8)
    + (selectedSlugs.has(entity.canonicalSlug) ? 32 : 0);
  return Math.round(Math.min(100, score));
};

const toCandidate = (
  entity: TravelEntityCatalogItem,
  preferenceTags: ReadonlySet<string>,
  selectedSlugs: ReadonlySet<string>,
): JourneyDestinationCandidate => ({
  entity: toEntityReference(entity),
  summary: toBriefValue(findFact(entity, 'summary'), isString),
  tags: generalTagsForEntity(entity),
  audienceSignals: audienceSignalsForEntity(entity),
  matchScore: scoreCandidate(entity, preferenceTags, selectedSlugs),
  popularityScore: entity.popularityScore,
  hiddenGemScore: entity.hiddenGemScore,
  selectedByTraveler: selectedSlugs.has(entity.canonicalSlug),
});

const rankCandidates = (candidates: JourneyDestinationCandidate[]): JourneyDestinationCandidate[] => (
  candidates.sort((left, right) => (
    Number(right.selectedByTraveler) - Number(left.selectedByTraveler)
    || right.matchScore - left.matchScore
    || right.popularityScore - left.popularityScore
    || left.entity.name.localeCompare(right.entity.name)
  ))
);

export interface JourneyDestinationBriefOptions {
  maxNeighborhoods?: number;
  maxActivities?: number;
}

export const buildJourneyDestinationBriefs = (
  spec: JourneySpec,
  pack: TravelDestinationPack,
  options: JourneyDestinationBriefOptions = {},
): JourneyDestinationBrief[] => {
  const maxNeighborhoods = Math.max(0, options.maxNeighborhoods ?? 4);
  const maxActivities = Math.max(0, options.maxActivities ?? 6);
  const index = getTravelKnowledgeIndex(pack);
  const selectedSlugs = new Set(
    spec.places.filter((place) => place.locked === true).map((place) => place.entity.canonicalSlug),
  );
  const preferenceTags = new Set([
    ...spec.preferences.interestTags,
    ...spec.preferences.vibeTags,
  ]);
  const baseCities = spec.places.flatMap((place): TravelEntityCatalogItem[] => {
    if (place.role !== 'base' || place.entity.entityType !== 'city') return [];
    const entity = (place.entity.entityId ? index.byId.get(place.entity.entityId) : undefined)
      ?? index.bySlug.get(place.entity.canonicalSlug);
    return entity ? [entity] : [];
  });
  const uniqueBaseCities = Array.from(new Map(
    baseCities.map((city) => [city.entityId, city]),
  ).values());

  return uniqueBaseCities.map((city): JourneyDestinationBrief => {
    const neighborhoods = city.entityId
      ? [...getTravelKnowledgeChildren(index, city.entityId, 'neighborhood')]
      : [];
    const activities = city.entityId
      ? [...getTravelKnowledgeDescendants(index, city.entityId, 'poi')]
      : [];

    return {
      version: JOURNEY_DESTINATION_BRIEF_VERSION,
      datasetVersion: pack.dataset?.version ?? city.datasetVersion,
      city: toEntityReference(city),
      summary: toBriefValue(findFact(city, 'summary'), isString),
      bestMonths: toBriefValue(findFact(city, 'season.best_months'), isMonthArray),
      seasonalCaution: toBriefValue(findFact(city, 'season.caution'), isString),
      transportSummary: toBriefValue(findFact(city, 'transport.summary'), isString),
      signatureDishes: toBriefValue(findFact(city, 'food.signature_dishes'), isStringArray),
      relativeCostLevel: toBriefValue(findFact(city, 'cost.relative_level'), isFiniteNumber),
      recommendedStay: toBriefValue(findFact(city, 'stay.recommended_days'), isRecommendedStay),
      tags: generalTagsForEntity(city),
      audienceSignals: audienceSignalsForEntity(city),
      neighborhoods: rankCandidates(neighborhoods.map((entity) => (
        toCandidate(entity, preferenceTags, selectedSlugs)
      ))).slice(0, maxNeighborhoods),
      activities: rankCandidates(activities.map((entity) => (
        toCandidate(entity, preferenceTags, selectedSlugs)
      ))).slice(0, maxActivities),
    };
  });
};
