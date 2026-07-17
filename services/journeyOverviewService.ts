import type {
  ITrip,
  ITimelineItem,
  JourneyPlanningTrace,
  TimelineKnowledgeOrigin,
} from '../types';
import type { JourneyType } from '../shared/journeySpec';
import type {
  TravelEntityReference,
  TravelEvidenceLevel,
} from '../shared/travelKnowledge';
import type { TransportMode } from '../shared/transportModes';
import { findTravelBetweenCities } from '../utils';

export const JOURNEY_OVERVIEW_MODEL_VERSION = 1 as const;

export type JourneyOverviewSource = 'structured' | 'legacy';
export type JourneyOverviewTransferLoad = 'light' | 'balanced' | 'heavy' | 'unknown';
export type JourneyOverviewActivityKind = 'scheduled' | 'recommended' | 'day_trip';

export interface JourneyOverviewCoordinates {
  lat: number;
  lng: number;
}

export interface JourneyOverviewNeighborhood {
  id: string;
  entity: TravelEntityReference;
  title: string;
  selectedByTraveler: boolean;
  matchScore: number;
  popularityScore: number;
  hiddenGemScore: number;
}

export interface JourneyOverviewActivity {
  id: string;
  title: string;
  kind: JourneyOverviewActivityKind;
  sourceItemId?: string;
  entity?: TravelEntityReference;
  selectedByTraveler: boolean;
  matchScore?: number;
}

export interface JourneyOverviewAudienceSignal {
  tagKey: string;
  relevance: number;
  evidenceLevel: TravelEvidenceLevel;
}

export interface JourneyOverviewChapter {
  id: string;
  order: number;
  sourceItemId: string;
  entity?: TravelEntityReference;
  title: string;
  location?: string;
  startDay: number;
  nights: number;
  shareOfTrip: number;
  coordinates?: JourneyOverviewCoordinates;
  locked: boolean;
  origin?: TimelineKnowledgeOrigin;
  tags: string[];
  signatureDishes: string[];
  audienceSignals: JourneyOverviewAudienceSignal[];
  neighborhoods: JourneyOverviewNeighborhood[];
  activities: JourneyOverviewActivity[];
  dayTrips: JourneyOverviewActivity[];
}

export interface JourneyOverviewLeg {
  id: string;
  order: number;
  sourceItemId?: string;
  fromChapterId: string;
  toChapterId: string;
  mode?: TransportMode;
  durationMinutes?: number;
  distanceKm?: number;
  load: JourneyOverviewTransferLoad;
  exceedsTolerance: boolean;
}

export type JourneyOverviewWarningCode =
  | 'legacy_trip'
  | 'open_route_decisions'
  | 'transfer_metrics_missing'
  | 'transfer_exceeds_tolerance';

export interface JourneyOverviewWarning {
  id: string;
  code: JourneyOverviewWarningCode;
  severity: 'info' | 'warning';
  chapterId?: string;
  legId?: string;
  value?: number;
  limit?: number;
}

export interface JourneyOverviewModel {
  version: typeof JOURNEY_OVERVIEW_MODEL_VERSION;
  source: JourneyOverviewSource;
  identity: {
    title: string;
    journeyType: JourneyType | 'legacy';
    startDate: string;
    endDate: string;
    durationDays: number;
    pace?: string;
    interestTags: string[];
    vibeTags: string[];
  };
  summary: {
    baseCount: number;
    dayTripCount: number;
    transferCount: number;
    totalTransferMinutes: number;
    longestTransferMinutes?: number;
    plannedActivityCount: number;
    openDecisionCount: number;
  };
  chapters: JourneyOverviewChapter[];
  legs: JourneyOverviewLeg[];
  warnings: JourneyOverviewWarning[];
  provenance?: {
    datasetVersion: string;
    templateKey: string;
    templateVersion: number;
    routeStage: 'skeleton' | 'enriched';
    compiledAt?: string;
    matchedTemplateScore?: number;
    reasons: string[];
    tradeoffs: string[];
  };
}

const asPositiveNumber = (value: number | undefined): number | undefined => (
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined
);

const isoDatePlusDays = (value: string, days: number): string => {
  const parsed = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed)) return value;
  return new Date(parsed + (Math.max(0, days) * 86_400_000)).toISOString().slice(0, 10);
};

const deriveLegacyDuration = (items: readonly ITimelineItem[]): number => Math.max(
  1,
  Math.ceil(items.reduce((maximum, item) => (
    Math.max(maximum, item.startDateOffset + Math.max(0, item.duration))
  ), 0)),
);

const referenceKey = (entity: TravelEntityReference | undefined): string | undefined => (
  entity?.entityId || entity?.canonicalSlug || undefined
);

const transferLoad = (
  durationMinutes: number | undefined,
  toleranceMinutes: number | undefined,
): JourneyOverviewTransferLoad => {
  if (durationMinutes === undefined) return 'unknown';
  if (toleranceMinutes !== undefined && durationMinutes > toleranceMinutes) return 'heavy';
  if (durationMinutes <= 120) return 'light';
  if (durationMinutes > 360) return 'heavy';
  return 'balanced';
};

const traceReasons = (trace: JourneyPlanningTrace | undefined): string[] => (
  trace?.matchedTemplateReasons?.filter(Boolean) ?? []
);

const traceTradeoffs = (trace: JourneyPlanningTrace | undefined): string[] => (
  trace?.matchedTemplateTradeoffs?.filter(Boolean) ?? []
);

export const buildJourneyOverviewModel = (trip: ITrip): JourneyOverviewModel => {
  const planningMeta = trip.planningMeta;
  const spec = planningMeta?.journeySpec;
  const source: JourneyOverviewSource = spec ? 'structured' : 'legacy';
  const durationDays = spec?.durationDays ?? deriveLegacyDuration(trip.items);
  const endDate = spec?.dateWindow.mode === 'exact'
    ? spec.dateWindow.endDate
    : isoDatePlusDays(trip.startDate, durationDays);
  const cityItems = trip.items
    .filter((item) => item.type === 'city')
    .sort((left, right) => left.startDateOffset - right.startDateOffset || left.id.localeCompare(right.id));
  const specPlacesBySlug = new Map((spec?.places ?? []).map((place) => [place.entity.canonicalSlug, place]));
  const dayTripSlugs = new Set((spec?.places ?? [])
    .filter((place) => place.role === 'day_trip')
    .map((place) => place.entity.canonicalSlug));
  const briefsByCitySlug = new Map((planningMeta?.destinationBriefs ?? [])
    .map((brief) => [brief.city.canonicalSlug, brief]));

  const chapters: JourneyOverviewChapter[] = cityItems.map((city, order) => {
    const entity = city.knowledgeMeta?.entity;
    const place = entity ? specPlacesBySlug.get(entity.canonicalSlug) : undefined;
    const brief = entity ? briefsByCitySlug.get(entity.canonicalSlug) : undefined;
    const cityEnd = city.startDateOffset + city.duration;
    const scheduledItems = trip.items
      .filter((item) => (
        item.type === 'activity'
        && item.startDateOffset >= city.startDateOffset
        && item.startDateOffset < cityEnd
      ))
      .sort((left, right) => left.startDateOffset - right.startDateOffset || left.id.localeCompare(right.id));
    const scheduledEntityKeys = new Set(scheduledItems
      .map((item) => referenceKey(item.knowledgeMeta?.entity))
      .filter((key): key is string => Boolean(key)));
    const scheduledActivities: JourneyOverviewActivity[] = scheduledItems.map((item) => {
      const itemEntity = item.knowledgeMeta?.entity;
      const isDayTrip = Boolean(itemEntity && dayTripSlugs.has(itemEntity.canonicalSlug));
      return {
        id: `activity:${itemEntity?.canonicalSlug ?? item.id}`,
        title: item.title,
        kind: isDayTrip ? 'day_trip' : 'scheduled',
        sourceItemId: item.id,
        entity: itemEntity,
        selectedByTraveler: item.knowledgeMeta?.origin === 'traveler_selection',
        matchScore: item.knowledgeMeta?.matchScore,
      };
    });
    const recommendedActivities: JourneyOverviewActivity[] = (brief?.activities ?? [])
      .filter((candidate) => !scheduledEntityKeys.has(referenceKey(candidate.entity) ?? ''))
      .slice(0, 3)
      .map((candidate) => ({
        id: `recommendation:${candidate.entity.canonicalSlug}`,
        title: candidate.entity.name,
        kind: 'recommended',
        entity: candidate.entity,
        selectedByTraveler: candidate.selectedByTraveler,
        matchScore: candidate.matchScore,
      }));
    const activities = [...scheduledActivities, ...recommendedActivities];
    const neighborhoods = (brief?.neighborhoods ?? [])
      .slice()
      .sort((left, right) => (
        Number(right.selectedByTraveler) - Number(left.selectedByTraveler)
        || right.matchScore - left.matchScore
        || right.popularityScore - left.popularityScore
      ))
      .slice(0, 4)
      .map((candidate) => ({
        id: `neighborhood:${candidate.entity.canonicalSlug}`,
        entity: candidate.entity,
        title: candidate.entity.name,
        selectedByTraveler: candidate.selectedByTraveler,
        matchScore: candidate.matchScore,
        popularityScore: candidate.popularityScore,
        hiddenGemScore: candidate.hiddenGemScore,
      }));
    const coordinates = city.coordinates && Number.isFinite(city.coordinates.lat) && Number.isFinite(city.coordinates.lng)
      ? { lat: city.coordinates.lat, lng: city.coordinates.lng }
      : undefined;

    return {
      id: `chapter:${entity?.canonicalSlug ?? city.id}`,
      order,
      sourceItemId: city.id,
      entity,
      title: city.title,
      location: city.location,
      startDay: Math.max(0, city.startDateOffset),
      nights: Math.max(1, Math.round(city.duration)),
      shareOfTrip: Math.min(1, Math.max(0, city.duration / durationDays)),
      coordinates,
      locked: place?.locked === true,
      origin: city.knowledgeMeta?.origin,
      tags: brief?.tags ?? [],
      signatureDishes: brief?.signatureDishes?.value ?? [],
      audienceSignals: (brief?.audienceSignals ?? []).map((signal) => ({
        tagKey: signal.tagKey,
        relevance: signal.relevance,
        evidenceLevel: signal.evidenceLevel,
      })),
      neighborhoods,
      activities,
      dayTrips: activities.filter((activity) => activity.kind === 'day_trip'),
    };
  });

  const toleranceMinutes = spec?.constraints.maxTransferMinutes;
  const legs: JourneyOverviewLeg[] = [];
  for (let order = 0; order < chapters.length - 1; order += 1) {
    const fromChapter = chapters[order]!;
    const toChapter = chapters[order + 1]!;
    const fromCity = cityItems[order]!;
    const toCity = cityItems[order + 1]!;
    const travelItem = findTravelBetweenCities(trip.items, fromCity, toCity);
    const durationMinutes = asPositiveNumber(travelItem?.routeDurationHours) === undefined
      ? undefined
      : Math.round(travelItem!.routeDurationHours! * 60);
    const distanceKm = asPositiveNumber(travelItem?.routeDistanceKm);
    legs.push({
      id: `leg:${travelItem?.id ?? `${fromCity.id}:${toCity.id}`}`,
      order,
      sourceItemId: travelItem?.id,
      fromChapterId: fromChapter.id,
      toChapterId: toChapter.id,
      mode: travelItem?.transportMode,
      durationMinutes,
      distanceKm,
      load: transferLoad(durationMinutes, toleranceMinutes),
      exceedsTolerance: Boolean(
        durationMinutes !== undefined
        && toleranceMinutes !== undefined
        && durationMinutes > toleranceMinutes
      ),
    });
  }

  const openDecisionCount = (spec?.places ?? []).filter((place) => (
    place.role === 'consider' || place.entity.resolution === 'legacy_unresolved'
  )).length;
  const warnings: JourneyOverviewWarning[] = [];
  if (source === 'legacy') {
    warnings.push({ id: 'warning:legacy', code: 'legacy_trip', severity: 'info' });
  }
  if (openDecisionCount > 0) {
    warnings.push({
      id: 'warning:open-decisions',
      code: 'open_route_decisions',
      severity: 'info',
      value: openDecisionCount,
    });
  }
  for (const leg of legs) {
    if (leg.durationMinutes === undefined) {
      warnings.push({
        id: `warning:${leg.id}:metrics`,
        code: 'transfer_metrics_missing',
        severity: 'info',
        legId: leg.id,
      });
    } else if (leg.exceedsTolerance) {
      warnings.push({
        id: `warning:${leg.id}:tolerance`,
        code: 'transfer_exceeds_tolerance',
        severity: 'warning',
        legId: leg.id,
        value: leg.durationMinutes,
        limit: toleranceMinutes,
      });
    }
  }

  const knownTransferMinutes = legs
    .map((leg) => leg.durationMinutes)
    .filter((value): value is number => value !== undefined);
  const longestTransferMinutes = knownTransferMinutes.length > 0
    ? Math.max(...knownTransferMinutes)
    : undefined;

  return {
    version: JOURNEY_OVERVIEW_MODEL_VERSION,
    source,
    identity: {
      title: trip.title,
      journeyType: spec?.journeyType ?? 'legacy',
      startDate: trip.startDate,
      endDate,
      durationDays,
      pace: spec?.preferences.pace,
      interestTags: spec?.preferences.interestTags ?? [],
      vibeTags: spec?.preferences.vibeTags ?? [],
    },
    summary: {
      baseCount: chapters.length,
      dayTripCount: chapters.reduce((count, chapter) => count + chapter.dayTrips.length, 0),
      transferCount: legs.length,
      totalTransferMinutes: knownTransferMinutes.reduce((total, minutes) => total + minutes, 0),
      longestTransferMinutes,
      plannedActivityCount: trip.items.filter((item) => item.type === 'activity').length,
      openDecisionCount,
    },
    chapters,
    legs,
    warnings,
    provenance: planningMeta ? {
      datasetVersion: planningMeta.datasetVersion,
      templateKey: planningMeta.templateKey,
      templateVersion: planningMeta.templateVersion,
      routeStage: planningMeta.routeStage,
      compiledAt: planningMeta.trace?.compiledAt,
      matchedTemplateScore: planningMeta.trace?.matchedTemplateScore,
      reasons: traceReasons(planningMeta.trace),
      tradeoffs: traceTradeoffs(planningMeta.trace),
    } : undefined,
  };
};
