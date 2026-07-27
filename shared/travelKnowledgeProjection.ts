import type { ActivityType, ICoordinates } from '../types';
import type {
  TravelEntityCatalogItem,
  TravelEntityReference,
} from './travelKnowledge';

export interface TravelEntityStayRange {
  min: number;
  max: number;
}

const isStayRange = (value: unknown): value is TravelEntityStayRange => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as { min?: unknown; max?: unknown };
  return typeof candidate.min === 'number'
    && Number.isFinite(candidate.min)
    && typeof candidate.max === 'number'
    && Number.isFinite(candidate.max)
    && candidate.min >= 0
    && candidate.max >= candidate.min;
};

export const toTravelEntityReference = (
  entity: TravelEntityCatalogItem,
): TravelEntityReference => ({
  entityId: entity.entityId,
  canonicalSlug: entity.canonicalSlug,
  entityType: entity.entityType,
  countryCode: entity.countryCode,
  name: entity.name,
  resolution: entity.resolution,
});

export const getTravelEntitySummary = (
  entity: TravelEntityCatalogItem,
): string | undefined => {
  const value = entity.facts.find((fact) => fact.factKey === 'summary')?.valueJson;
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
};

export const getTravelEntityRecommendedStayRange = (
  entity: TravelEntityCatalogItem,
): TravelEntityStayRange | undefined => {
  const value = entity.facts.find((fact) => fact.factKey === 'stay.recommended_days')?.valueJson;
  return isStayRange(value) ? value : undefined;
};

export const getTravelEntityCoordinates = (
  entity: TravelEntityCatalogItem,
): ICoordinates | undefined => (
  entity.latitude !== undefined && entity.longitude !== undefined
    ? { lat: entity.latitude, lng: entity.longitude }
    : undefined
);

export const getTravelEntitySourceKeys = (
  entity: TravelEntityCatalogItem,
): string[] => Array.from(new Set([
  ...entity.facts.map((fact) => fact.sourceKey),
  ...entity.tags.map((tag) => tag.sourceKey),
])).sort();

export const getTravelEntityActivityTypes = (
  entity: TravelEntityCatalogItem,
): ActivityType[] => {
  const tags = new Set(entity.tags.map((tag) => tag.tagKey));
  const activityTypes: ActivityType[] = [];
  if (tags.has('food') || tags.has('markets')) activityTypes.push('food');
  if (tags.has('culture') || tags.has('history') || tags.has('heritage') || tags.has('temples')) activityTypes.push('culture');
  if (tags.has('beaches')) activityTypes.push('beach');
  if (tags.has('nature') || tags.has('mountain')) activityTypes.push('nature');
  if (tags.has('hiking')) activityTypes.push('hiking');
  if (tags.has('nightlife')) activityTypes.push('nightlife');
  if (tags.has('wellness')) activityTypes.push('relaxation');
  if (tags.has('diving')) activityTypes.push('sports');
  return activityTypes.length > 0 ? Array.from(new Set(activityTypes)) : ['sightseeing'];
};
