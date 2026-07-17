import type {
  ITimelineItem,
  ITrip,
  JourneyKnowledgeSource,
  JourneyPlanningContextTrace,
  TimelineKnowledgeOrigin,
} from '../types';
import {
  TRAVEL_TEMPLATE_RANKER_VERSION,
  type AppliedTravelTemplate,
  type TravelTemplateMatch,
} from '../shared/travelTemplateMatcher';
import type { JourneySpec } from '../shared/journeySpec';
import { buildTravelActivityKnowledge } from '../shared/travelActivityKnowledge';
import type { TravelDestinationPack, TravelEntityCatalogItem } from '../shared/travelKnowledge';
import { getTravelKnowledgeIndex } from '../shared/travelKnowledgeIndex';
import {
  getTravelEntityActivityTypes,
  getTravelEntityCoordinates,
  getTravelEntitySourceKeys,
  getTravelEntitySummary,
  toTravelEntityReference,
} from '../shared/travelKnowledgeProjection';
import { buildJourneyDestinationBriefs } from './journeyDestinationBriefService';
import {
  DEFAULT_CITY_COLOR_PALETTE_ID,
  DEFAULT_MAP_COLOR_MODE,
  TRAVEL_COLOR,
  applyCityPaletteToItems,
  generateTripId,
  getActivityColorByTypes,
} from '../utils';

export const JOURNEY_SKELETON_COMPILER_VERSION = 'journey-skeleton-v1' as const;

export interface JourneySkeletonBuildOptions {
  now?: Date;
  tripId?: string;
  knowledgeSource?: JourneyKnowledgeSource;
  planningContext?: JourneyPlanningContextTrace;
  match?: Pick<TravelTemplateMatch, 'score' | 'reasons' | 'tradeoffs'>;
}

const formatIsoDate = (date: Date): string => date.toISOString().slice(0, 10);

const nextFlexibleStartDate = (spec: JourneySpec, now: Date): string => {
  const months = spec.dateWindow.mode === 'flexible' ? spec.dateWindow.months : [];
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth() + 1;
  const candidates = months.length > 0 ? Array.from(new Set(months)).sort((a, b) => a - b) : [currentMonth + 1];

  for (const month of candidates) {
    const normalizedMonth = month > 12 ? month - 12 : month;
    const year = normalizedMonth > currentMonth ? currentYear : currentYear + 1;
    const candidate = new Date(Date.UTC(year, normalizedMonth - 1, 1));
    if (candidate.getTime() > now.getTime()) return formatIsoDate(candidate);
  }

  return formatIsoDate(new Date(Date.UTC(currentYear + 1, Math.max(0, candidates[0]! - 1), 1)));
};

export const resolveJourneySkeletonStartDate = (spec: JourneySpec, now = new Date()): string => {
  if (spec.dateWindow.mode === 'exact') return spec.dateWindow.startDate;
  return nextFlexibleStartDate(spec, now);
};

const knowledgeMetaForEntity = (
  entity: TravelEntityCatalogItem,
  datasetVersion: string,
  origin: TimelineKnowledgeOrigin,
  templateKey: string,
  matchScore?: number,
): ITimelineItem['knowledgeMeta'] => ({
  entity: toTravelEntityReference(entity),
  datasetVersion,
  origin,
  templateKey,
  matchScore,
  sourceKeys: getTravelEntitySourceKeys(entity),
});

export const buildTripSkeletonFromTemplate = (
  applied: AppliedTravelTemplate,
  pack: TravelDestinationPack,
  options: JourneySkeletonBuildOptions = {},
): ITrip => {
  const index = getTravelKnowledgeIndex(pack);
  const now = options.now ?? new Date();
  const places = applied.spec.places.filter((place) => place.role !== 'country_scope' && place.role !== 'avoid');
  const items: ITimelineItem[] = [];
  const baseEntries: Array<{
    place: typeof places[number];
    entity: TravelEntityCatalogItem;
    item: ITimelineItem;
  }> = [];
  const datasetVersion = applied.spec.knowledgeContext?.datasetVersion
    ?? pack.dataset?.version
    ?? applied.template.datasetVersion;
  const templateKey = applied.template.templateKey;
  let offset = 0;

  for (const place of places) {
    if (place.role !== 'base') continue;
    const entity = (place.entity.entityId ? index.byId.get(place.entity.entityId) : undefined)
      ?? index.bySlug.get(place.entity.canonicalSlug);
    if (!entity) continue;
    const duration = Math.max(1, place.nights ?? 1);
    const item: ITimelineItem = {
      id: `city-${entity.entityId ?? entity.canonicalSlug}`,
      type: 'city',
      title: entity.name,
      startDateOffset: offset,
      duration,
      color: '#f59e0b',
      description: getTravelEntitySummary(entity),
      location: entity.name,
      coordinates: getTravelEntityCoordinates(entity),
      countryCode: entity.countryCode,
      countryName: 'Thailand',
      knowledgeMeta: knowledgeMetaForEntity(
        entity,
        datasetVersion,
        place.locked ? 'traveler_selection' : 'route_template',
        templateKey,
        options.match?.score,
      ),
    };
    items.push(item);
    baseEntries.push({ place, entity, item });
    offset += duration;
  }

  const orderedBaseEntries = baseEntries.sort((left, right) => left.item.startDateOffset - right.item.startDateOffset);
  for (let index = 1; index < orderedBaseEntries.length; index += 1) {
    const previousEntry = orderedBaseEntries[index - 1]!;
    const nextEntry = orderedBaseEntries[index]!;
    const previous = previousEntry.item;
    const next = nextEntry.item;
    const templateLeg = applied.template.legs.find((leg) => (
      leg.legRole === 'transfer'
      && leg.fromEntitySlug === previousEntry.entity.canonicalSlug
      && leg.toEntitySlug === nextEntry.entity.canonicalSlug
    ));
    const durationMinutes = templateLeg
      ? (templateLeg.durationMinMinutes + templateLeg.durationMaxMinutes) / 2
      : 144;
    const durationDays = durationMinutes / 1_440;
    const durationDescription = templateLeg
      ? ` Typical transport time: ${Math.round(templateLeg.durationMinMinutes / 30) / 2}–${Math.round(templateLeg.durationMaxMinutes / 30) / 2} hours before local buffers.`
      : '';
    items.push({
      id: `travel-${previous.id}-${next.id}`,
      type: 'travel',
      title: `Travel to ${next.title}`,
      startDateOffset: Math.max(previous.startDateOffset, next.startDateOffset - durationDays),
      duration: durationDays,
      color: TRAVEL_COLOR,
      description: `Transfer from ${previous.title} to ${next.title}.${durationDescription} Confirm live schedules before departure.`,
      location: `${previous.title} – ${next.title}`,
      transportMode: templateLeg?.transportModes[0],
      routeDurationHours: templateLeg ? durationMinutes / 60 : undefined,
      routeDistanceKm: templateLeg?.distanceKm,
    });
  }

  let currentBaseEntry = orderedBaseEntries[0];
  let detailIndexWithinBase = 0;
  for (const place of places) {
    if (place.role === 'base') {
      currentBaseEntry = orderedBaseEntries.find((entry) => entry.entity.canonicalSlug === place.entity.canonicalSlug)
        ?? currentBaseEntry;
      detailIndexWithinBase = 0;
      continue;
    }
    if (place.role !== 'must_visit' && place.role !== 'day_trip') continue;
    const entity = (place.entity.entityId ? index.byId.get(place.entity.entityId) : undefined)
      ?? index.bySlug.get(place.entity.canonicalSlug);
    if (!entity || !currentBaseEntry) continue;
    const currentBase = currentBaseEntry.item;
    const activityTypes = getTravelEntityActivityTypes(entity);
    const preferredOffset = currentBase.startDateOffset + 0.45 + (detailIndexWithinBase * 0.55);
    const latestOffset = currentBase.startDateOffset + Math.max(0.5, currentBase.duration - 0.4);
    const dayTripLeg = place.role === 'day_trip'
      ? applied.template.legs.find((leg) => (
        leg.legRole === 'day_trip'
        && leg.fromEntitySlug === currentBaseEntry.entity.canonicalSlug
        && leg.toEntitySlug === entity.canonicalSlug
      ))
      : undefined;
    const dayTripTransport = dayTripLeg
      ? ` Allow ${Math.round(dayTripLeg.durationMinMinutes / 30) / 2}–${Math.round(dayTripLeg.durationMaxMinutes / 30) / 2} hours for ${dayTripLeg.roundTrip ? 'round-trip ' : ''}transport; verify live conditions.`
      : '';
    items.push({
      id: `place-${entity.entityId ?? entity.canonicalSlug}`,
      type: 'activity',
      title: entity.name,
      startDateOffset: Math.min(preferredOffset, latestOffset),
      duration: place.role === 'day_trip' ? 0.5 : 0.18,
      color: getActivityColorByTypes(activityTypes),
      description: `${getTravelEntitySummary(entity) ?? ''}${dayTripTransport}`.trim() || undefined,
      location: entity.name,
      coordinates: getTravelEntityCoordinates(entity),
      countryCode: entity.countryCode,
      countryName: 'Thailand',
      activityType: activityTypes,
      activityKnowledge: buildTravelActivityKnowledge(entity, now),
      knowledgeMeta: knowledgeMetaForEntity(
        entity,
        datasetVersion,
        place.locked ? 'traveler_selection' : 'route_template',
        templateKey,
        options.match?.score,
      ),
    });
    detailIndexWithinBase += 1;
  }

  const knowledge = applied.spec.knowledgeContext;
  if (!knowledge?.templateKey || !knowledge.templateVersion) {
    throw new Error('A route skeleton requires a template-backed JourneySpec.');
  }

  const destinationBriefs = buildJourneyDestinationBriefs(applied.spec, pack);
  return {
    id: options.tripId ?? generateTripId(),
    title: applied.template.copy.title,
    startDate: resolveJourneySkeletonStartDate(applied.spec, now),
    items: applyCityPaletteToItems(items, DEFAULT_CITY_COLOR_PALETTE_ID),
    createdAt: now.getTime(),
    updatedAt: now.getTime(),
    isFavorite: false,
    roundTrip: applied.spec.constraints.roundTrip || undefined,
    cityColorPaletteId: DEFAULT_CITY_COLOR_PALETTE_ID,
    mapColorMode: DEFAULT_MAP_COLOR_MODE,
    sourceKind: 'created',
    sourceTemplateId: applied.template.id,
    planningMeta: {
      journeySpec: applied.spec,
      routeStage: 'skeleton',
      datasetVersion: knowledge.datasetVersion,
      templateKey: knowledge.templateKey,
      templateVersion: knowledge.templateVersion,
      destinationBriefs,
      trace: {
        skeletonCompilerVersion: JOURNEY_SKELETON_COMPILER_VERSION,
        templateRankerVersion: TRAVEL_TEMPLATE_RANKER_VERSION,
        knowledgeSource: options.knowledgeSource,
        planningContext: options.planningContext,
        matchedTemplateScore: options.match?.score,
        matchedTemplateReasons: options.match ? [...options.match.reasons] : undefined,
        matchedTemplateTradeoffs: options.match ? [...options.match.tradeoffs] : undefined,
        compiledAt: now.toISOString(),
      },
    },
  };
};
