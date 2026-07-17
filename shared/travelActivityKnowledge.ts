import type { ActivityType } from '../types';
import type {
  TravelEntityCatalogItem,
  TravelEntityFact,
  TravelEntityReference,
  TravelEntityType,
} from './travelKnowledge.ts';
import {
  getTravelEntityActivityTypes,
  getTravelEntitySourceKeys,
  toTravelEntityReference,
} from './travelKnowledgeProjection';

export const TRAVEL_ACTIVITY_KNOWLEDGE_VERSION = 2 as const;

export interface TravelKnowledgeSupport {
  sourceKey: string;
  sourceUrl?: string;
  confidence: number;
  reviewStatus: TravelEntityFact['reviewStatus'];
  observedAt: string;
  validUntil?: string;
}

export interface SupportedTravelValue<T> {
  value: T;
  support: TravelKnowledgeSupport;
}

export interface TravelActivityDuration {
  min: number;
  max: number;
  unit: 'minutes';
}

export interface TravelActivityOpeningHours {
  timezone: string;
  schedule: Array<{
    days: string[];
    opens: string;
    closes: string;
    scope?: string;
  }>;
  lastEntry?: string;
  notes?: string[];
  checkBeforeVisit: boolean;
}

export interface TravelActivityAdmission {
  currency?: string;
  adultForeign?: number;
  childForeign?: number;
  adultLocal?: number;
  childLocal?: number;
  free?: boolean;
  notes?: string[];
  checkBeforeVisit: boolean;
}

export interface TravelActivityBooking {
  mode: 'walk_in' | 'optional_advance' | 'recommended_advance' | 'required_advance' | 'operator_required';
  bookingUrl?: string;
  notes?: string[];
}

export interface TravelActivityAudienceFit {
  audience: 'family' | 'lgbtq' | 'solo' | 'mobility';
  fit: 'good' | 'conditional' | 'limited' | 'unknown';
  notes: string[];
}

export interface TravelActivityWeatherDependency {
  level: 'low' | 'moderate' | 'high' | 'seasonal';
  notes: string[];
}

export interface TravelActivityPhysicalIntensity {
  level: 'low' | 'moderate' | 'high' | 'variable';
  notes: string[];
}

export interface TravelActivityTransportAccess {
  modes: string[];
  notes: string[];
}

export interface TravelActivityFreshness {
  status: 'current' | 'expired' | 'undated';
  latestObservedAt?: string;
  earliestValidUntil?: string;
}

export const TRAVEL_ACTIVITY_CATEGORY_VALUES = [
  'temple',
  'heritage_site',
  'market',
  'museum_memorial',
  'national_park',
  'waterfall',
  'beach',
  'island_excursion',
  'viewpoint',
  'hiking_outdoor',
  'general_attraction',
] as const;

export type TravelActivityCategory = (typeof TRAVEL_ACTIVITY_CATEGORY_VALUES)[number];

export const TRAVEL_ACTIVITY_PLANNING_TIER_VALUES = ['anchor', 'supporting', 'discovery'] as const;
export type TravelActivityPlanningTier = (typeof TRAVEL_ACTIVITY_PLANNING_TIER_VALUES)[number];

export const TRAVEL_ACTIVITY_COVERAGE_STATUS_VALUES = ['starter', 'usable', 'rich'] as const;
export type TravelActivityCoverageStatus = (typeof TRAVEL_ACTIVITY_COVERAGE_STATUS_VALUES)[number];

export interface TravelActivityProfile {
  version: 1;
  primaryCategory: TravelActivityCategory;
  secondaryCategories: TravelActivityCategory[];
  planningTier: TravelActivityPlanningTier;
  derivedFromTags: boolean;
}

export interface TravelActivityFieldRequirement {
  factKey: string;
  label: string;
  importance: 'required' | 'recommended';
  weight: number;
}

export interface TravelActivityKnowledgeCoverage {
  category: TravelActivityCategory;
  planningTier: TravelActivityPlanningTier;
  status: TravelActivityCoverageStatus;
  score: number;
  completedWeight: number;
  totalWeight: number;
  presentFactKeys: string[];
  missingRequiredFactKeys: string[];
  missingRecommendedFactKeys: string[];
  invalidFactKeys: string[];
  expiringFactCount: number;
  expiredFactCount: number;
}

export interface TravelActivityKnowledge {
  version: typeof TRAVEL_ACTIVITY_KNOWLEDGE_VERSION;
  entity: TravelEntityReference;
  categories: ActivityType[];
  profile: TravelActivityProfile;
  coverage: TravelActivityKnowledgeCoverage;
  summary?: SupportedTravelValue<string>;
  recommendedDuration?: SupportedTravelValue<TravelActivityDuration>;
  bestTime?: SupportedTravelValue<string[]>;
  openingHours?: SupportedTravelValue<TravelActivityOpeningHours>;
  admission?: SupportedTravelValue<TravelActivityAdmission>;
  booking?: SupportedTravelValue<TravelActivityBooking>;
  dressCode?: SupportedTravelValue<string[]>;
  accessibility?: SupportedTravelValue<string[]>;
  audience: Array<SupportedTravelValue<TravelActivityAudienceFit>>;
  practicalNotes?: SupportedTravelValue<string[]>;
  weatherDependency?: SupportedTravelValue<TravelActivityWeatherDependency>;
  physicalIntensity?: SupportedTravelValue<TravelActivityPhysicalIntensity>;
  transportAccess?: SupportedTravelValue<TravelActivityTransportAccess>;
  facilities?: SupportedTravelValue<string[]>;
  sourceKeys: string[];
  freshness: TravelActivityFreshness;
}

export interface TravelActivityProfileInput {
  entityType: TravelEntityType;
  canonicalSlug: string;
  tagKeys: readonly string[];
  popularityScore: number;
  hiddenGemScore: number;
  attributes?: Record<string, unknown>;
}

const CATEGORY_SET = new Set<string>(TRAVEL_ACTIVITY_CATEGORY_VALUES);
const PLANNING_TIER_SET = new Set<string>(TRAVEL_ACTIVITY_PLANNING_TIER_VALUES);
const DAY_VALUES = new Set([
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]);
const BOOKING_MODE_VALUES = new Set([
  'walk_in',
  'optional_advance',
  'recommended_advance',
  'required_advance',
  'operator_required',
]);
const AUDIENCE_FIT_VALUES = new Set(['good', 'conditional', 'limited', 'unknown']);
const WEATHER_DEPENDENCY_VALUES = new Set(['low', 'moderate', 'high', 'seasonal']);
const PHYSICAL_INTENSITY_VALUES = new Set(['low', 'moderate', 'high', 'variable']);
const CLOCK_TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

const COMMON_REQUIREMENTS: TravelActivityFieldRequirement[] = [
  { factKey: 'summary', label: 'Summary', importance: 'required', weight: 2 },
  { factKey: 'visit.duration_minutes', label: 'Visit duration', importance: 'required', weight: 2 },
  { factKey: 'visit.best_time', label: 'Best time to visit', importance: 'recommended', weight: 1 },
  { factKey: 'visit.practical_notes', label: 'Practical notes', importance: 'required', weight: 1.5 },
];

const REQUIREMENTS_BY_CATEGORY: Record<TravelActivityCategory, TravelActivityFieldRequirement[]> = {
  temple: [
    { factKey: 'opening_hours.regular', label: 'Opening hours', importance: 'required', weight: 2 },
    { factKey: 'pricing.admission', label: 'Admission price', importance: 'required', weight: 1.5 },
    { factKey: 'visit.booking', label: 'Booking guidance', importance: 'recommended', weight: 1 },
    { factKey: 'visit.dress_code', label: 'Dress and etiquette', importance: 'required', weight: 1.5 },
    { factKey: 'audience.mobility_fit', label: 'Mobility context', importance: 'recommended', weight: 1 },
  ],
  heritage_site: [
    { factKey: 'opening_hours.regular', label: 'Opening hours', importance: 'required', weight: 2 },
    { factKey: 'pricing.admission', label: 'Admission price', importance: 'required', weight: 1.5 },
    { factKey: 'visit.booking', label: 'Booking guidance', importance: 'recommended', weight: 1 },
    { factKey: 'visit.physical_intensity', label: 'Physical intensity', importance: 'recommended', weight: 1 },
    { factKey: 'audience.mobility_fit', label: 'Mobility context', importance: 'recommended', weight: 1 },
  ],
  market: [
    { factKey: 'opening_hours.regular', label: 'Operating days and hours', importance: 'required', weight: 2 },
    { factKey: 'pricing.admission', label: 'Admission context', importance: 'recommended', weight: 1 },
    { factKey: 'access.transport', label: 'Access and transport', importance: 'recommended', weight: 1 },
    { factKey: 'audience.mobility_fit', label: 'Mobility context', importance: 'recommended', weight: 1 },
  ],
  museum_memorial: [
    { factKey: 'opening_hours.regular', label: 'Opening hours', importance: 'required', weight: 2 },
    { factKey: 'pricing.admission', label: 'Admission price', importance: 'required', weight: 1.5 },
    { factKey: 'visit.booking', label: 'Booking guidance', importance: 'recommended', weight: 1 },
    { factKey: 'audience.mobility_fit', label: 'Mobility context', importance: 'recommended', weight: 1 },
  ],
  national_park: [
    { factKey: 'opening_hours.regular', label: 'Opening hours', importance: 'required', weight: 2 },
    { factKey: 'pricing.admission', label: 'Park fees', importance: 'required', weight: 1.5 },
    { factKey: 'visit.booking', label: 'Permit or booking guidance', importance: 'recommended', weight: 1 },
    { factKey: 'visit.weather_dependency', label: 'Weather dependency', importance: 'required', weight: 1.5 },
    { factKey: 'visit.physical_intensity', label: 'Physical intensity', importance: 'required', weight: 1.5 },
    { factKey: 'access.transport', label: 'Access and transport', importance: 'recommended', weight: 1 },
    { factKey: 'visit.facilities', label: 'Visitor facilities', importance: 'recommended', weight: 1 },
  ],
  waterfall: [
    { factKey: 'opening_hours.regular', label: 'Opening hours', importance: 'required', weight: 2 },
    { factKey: 'pricing.admission', label: 'Admission price', importance: 'recommended', weight: 1 },
    { factKey: 'visit.weather_dependency', label: 'Weather and water conditions', importance: 'required', weight: 1.5 },
    { factKey: 'visit.physical_intensity', label: 'Physical intensity', importance: 'required', weight: 1.5 },
    { factKey: 'access.transport', label: 'Access and transport', importance: 'recommended', weight: 1 },
  ],
  beach: [
    { factKey: 'visit.weather_dependency', label: 'Weather and sea conditions', importance: 'required', weight: 2 },
    { factKey: 'visit.physical_intensity', label: 'Physical intensity', importance: 'recommended', weight: 1 },
    { factKey: 'access.transport', label: 'Access and transport', importance: 'required', weight: 1.5 },
    { factKey: 'visit.facilities', label: 'Visitor facilities', importance: 'recommended', weight: 1 },
  ],
  island_excursion: [
    { factKey: 'visit.weather_dependency', label: 'Weather and sea conditions', importance: 'required', weight: 2 },
    { factKey: 'visit.booking', label: 'Boat or operator booking', importance: 'required', weight: 1.5 },
    { factKey: 'access.transport', label: 'Boat and transfer access', importance: 'required', weight: 2 },
    { factKey: 'visit.physical_intensity', label: 'Physical intensity', importance: 'recommended', weight: 1 },
    { factKey: 'visit.facilities', label: 'Visitor facilities', importance: 'recommended', weight: 1 },
  ],
  viewpoint: [
    { factKey: 'visit.weather_dependency', label: 'Visibility and weather', importance: 'required', weight: 1.5 },
    { factKey: 'visit.physical_intensity', label: 'Physical intensity', importance: 'required', weight: 1.5 },
    { factKey: 'access.transport', label: 'Access and transport', importance: 'recommended', weight: 1 },
  ],
  hiking_outdoor: [
    { factKey: 'visit.weather_dependency', label: 'Weather dependency', importance: 'required', weight: 1.5 },
    { factKey: 'visit.physical_intensity', label: 'Physical intensity', importance: 'required', weight: 2 },
    { factKey: 'access.transport', label: 'Access and transport', importance: 'recommended', weight: 1 },
    { factKey: 'visit.facilities', label: 'Visitor facilities', importance: 'recommended', weight: 1 },
  ],
  general_attraction: [
    { factKey: 'opening_hours.regular', label: 'Opening hours', importance: 'recommended', weight: 1.5 },
    { factKey: 'pricing.admission', label: 'Admission price', importance: 'recommended', weight: 1 },
    { factKey: 'access.transport', label: 'Access and transport', importance: 'recommended', weight: 1 },
  ],
};

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

const isNonEmptyString = (value: unknown): value is string => (
  typeof value === 'string' && value.trim().length > 0
);

const isStringArray = (value: unknown): value is string[] => (
  Array.isArray(value) && value.length > 0 && value.every(isNonEmptyString)
);

const isFiniteNonNegativeNumber = (value: unknown): value is number => (
  typeof value === 'number' && Number.isFinite(value) && value >= 0
);

const readStringArray = (value: unknown): string[] => (
  Array.isArray(value) ? value.filter(isNonEmptyString) : []
);

const categoryForTags = (tagKeys: ReadonlySet<string>): TravelActivityCategory => {
  if (tagKeys.has('museum') || tagKeys.has('memorial')) return 'museum_memorial';
  if (tagKeys.has('market') || tagKeys.has('markets')) return 'market';
  if (tagKeys.has('national_park')) return 'national_park';
  if (tagKeys.has('waterfall')) return 'waterfall';
  if (tagKeys.has('beach') || tagKeys.has('beaches')) return 'beach';
  if (tagKeys.has('island') || tagKeys.has('boat_required') || tagKeys.has('diving')) return 'island_excursion';
  if (tagKeys.has('viewpoint')) return 'viewpoint';
  if (tagKeys.has('temples')) return 'temple';
  if (tagKeys.has('heritage') || tagKeys.has('history')) return 'heritage_site';
  if (tagKeys.has('hiking') || tagKeys.has('nature') || tagKeys.has('mountain')) return 'hiking_outdoor';
  return 'general_attraction';
};

const allCategoriesForTags = (tagKeys: ReadonlySet<string>): TravelActivityCategory[] => {
  const categories = new Set<TravelActivityCategory>();
  if (tagKeys.has('museum') || tagKeys.has('memorial')) categories.add('museum_memorial');
  if (tagKeys.has('market') || tagKeys.has('markets')) categories.add('market');
  if (tagKeys.has('national_park')) categories.add('national_park');
  if (tagKeys.has('waterfall')) categories.add('waterfall');
  if (tagKeys.has('beach') || tagKeys.has('beaches')) categories.add('beach');
  if (tagKeys.has('island') || tagKeys.has('boat_required') || tagKeys.has('diving')) categories.add('island_excursion');
  if (tagKeys.has('viewpoint')) categories.add('viewpoint');
  if (tagKeys.has('temples')) categories.add('temple');
  if (tagKeys.has('heritage') || tagKeys.has('history')) categories.add('heritage_site');
  if (tagKeys.has('hiking') || tagKeys.has('nature') || tagKeys.has('mountain')) categories.add('hiking_outdoor');
  if (categories.size === 0) categories.add('general_attraction');
  return Array.from(categories);
};

const readProfileOverride = (attributes: Record<string, unknown> | undefined): Partial<TravelActivityProfile> => {
  if (!isRecord(attributes?.activityProfile)) return {};
  const profile = attributes.activityProfile;
  return {
    primaryCategory: typeof profile.primaryCategory === 'string' && CATEGORY_SET.has(profile.primaryCategory)
      ? profile.primaryCategory as TravelActivityCategory
      : undefined,
    secondaryCategories: readStringArray(profile.secondaryCategories)
      .filter((value): value is TravelActivityCategory => CATEGORY_SET.has(value)),
    planningTier: typeof profile.planningTier === 'string' && PLANNING_TIER_SET.has(profile.planningTier)
      ? profile.planningTier as TravelActivityPlanningTier
      : undefined,
    derivedFromTags: typeof profile.derivedFromTags === 'boolean' ? profile.derivedFromTags : undefined,
  };
};

export const deriveTravelActivityProfile = (
  input: TravelActivityProfileInput,
): TravelActivityProfile | undefined => {
  if (input.entityType !== 'poi') return undefined;
  const tags = new Set(input.tagKeys);
  const override = readProfileOverride(input.attributes);
  const primaryCategory = override.primaryCategory ?? categoryForTags(tags);
  const derivedCategories = allCategoriesForTags(tags).filter((category) => category !== primaryCategory);
  const planningTier = override.planningTier
    ?? (tags.has('essential') || input.popularityScore >= 90
      ? 'anchor'
      : tags.has('hidden_gem') || input.hiddenGemScore >= 65
        ? 'discovery'
        : 'supporting');

  return {
    version: 1,
    primaryCategory,
    secondaryCategories: Array.from(new Set([
      ...(override.secondaryCategories ?? []),
      ...derivedCategories,
    ])).filter((category) => category !== primaryCategory),
    planningTier,
    derivedFromTags: override.derivedFromTags ?? !override.primaryCategory,
  };
};

export const getTravelActivityProfile = (
  entity: TravelEntityCatalogItem,
): TravelActivityProfile | undefined => deriveTravelActivityProfile({
  entityType: entity.entityType,
  canonicalSlug: entity.canonicalSlug,
  tagKeys: entity.tags.map((tag) => tag.tagKey),
  popularityScore: entity.popularityScore,
  hiddenGemScore: entity.hiddenGemScore,
  attributes: entity.attributes,
});

export const getTravelActivityFieldRequirements = (
  category: TravelActivityCategory,
): TravelActivityFieldRequirement[] => {
  const requirements = [...COMMON_REQUIREMENTS, ...REQUIREMENTS_BY_CATEGORY[category]];
  return Array.from(new Map(requirements.map((requirement) => [requirement.factKey, requirement])).values());
};

export const validateTravelActivityFactValue = (
  factKey: string,
  value: unknown,
): string[] => {
  const errors: string[] = [];
  if (factKey === 'summary' && !isNonEmptyString(value)) {
    errors.push('must be a non-empty string');
  } else if (factKey === 'visit.duration_minutes') {
    if (
      !isRecord(value)
      || !isFiniteNonNegativeNumber(value.min)
      || !isFiniteNonNegativeNumber(value.max)
      || value.min > value.max
    ) {
      errors.push('must be an object with finite min/max minutes and max >= min');
    }
  } else if (['visit.best_time', 'visit.dress_code', 'visit.practical_notes', 'visit.facilities'].includes(factKey)) {
    if (!isStringArray(value)) errors.push('must be a non-empty string array');
  } else if (factKey === 'opening_hours.regular') {
    if (!isRecord(value) || !isNonEmptyString(value.timezone) || !Array.isArray(value.schedule) || value.schedule.length === 0) {
      errors.push('must include timezone and at least one schedule entry');
    } else {
      value.schedule.forEach((entry, index) => {
        if (
          !isRecord(entry)
          || !Array.isArray(entry.days)
          || entry.days.length === 0
          || entry.days.some((day) => typeof day !== 'string' || !DAY_VALUES.has(day))
          || !isNonEmptyString(entry.opens)
          || !CLOCK_TIME_PATTERN.test(entry.opens)
          || !isNonEmptyString(entry.closes)
          || !CLOCK_TIME_PATTERN.test(entry.closes)
        ) {
          errors.push(`schedule entry ${index + 1} must include valid days, opens, and closes`);
        }
      });
    }
  } else if (factKey === 'pricing.admission') {
    if (!isRecord(value) || (value.free !== true && !isNonEmptyString(value.currency))) {
      errors.push('must declare free=true or include a currency');
    }
  } else if (factKey === 'visit.booking') {
    if (!isRecord(value) || !isNonEmptyString(value.mode) || !BOOKING_MODE_VALUES.has(value.mode)) {
      errors.push('must include a supported booking mode');
    }
  } else if (factKey === 'audience.family_fit' || factKey === 'audience.mobility_fit') {
    if (!isRecord(value) || !isNonEmptyString(value.fit) || !AUDIENCE_FIT_VALUES.has(value.fit)) {
      errors.push('must include a supported fit value');
    }
  } else if (factKey === 'visit.weather_dependency') {
    if (!isRecord(value) || !isNonEmptyString(value.level) || !WEATHER_DEPENDENCY_VALUES.has(value.level)) {
      errors.push('must include a supported weather-dependency level');
    }
  } else if (factKey === 'visit.physical_intensity') {
    if (!isRecord(value) || !isNonEmptyString(value.level) || !PHYSICAL_INTENSITY_VALUES.has(value.level)) {
      errors.push('must include a supported physical-intensity level');
    }
  } else if (factKey === 'access.transport') {
    if (!isRecord(value) || !isStringArray(value.modes) || !isStringArray(value.notes)) {
      errors.push('must include non-empty modes and notes arrays');
    }
  }
  return errors;
};

const isFactCurrent = (fact: TravelEntityFact, nowMs: number): boolean => (
  !fact.validUntil || Date.parse(fact.validUntil) > nowMs
);

export const getTravelActivityKnowledgeCoverage = (
  entity: TravelEntityCatalogItem,
  now = new Date(),
): TravelActivityKnowledgeCoverage | undefined => {
  const profile = getTravelActivityProfile(entity);
  if (!profile) return undefined;
  const requirements = getTravelActivityFieldRequirements(profile.primaryCategory);
  const factsByKey = new Map(entity.facts.map((fact) => [fact.factKey, fact]));
  const presentFactKeys: string[] = [];
  const missingRequiredFactKeys: string[] = [];
  const missingRecommendedFactKeys: string[] = [];
  const invalidFactKeys: string[] = [];
  let completedWeight = 0;
  const totalWeight = requirements.reduce((sum, requirement) => sum + requirement.weight, 0);

  for (const requirement of requirements) {
    const fact = factsByKey.get(requirement.factKey);
    if (!fact) {
      (requirement.importance === 'required' ? missingRequiredFactKeys : missingRecommendedFactKeys)
        .push(requirement.factKey);
      continue;
    }
    if (validateTravelActivityFactValue(fact.factKey, fact.valueJson).length > 0) {
      invalidFactKeys.push(requirement.factKey);
      continue;
    }
    presentFactKeys.push(requirement.factKey);
    completedWeight += requirement.weight;
  }

  const score = totalWeight > 0 ? Math.round((completedWeight / totalWeight) * 100) : 0;
  const status: TravelActivityCoverageStatus = score >= 85 && missingRequiredFactKeys.length === 0
    ? 'rich'
    : score >= 55 && missingRequiredFactKeys.length <= 1
      ? 'usable'
      : 'starter';
  const nowMs = now.getTime();
  const soonMs = nowMs + 30 * 24 * 60 * 60 * 1000;
  const expiringFactCount = entity.facts.filter((fact) => (
    fact.validUntil
    && Date.parse(fact.validUntil) > nowMs
    && Date.parse(fact.validUntil) <= soonMs
  )).length;
  const expiredFactCount = entity.facts.filter((fact) => (
    fact.validUntil && !isFactCurrent(fact, nowMs)
  )).length;

  return {
    category: profile.primaryCategory,
    planningTier: profile.planningTier,
    status,
    score,
    completedWeight,
    totalWeight,
    presentFactKeys: presentFactKeys.sort(),
    missingRequiredFactKeys: missingRequiredFactKeys.sort(),
    missingRecommendedFactKeys: missingRecommendedFactKeys.sort(),
    invalidFactKeys: invalidFactKeys.sort(),
    expiringFactCount,
    expiredFactCount,
  };
};

const sourceUrlForFact = (fact: TravelEntityFact): string | undefined => (
  typeof fact.metadata.sourceUrl === 'string' ? fact.metadata.sourceUrl : undefined
);

const supportedValue = <T>(fact: TravelEntityFact, value: T): SupportedTravelValue<T> => ({
  value,
  support: {
    sourceKey: fact.sourceKey,
    sourceUrl: sourceUrlForFact(fact),
    confidence: fact.confidence,
    reviewStatus: fact.reviewStatus,
    observedAt: fact.observedAt,
    validUntil: fact.validUntil,
  },
});

const factByKey = (entity: TravelEntityCatalogItem, key: string): TravelEntityFact | undefined => (
  entity.facts.find((fact) => fact.factKey === key && fact.reviewStatus !== 'deprecated')
);

const stringValue = (value: unknown): string | null => (
  typeof value === 'string' && value.trim() ? value.trim() : null
);

const stringArray = (value: unknown): string[] | null => (
  Array.isArray(value) && value.length > 0 && value.every((entry) => typeof entry === 'string' && entry.trim())
    ? value.map((entry) => entry.trim())
    : null
);

const numberValue = (value: unknown): number | undefined => (
  typeof value === 'number' && Number.isFinite(value) ? value : undefined
);

const durationValue = (value: unknown): TravelActivityDuration | null => {
  if (!isRecord(value)) return null;
  const min = numberValue(value.min);
  const max = numberValue(value.max);
  if (min === undefined || max === undefined || min <= 0 || max < min) return null;
  return { min, max, unit: 'minutes' };
};

const openingHoursValue = (value: unknown): TravelActivityOpeningHours | null => {
  if (!isRecord(value) || !Array.isArray(value.schedule)) return null;
  const schedule = value.schedule.flatMap((entry) => {
    if (!isRecord(entry)) return [];
    const days = stringArray(entry.days);
    const opens = stringValue(entry.opens);
    const closes = stringValue(entry.closes);
    if (!days || !opens || !closes) return [];
    return [{
      days,
      opens,
      closes,
      scope: stringValue(entry.scope) ?? undefined,
    }];
  });
  const timezone = stringValue(value.timezone);
  if (!timezone || schedule.length === 0) return null;
  return {
    timezone,
    schedule,
    lastEntry: stringValue(value.lastEntry) ?? undefined,
    notes: stringArray(value.notes) ?? undefined,
    checkBeforeVisit: value.checkBeforeVisit !== false,
  };
};

const admissionValue = (value: unknown): TravelActivityAdmission | null => {
  if (!isRecord(value)) return null;
  const currency = stringValue(value.currency) ?? undefined;
  if (!currency && value.free !== true) return null;
  return {
    currency,
    adultForeign: numberValue(value.adultForeign),
    childForeign: numberValue(value.childForeign),
    adultLocal: numberValue(value.adultLocal),
    childLocal: numberValue(value.childLocal),
    free: value.free === true,
    notes: stringArray(value.notes) ?? undefined,
    checkBeforeVisit: value.checkBeforeVisit !== false,
  };
};

const BOOKING_MODES = new Set<TravelActivityBooking['mode']>([
  'walk_in',
  'optional_advance',
  'recommended_advance',
  'required_advance',
  'operator_required',
]);

const bookingValue = (value: unknown): TravelActivityBooking | null => {
  if (!isRecord(value) || typeof value.mode !== 'string' || !BOOKING_MODES.has(value.mode as TravelActivityBooking['mode'])) {
    return null;
  }
  return {
    mode: value.mode as TravelActivityBooking['mode'],
    bookingUrl: stringValue(value.bookingUrl) ?? undefined,
    notes: stringArray(value.notes) ?? undefined,
  };
};

const audienceValue = (
  value: unknown,
  audience: TravelActivityAudienceFit['audience'],
): TravelActivityAudienceFit | null => {
  if (!isRecord(value) || !AUDIENCE_FIT_VALUES.has(String(value.fit))) return null;
  return {
    audience,
    fit: value.fit as TravelActivityAudienceFit['fit'],
    notes: stringArray(value.notes) ?? [],
  };
};

const weatherDependencyValue = (value: unknown): TravelActivityWeatherDependency | null => {
  if (!isRecord(value) || !WEATHER_DEPENDENCY_VALUES.has(String(value.level))) return null;
  return {
    level: value.level as TravelActivityWeatherDependency['level'],
    notes: stringArray(value.notes) ?? [],
  };
};

const physicalIntensityValue = (value: unknown): TravelActivityPhysicalIntensity | null => {
  if (!isRecord(value) || !PHYSICAL_INTENSITY_VALUES.has(String(value.level))) return null;
  return {
    level: value.level as TravelActivityPhysicalIntensity['level'],
    notes: stringArray(value.notes) ?? [],
  };
};

const transportAccessValue = (value: unknown): TravelActivityTransportAccess | null => {
  if (!isRecord(value)) return null;
  const modes = stringArray(value.modes);
  const notes = stringArray(value.notes);
  return modes && notes ? { modes, notes } : null;
};

const freshnessForFacts = (
  facts: readonly TravelEntityFact[],
  now: Date,
): TravelActivityFreshness => {
  const timestamps = facts.map((fact) => fact.observedAt).filter((value) => Number.isFinite(Date.parse(value)));
  const validUntilValues = facts.flatMap((fact) => (
    fact.validUntil && Number.isFinite(Date.parse(fact.validUntil)) ? [fact.validUntil] : []
  ));
  const latestObservedAt = timestamps.toSorted((left, right) => Date.parse(right) - Date.parse(left))[0];
  const earliestValidUntil = validUntilValues.toSorted((left, right) => Date.parse(left) - Date.parse(right))[0];
  return {
    status: earliestValidUntil
      ? Date.parse(earliestValidUntil) < now.getTime() ? 'expired' : 'current'
      : 'undated',
    latestObservedAt,
    earliestValidUntil,
  };
};

export const buildTravelActivityKnowledge = (
  entity: TravelEntityCatalogItem,
  now = new Date(),
): TravelActivityKnowledge | undefined => {
  const profile = getTravelActivityProfile(entity);
  const coverage = getTravelActivityKnowledgeCoverage(entity, now);
  if (!profile || !coverage) return undefined;

  const summaryFact = factByKey(entity, 'summary');
  const summary = summaryFact ? stringValue(summaryFact.valueJson) : null;
  const durationFact = factByKey(entity, 'visit.duration_minutes');
  const duration = durationFact ? durationValue(durationFact.valueJson) : null;
  const bestTimeFact = factByKey(entity, 'visit.best_time');
  const bestTime = bestTimeFact ? stringArray(bestTimeFact.valueJson) : null;
  const openingHoursFact = factByKey(entity, 'opening_hours.regular');
  const openingHours = openingHoursFact ? openingHoursValue(openingHoursFact.valueJson) : null;
  const admissionFact = factByKey(entity, 'pricing.admission');
  const admission = admissionFact ? admissionValue(admissionFact.valueJson) : null;
  const bookingFact = factByKey(entity, 'visit.booking');
  const booking = bookingFact ? bookingValue(bookingFact.valueJson) : null;
  const dressCodeFact = factByKey(entity, 'visit.dress_code');
  const dressCode = dressCodeFact ? stringArray(dressCodeFact.valueJson) : null;
  const accessibilityFact = factByKey(entity, 'visit.accessibility');
  const accessibility = accessibilityFact ? stringArray(accessibilityFact.valueJson) : null;
  const practicalNotesFact = factByKey(entity, 'visit.practical_notes');
  const practicalNotes = practicalNotesFact ? stringArray(practicalNotesFact.valueJson) : null;
  const weatherDependencyFact = factByKey(entity, 'visit.weather_dependency');
  const weatherDependency = weatherDependencyFact ? weatherDependencyValue(weatherDependencyFact.valueJson) : null;
  const physicalIntensityFact = factByKey(entity, 'visit.physical_intensity');
  const physicalIntensity = physicalIntensityFact ? physicalIntensityValue(physicalIntensityFact.valueJson) : null;
  const transportAccessFact = factByKey(entity, 'access.transport');
  const transportAccess = transportAccessFact ? transportAccessValue(transportAccessFact.valueJson) : null;
  const facilitiesFact = factByKey(entity, 'visit.facilities');
  const facilities = facilitiesFact ? stringArray(facilitiesFact.valueJson) : null;
  const audience = (['family', 'lgbtq', 'solo', 'mobility'] as const).flatMap((audienceKey) => {
    const fact = factByKey(entity, `audience.${audienceKey}_fit`);
    const fit = fact ? audienceValue(fact.valueJson, audienceKey) : null;
    return fact && fit ? [supportedValue(fact, fit)] : [];
  });
  const relevantFacts = entity.facts.filter((fact) => fact.reviewStatus !== 'deprecated');

  return {
    version: TRAVEL_ACTIVITY_KNOWLEDGE_VERSION,
    entity: toTravelEntityReference(entity),
    categories: getTravelEntityActivityTypes(entity),
    profile,
    coverage,
    summary: summaryFact && summary ? supportedValue(summaryFact, summary) : undefined,
    recommendedDuration: durationFact && duration ? supportedValue(durationFact, duration) : undefined,
    bestTime: bestTimeFact && bestTime ? supportedValue(bestTimeFact, bestTime) : undefined,
    openingHours: openingHoursFact && openingHours ? supportedValue(openingHoursFact, openingHours) : undefined,
    admission: admissionFact && admission ? supportedValue(admissionFact, admission) : undefined,
    booking: bookingFact && booking ? supportedValue(bookingFact, booking) : undefined,
    dressCode: dressCodeFact && dressCode ? supportedValue(dressCodeFact, dressCode) : undefined,
    accessibility: accessibilityFact && accessibility ? supportedValue(accessibilityFact, accessibility) : undefined,
    audience,
    practicalNotes: practicalNotesFact && practicalNotes ? supportedValue(practicalNotesFact, practicalNotes) : undefined,
    weatherDependency: weatherDependencyFact && weatherDependency
      ? supportedValue(weatherDependencyFact, weatherDependency)
      : undefined,
    physicalIntensity: physicalIntensityFact && physicalIntensity
      ? supportedValue(physicalIntensityFact, physicalIntensity)
      : undefined,
    transportAccess: transportAccessFact && transportAccess
      ? supportedValue(transportAccessFact, transportAccess)
      : undefined,
    facilities: facilitiesFact && facilities ? supportedValue(facilitiesFact, facilities) : undefined,
    sourceKeys: getTravelEntitySourceKeys(entity),
    freshness: freshnessForFacts(relevantFacts, now),
  };
};
