import type { JourneyPlaceRole, JourneySpec } from './journeySpec';
import {
  type TravelDestinationPack,
  type TravelEntityCatalogItem,
  type TravelTemplateCatalogItem,
} from './travelKnowledge';
import {
  getTravelKnowledgeDescendants,
  getTravelKnowledgeIndex,
} from './travelKnowledgeIndex';
import { matchTravelTemplates } from './travelTemplateMatcher';

export const TRAVEL_PLANNING_CONTEXT_VERSION = 1 as const;
export const TRAVEL_PLANNING_RETRIEVER_VERSION = 'structured-pack-v1' as const;

const ROUTE_SELECTION_ROLES = new Set<JourneyPlaceRole>([
  'entry',
  'exit',
  'base',
  'must_visit',
  'day_trip',
]);

export interface TravelPlanningContextQuery {
  countryCode: string;
  locale: string;
  journeyType: JourneySpec['journeyType'];
  durationDays: number;
  months: number[];
  pace: JourneySpec['preferences']['pace'];
  interestTags: string[];
  selectedPlaceSlugs: string[];
  lockedPlaceSlugs: string[];
  avoidedPlaceSlugs: string[];
  maxBaseChanges?: number;
  templateKeys: string[];
  templateLimit: number;
  neighborhoodLimitPerCity: number;
  poiLimitPerCity: number;
}

export interface TravelPlanningContextStats {
  sourceEntityCount: number;
  sourceTemplateCount: number;
  selectedEntityCount: number;
  selectedTemplateCount: number;
  selectedCityCount: number;
  selectedNeighborhoodCount: number;
  selectedPoiCount: number;
}

export interface TravelPlanningContextV1 {
  version: typeof TRAVEL_PLANNING_CONTEXT_VERSION;
  retrieverVersion: typeof TRAVEL_PLANNING_RETRIEVER_VERSION;
  query: TravelPlanningContextQuery;
  pack: TravelDestinationPack;
  stats: TravelPlanningContextStats;
}

export type TravelPlanningContext = TravelPlanningContextV1;

export interface BuildTravelPlanningContextOptions {
  locale?: string;
  templateKeys?: string[];
  templateLimit?: number;
  neighborhoodLimitPerCity?: number;
  poiLimitPerCity?: number;
}

export interface TravelPlanningContextValidationResult {
  valid: boolean;
  errors: string[];
}

const uniqueStrings = (values: readonly string[]): string[] => Array.from(new Set(
  values.map((value) => value.trim().toLowerCase()).filter(Boolean),
)).sort();

const boundedInteger = (value: number | undefined, fallback: number, maximum: number): number => (
  Math.max(1, Math.min(maximum, Math.round(value ?? fallback)))
);

const journeyMonths = (spec: JourneySpec): number[] => {
  if (spec.dateWindow.mode === 'flexible') {
    return Array.from(new Set(spec.dateWindow.months)).sort((left, right) => left - right);
  }

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
  return Array.from(new Set(months)).sort((left, right) => left - right);
};

export const buildTravelPlanningContextQuery = (
  spec: JourneySpec,
  options: BuildTravelPlanningContextOptions = {},
): TravelPlanningContextQuery => {
  const routePlaces = spec.places.filter((place) => ROUTE_SELECTION_ROLES.has(place.role));
  return {
    countryCode: spec.countryCodes[0]?.trim().toUpperCase() ?? '',
    locale: options.locale?.trim().toLowerCase() || 'en',
    journeyType: spec.journeyType,
    durationDays: spec.durationDays,
    months: journeyMonths(spec),
    pace: spec.preferences.pace,
    interestTags: uniqueStrings([
      ...spec.preferences.interestTags,
      ...spec.preferences.vibeTags,
    ]),
    selectedPlaceSlugs: uniqueStrings(routePlaces.map((place) => place.entity.canonicalSlug)),
    lockedPlaceSlugs: uniqueStrings(routePlaces
      .filter((place) => place.locked || spec.constraints.routeLocked)
      .map((place) => place.entity.canonicalSlug)),
    avoidedPlaceSlugs: uniqueStrings(spec.places
      .filter((place) => place.role === 'avoid')
      .map((place) => place.entity.canonicalSlug)),
    maxBaseChanges: spec.constraints.maxBaseChanges,
    templateKeys: uniqueStrings(options.templateKeys ?? []),
    templateLimit: boundedInteger(options.templateLimit, 3, 10),
    neighborhoodLimitPerCity: boundedInteger(options.neighborhoodLimitPerCity, 2, 10),
    poiLimitPerCity: boundedInteger(options.poiLimitPerCity, 2, 12),
  };
};

const nearestCity = (
  entity: TravelEntityCatalogItem,
  pack: TravelDestinationPack,
): TravelEntityCatalogItem | undefined => {
  const index = getTravelKnowledgeIndex(pack);
  let current: TravelEntityCatalogItem | undefined = entity;
  const visited = new Set<string>();
  while (current) {
    if (current.entityType === 'city') return current;
    if (!current.parentId || visited.has(current.parentId)) return undefined;
    visited.add(current.parentId);
    current = index.byId.get(current.parentId);
  }
  return undefined;
};

const addEntityAndAncestors = (
  entity: TravelEntityCatalogItem | undefined,
  pack: TravelDestinationPack,
  selectedSlugs: Set<string>,
): void => {
  if (!entity) return;
  const index = getTravelKnowledgeIndex(pack);
  let current: TravelEntityCatalogItem | undefined = entity;
  const visited = new Set<string>();
  while (current && !visited.has(current.canonicalSlug)) {
    selectedSlugs.add(current.canonicalSlug);
    visited.add(current.canonicalSlug);
    current = current.parentId ? index.byId.get(current.parentId) : undefined;
  }
};

const poiScore = (
  entity: TravelEntityCatalogItem,
  interestTags: ReadonlySet<string>,
): number => {
  const tagScore = entity.tags.reduce((score, tag) => (
    score + (interestTags.has(tag.tagKey) ? Math.max(0, tag.relevance) * 100 : 0)
  ), 0);
  const essentialScore = entity.tags.some((tag) => tag.tagKey === 'essential') ? 25 : 0;
  return tagScore
    + essentialScore
    + entity.popularityScore
    + (entity.hiddenGemScore * 0.2)
    - (entity.tourismIntensityScore * 0.03);
};

const AUDIENCE_TAG_KEYS = new Set([
  'family_activity_supply',
  'lgbtq_scene',
  'solo_travel_interest',
]);

const compactContextEntity = (entity: TravelEntityCatalogItem): TravelEntityCatalogItem => ({
  ...entity,
  attributes: Object.fromEntries(
    Object.entries(entity.attributes).filter(([key]) => key !== 'sourceUrls'),
  ),
  names: entity.names.filter((name) => name.isPreferred),
  facts: entity.facts.map((fact) => ({
    ...fact,
    metadata: typeof fact.metadata.sourceUrl === 'string'
      ? { sourceUrl: fact.metadata.sourceUrl }
      : {},
  })),
  tags: entity.tags.map((tag) => (
    AUDIENCE_TAG_KEYS.has(tag.tagKey)
      ? tag
      : { ...tag, evidenceNote: undefined, metadata: {} }
  )),
});

const selectRelevantEntities = (
  pack: TravelDestinationPack,
  templates: readonly TravelTemplateCatalogItem[],
  query: TravelPlanningContextQuery,
): TravelEntityCatalogItem[] => {
  const index = getTravelKnowledgeIndex(pack);
  const selectedSlugs = new Set<string>();
  const citySlugs = new Set<string>();
  const explicitTemplateStopSlugs = new Set(templates.flatMap((template) => (
    template.stops.map((stop) => stop.entitySlug)
  )));
  const seedSlugs = new Set([
    ...query.selectedPlaceSlugs,
    ...query.lockedPlaceSlugs,
    ...explicitTemplateStopSlugs,
  ]);

  for (const country of index.byType.get('country') ?? []) {
    if (country.countryCode === query.countryCode) addEntityAndAncestors(country, pack, selectedSlugs);
  }
  for (const slug of seedSlugs) {
    const entity = index.bySlug.get(slug);
    addEntityAndAncestors(entity, pack, selectedSlugs);
    const city = entity ? nearestCity(entity, pack) : undefined;
    if (city) citySlugs.add(city.canonicalSlug);
  }

  const desiredTags = new Set(query.interestTags);
  for (const citySlug of citySlugs) {
    const city = index.bySlug.get(citySlug);
    if (!city?.entityId) continue;
    addEntityAndAncestors(city, pack, selectedSlugs);

    const rankedNeighborhoods = [...getTravelKnowledgeDescendants(index, city.entityId, 'neighborhood')]
      .sort((left, right) => (
        poiScore(right, desiredTags) - poiScore(left, desiredTags)
        || right.popularityScore - left.popularityScore
        || left.canonicalSlug.localeCompare(right.canonicalSlug)
      ));
    const requiredNeighborhoods = rankedNeighborhoods.filter((entity) => (
      explicitTemplateStopSlugs.has(entity.canonicalSlug)
      || query.selectedPlaceSlugs.includes(entity.canonicalSlug)
      || query.lockedPlaceSlugs.includes(entity.canonicalSlug)
    ));
    const selectedNeighborhoods = [
      ...requiredNeighborhoods,
      ...rankedNeighborhoods.filter((entity) => !requiredNeighborhoods.includes(entity)),
    ].slice(0, Math.max(query.neighborhoodLimitPerCity, requiredNeighborhoods.length));
    for (const neighborhood of selectedNeighborhoods) {
      addEntityAndAncestors(neighborhood, pack, selectedSlugs);
    }

    const rankedPois = [...getTravelKnowledgeDescendants(index, city.entityId, 'poi')]
      .sort((left, right) => (
        poiScore(right, desiredTags) - poiScore(left, desiredTags)
        || right.popularityScore - left.popularityScore
        || left.canonicalSlug.localeCompare(right.canonicalSlug)
      ));
    const requiredPois = rankedPois.filter((entity) => explicitTemplateStopSlugs.has(entity.canonicalSlug));
    const selectedPois = [
      ...requiredPois,
      ...rankedPois.filter((entity) => !explicitTemplateStopSlugs.has(entity.canonicalSlug)),
    ].slice(0, Math.max(query.poiLimitPerCity, requiredPois.length));
    for (const poi of selectedPois) addEntityAndAncestors(poi, pack, selectedSlugs);
  }

  return pack.entities
    .filter((entity) => selectedSlugs.has(entity.canonicalSlug))
    .map(compactContextEntity);
};

export const buildTravelPlanningContext = (
  pack: TravelDestinationPack,
  spec: JourneySpec,
  options: BuildTravelPlanningContextOptions = {},
): TravelPlanningContext => {
  const query = buildTravelPlanningContextQuery(spec, {
    ...options,
    locale: options.locale ?? pack.locale,
  });
  if (query.countryCode !== pack.countryCode) {
    throw new Error(`Planning context requested ${query.countryCode || 'no country'} from the ${pack.countryCode} pack.`);
  }
  if (!pack.dataset?.version) throw new Error('Planning context requires a versioned destination pack.');

  const templateByKey = new Map(pack.templates.map((template) => [template.templateKey, template]));
  const eligibleTemplateKeys = query.templateKeys.length > 0
    ? new Set(matchTravelTemplates(spec, pack, { limit: Math.max(1, pack.templates.length) })
      .map((match) => match.template.templateKey))
    : undefined;
  const templates = query.templateKeys.length > 0
    ? query.templateKeys.flatMap((templateKey) => {
        const template = templateByKey.get(templateKey);
        if (!template) throw new Error(`Planning context template ${templateKey} is unavailable in ${pack.dataset?.version}.`);
        if (!eligibleTemplateKeys?.has(templateKey)) {
          throw new Error(`Planning context template ${templateKey} conflicts with the JourneySpec constraints.`);
        }
        return [template];
      })
    : matchTravelTemplates(spec, pack, { limit: query.templateLimit })
      .map((match) => match.template);
  const entities = selectRelevantEntities(pack, templates, query);
  const context: TravelPlanningContext = {
    version: TRAVEL_PLANNING_CONTEXT_VERSION,
    retrieverVersion: TRAVEL_PLANNING_RETRIEVER_VERSION,
    query,
    pack: {
      ...pack,
      locale: query.locale,
      entities,
      templates,
    },
    stats: {
      sourceEntityCount: pack.entities.length,
      sourceTemplateCount: pack.templates.length,
      selectedEntityCount: entities.length,
      selectedTemplateCount: templates.length,
      selectedCityCount: entities.filter((entity) => entity.entityType === 'city').length,
      selectedNeighborhoodCount: entities.filter((entity) => entity.entityType === 'neighborhood').length,
      selectedPoiCount: entities.filter((entity) => entity.entityType === 'poi').length,
    },
  };
  const validation = validateTravelPlanningContext(context);
  if (!validation.valid) throw new Error(`Planning context is invalid: ${validation.errors.join(' ')}`);
  return context;
};

export const validateTravelPlanningContext = (
  context: TravelPlanningContext,
): TravelPlanningContextValidationResult => {
  const errors: string[] = [];
  if (context.version !== TRAVEL_PLANNING_CONTEXT_VERSION) errors.push('Planning context version must be 1.');
  if (context.retrieverVersion !== TRAVEL_PLANNING_RETRIEVER_VERSION) {
    errors.push(`Planning context retriever must be ${TRAVEL_PLANNING_RETRIEVER_VERSION}.`);
  }
  if (!context.pack.dataset?.version) errors.push('Planning context requires dataset provenance.');
  if (context.pack.countryCode !== context.query.countryCode) errors.push('Planning context country does not match its query.');
  if (context.pack.locale !== context.query.locale) errors.push('Planning context locale does not match its query.');
  if (context.stats.sourceEntityCount < context.pack.entities.length) errors.push('Planning context source entity count is invalid.');
  if (context.stats.sourceTemplateCount < context.pack.templates.length) errors.push('Planning context source template count is invalid.');
  if (context.stats.selectedEntityCount !== context.pack.entities.length) errors.push('Planning context selected entity count is invalid.');
  if (context.stats.selectedTemplateCount !== context.pack.templates.length) errors.push('Planning context selected template count is invalid.');

  const entityIds = new Set(context.pack.entities.map((entity) => entity.entityId).filter(Boolean));
  const entitySlugs = new Set(context.pack.entities.map((entity) => entity.canonicalSlug));
  const datasetVersion = context.pack.dataset?.version;
  for (const entity of context.pack.entities) {
    if (entity.datasetVersion !== datasetVersion) {
      errors.push(`Entity ${entity.canonicalSlug} is from a different dataset version.`);
    }
    if (entity.parentId && !entityIds.has(entity.parentId)) {
      errors.push(`Entity ${entity.canonicalSlug} has a missing parent in the planning context.`);
    }
  }
  for (const template of context.pack.templates) {
    if (template.datasetVersion !== datasetVersion) {
      errors.push(`Template ${template.templateKey} is from a different dataset version.`);
    }
    for (const stop of template.stops) {
      if (!entityIds.has(stop.entityId) || !entitySlugs.has(stop.entitySlug)) {
        errors.push(`Template ${template.templateKey} references a missing context entity ${stop.entitySlug}.`);
      }
    }
  }
  return { valid: errors.length === 0, errors };
};
