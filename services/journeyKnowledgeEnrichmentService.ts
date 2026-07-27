import type { ITimelineItem, ITrip, TimelineKnowledgeOrigin } from '../types';
import type { AppliedTravelTemplate } from '../shared/travelTemplateMatcher';
import { buildTravelActivityKnowledge } from '../shared/travelActivityKnowledge';
import type {
  TravelDestinationPack,
  TravelEntityCatalogItem,
} from '../shared/travelKnowledge';
import { getTravelKnowledgeIndex } from '../shared/travelKnowledgeIndex';
import {
  getTravelEntityActivityTypes,
  getTravelEntityCoordinates,
  getTravelEntityRecommendedStayRange,
  getTravelEntitySourceKeys,
  getTravelEntitySummary,
  toTravelEntityReference,
} from '../shared/travelKnowledgeProjection';
import {
  buildTripSkeletonFromTemplate,
  type JourneySkeletonBuildOptions,
} from './journeySkeletonService';
import {
  applyCityPaletteToItems,
  DEFAULT_CITY_COLOR_PALETTE_ID,
  getActivityColorByTypes,
} from '../utils';

export const JOURNEY_KNOWLEDGE_ENRICHER_VERSION = 'journey-knowledge-enricher-v1' as const;

const PACE_SLOT_FRACTIONS = {
  relaxed: [0.25],
  balanced: [0.18, 0.58],
  full: [0.12, 0.42, 0.72],
} as const;

const DEFAULT_MAX_ACTIVITIES_BY_PACE = {
  relaxed: 2,
  balanced: 4,
  full: 6,
} as const;

interface OccupiedInterval {
  start: number;
  end: number;
}

export interface JourneyKnowledgeEnrichmentOptions {
  now?: Date;
  maxActivitiesPerCity?: number;
}

export interface JourneyKnowledgeCompilationOptions
  extends JourneySkeletonBuildOptions, JourneyKnowledgeEnrichmentOptions {}

export interface JourneyKnowledgeCompilationResult {
  trip: ITrip;
  addedActivityCount: number;
  skeletonDurationMs: number;
  enrichmentDurationMs: number;
  compileDurationMs: number;
}

const measureNow = (): number => (
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now()
);

const intervalsOverlap = (
  left: OccupiedInterval,
  right: OccupiedInterval,
): boolean => left.start < right.end && right.start < left.end;

const candidateDuration = (entity: TravelEntityCatalogItem, now: Date): number => {
  const activityKnowledge = buildTravelActivityKnowledge(entity, now);
  if (activityKnowledge?.recommendedDuration) {
    const { min, max } = activityKnowledge.recommendedDuration.value;
    return Math.min(0.8, Math.max(0.04, ((min + max) / 2) / 1_440));
  }
  const range = getTravelEntityRecommendedStayRange(entity);
  if (!range) return 0.2;
  return Math.min(0.8, Math.max(0.08, (range.min + range.max) / 2));
};

const slotsForCity = (
  city: ITimelineItem,
  pace: keyof typeof PACE_SLOT_FRACTIONS,
): number[] => {
  const slots: number[] = [];
  const fullDays = Math.max(1, Math.ceil(city.duration));
  for (let dayIndex = 0; dayIndex < fullDays; dayIndex += 1) {
    for (const fraction of PACE_SLOT_FRACTIONS[pace]) {
      const start = city.startDateOffset + dayIndex + fraction;
      if (start < city.startDateOffset + city.duration) slots.push(start);
    }
  }
  return slots;
};

const findAvailableStart = (
  slots: readonly number[],
  duration: number,
  cityEnd: number,
  occupied: readonly OccupiedInterval[],
): number | undefined => slots.find((start) => {
  const interval = { start, end: start + duration };
  if (interval.end > cityEnd - 0.02) return false;
  return occupied.every((existing) => !intervalsOverlap(
    { start: interval.start - 0.02, end: interval.end + 0.02 },
    existing,
  ));
});

const knowledgeMetaForCandidate = (
  entity: TravelEntityCatalogItem,
  trip: ITrip,
  matchScore: number,
  origin: TimelineKnowledgeOrigin = 'knowledge_ranker',
): ITimelineItem['knowledgeMeta'] => ({
  entity: toTravelEntityReference(entity),
  datasetVersion: trip.planningMeta!.datasetVersion,
  origin,
  templateKey: trip.planningMeta!.templateKey,
  matchScore,
  sourceKeys: getTravelEntitySourceKeys(entity),
});

export const enrichTripSkeletonFromKnowledge = (
  skeleton: ITrip,
  pack: TravelDestinationPack,
  options: JourneyKnowledgeEnrichmentOptions = {},
): ITrip => {
  const planningMeta = skeleton.planningMeta;
  if (!planningMeta) throw new Error('Knowledge enrichment requires trip planning metadata.');
  if (planningMeta.routeStage === 'enriched') return skeleton;
  if (pack.dataset && pack.dataset.version !== planningMeta.datasetVersion) {
    throw new Error('Knowledge enrichment requires the same dataset version used for route selection.');
  }

  const now = options.now ?? new Date();
  const index = getTravelKnowledgeIndex(pack);
  const existingEntitySlugs = new Set(skeleton.items.flatMap((item) => (
    item.knowledgeMeta ? [item.knowledgeMeta.entity.canonicalSlug] : []
  )));
  const addedItems: ITimelineItem[] = [];
  const pace = planningMeta.journeySpec.preferences.pace;
  const maximum = Math.max(
    0,
    Math.round(options.maxActivitiesPerCity ?? DEFAULT_MAX_ACTIVITIES_BY_PACE[pace]),
  );

  for (const brief of planningMeta.destinationBriefs) {
    const city = skeleton.items.find((item) => (
      item.type === 'city'
      && item.knowledgeMeta?.entity.canonicalSlug === brief.city.canonicalSlug
    ));
    if (!city) continue;

    const cityEnd = city.startDateOffset + city.duration;
    const occupied: OccupiedInterval[] = skeleton.items
      .filter((item) => (
        item.type === 'activity'
        && item.startDateOffset >= city.startDateOffset
        && item.startDateOffset < cityEnd
      ))
      .map((item) => ({
        start: item.startDateOffset,
        end: item.startDateOffset + item.duration,
      }));
    const slots = slotsForCity(city, pace);
    let addedForCity = 0;

    for (const candidate of brief.activities) {
      if (addedForCity >= maximum) break;
      if (existingEntitySlugs.has(candidate.entity.canonicalSlug)) continue;
      const entity = (candidate.entity.entityId ? index.byId.get(candidate.entity.entityId) : undefined)
        ?? index.bySlug.get(candidate.entity.canonicalSlug);
      if (!entity || entity.entityType !== 'poi') continue;

      const duration = candidateDuration(entity, now);
      const startDateOffset = findAvailableStart(slots, duration, cityEnd, occupied);
      if (startDateOffset === undefined) continue;
      const activityTypes = getTravelEntityActivityTypes(entity);
      addedItems.push({
        id: `knowledge-${entity.entityId ?? entity.canonicalSlug}`,
        type: 'activity',
        title: entity.name,
        startDateOffset,
        duration,
        color: getActivityColorByTypes(activityTypes),
        description: getTravelEntitySummary(entity),
        location: entity.name,
        coordinates: getTravelEntityCoordinates(entity),
        countryCode: entity.countryCode,
        countryName: 'Thailand',
        activityType: activityTypes,
        activityKnowledge: buildTravelActivityKnowledge(entity, now),
        knowledgeMeta: knowledgeMetaForCandidate(entity, skeleton, candidate.matchScore),
      });
      existingEntitySlugs.add(entity.canonicalSlug);
      occupied.push({ start: startDateOffset, end: startDateOffset + duration });
      addedForCity += 1;
    }
  }

  const paletteId = skeleton.cityColorPaletteId ?? DEFAULT_CITY_COLOR_PALETTE_ID;
  return {
    ...skeleton,
    items: applyCityPaletteToItems([...skeleton.items, ...addedItems], paletteId),
    updatedAt: now.getTime(),
    planningMeta: {
      ...planningMeta,
      routeStage: 'enriched',
      trace: {
        skeletonCompilerVersion: planningMeta.trace?.skeletonCompilerVersion ?? 'unknown',
        templateRankerVersion: planningMeta.trace?.templateRankerVersion ?? 'unknown',
        compiledAt: planningMeta.trace?.compiledAt ?? new Date(skeleton.createdAt).toISOString(),
        ...planningMeta.trace,
        knowledgeEnricherVersion: JOURNEY_KNOWLEDGE_ENRICHER_VERSION,
        knowledgeActivityCount: addedItems.length,
      },
    },
  };
};

export const buildKnowledgeEnrichedTripFromTemplate = (
  applied: AppliedTravelTemplate,
  pack: TravelDestinationPack,
  options: JourneyKnowledgeCompilationOptions = {},
): JourneyKnowledgeCompilationResult => {
  const startedAt = measureNow();
  const skeleton = buildTripSkeletonFromTemplate(applied, pack, options);
  const skeletonCompletedAt = measureNow();
  const trip = enrichTripSkeletonFromKnowledge(skeleton, pack, options);
  const completedAt = measureNow();
  return {
    trip,
    addedActivityCount: trip.planningMeta?.trace?.knowledgeActivityCount ?? 0,
    skeletonDurationMs: Math.max(0, skeletonCompletedAt - startedAt),
    enrichmentDurationMs: Math.max(0, completedAt - skeletonCompletedAt),
    compileDurationMs: Math.max(0, completedAt - startedAt),
  };
};
