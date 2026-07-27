import thailandPackJson from '../data/travelKnowledge/thailand.v1.pack.generated.json';
import thailandTemplateCopyJson from '../data/travelKnowledge/thailand.v1.template-copy.generated.json';
import type {
  TravelDatasetManifest,
  TravelDestinationPack,
  TravelEntityCatalogItem,
  TravelEntityFact,
  TravelEntityName,
  TravelEntityTag,
  TravelTemplateCatalogItem,
  TravelTemplateLeg,
  TravelTemplateStop,
} from '../shared/travelKnowledge';
import {
  isTravelEntityType,
  TRAVEL_ENTITY_STATUS_VALUES,
  TRAVEL_EVIDENCE_LEVEL_VALUES,
} from '../shared/travelKnowledge';
import { MODEL_TRANSPORT_MODE_VALUES, type TransportMode } from '../shared/transportModes';

export type TravelKnowledgeLoadSource = 'memory' | 'bundled' | 'supabase';
export type TravelKnowledgeNetworkPolicy = 'cache-first' | 'network-first';

export interface TravelKnowledgeLoadResult {
  pack: TravelDestinationPack;
  source: TravelKnowledgeLoadSource;
  loadDurationMs: number;
}

export interface TravelKnowledgeLoadOptions {
  countryCode: string;
  locale?: string;
  networkPolicy?: TravelKnowledgeNetworkPolicy;
}

const bundledThailandPack = thailandPackJson as TravelDestinationPack;
type BundledTemplateCopyCatalog = {
  datasetVersion: string;
  templates: Record<string, Record<string, TravelTemplateCatalogItem['copy']>>;
};
const bundledThailandTemplateCopy = thailandTemplateCopyJson as BundledTemplateCopyCatalog;
const bundledLocaleCache = new Map<string, TravelDestinationPack>();
export const isRemoteTravelKnowledgeEnabled =
  import.meta.env.VITE_TRAVEL_KNOWLEDGE_REMOTE_ENABLED === 'true';
const ENTITY_STATUS_SET = new Set<string>(TRAVEL_ENTITY_STATUS_VALUES);
const EVIDENCE_LEVEL_SET = new Set<string>(TRAVEL_EVIDENCE_LEVEL_VALUES);
const TRANSPORT_MODE_SET = new Set<string>(MODEL_TRANSPORT_MODE_VALUES);
const remoteCache = new Map<string, TravelDestinationPack>();
const pendingRefreshes = new Map<string, Promise<TravelDestinationPack>>();

const measureNow = (): number => (
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now()
);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const firstField = (record: Record<string, unknown>, ...keys: string[]): unknown => {
  for (const key of keys) {
    if (record[key] !== undefined) return record[key];
  }
  return undefined;
};

const stringValue = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback;

const optionalString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value : undefined;

const numberValue = (value: unknown, fallback = 0): number => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const optionalNumber = (value: unknown): number | undefined => {
  if (value === null || value === undefined || value === '') return undefined;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const booleanValue = (value: unknown): boolean => value === true;

const recordValue = (value: unknown): Record<string, unknown> => isRecord(value) ? value : {};

const recordArray = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? value.filter(isRecord) : [];

const stringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

const numberArray = (value: unknown): number[] =>
  Array.isArray(value)
    ? value.map((item) => numberValue(item, Number.NaN)).filter(Number.isFinite)
    : [];

const normalizeDataset = (value: unknown): TravelDatasetManifest | null => {
  if (!isRecord(value) || Object.keys(value).length === 0) return null;
  const version = stringValue(value.version);
  const countryCode = stringValue(firstField(value, 'countryCode', 'country_code')).toUpperCase();
  if (!version || !countryCode) return null;
  return {
    datasetKey: stringValue(firstField(value, 'datasetKey', 'dataset_key')),
    countryCode,
    version,
    checksum: stringValue(value.checksum),
    entityCount: numberValue(firstField(value, 'entityCount', 'entity_count')),
    factCount: numberValue(firstField(value, 'factCount', 'fact_count')),
    templateCount: numberValue(firstField(value, 'templateCount', 'template_count')),
    generatedAt: stringValue(firstField(value, 'generatedAt', 'generated_at')),
    publishedAt: optionalString(firstField(value, 'publishedAt', 'published_at')),
  };
};

const normalizeName = (value: Record<string, unknown>): TravelEntityName | null => {
  const name = stringValue(value.name);
  const locale = stringValue(value.locale);
  const nameKind = stringValue(firstField(value, 'nameKind', 'name_kind'));
  if (!name || !locale || !['primary', 'local', 'alias', 'historic'].includes(nameKind)) return null;
  return {
    locale,
    name,
    nameKind: nameKind as TravelEntityName['nameKind'],
    isPreferred: booleanValue(firstField(value, 'isPreferred', 'is_preferred')),
  };
};

const normalizeFact = (value: Record<string, unknown>): TravelEntityFact | null => {
  const factKey = stringValue(firstField(value, 'factKey', 'fact_key'));
  const sourceKey = stringValue(firstField(value, 'sourceKey', 'source_key'));
  const reviewStatus = stringValue(firstField(value, 'reviewStatus', 'review_status'));
  if (!factKey || !sourceKey || !['imported', 'editorial_reviewed', 'verified', 'deprecated'].includes(reviewStatus)) {
    return null;
  }
  return {
    id: stringValue(value.id),
    factKey,
    valueJson: firstField(value, 'valueJson', 'value_json'),
    unit: optionalString(value.unit),
    locale: optionalString(value.locale),
    sourceKey,
    confidence: numberValue(value.confidence, 0.8),
    reviewStatus: reviewStatus as TravelEntityFact['reviewStatus'],
    observedAt: stringValue(firstField(value, 'observedAt', 'observed_at')),
    validFrom: optionalString(firstField(value, 'validFrom', 'valid_from')),
    validUntil: optionalString(firstField(value, 'validUntil', 'valid_until')),
    metadata: recordValue(value.metadata),
  };
};

const normalizeTag = (value: Record<string, unknown>): TravelEntityTag | null => {
  const tagKey = stringValue(firstField(value, 'tagKey', 'tag_key'));
  const sourceKey = stringValue(firstField(value, 'sourceKey', 'source_key'));
  const evidenceLevel = stringValue(firstField(value, 'evidenceLevel', 'evidence_level'));
  if (!tagKey || !sourceKey || !EVIDENCE_LEVEL_SET.has(evidenceLevel)) return null;
  return {
    tagKey,
    sourceKey,
    relevance: numberValue(value.relevance),
    evidenceLevel: evidenceLevel as TravelEntityTag['evidenceLevel'],
    evidenceNote: optionalString(firstField(value, 'evidenceNote', 'evidence_note')),
    validUntil: optionalString(firstField(value, 'validUntil', 'valid_until')),
    metadata: recordValue(value.metadata),
  };
};

const normalizeEntity = (value: Record<string, unknown>): TravelEntityCatalogItem | null => {
  const entityType = firstField(value, 'entityType', 'entity_type');
  const status = stringValue(value.status);
  const canonicalSlug = stringValue(firstField(value, 'canonicalSlug', 'canonical_slug'));
  const entityId = stringValue(firstField(value, 'entityId', 'id'));
  const name = stringValue(firstField(value, 'name', 'primaryName', 'primary_name'));
  if (!isTravelEntityType(entityType) || !ENTITY_STATUS_SET.has(status) || !canonicalSlug || !entityId || !name) {
    return null;
  }
  return {
    entityId,
    canonicalSlug,
    entityType,
    countryCode: stringValue(firstField(value, 'countryCode', 'country_code')).toUpperCase(),
    name,
    resolution: 'canonical',
    parentId: optionalString(firstField(value, 'parentId', 'parent_id')) ?? null,
    localName: optionalString(firstField(value, 'localName', 'local_name')),
    timezone: optionalString(value.timezone),
    latitude: optionalNumber(value.latitude),
    longitude: optionalNumber(value.longitude),
    status: status as TravelEntityCatalogItem['status'],
    datasetVersion: stringValue(firstField(value, 'datasetVersion', 'dataset_version')),
    typicalMinDays: optionalNumber(firstField(value, 'typicalMinDays', 'typical_min_days')),
    typicalMaxDays: optionalNumber(firstField(value, 'typicalMaxDays', 'typical_max_days')),
    popularityScore: numberValue(firstField(value, 'popularityScore', 'popularity_score')),
    hiddenGemScore: numberValue(firstField(value, 'hiddenGemScore', 'hidden_gem_score')),
    tourismIntensityScore: numberValue(firstField(value, 'tourismIntensityScore', 'tourism_intensity_score')),
    attributes: recordValue(value.attributes),
    names: recordArray(value.names).flatMap((item) => {
      const normalized = normalizeName(item);
      return normalized ? [normalized] : [];
    }),
    facts: recordArray(value.facts).flatMap((item) => {
      const normalized = normalizeFact(item);
      return normalized ? [normalized] : [];
    }),
    tags: recordArray(value.tags).flatMap((item) => {
      const normalized = normalizeTag(item);
      return normalized ? [normalized] : [];
    }),
  };
};

const normalizeTemplateStop = (value: Record<string, unknown>): TravelTemplateStop | null => {
  const entityType = firstField(value, 'entityType', 'entity_type');
  const stopRole = stringValue(firstField(value, 'stopRole', 'stop_role'));
  if (!isTravelEntityType(entityType) || !['entry', 'exit', 'base', 'must_visit', 'day_trip', 'consider'].includes(stopRole)) {
    return null;
  }
  return {
    sequence: numberValue(value.sequence),
    entityId: stringValue(firstField(value, 'entityId', 'entity_id')),
    entitySlug: stringValue(firstField(value, 'entitySlug', 'entity_slug')),
    entityName: stringValue(firstField(value, 'entityName', 'entity_name')),
    entityType,
    stopRole: stopRole as TravelTemplateStop['stopRole'],
    minNights: numberValue(firstField(value, 'minNights', 'min_nights')),
    maxNights: numberValue(firstField(value, 'maxNights', 'max_nights')),
    isOptional: booleanValue(firstField(value, 'isOptional', 'is_optional')),
    notes: recordValue(value.notes),
  };
};

const normalizeTemplateLeg = (value: Record<string, unknown>): TravelTemplateLeg | null => {
  const legRole = stringValue(firstField(value, 'legRole', 'leg_role'));
  const fromEntityId = stringValue(firstField(value, 'fromEntityId', 'from_entity_id'));
  const fromEntitySlug = stringValue(firstField(value, 'fromEntitySlug', 'from_entity_slug'));
  const fromEntityName = stringValue(firstField(value, 'fromEntityName', 'from_entity_name'));
  const toEntityId = stringValue(firstField(value, 'toEntityId', 'to_entity_id'));
  const toEntitySlug = stringValue(firstField(value, 'toEntitySlug', 'to_entity_slug'));
  const toEntityName = stringValue(firstField(value, 'toEntityName', 'to_entity_name'));
  const transportModes = stringArray(firstField(value, 'transportModes', 'transport_modes'))
    .filter((mode): mode is TransportMode => TRANSPORT_MODE_SET.has(mode));
  const durationMinMinutes = numberValue(firstField(value, 'durationMinMinutes', 'duration_min_minutes'));
  const durationMaxMinutes = numberValue(firstField(value, 'durationMaxMinutes', 'duration_max_minutes'));
  if (
    !['transfer', 'day_trip'].includes(legRole)
    || !fromEntityId
    || !fromEntitySlug
    || !fromEntityName
    || !toEntityId
    || !toEntitySlug
    || !toEntityName
    || transportModes.length === 0
    || durationMinMinutes <= 0
    || durationMaxMinutes < durationMinMinutes
  ) {
    return null;
  }
  return {
    sequence: numberValue(value.sequence),
    fromEntityId,
    fromEntitySlug,
    fromEntityName,
    toEntityId,
    toEntitySlug,
    toEntityName,
    legRole: legRole as TravelTemplateLeg['legRole'],
    transportModes,
    durationMinMinutes,
    durationMaxMinutes,
    distanceKm: optionalNumber(firstField(value, 'distanceKm', 'distance_km')),
    roundTrip: booleanValue(firstField(value, 'roundTrip', 'round_trip')),
    sourceKey: stringValue(firstField(value, 'sourceKey', 'source_key')),
    confidence: numberValue(value.confidence, 0.72),
    observedAt: stringValue(firstField(value, 'observedAt', 'observed_at')),
    validUntil: optionalString(firstField(value, 'validUntil', 'valid_until')),
    notes: recordValue(value.notes),
  };
};

const normalizeTemplate = (value: Record<string, unknown>): TravelTemplateCatalogItem | null => {
  const copyValue = recordValue(value.copy);
  const pace = stringValue(firstField(value, 'preferredPace', 'preferred_pace'));
  const templateKey = stringValue(firstField(value, 'templateKey', 'template_key'));
  if (!templateKey || !['relaxed', 'balanced', 'full'].includes(pace)) return null;
  return {
    id: stringValue(value.id),
    templateKey,
    countryCode: stringValue(firstField(value, 'countryCode', 'country_code')).toUpperCase(),
    journeyType: stringValue(firstField(value, 'journeyType', 'journey_type')),
    minDays: numberValue(firstField(value, 'minDays', 'min_days')),
    maxDays: numberValue(firstField(value, 'maxDays', 'max_days')),
    preferredPace: pace as TravelTemplateCatalogItem['preferredPace'],
    idealMonths: numberArray(firstField(value, 'idealMonths', 'ideal_months')),
    datasetVersion: stringValue(firstField(value, 'datasetVersion', 'dataset_version')),
    version: numberValue(value.version),
    copy: {
      locale: stringValue(copyValue.locale, 'en'),
      title: stringValue(copyValue.title),
      summary: stringValue(copyValue.summary),
      highlights: stringArray(copyValue.highlights),
      tradeoffs: stringArray(copyValue.tradeoffs),
    },
    stops: recordArray(value.stops).flatMap((item) => {
      const normalized = normalizeTemplateStop(item);
      return normalized ? [normalized] : [];
    }),
    legs: recordArray(value.legs).flatMap((item) => {
      const normalized = normalizeTemplateLeg(item);
      return normalized ? [normalized] : [];
    }),
    tags: recordArray(value.tags).flatMap((tag) => {
      const tagKey = stringValue(firstField(tag, 'tagKey', 'tag_key'));
      return tagKey ? [{ tagKey, weight: numberValue(tag.weight) }] : [];
    }),
    attributes: recordValue(value.attributes),
  };
};

export const normalizeTravelDestinationPack = (value: unknown): TravelDestinationPack | null => {
  if (!isRecord(value)) return null;
  const countryCode = stringValue(firstField(value, 'countryCode', 'country_code')).toUpperCase();
  if (!countryCode) return null;
  const entities = recordArray(value.entities).flatMap((item) => {
    const normalized = normalizeEntity(item);
    return normalized ? [normalized] : [];
  });
  const templates = recordArray(value.templates).flatMap((item) => {
    const normalized = normalizeTemplate(item);
    return normalized ? [normalized] : [];
  });
  if (entities.length === 0) return null;
  return {
    countryCode,
    locale: stringValue(value.locale, 'en'),
    dataset: normalizeDataset(value.dataset),
    entities,
    templates,
  };
};

const cacheKey = (countryCode: string, locale: string): string =>
  `${countryCode.trim().toUpperCase()}:${locale.trim().toLowerCase() || 'en'}`;

export const getBundledTravelDestinationPack = (
  countryCode: string,
  locale = 'en',
): TravelDestinationPack | null => {
  if (countryCode.trim().toUpperCase() !== 'TH') return null;
  const normalizedLocale = locale.trim().toLowerCase() || 'en';
  const cached = bundledLocaleCache.get(normalizedLocale);
  if (cached) return cached;
  const primaryLocale = normalizedLocale.split('-')[0] ?? normalizedLocale;
  const localized: TravelDestinationPack = {
    ...bundledThailandPack,
    locale: normalizedLocale,
    templates: bundledThailandPack.templates.map((template) => {
      const copies = bundledThailandTemplateCopy.templates[template.templateKey];
      const copy = copies?.[normalizedLocale] ?? copies?.[primaryLocale] ?? copies?.en ?? template.copy;
      return copy === template.copy ? template : { ...template, copy };
    }),
  };
  bundledLocaleCache.set(normalizedLocale, localized);
  return localized;
};

export const refreshTravelDestinationPack = async (
  countryCode: string,
  locale = 'en',
): Promise<TravelDestinationPack> => {
  const normalizedCountryCode = countryCode.trim().toUpperCase();
  const normalizedLocale = locale.trim().toLowerCase() || 'en';
  const key = cacheKey(normalizedCountryCode, normalizedLocale);
  const pending = pendingRefreshes.get(key);
  if (pending) return pending;

  const request = (async () => {
    if (!isRemoteTravelKnowledgeEnabled) {
      const bundled = getBundledTravelDestinationPack(normalizedCountryCode, normalizedLocale);
      if (bundled) return bundled;
      throw new Error(`Travel knowledge is unavailable for ${normalizedCountryCode}.`);
    }

    const { isSupabaseEnabled, supabase } = await import('./supabaseClient');
    if (!isSupabaseEnabled || !supabase) {
      const bundled = getBundledTravelDestinationPack(normalizedCountryCode, normalizedLocale);
      if (bundled) return bundled;
      throw new Error(`Travel knowledge is unavailable for ${normalizedCountryCode}.`);
    }

    const { data, error } = await supabase.rpc('get_active_travel_destination_pack', {
      p_country_code: normalizedCountryCode,
      p_locale: normalizedLocale,
    });
    if (error) throw error;
    const normalized = normalizeTravelDestinationPack(data);
    if (!normalized) throw new Error(`Travel knowledge returned an invalid ${normalizedCountryCode} destination pack.`);
    remoteCache.set(key, normalized);
    return normalized;
  })().finally(() => {
    pendingRefreshes.delete(key);
  });

  pendingRefreshes.set(key, request);
  return request;
};

export const loadTravelDestinationPack = async (
  options: TravelKnowledgeLoadOptions,
): Promise<TravelKnowledgeLoadResult> => {
  const startedAt = measureNow();
  const countryCode = options.countryCode.trim().toUpperCase();
  const locale = options.locale?.trim().toLowerCase() || 'en';
  const key = cacheKey(countryCode, locale);
  const finish = (
    pack: TravelDestinationPack,
    source: TravelKnowledgeLoadSource,
  ): TravelKnowledgeLoadResult => ({
    pack,
    source,
    loadDurationMs: Math.max(0, measureNow() - startedAt),
  });
  const cached = remoteCache.get(key);
  if (cached) return finish(cached, 'memory');

  const bundled = getBundledTravelDestinationPack(countryCode, locale);
  if (options.networkPolicy !== 'network-first' && bundled) {
    void refreshTravelDestinationPack(countryCode, locale).catch(() => undefined);
    return finish(bundled, 'bundled');
  }

  try {
    const pack = await refreshTravelDestinationPack(countryCode, locale);
    return finish(pack, remoteCache.get(key) === pack ? 'supabase' : 'bundled');
  } catch (error) {
    if (bundled) return finish(bundled, 'bundled');
    throw error;
  }
};

export const clearTravelKnowledgeMemoryCacheForTests = (): void => {
  remoteCache.clear();
  pendingRefreshes.clear();
  bundledLocaleCache.clear();
};
