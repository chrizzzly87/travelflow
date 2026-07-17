import type { TransportMode } from './transportModes';

export const TRAVEL_ENTITY_TYPE_VALUES = [
  'country',
  'region',
  'city',
  'neighborhood',
  'poi',
  'port',
  'campground',
] as const;

export type TravelEntityType = (typeof TRAVEL_ENTITY_TYPE_VALUES)[number];

export const TRAVEL_ENTITY_STATUS_VALUES = ['draft', 'published', 'archived'] as const;
export type TravelEntityStatus = (typeof TRAVEL_ENTITY_STATUS_VALUES)[number];

export const TRAVEL_EVIDENCE_LEVEL_VALUES = [
  'official',
  'editorial',
  'community',
  'self_attested',
  'inferred',
] as const;

export type TravelEvidenceLevel = (typeof TRAVEL_EVIDENCE_LEVEL_VALUES)[number];

export interface TravelEntityReference {
  entityId: string | null;
  canonicalSlug: string;
  entityType: TravelEntityType;
  countryCode: string;
  name: string;
  resolution: 'canonical' | 'legacy_unresolved';
}

export interface TravelEntityName {
  locale: string;
  name: string;
  nameKind: 'primary' | 'local' | 'alias' | 'historic';
  isPreferred: boolean;
}

export interface TravelSourceReference {
  sourceKey: string;
  name: string;
  baseUrl: string;
  licenseKey?: string;
  attributionText?: string;
}

export interface TravelEntityFact {
  id: string;
  factKey: string;
  valueJson: unknown;
  unit?: string;
  locale?: string;
  sourceKey: string;
  confidence: number;
  reviewStatus: 'imported' | 'editorial_reviewed' | 'verified' | 'deprecated';
  observedAt: string;
  validFrom?: string;
  validUntil?: string;
  metadata: Record<string, unknown>;
}

export interface TravelEntityTag {
  tagKey: string;
  sourceKey: string;
  relevance: number;
  evidenceLevel: TravelEvidenceLevel;
  evidenceNote?: string;
  validUntil?: string;
  metadata: Record<string, unknown>;
}

export interface TravelEntityCatalogItem extends TravelEntityReference {
  parentId: string | null;
  localName?: string;
  timezone?: string;
  latitude?: number;
  longitude?: number;
  status: TravelEntityStatus;
  datasetVersion: string;
  typicalMinDays?: number;
  typicalMaxDays?: number;
  popularityScore: number;
  hiddenGemScore: number;
  tourismIntensityScore: number;
  attributes: Record<string, unknown>;
  names: TravelEntityName[];
  facts: TravelEntityFact[];
  tags: TravelEntityTag[];
}

export interface TravelDatasetManifest {
  datasetKey: string;
  countryCode: string;
  version: string;
  checksum: string;
  entityCount: number;
  factCount: number;
  templateCount: number;
  generatedAt: string;
  publishedAt?: string;
}

export interface TravelTemplateStop {
  sequence: number;
  entityId: string;
  entitySlug: string;
  entityName: string;
  entityType: TravelEntityType;
  stopRole: 'entry' | 'exit' | 'base' | 'must_visit' | 'day_trip' | 'consider';
  minNights: number;
  maxNights: number;
  isOptional: boolean;
  notes: Record<string, unknown>;
}

export interface TravelTemplateLeg {
  sequence: number;
  fromEntityId: string;
  fromEntitySlug: string;
  fromEntityName: string;
  toEntityId: string;
  toEntitySlug: string;
  toEntityName: string;
  legRole: 'transfer' | 'day_trip';
  transportModes: TransportMode[];
  durationMinMinutes: number;
  durationMaxMinutes: number;
  distanceKm?: number;
  roundTrip: boolean;
  sourceKey: string;
  confidence: number;
  observedAt: string;
  validUntil?: string;
  notes: Record<string, unknown>;
}

export interface TravelTemplateCatalogItem {
  id: string;
  templateKey: string;
  countryCode: string;
  journeyType: string;
  minDays: number;
  maxDays: number;
  preferredPace: 'relaxed' | 'balanced' | 'full';
  idealMonths: number[];
  datasetVersion: string;
  version: number;
  copy: {
    locale: string;
    title: string;
    summary: string;
    highlights: string[];
    tradeoffs: string[];
  };
  stops: TravelTemplateStop[];
  legs: TravelTemplateLeg[];
  tags: Array<{ tagKey: string; weight: number }>;
  attributes: Record<string, unknown>;
}

export interface TravelDestinationPack {
  countryCode: string;
  locale: string;
  dataset: TravelDatasetManifest | null;
  entities: TravelEntityCatalogItem[];
  templates: TravelTemplateCatalogItem[];
}

const ENTITY_TYPE_SET = new Set<string>(TRAVEL_ENTITY_TYPE_VALUES);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/;

export const isTravelEntityType = (value: unknown): value is TravelEntityType =>
  typeof value === 'string' && ENTITY_TYPE_SET.has(value);

export const isCanonicalTravelEntityReference = (value: unknown): value is TravelEntityReference => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<TravelEntityReference>;
  return (
    typeof candidate.entityId === 'string'
    && UUID_PATTERN.test(candidate.entityId)
    && typeof candidate.canonicalSlug === 'string'
    && SLUG_PATTERN.test(candidate.canonicalSlug)
    && isTravelEntityType(candidate.entityType)
    && typeof candidate.countryCode === 'string'
    && COUNTRY_CODE_PATTERN.test(candidate.countryCode)
    && typeof candidate.name === 'string'
    && candidate.name.trim().length > 0
    && candidate.resolution === 'canonical'
  );
};

export const createLegacyTravelEntityReference = (input: {
  canonicalSlug: string;
  entityType: TravelEntityType;
  countryCode: string;
  name: string;
}): TravelEntityReference => ({
  entityId: null,
  canonicalSlug: input.canonicalSlug.trim().toLowerCase(),
  entityType: input.entityType,
  countryCode: input.countryCode.trim().toUpperCase(),
  name: input.name.trim(),
  resolution: 'legacy_unresolved',
});
