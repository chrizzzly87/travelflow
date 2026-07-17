import {
  JOURNEY_PACE_VALUES,
  JOURNEY_TYPE_VALUES,
  type JourneySpec,
} from '../shared/journeySpec';
import {
  buildTravelPlanningContext,
  buildTravelPlanningContextQuery,
  TRAVEL_PLANNING_CONTEXT_VERSION,
  TRAVEL_PLANNING_RETRIEVER_VERSION,
  validateTravelPlanningContext,
  type BuildTravelPlanningContextOptions,
  type TravelPlanningContext,
  type TravelPlanningContextQuery,
} from '../shared/travelPlanningContext';
import {
  getBundledTravelDestinationPack,
  isRemoteTravelKnowledgeEnabled,
  normalizeTravelDestinationPack,
  type TravelKnowledgeNetworkPolicy,
} from './travelKnowledgeService';

export type TravelPlanningContextLoadSource = 'memory' | 'bundled' | 'supabase';

export interface TravelPlanningContextLoadOptions extends BuildTravelPlanningContextOptions {
  spec: JourneySpec;
  networkPolicy?: TravelKnowledgeNetworkPolicy;
}

export interface TravelPlanningContextLoadResult {
  context: TravelPlanningContext;
  source: TravelPlanningContextLoadSource;
  loadDurationMs: number;
}

const PACE_SET = new Set<string>(JOURNEY_PACE_VALUES);
const JOURNEY_TYPE_SET = new Set<string>(JOURNEY_TYPE_VALUES);
const memoryCache = new Map<string, TravelPlanningContext>();
const pendingRefreshes = new Map<string, Promise<TravelPlanningContext>>();
const remoteContextKeys = new Set<string>();

const measureNow = (): number => (
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now()
);

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

const stringArray = (value: unknown): string[] | null => (
  Array.isArray(value) && value.every((entry) => typeof entry === 'string')
    ? value
    : null
);

const integerArray = (value: unknown): number[] | null => (
  Array.isArray(value) && value.every((entry) => Number.isInteger(entry))
    ? value as number[]
    : null
);

const positiveInteger = (value: unknown): number | null => (
  Number.isInteger(value) && Number(value) >= 1 ? Number(value) : null
);

const nonNegativeInteger = (value: unknown): number | undefined | null => {
  if (value === undefined || value === null) return undefined;
  return Number.isInteger(value) && Number(value) >= 0 ? Number(value) : null;
};

const normalizeQuery = (value: unknown): TravelPlanningContextQuery | null => {
  if (!isRecord(value)) return null;
  const months = integerArray(value.months);
  const interestTags = stringArray(value.interestTags);
  const selectedPlaceSlugs = stringArray(value.selectedPlaceSlugs);
  const lockedPlaceSlugs = stringArray(value.lockedPlaceSlugs);
  const avoidedPlaceSlugs = stringArray(value.avoidedPlaceSlugs);
  const templateKeys = stringArray(value.templateKeys);
  const maxBaseChanges = nonNegativeInteger(value.maxBaseChanges);
  const durationDays = positiveInteger(value.durationDays);
  const templateLimit = positiveInteger(value.templateLimit);
  const neighborhoodLimitPerCity = positiveInteger(value.neighborhoodLimitPerCity);
  const poiLimitPerCity = positiveInteger(value.poiLimitPerCity);
  if (
    typeof value.countryCode !== 'string'
    || typeof value.locale !== 'string'
    || typeof value.journeyType !== 'string'
    || !JOURNEY_TYPE_SET.has(value.journeyType)
    || typeof value.pace !== 'string'
    || !PACE_SET.has(value.pace)
    || !months
    || months.some((month) => month < 1 || month > 12)
    || !interestTags
    || !selectedPlaceSlugs
    || !lockedPlaceSlugs
    || !avoidedPlaceSlugs
    || !templateKeys
    || maxBaseChanges === null
    || durationDays === null
    || templateLimit === null
    || neighborhoodLimitPerCity === null
    || poiLimitPerCity === null
  ) return null;

  return {
    countryCode: value.countryCode,
    locale: value.locale,
    journeyType: value.journeyType as TravelPlanningContextQuery['journeyType'],
    durationDays,
    months,
    pace: value.pace as TravelPlanningContextQuery['pace'],
    interestTags,
    selectedPlaceSlugs,
    lockedPlaceSlugs,
    avoidedPlaceSlugs,
    maxBaseChanges,
    templateKeys,
    templateLimit,
    neighborhoodLimitPerCity,
    poiLimitPerCity,
  };
};

const normalizeStats = (value: unknown): TravelPlanningContext['stats'] | null => {
  if (!isRecord(value)) return null;
  const keys = [
    'sourceEntityCount',
    'sourceTemplateCount',
    'selectedEntityCount',
    'selectedTemplateCount',
    'selectedCityCount',
    'selectedNeighborhoodCount',
    'selectedPoiCount',
  ] as const;
  if (keys.some((key) => !Number.isInteger(value[key]) || Number(value[key]) < 0)) return null;
  return Object.fromEntries(keys.map((key) => [key, Number(value[key])])) as TravelPlanningContext['stats'];
};

export const normalizeTravelPlanningContext = (value: unknown): TravelPlanningContext | null => {
  if (!isRecord(value)
    || value.version !== TRAVEL_PLANNING_CONTEXT_VERSION
    || value.retrieverVersion !== TRAVEL_PLANNING_RETRIEVER_VERSION) return null;
  const query = normalizeQuery(value.query);
  const pack = normalizeTravelDestinationPack(value.pack);
  const stats = normalizeStats(value.stats);
  if (!query || !pack || !stats) return null;
  const context: TravelPlanningContext = {
    version: TRAVEL_PLANNING_CONTEXT_VERSION,
    retrieverVersion: TRAVEL_PLANNING_RETRIEVER_VERSION,
    query,
    pack,
    stats,
  };
  return validateTravelPlanningContext(context).valid ? context : null;
};

const cacheKey = (query: TravelPlanningContextQuery): string => JSON.stringify(query);

const bundledContext = (
  spec: JourneySpec,
  options: BuildTravelPlanningContextOptions,
): TravelPlanningContext => {
  const countryCode = spec.countryCodes[0]?.trim().toUpperCase() ?? '';
  const pack = getBundledTravelDestinationPack(countryCode, options.locale);
  if (!pack) throw new Error(`Travel planning context is unavailable for ${countryCode || 'the selected country'}.`);
  return buildTravelPlanningContext(pack, spec, options);
};

export const refreshTravelPlanningContext = async (
  options: TravelPlanningContextLoadOptions,
): Promise<TravelPlanningContext> => {
  const query = buildTravelPlanningContextQuery(options.spec, options);
  const key = cacheKey(query);
  const pending = pendingRefreshes.get(key);
  if (pending) return pending;

  const request = (async () => {
    if (!isRemoteTravelKnowledgeEnabled) {
      const context = bundledContext(options.spec, options);
      memoryCache.set(key, context);
      remoteContextKeys.delete(key);
      return context;
    }
    const { isSupabaseEnabled, supabase } = await import('./supabaseClient');
    if (!isSupabaseEnabled || !supabase) {
      const context = bundledContext(options.spec, options);
      memoryCache.set(key, context);
      remoteContextKeys.delete(key);
      return context;
    }

    const { data, error } = await supabase.rpc('get_active_travel_planning_context', {
      p_country_code: query.countryCode,
      p_locale: query.locale,
      p_journey_type: query.journeyType,
      p_duration_days: query.durationDays,
      p_months: query.months,
      p_pace: query.pace,
      p_interest_tags: query.interestTags,
      p_selected_place_slugs: query.selectedPlaceSlugs,
      p_locked_place_slugs: query.lockedPlaceSlugs,
      p_avoided_place_slugs: query.avoidedPlaceSlugs,
      p_max_base_changes: query.maxBaseChanges ?? null,
      p_template_keys: query.templateKeys,
      p_template_limit: query.templateLimit,
      p_neighborhood_limit_per_city: query.neighborhoodLimitPerCity,
      p_poi_limit_per_city: query.poiLimitPerCity,
    });
    if (error) throw error;
    const context = normalizeTravelPlanningContext(data);
    if (!context) throw new Error(`Travel knowledge returned an invalid ${query.countryCode} planning context.`);
    const pinnedDatasetVersion = options.spec.knowledgeContext?.datasetVersion;
    if (pinnedDatasetVersion && context.pack.dataset?.version !== pinnedDatasetVersion) {
      throw new Error(`Planning context dataset drifted from ${pinnedDatasetVersion} to ${context.pack.dataset?.version ?? 'unknown'}.`);
    }
    memoryCache.set(key, context);
    remoteContextKeys.add(key);
    return context;
  })().finally(() => pendingRefreshes.delete(key));

  pendingRefreshes.set(key, request);
  return request;
};

export const loadTravelPlanningContext = async (
  options: TravelPlanningContextLoadOptions,
): Promise<TravelPlanningContextLoadResult> => {
  const startedAt = measureNow();
  const query = buildTravelPlanningContextQuery(options.spec, options);
  const key = cacheKey(query);
  const finish = (
    context: TravelPlanningContext,
    source: TravelPlanningContextLoadSource,
  ): TravelPlanningContextLoadResult => ({
    context,
    source,
    loadDurationMs: Math.max(0, measureNow() - startedAt),
  });
  const cached = memoryCache.get(key);
  if (cached) return finish(cached, 'memory');

  const fallback = bundledContext(options.spec, options);
  if (options.networkPolicy !== 'network-first') {
    void refreshTravelPlanningContext(options).catch(() => undefined);
    return finish(fallback, 'bundled');
  }

  try {
    const context = await refreshTravelPlanningContext(options);
    return finish(context, remoteContextKeys.has(key) ? 'supabase' : 'bundled');
  } catch {
    return finish(fallback, 'bundled');
  }
};

export const clearTravelPlanningContextMemoryCacheForTests = (): void => {
  memoryCache.clear();
  pendingRefreshes.clear();
  remoteContextKeys.clear();
};
