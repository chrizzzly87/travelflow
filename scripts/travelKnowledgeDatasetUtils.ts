import { createHash } from 'node:crypto';
import type {
  TravelDestinationPack,
  TravelEntityCatalogItem,
  TravelEntityFact,
  TravelEntityName,
  TravelEntityTag,
  TravelTemplateCatalogItem,
} from '../shared/travelKnowledge';
import {
  deriveTravelActivityProfile,
  validateTravelActivityFactValue,
} from '../shared/travelActivityKnowledge';
import { MODEL_TRANSPORT_MODE_VALUES, type TransportMode } from '../shared/transportModes';

export interface TravelKnowledgeDatasetSource {
  sourceKey: string;
  name: string;
  sourceKind: 'official' | 'open_data' | 'commercial' | 'editorial' | 'community';
  baseUrl: string;
  termsUrl?: string;
  licenseKey?: string;
  attributionText?: string;
  commercialUseAllowed: boolean;
  redistributionAllowed: boolean;
  refreshIntervalDays?: number;
  metadata?: Record<string, unknown>;
}

export interface TravelKnowledgeDatasetTag {
  tagKey: string;
  tagGroup: 'trip_shape' | 'experience' | 'place_character' | 'practical' | 'audience_context';
  label: string;
  description: string;
  evidenceRequired?: boolean;
  sensitive?: boolean;
}

export interface TravelKnowledgeDatasetFact {
  factKey: string;
  value: unknown;
  sourceKey: string;
  sourceUrl?: string;
  unit?: string;
  locale?: string;
  confidence?: number;
  reviewStatus?: 'editorial_reviewed' | 'verified';
  observedAt?: string;
  validFrom?: string;
  validUntil?: string;
  metadata?: Record<string, unknown>;
}

export interface TravelKnowledgeEvidenceTag {
  tagKey: string;
  sourceKey: string;
  evidenceLevel: 'official' | 'editorial' | 'community' | 'self_attested';
  relevance: number;
  evidenceNote: string;
  sourceUrl?: string;
  validUntil?: string;
}

export interface TravelKnowledgeEntityProfile {
  summary?: string;
  bestMonths?: number[];
  seasonalCaution?: string;
  transportSummary?: string;
  signatureFoods?: string[];
  relativeCostLevel?: 1 | 2 | 3 | 4 | 5;
}

export interface TravelKnowledgeDatasetEntity {
  canonicalSlug: string;
  entityType: 'country' | 'region' | 'city' | 'neighborhood' | 'poi' | 'port' | 'campground';
  parentSlug?: string;
  countryCode: string;
  primaryName: string;
  localName?: string;
  timezone?: string;
  latitude?: number;
  longitude?: number;
  typicalMinDays?: number;
  typicalMaxDays?: number;
  popularityScore: number;
  hiddenGemScore: number;
  tourismIntensityScore: number;
  attributes?: Record<string, unknown>;
  names?: Array<{
    locale: string;
    name: string;
    nameKind: 'primary' | 'local' | 'alias' | 'historic';
    isPreferred?: boolean;
  }>;
  sourceUrls?: string[];
  profile?: TravelKnowledgeEntityProfile;
  tagKeys?: string[];
  evidenceTags?: TravelKnowledgeEvidenceTag[];
  facts?: TravelKnowledgeDatasetFact[];
}

export interface TravelKnowledgeDatasetTemplate {
  templateKey: string;
  countryCode: string;
  journeyType: 'city_break' | 'hub_and_day_trips' | 'single_country_circuit';
  minDays: number;
  maxDays: number;
  preferredPace: 'relaxed' | 'balanced' | 'full';
  idealMonths: number[];
  version: number;
  copy: Array<{
    locale: string;
    title: string;
    summary: string;
    highlights: string[];
    tradeoffs: string[];
  }>;
  stops: Array<{
    entitySlug: string;
    role: 'entry' | 'exit' | 'base' | 'must_visit' | 'day_trip' | 'consider';
    minNights: number;
    maxNights: number;
    isOptional?: boolean;
    notes?: Record<string, unknown>;
  }>;
  legs?: Array<{
    fromEntitySlug: string;
    toEntitySlug: string;
    legRole: 'transfer' | 'day_trip';
    transportModes: Exclude<TransportMode, 'na'>[];
    durationMinMinutes: number;
    durationMaxMinutes: number;
    distanceKm?: number;
    roundTrip?: boolean;
    sourceKey: string;
    confidence?: number;
    observedAt?: string;
    validUntil?: string;
    notes?: Record<string, unknown>;
  }>;
  tags: Array<{ tagKey: string; weight: number }>;
  attributes?: Record<string, unknown>;
}

export interface TravelKnowledgeDataset {
  manifest: {
    datasetKey: string;
    countryCode: string;
    version: string;
    generatedAt: string;
    notes?: string;
  };
  sources: TravelKnowledgeDatasetSource[];
  tags: TravelKnowledgeDatasetTag[];
  entities: TravelKnowledgeDatasetEntity[];
  templates: TravelKnowledgeDatasetTemplate[];
}

export interface TravelKnowledgeDatasetValidationResult {
  valid: boolean;
  errors: string[];
  counts: {
    sources: number;
    tags: number;
    entities: number;
    facts: number;
    entityTags: number;
    templates: number;
    templateLegs: number;
  };
}

const UUID_NAMESPACE_DNS = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const KEY_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;
const FACT_KEY_PATTERN = /^[a-z0-9][a-z0-9_.-]*$/;
const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/;
const PLANNING_AREA_BASE_FITS = new Set(['primary', 'alternative', 'visit_only']);
const PLANNING_AREA_WALKABILITY_LEVELS = new Set(['high', 'medium', 'low']);
const PLANNING_AREA_EVENING_ENERGY_LEVELS = new Set(['quiet', 'balanced', 'lively']);

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const uuidToBytes = (uuid: string): Buffer => Buffer.from(uuid.replace(/-/g, ''), 'hex');

export const deterministicTravelUuid = (name: string): string => {
  const digest = createHash('sha1')
    .update(Buffer.concat([uuidToBytes(UUID_NAMESPACE_DNS), Buffer.from(`travelflow:${name}`, 'utf8')]))
    .digest();
  digest[6] = (digest[6]! & 0x0f) | 0x50;
  digest[8] = (digest[8]! & 0x3f) | 0x80;
  const hex = digest.subarray(0, 16).toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

export const compileEntityFacts = (
  dataset: TravelKnowledgeDataset,
  entity: TravelKnowledgeDatasetEntity,
): TravelKnowledgeDatasetFact[] => {
  const observedAt = dataset.manifest.generatedAt;
  const sourceUrl = entity.sourceUrls?.[0];
  const facts: TravelKnowledgeDatasetFact[] = [];
  const add = (fact: TravelKnowledgeDatasetFact) => facts.push({
    confidence: 0.82,
    reviewStatus: 'editorial_reviewed',
    observedAt,
    ...fact,
  });

  if (entity.profile?.summary) {
    add({
      factKey: 'summary',
      value: entity.profile.summary,
      sourceKey: sourceUrl ? 'tat_official' : 'travelflow_editorial',
      sourceUrl,
      locale: 'en',
      confidence: sourceUrl ? 0.9 : 0.8,
    });
  }
  if (entity.profile?.bestMonths?.length) {
    add({ factKey: 'season.best_months', value: entity.profile.bestMonths, sourceKey: 'travelflow_editorial', sourceUrl });
  }
  if (entity.profile?.seasonalCaution) {
    add({ factKey: 'season.caution', value: entity.profile.seasonalCaution, sourceKey: 'travelflow_editorial', sourceUrl, locale: 'en' });
  }
  if (entity.profile?.transportSummary) {
    add({ factKey: 'transport.summary', value: entity.profile.transportSummary, sourceKey: 'travelflow_editorial', sourceUrl, locale: 'en' });
  }
  if (entity.profile?.signatureFoods?.length) {
    add({ factKey: 'food.signature_dishes', value: entity.profile.signatureFoods, sourceKey: 'travelflow_editorial', sourceUrl, locale: 'en' });
  }
  if (entity.profile?.relativeCostLevel) {
    add({
      factKey: 'cost.relative_level',
      value: entity.profile.relativeCostLevel,
      unit: '1_to_5',
      sourceKey: 'travelflow_editorial',
      sourceUrl,
      confidence: 0.72,
      metadata: { interpretation: 'Relative planning estimate within Thailand; not a live price.' },
    });
  }
  if (entity.typicalMinDays !== undefined || entity.typicalMaxDays !== undefined) {
    add({
      factKey: 'stay.recommended_days',
      value: { min: entity.typicalMinDays ?? null, max: entity.typicalMaxDays ?? null },
      unit: 'days',
      sourceKey: 'travelflow_editorial',
      sourceUrl,
      confidence: 0.78,
    });
  }
  return [...facts, ...(entity.facts ?? [])];
};

export const compileTravelEntityAttributes = (
  entity: TravelKnowledgeDatasetEntity,
): Record<string, unknown> => {
  const activityProfile = deriveTravelActivityProfile({
    entityType: entity.entityType,
    canonicalSlug: entity.canonicalSlug,
    tagKeys: entity.tagKeys ?? [],
    popularityScore: entity.popularityScore,
    hiddenGemScore: entity.hiddenGemScore,
    attributes: entity.attributes,
  });
  return {
    ...(entity.attributes ?? {}),
    ...(activityProfile ? { activityProfile } : {}),
    sourceUrls: entity.sourceUrls ?? [],
  };
};

export const validateTravelKnowledgeDataset = (
  dataset: TravelKnowledgeDataset,
  now = new Date(),
): TravelKnowledgeDatasetValidationResult => {
  const errors: string[] = [];
  const sourceKeys = new Set<string>();
  const tagKeys = new Set<string>();
  const entitySlugs = new Set<string>();
  const templateKeys = new Set<string>();
  let factCount = 0;
  let entityTagCount = 0;
  let templateLegCount = 0;
  const transportModeSet = new Set<string>(MODEL_TRANSPORT_MODE_VALUES);

  if (!KEY_PATTERN.test(dataset.manifest.datasetKey)) errors.push('Manifest datasetKey is invalid.');
  if (!COUNTRY_CODE_PATTERN.test(dataset.manifest.countryCode)) errors.push('Manifest countryCode must be ISO alpha-2.');
  const generatedAtMs = Date.parse(dataset.manifest.generatedAt);
  if (!Number.isFinite(generatedAtMs)) {
    errors.push('Manifest generatedAt must be an ISO timestamp.');
  } else if (generatedAtMs > now.getTime()) {
    errors.push('Manifest generatedAt cannot be in the future.');
  }

  for (const source of dataset.sources) {
    if (!KEY_PATTERN.test(source.sourceKey)) errors.push(`Source key ${source.sourceKey} is invalid.`);
    if (sourceKeys.has(source.sourceKey)) errors.push(`Source key ${source.sourceKey} is duplicated.`);
    sourceKeys.add(source.sourceKey);
    try {
      new URL(source.baseUrl);
    } catch {
      errors.push(`Source ${source.sourceKey} has an invalid base URL.`);
    }
  }

  for (const tag of dataset.tags) {
    if (!/^[a-z0-9][a-z0-9_]*$/.test(tag.tagKey)) errors.push(`Tag key ${tag.tagKey} is invalid.`);
    if (tagKeys.has(tag.tagKey)) errors.push(`Tag key ${tag.tagKey} is duplicated.`);
    tagKeys.add(tag.tagKey);
  }

  for (const entity of dataset.entities) {
    if (!SLUG_PATTERN.test(entity.canonicalSlug)) errors.push(`Entity slug ${entity.canonicalSlug} is invalid.`);
    if (entitySlugs.has(entity.canonicalSlug)) errors.push(`Entity slug ${entity.canonicalSlug} is duplicated.`);
    entitySlugs.add(entity.canonicalSlug);
  }

  const entityBySlug = new Map(dataset.entities.map((entity) => [entity.canonicalSlug, entity]));
  const hasDescendantPoi = (ancestorSlug: string): boolean => dataset.entities.some((entity) => {
    if (entity.entityType !== 'poi') return false;
    const visited = new Set<string>();
    let parentSlug = entity.parentSlug;
    while (parentSlug && !visited.has(parentSlug)) {
      if (parentSlug === ancestorSlug) return true;
      visited.add(parentSlug);
      parentSlug = entityBySlug.get(parentSlug)?.parentSlug;
    }
    return false;
  });

  const countryEntities = dataset.entities.filter((entity) => entity.entityType === 'country');
  if (countryEntities.length !== 1) errors.push('The Thailand-first dataset must contain exactly one country entity.');

  for (const entity of dataset.entities) {
    if (entity.countryCode !== dataset.manifest.countryCode) errors.push(`Entity ${entity.canonicalSlug} is outside the manifest country.`);
    if (entity.entityType === 'country' && entity.parentSlug) errors.push(`Country ${entity.canonicalSlug} cannot have a parent.`);
    if (entity.entityType !== 'country' && (!entity.parentSlug || !entitySlugs.has(entity.parentSlug))) {
      errors.push(`Entity ${entity.canonicalSlug} has an unknown parent.`);
    }
    if ((entity.latitude === undefined) !== (entity.longitude === undefined)) {
      errors.push(`Entity ${entity.canonicalSlug} must provide both coordinates or neither.`);
    }
    if (entity.latitude !== undefined && (entity.latitude < -90 || entity.latitude > 90)) {
      errors.push(`Entity ${entity.canonicalSlug} has invalid latitude.`);
    }
    if (entity.longitude !== undefined && (entity.longitude < -180 || entity.longitude > 180)) {
      errors.push(`Entity ${entity.canonicalSlug} has invalid longitude.`);
    }
    for (const score of [entity.popularityScore, entity.hiddenGemScore, entity.tourismIntensityScore]) {
      if (!Number.isFinite(score) || score < 0 || score > 100) errors.push(`Entity ${entity.canonicalSlug} has a score outside 0-100.`);
    }
    if (
      entity.typicalMinDays !== undefined
      && entity.typicalMaxDays !== undefined
      && entity.typicalMinDays > entity.typicalMaxDays
    ) {
      errors.push(`Entity ${entity.canonicalSlug} has an inverted stay range.`);
    }

    const planningArea = entity.attributes?.planningArea;
    if (planningArea !== undefined) {
      if (entity.entityType !== 'neighborhood') {
        errors.push(`Entity ${entity.canonicalSlug} can only define planningArea metadata as a neighborhood.`);
      }
      if (!isRecord(planningArea)) {
        errors.push(`Entity ${entity.canonicalSlug} planningArea must be an object.`);
      } else {
        if (planningArea.classification !== 'editorial_travel_area') {
          errors.push(`Entity ${entity.canonicalSlug} planningArea must be classified as editorial_travel_area.`);
        }
        if (typeof planningArea.baseFit !== 'string' || !PLANNING_AREA_BASE_FITS.has(planningArea.baseFit)) {
          errors.push(`Entity ${entity.canonicalSlug} planningArea has invalid baseFit.`);
        }
        if (
          typeof planningArea.walkability !== 'string'
          || !PLANNING_AREA_WALKABILITY_LEVELS.has(planningArea.walkability)
        ) {
          errors.push(`Entity ${entity.canonicalSlug} planningArea has invalid walkability.`);
        }
        if (
          typeof planningArea.eveningEnergy !== 'string'
          || !PLANNING_AREA_EVENING_ENERGY_LEVELS.has(planningArea.eveningEnergy)
        ) {
          errors.push(`Entity ${entity.canonicalSlug} planningArea has invalid eveningEnergy.`);
        }
        if (
          !Array.isArray(planningArea.tradeoffs)
          || planningArea.tradeoffs.length === 0
          || planningArea.tradeoffs.some((tradeoff) => typeof tradeoff !== 'string' || !tradeoff.trim())
        ) {
          errors.push(`Entity ${entity.canonicalSlug} planningArea requires non-empty tradeoffs.`);
        }
        if (typeof planningArea.scopeNote !== 'string' || !planningArea.scopeNote.trim()) {
          errors.push(`Entity ${entity.canonicalSlug} planningArea requires a scopeNote.`);
        }
      }
    }

    const entityFacts = compileEntityFacts(dataset, entity);
    factCount += entityFacts.length;
    for (const fact of entityFacts) {
      if (!FACT_KEY_PATTERN.test(fact.factKey)) errors.push(`Entity ${entity.canonicalSlug} has invalid fact key ${fact.factKey}.`);
      if (!sourceKeys.has(fact.sourceKey)) errors.push(`Entity ${entity.canonicalSlug} fact ${fact.factKey} has unknown source ${fact.sourceKey}.`);
      const observedAtMs = Date.parse(fact.observedAt ?? dataset.manifest.generatedAt);
      if (!Number.isFinite(observedAtMs)) {
        errors.push(`Entity ${entity.canonicalSlug} fact ${fact.factKey} has invalid observedAt.`);
      } else if (Number.isFinite(generatedAtMs) && observedAtMs > generatedAtMs) {
        errors.push(`Entity ${entity.canonicalSlug} fact ${fact.factKey} was observed after the dataset was generated.`);
      }
      if (entity.entityType === 'poi') {
        validateTravelActivityFactValue(fact.factKey, fact.value).forEach((finding) => {
          errors.push(`Entity ${entity.canonicalSlug} fact ${fact.factKey} ${finding}.`);
        });
      }
    }

    for (const tagKey of entity.tagKeys ?? []) {
      entityTagCount += 1;
      if (!tagKeys.has(tagKey)) errors.push(`Entity ${entity.canonicalSlug} has unknown tag ${tagKey}.`);
      const tag = dataset.tags.find((candidate) => candidate.tagKey === tagKey);
      if (tag?.evidenceRequired) errors.push(`Entity ${entity.canonicalSlug} must use evidenceTags for ${tagKey}.`);
    }
    for (const evidenceTag of entity.evidenceTags ?? []) {
      entityTagCount += 1;
      if (!tagKeys.has(evidenceTag.tagKey)) errors.push(`Entity ${entity.canonicalSlug} has unknown evidence tag ${evidenceTag.tagKey}.`);
      if (!sourceKeys.has(evidenceTag.sourceKey)) errors.push(`Entity ${entity.canonicalSlug} tag ${evidenceTag.tagKey} has unknown source.`);
      if (!evidenceTag.evidenceNote.trim()) errors.push(`Entity ${entity.canonicalSlug} tag ${evidenceTag.tagKey} requires an evidence note.`);
      if (evidenceTag.relevance < 0 || evidenceTag.relevance > 1) errors.push(`Entity ${entity.canonicalSlug} tag ${evidenceTag.tagKey} has invalid relevance.`);
    }
  }

  for (const template of dataset.templates) {
    if (!KEY_PATTERN.test(template.templateKey)) errors.push(`Template key ${template.templateKey} is invalid.`);
    if (templateKeys.has(template.templateKey)) errors.push(`Template key ${template.templateKey} is duplicated.`);
    templateKeys.add(template.templateKey);
    if (template.countryCode !== dataset.manifest.countryCode) errors.push(`Template ${template.templateKey} is outside the manifest country.`);
    if (template.minDays < 1 || template.maxDays < template.minDays) errors.push(`Template ${template.templateKey} has invalid duration.`);
    if (template.idealMonths.some((month) => !Number.isInteger(month) || month < 1 || month > 12)) {
      errors.push(`Template ${template.templateKey} has invalid ideal months.`);
    }
    if (!template.copy.some((copy) => copy.locale === 'en')) errors.push(`Template ${template.templateKey} requires English copy.`);
    template.stops.forEach((stop) => {
      if (!entitySlugs.has(stop.entitySlug)) errors.push(`Template ${template.templateKey} references unknown entity ${stop.entitySlug}.`);
      if (stop.minNights < 0 || stop.maxNights < stop.minNights) errors.push(`Template ${template.templateKey} has invalid nights for ${stop.entitySlug}.`);
    });
    template.stops
      .filter((stop) => stop.role === 'base' && !stop.isOptional)
      .forEach((stop) => {
        if (entitySlugs.has(stop.entitySlug) && !hasDescendantPoi(stop.entitySlug)) {
          errors.push(`Template ${template.templateKey} required base ${stop.entitySlug} has no descendant POI candidate.`);
        }
      });
    (template.legs ?? []).forEach((leg, index) => {
      templateLegCount += 1;
      if (!entitySlugs.has(leg.fromEntitySlug)) {
        errors.push(`Template ${template.templateKey} leg references unknown origin ${leg.fromEntitySlug}.`);
      }
      if (!entitySlugs.has(leg.toEntitySlug)) {
        errors.push(`Template ${template.templateKey} leg references unknown destination ${leg.toEntitySlug}.`);
      }
      if (
        !template.stops.some((stop) => stop.entitySlug === leg.fromEntitySlug)
        || !template.stops.some((stop) => stop.entitySlug === leg.toEntitySlug)
      ) {
        errors.push(`Template ${template.templateKey} leg endpoints must both be template stops.`);
      }
      if (leg.fromEntitySlug === leg.toEntitySlug) {
        errors.push(`Template ${template.templateKey} leg cannot connect an entity to itself.`);
      }
      if (leg.transportModes.length === 0 || leg.transportModes.some((mode) => !transportModeSet.has(mode))) {
        errors.push(`Template ${template.templateKey} leg has an invalid transport mode.`);
      }
      if (
        !Number.isInteger(leg.durationMinMinutes)
        || !Number.isInteger(leg.durationMaxMinutes)
        || leg.durationMinMinutes <= 0
        || leg.durationMaxMinutes < leg.durationMinMinutes
      ) {
        errors.push(`Template ${template.templateKey} leg has an invalid duration range.`);
      }
      if (leg.distanceKm !== undefined && (!Number.isFinite(leg.distanceKm) || leg.distanceKm <= 0)) {
        errors.push(`Template ${template.templateKey} leg has an invalid distance.`);
      }
      if (!sourceKeys.has(leg.sourceKey)) {
        errors.push(`Template ${template.templateKey} leg has unknown source ${leg.sourceKey}.`);
      }
      if (leg.confidence !== undefined && (leg.confidence < 0 || leg.confidence > 1)) {
        errors.push(`Template ${template.templateKey} leg has invalid confidence.`);
      }
      const observedAtMs = Date.parse(leg.observedAt ?? dataset.manifest.generatedAt);
      if (!Number.isFinite(observedAtMs)) {
        errors.push(`Template ${template.templateKey} leg has invalid observedAt.`);
      } else if (Number.isFinite(generatedAtMs) && observedAtMs > generatedAtMs) {
        errors.push(`Template ${template.templateKey} leg ${index + 1} was observed after the dataset was generated.`);
      }
    });
    template.tags.forEach((tag) => {
      if (!tagKeys.has(tag.tagKey)) errors.push(`Template ${template.templateKey} has unknown tag ${tag.tagKey}.`);
      if (tag.weight < 0 || tag.weight > 1) errors.push(`Template ${template.templateKey} has invalid weight for ${tag.tagKey}.`);
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    counts: {
      sources: dataset.sources.length,
      tags: dataset.tags.length,
      entities: dataset.entities.length,
      facts: factCount,
      entityTags: entityTagCount,
      templates: dataset.templates.length,
      templateLegs: templateLegCount,
    },
  };
};

const sqlString = (value: string | undefined | null): string =>
  value === undefined || value === null ? 'null' : `'${value.replace(/'/g, "''")}'`;

const sqlJson = (value: unknown): string => `${sqlString(JSON.stringify(value))}::jsonb`;
const sqlBoolean = (value: boolean | undefined): string => value ? 'true' : 'false';
const sqlNumber = (value: number | undefined): string => value === undefined ? 'null' : String(value);
const sqlSmallintArray = (values: readonly number[]): string =>
  `array[${values.join(', ')}]::smallint[]`;
const sqlTextArray = (values: readonly string[]): string =>
  `array[${values.map((value) => sqlString(value)).join(', ')}]::text[]`;

const sqlEntityId = (canonicalSlug: string): string =>
  `(select id from public.travel_entities where canonical_slug = ${sqlString(canonicalSlug)})`;
const sqlSourceId = (sourceKey: string): string =>
  `(select id from public.travel_sources where source_key = ${sqlString(sourceKey)})`;
const sqlTemplateId = (templateKey: string): string =>
  `(select id from public.travel_templates where template_key = ${sqlString(templateKey)})`;

export const sortTravelEntitiesByHierarchy = (
  entities: readonly TravelKnowledgeDatasetEntity[],
): TravelKnowledgeDatasetEntity[] => {
  const bySlug = new Map(entities.map((entity) => [entity.canonicalSlug, entity]));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const ordered: TravelKnowledgeDatasetEntity[] = [];

  const visit = (entity: TravelKnowledgeDatasetEntity): void => {
    if (visited.has(entity.canonicalSlug)) return;
    if (visiting.has(entity.canonicalSlug)) {
      throw new Error(`Travel entity hierarchy contains a cycle at ${entity.canonicalSlug}.`);
    }
    visiting.add(entity.canonicalSlug);
    if (entity.parentSlug) {
      const parent = bySlug.get(entity.parentSlug);
      if (parent) visit(parent);
    }
    visiting.delete(entity.canonicalSlug);
    visited.add(entity.canonicalSlug);
    ordered.push(entity);
  };

  entities.forEach(visit);
  return ordered;
};

export const calculateTravelKnowledgeChecksum = (dataset: TravelKnowledgeDataset): string =>
  createHash('sha256').update(JSON.stringify(dataset)).digest('hex');

export const compileTravelDestinationPack = (
  dataset: TravelKnowledgeDataset,
  locale = 'en',
): TravelDestinationPack => {
  const validation = validateTravelKnowledgeDataset(dataset);
  if (!validation.valid) throw new Error(validation.errors.join('\n'));

  const sourcesByKey = new Map(dataset.sources.map((source) => [source.sourceKey, source]));
  const entityBySlug = new Map(dataset.entities.map((entity) => [entity.canonicalSlug, entity]));

  const entities: TravelEntityCatalogItem[] = sortTravelEntitiesByHierarchy(dataset.entities).map((entity) => {
    const names: TravelEntityName[] = [
      { locale: 'en', name: entity.primaryName, nameKind: 'primary', isPreferred: true },
      ...(entity.localName
        ? [{ locale: 'th', name: entity.localName, nameKind: 'local' as const, isPreferred: true }]
        : []),
      ...(entity.names ?? []).map((name) => ({
        locale: name.locale,
        name: name.name,
        nameKind: name.nameKind,
        isPreferred: name.isPreferred ?? false,
      })),
    ];
    const facts: TravelEntityFact[] = compileEntityFacts(dataset, entity).map((fact) => ({
      id: deterministicTravelUuid(`fact:${entity.canonicalSlug}:${fact.factKey}:${fact.sourceKey}:${fact.locale ?? ''}`),
      factKey: fact.factKey,
      valueJson: fact.value,
      unit: fact.unit,
      locale: fact.locale,
      sourceKey: fact.sourceKey,
      confidence: fact.confidence ?? 0.8,
      reviewStatus: fact.reviewStatus ?? 'editorial_reviewed',
      observedAt: fact.observedAt ?? dataset.manifest.generatedAt,
      validFrom: fact.validFrom,
      validUntil: fact.validUntil,
      metadata: { ...(fact.metadata ?? {}), sourceUrl: fact.sourceUrl ?? null },
    }));
    const tags: TravelEntityTag[] = [
      ...(entity.tagKeys ?? []).map((tagKey) => ({
        tagKey,
        sourceKey: 'travelflow_editorial',
        relevance: 0.75,
        evidenceLevel: 'editorial' as const,
        evidenceNote: 'TravelFlow editorial classification; not a safety or availability guarantee.',
        metadata: { sourceUrls: entity.sourceUrls ?? [] },
      })),
      ...(entity.evidenceTags ?? []).map((tag) => ({
        tagKey: tag.tagKey,
        sourceKey: tag.sourceKey,
        relevance: tag.relevance,
        evidenceLevel: tag.evidenceLevel,
        evidenceNote: tag.evidenceNote,
        validUntil: tag.validUntil,
        metadata: {
          sourceUrl: tag.sourceUrl ?? null,
          sourceName: sourcesByKey.get(tag.sourceKey)?.name ?? null,
        },
      })),
    ];

    return {
      entityId: deterministicTravelUuid(`entity:${entity.canonicalSlug}`),
      canonicalSlug: entity.canonicalSlug,
      entityType: entity.entityType,
      countryCode: entity.countryCode,
      name: entity.primaryName,
      resolution: 'canonical',
      parentId: entity.parentSlug ? deterministicTravelUuid(`entity:${entity.parentSlug}`) : null,
      localName: entity.localName,
      timezone: entity.timezone,
      latitude: entity.latitude,
      longitude: entity.longitude,
      status: 'published',
      datasetVersion: dataset.manifest.version,
      typicalMinDays: entity.typicalMinDays,
      typicalMaxDays: entity.typicalMaxDays,
      popularityScore: entity.popularityScore,
      hiddenGemScore: entity.hiddenGemScore,
      tourismIntensityScore: entity.tourismIntensityScore,
      attributes: compileTravelEntityAttributes(entity),
      names,
      facts,
      tags,
    };
  });

  const templates: TravelTemplateCatalogItem[] = dataset.templates.map((template) => {
    const copy = template.copy.find((candidate) => candidate.locale === locale)
      ?? template.copy.find((candidate) => candidate.locale === 'en')
      ?? template.copy[0]!;
    return {
      id: deterministicTravelUuid(`template:${template.templateKey}`),
      templateKey: template.templateKey,
      countryCode: template.countryCode,
      journeyType: template.journeyType,
      minDays: template.minDays,
      maxDays: template.maxDays,
      preferredPace: template.preferredPace,
      idealMonths: template.idealMonths,
      datasetVersion: dataset.manifest.version,
      version: template.version,
      copy: {
        locale: copy.locale,
        title: copy.title,
        summary: copy.summary,
        highlights: copy.highlights,
        tradeoffs: copy.tradeoffs,
      },
      stops: template.stops.map((stop, sequence) => {
        const stopEntity = entityBySlug.get(stop.entitySlug)!;
        return {
          sequence,
          entityId: deterministicTravelUuid(`entity:${stop.entitySlug}`),
          entitySlug: stop.entitySlug,
          entityName: stopEntity.primaryName,
          entityType: stopEntity.entityType,
          stopRole: stop.role,
          minNights: stop.minNights,
          maxNights: stop.maxNights,
          isOptional: stop.isOptional ?? false,
          notes: stop.notes ?? {},
        };
      }),
      legs: (template.legs ?? []).map((leg, sequence) => {
        const fromEntity = entityBySlug.get(leg.fromEntitySlug)!;
        const toEntity = entityBySlug.get(leg.toEntitySlug)!;
        return {
          sequence,
          fromEntityId: deterministicTravelUuid(`entity:${leg.fromEntitySlug}`),
          fromEntitySlug: leg.fromEntitySlug,
          fromEntityName: fromEntity.primaryName,
          toEntityId: deterministicTravelUuid(`entity:${leg.toEntitySlug}`),
          toEntitySlug: leg.toEntitySlug,
          toEntityName: toEntity.primaryName,
          legRole: leg.legRole,
          transportModes: leg.transportModes,
          durationMinMinutes: leg.durationMinMinutes,
          durationMaxMinutes: leg.durationMaxMinutes,
          distanceKm: leg.distanceKm,
          roundTrip: leg.roundTrip ?? false,
          sourceKey: leg.sourceKey,
          confidence: leg.confidence ?? 0.72,
          observedAt: leg.observedAt ?? dataset.manifest.generatedAt,
          validUntil: leg.validUntil,
          notes: leg.notes ?? {},
        };
      }),
      tags: template.tags,
      attributes: template.attributes ?? {},
    };
  });

  return {
    countryCode: dataset.manifest.countryCode,
    locale,
    dataset: {
      datasetKey: dataset.manifest.datasetKey,
      countryCode: dataset.manifest.countryCode,
      version: dataset.manifest.version,
      checksum: calculateTravelKnowledgeChecksum(dataset),
      entityCount: validation.counts.entities,
      factCount: validation.counts.facts,
      templateCount: validation.counts.templates,
      generatedAt: dataset.manifest.generatedAt,
      publishedAt: dataset.manifest.generatedAt,
    },
    entities,
    templates,
  };
};

export const generateTravelKnowledgeSeedSql = (dataset: TravelKnowledgeDataset): string => {
  const validation = validateTravelKnowledgeDataset(dataset);
  if (!validation.valid) throw new Error(validation.errors.join('\n'));

  const lines: string[] = [
    '-- Generated by scripts/generate-travel-knowledge-seed.ts. Do not edit manually.',
    `-- Dataset: ${dataset.manifest.datasetKey} ${dataset.manifest.version}`,
    'begin;',
    '',
  ];

  for (const source of dataset.sources) {
    const sourceId = deterministicTravelUuid(`source:${source.sourceKey}`);
    lines.push(`insert into public.travel_sources (id, source_key, name, source_kind, base_url, terms_url, license_key, attribution_text, commercial_use_allowed, redistribution_allowed, refresh_interval_days, status, metadata)`);
    lines.push(`values (${sqlString(sourceId)}::uuid, ${sqlString(source.sourceKey)}, ${sqlString(source.name)}, ${sqlString(source.sourceKind)}, ${sqlString(source.baseUrl)}, ${sqlString(source.termsUrl)}, ${sqlString(source.licenseKey)}, ${sqlString(source.attributionText)}, ${sqlBoolean(source.commercialUseAllowed)}, ${sqlBoolean(source.redistributionAllowed)}, ${sqlNumber(source.refreshIntervalDays)}, 'active', ${sqlJson(source.metadata ?? {})})`);
    lines.push(`on conflict (source_key) do update set name = excluded.name, source_kind = excluded.source_kind, base_url = excluded.base_url, terms_url = excluded.terms_url, license_key = excluded.license_key, attribution_text = excluded.attribution_text, commercial_use_allowed = excluded.commercial_use_allowed, redistribution_allowed = excluded.redistribution_allowed, refresh_interval_days = excluded.refresh_interval_days, status = excluded.status, metadata = public.travel_sources.metadata || excluded.metadata;`);
    lines.push('');
  }

  for (const tag of dataset.tags) {
    lines.push(`insert into public.travel_tags (tag_key, tag_group, label, description, evidence_required, sensitive, status)`);
    lines.push(`values (${sqlString(tag.tagKey)}, ${sqlString(tag.tagGroup)}, ${sqlString(tag.label)}, ${sqlString(tag.description)}, ${sqlBoolean(tag.evidenceRequired)}, ${sqlBoolean(tag.sensitive)}, 'active')`);
    lines.push(`on conflict (tag_key) do update set tag_group = excluded.tag_group, label = excluded.label, description = excluded.description, evidence_required = excluded.evidence_required, sensitive = excluded.sensitive, status = excluded.status;`);
    lines.push('');
  }

  for (const entity of sortTravelEntitiesByHierarchy(dataset.entities)) {
    const entityId = deterministicTravelUuid(`entity:${entity.canonicalSlug}`);
    const entityIdReference = sqlEntityId(entity.canonicalSlug);
    const parentIdReference = entity.parentSlug ? sqlEntityId(entity.parentSlug) : null;
    lines.push(`insert into public.travel_entities (id, canonical_slug, entity_type, parent_id, country_code, primary_name, local_name, timezone, latitude, longitude, status, dataset_version, typical_min_days, typical_max_days, popularity_score, hidden_gem_score, tourism_intensity_score, attributes, published_at)`);
    lines.push(`values (${sqlString(entityId)}::uuid, ${sqlString(entity.canonicalSlug)}, ${sqlString(entity.entityType)}, ${parentIdReference ?? 'null'}, ${sqlString(entity.countryCode)}, ${sqlString(entity.primaryName)}, ${sqlString(entity.localName)}, ${sqlString(entity.timezone)}, ${sqlNumber(entity.latitude)}, ${sqlNumber(entity.longitude)}, 'published', ${sqlString(dataset.manifest.version)}, ${sqlNumber(entity.typicalMinDays)}, ${sqlNumber(entity.typicalMaxDays)}, ${entity.popularityScore}, ${entity.hiddenGemScore}, ${entity.tourismIntensityScore}, ${sqlJson(compileTravelEntityAttributes(entity))}, ${sqlString(dataset.manifest.generatedAt)}::timestamptz)`);
    lines.push(`on conflict (canonical_slug) do update set entity_type = excluded.entity_type, parent_id = excluded.parent_id, country_code = excluded.country_code, primary_name = excluded.primary_name, local_name = excluded.local_name, timezone = excluded.timezone, latitude = excluded.latitude, longitude = excluded.longitude, status = excluded.status, dataset_version = excluded.dataset_version, typical_min_days = excluded.typical_min_days, typical_max_days = excluded.typical_max_days, popularity_score = excluded.popularity_score, hidden_gem_score = excluded.hidden_gem_score, tourism_intensity_score = excluded.tourism_intensity_score, attributes = excluded.attributes, published_at = excluded.published_at;`);
    lines.push('');

    const names = [
      { locale: 'en', name: entity.primaryName, nameKind: 'primary' as const, isPreferred: true },
      ...(entity.localName ? [{ locale: 'th', name: entity.localName, nameKind: 'local' as const, isPreferred: true }] : []),
      ...(entity.names ?? []),
    ];
    for (const name of names) {
      const nameId = deterministicTravelUuid(`entity-name:${entity.canonicalSlug}:${name.locale}:${name.nameKind}:${name.name}`);
      lines.push(`insert into public.travel_entity_names (id, entity_id, locale, name, name_kind, is_preferred)`);
      lines.push(`values (${sqlString(nameId)}::uuid, ${entityIdReference}, ${sqlString(name.locale)}, ${sqlString(name.name)}, ${sqlString(name.nameKind)}, ${sqlBoolean(name.isPreferred)})`);
      lines.push(`on conflict (entity_id, locale, name, name_kind) do update set is_preferred = excluded.is_preferred;`);
    }
    if (names.length) lines.push('');

    for (const fact of compileEntityFacts(dataset, entity)) {
      const factId = deterministicTravelUuid(`fact:${entity.canonicalSlug}:${fact.factKey}:${fact.sourceKey}:${fact.locale ?? ''}`);
      lines.push(`insert into public.travel_entity_facts (id, entity_id, fact_key, value_json, unit, locale, source_id, confidence, review_status, is_public, observed_at, valid_from, valid_until, metadata)`);
      lines.push(`values (${sqlString(factId)}::uuid, ${entityIdReference}, ${sqlString(fact.factKey)}, ${sqlJson(fact.value)}, ${sqlString(fact.unit)}, ${sqlString(fact.locale)}, ${sqlSourceId(fact.sourceKey)}, ${fact.confidence ?? 0.8}, ${sqlString(fact.reviewStatus ?? 'editorial_reviewed')}, true, ${sqlString(fact.observedAt ?? dataset.manifest.generatedAt)}::timestamptz, ${fact.validFrom ? `${sqlString(fact.validFrom)}::timestamptz` : 'null'}, ${fact.validUntil ? `${sqlString(fact.validUntil)}::timestamptz` : 'null'}, ${sqlJson({ ...(fact.metadata ?? {}), sourceUrl: fact.sourceUrl ?? null })})`);
      lines.push(`on conflict (id) do update set value_json = excluded.value_json, unit = excluded.unit, locale = excluded.locale, source_id = excluded.source_id, confidence = excluded.confidence, review_status = excluded.review_status, is_public = excluded.is_public, observed_at = excluded.observed_at, valid_from = excluded.valid_from, valid_until = excluded.valid_until, metadata = excluded.metadata;`);
    }
    if (compileEntityFacts(dataset, entity).length) lines.push('');

    for (const tagKey of entity.tagKeys ?? []) {
      lines.push(`insert into public.travel_entity_tags (entity_id, tag_key, source_id, relevance, evidence_level, evidence_note, is_public, metadata)`);
      lines.push(`values (${entityIdReference}, ${sqlString(tagKey)}, ${sqlSourceId('travelflow_editorial')}, 0.75, 'editorial', ${sqlString('TravelFlow editorial classification; not a safety or availability guarantee.')}, true, ${sqlJson({ sourceUrls: entity.sourceUrls ?? [] })})`);
      lines.push(`on conflict (entity_id, tag_key, source_id) do update set relevance = excluded.relevance, evidence_level = excluded.evidence_level, evidence_note = excluded.evidence_note, is_public = excluded.is_public, metadata = excluded.metadata;`);
    }
    for (const tag of entity.evidenceTags ?? []) {
      lines.push(`insert into public.travel_entity_tags (entity_id, tag_key, source_id, relevance, evidence_level, evidence_note, valid_until, is_public, metadata)`);
      lines.push(`values (${entityIdReference}, ${sqlString(tag.tagKey)}, ${sqlSourceId(tag.sourceKey)}, ${tag.relevance}, ${sqlString(tag.evidenceLevel)}, ${sqlString(tag.evidenceNote)}, ${tag.validUntil ? `${sqlString(tag.validUntil)}::timestamptz` : 'null'}, true, ${sqlJson({ sourceUrl: tag.sourceUrl ?? null })})`);
      lines.push(`on conflict (entity_id, tag_key, source_id) do update set relevance = excluded.relevance, evidence_level = excluded.evidence_level, evidence_note = excluded.evidence_note, valid_until = excluded.valid_until, is_public = excluded.is_public, metadata = excluded.metadata;`);
    }
    if ((entity.tagKeys?.length ?? 0) + (entity.evidenceTags?.length ?? 0) > 0) lines.push('');
  }

  for (const template of dataset.templates) {
    const templateId = deterministicTravelUuid(`template:${template.templateKey}`);
    const templateIdReference = sqlTemplateId(template.templateKey);
    lines.push(`insert into public.travel_templates (id, template_key, country_code, journey_type, min_days, max_days, preferred_pace, ideal_months, dataset_version, version, status, attributes, published_at)`);
    lines.push(`values (${sqlString(templateId)}::uuid, ${sqlString(template.templateKey)}, ${sqlString(template.countryCode)}, ${sqlString(template.journeyType)}, ${template.minDays}, ${template.maxDays}, ${sqlString(template.preferredPace)}, ${sqlSmallintArray(template.idealMonths)}, ${sqlString(dataset.manifest.version)}, ${template.version}, 'published', ${sqlJson(template.attributes ?? {})}, ${sqlString(dataset.manifest.generatedAt)}::timestamptz)`);
    lines.push(`on conflict (template_key) do update set country_code = excluded.country_code, journey_type = excluded.journey_type, min_days = excluded.min_days, max_days = excluded.max_days, preferred_pace = excluded.preferred_pace, ideal_months = excluded.ideal_months, dataset_version = excluded.dataset_version, version = excluded.version, status = excluded.status, attributes = excluded.attributes, published_at = excluded.published_at;`);
    for (const copy of template.copy) {
      lines.push(`insert into public.travel_template_copy (template_id, locale, title, summary, highlights, tradeoffs)`);
      lines.push(`values (${templateIdReference}, ${sqlString(copy.locale)}, ${sqlString(copy.title)}, ${sqlString(copy.summary)}, ${sqlJson(copy.highlights)}, ${sqlJson(copy.tradeoffs)})`);
      lines.push(`on conflict (template_id, locale) do update set title = excluded.title, summary = excluded.summary, highlights = excluded.highlights, tradeoffs = excluded.tradeoffs;`);
    }
    template.stops.forEach((stop, sequence) => {
      lines.push(`insert into public.travel_template_stops (template_id, sequence, entity_id, stop_role, min_nights, max_nights, is_optional, notes)`);
      lines.push(`values (${templateIdReference}, ${sequence}, ${sqlEntityId(stop.entitySlug)}, ${sqlString(stop.role)}, ${stop.minNights}, ${stop.maxNights}, ${sqlBoolean(stop.isOptional)}, ${sqlJson(stop.notes ?? {})})`);
      lines.push(`on conflict (template_id, sequence) do update set entity_id = excluded.entity_id, stop_role = excluded.stop_role, min_nights = excluded.min_nights, max_nights = excluded.max_nights, is_optional = excluded.is_optional, notes = excluded.notes;`);
    });
    (template.legs ?? []).forEach((leg, sequence) => {
      lines.push(`insert into public.travel_template_legs (template_id, sequence, from_entity_id, to_entity_id, leg_role, transport_modes, duration_min_minutes, duration_max_minutes, distance_km, round_trip, source_id, confidence, observed_at, valid_until, notes)`);
      lines.push(`values (${templateIdReference}, ${sequence}, ${sqlEntityId(leg.fromEntitySlug)}, ${sqlEntityId(leg.toEntitySlug)}, ${sqlString(leg.legRole)}, ${sqlTextArray(leg.transportModes)}, ${leg.durationMinMinutes}, ${leg.durationMaxMinutes}, ${sqlNumber(leg.distanceKm)}, ${sqlBoolean(leg.roundTrip)}, ${sqlSourceId(leg.sourceKey)}, ${leg.confidence ?? 0.72}, ${sqlString(leg.observedAt ?? dataset.manifest.generatedAt)}::timestamptz, ${leg.validUntil ? `${sqlString(leg.validUntil)}::timestamptz` : 'null'}, ${sqlJson(leg.notes ?? {})})`);
      lines.push(`on conflict (template_id, sequence) do update set from_entity_id = excluded.from_entity_id, to_entity_id = excluded.to_entity_id, leg_role = excluded.leg_role, transport_modes = excluded.transport_modes, duration_min_minutes = excluded.duration_min_minutes, duration_max_minutes = excluded.duration_max_minutes, distance_km = excluded.distance_km, round_trip = excluded.round_trip, source_id = excluded.source_id, confidence = excluded.confidence, observed_at = excluded.observed_at, valid_until = excluded.valid_until, notes = excluded.notes;`);
    });
    for (const tag of template.tags) {
      lines.push(`insert into public.travel_template_tags (template_id, tag_key, weight)`);
      lines.push(`values (${templateIdReference}, ${sqlString(tag.tagKey)}, ${tag.weight})`);
      lines.push(`on conflict (template_id, tag_key) do update set weight = excluded.weight;`);
    }
    lines.push('');
  }

  const checksum = calculateTravelKnowledgeChecksum(dataset);
  const datasetId = deterministicTravelUuid(`dataset:${dataset.manifest.datasetKey}:${dataset.manifest.version}`);
  lines.push(`insert into public.travel_dataset_versions (id, dataset_key, country_code, version, status, checksum, entity_count, fact_count, template_count, source_snapshot, generated_at, published_at, notes)`);
  lines.push(`values (${sqlString(datasetId)}::uuid, ${sqlString(dataset.manifest.datasetKey)}, ${sqlString(dataset.manifest.countryCode)}, ${sqlString(dataset.manifest.version)}, 'published', ${sqlString(checksum)}, ${validation.counts.entities}, ${validation.counts.facts}, ${validation.counts.templates}, ${sqlJson(dataset.sources.map((source) => ({ sourceKey: source.sourceKey, baseUrl: source.baseUrl, licenseKey: source.licenseKey ?? null })))}, ${sqlString(dataset.manifest.generatedAt)}::timestamptz, ${sqlString(dataset.manifest.generatedAt)}::timestamptz, ${sqlString(dataset.manifest.notes)})`);
  lines.push(`on conflict (dataset_key, version) do update set status = excluded.status, checksum = excluded.checksum, entity_count = excluded.entity_count, fact_count = excluded.fact_count, template_count = excluded.template_count, source_snapshot = excluded.source_snapshot, generated_at = excluded.generated_at, published_at = excluded.published_at, notes = excluded.notes;`);
  lines.push('');
  lines.push('commit;');
  lines.push('');
  return lines.join('\n');
};
