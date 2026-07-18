import type { CreateTripPreferenceSignals } from './createTripPreferences.ts';
import {
  TRAVEL_ENTITY_TYPE_VALUES,
  createLegacyTravelEntityReference,
  type TravelEntityReference,
} from './travelKnowledge.ts';

export const JOURNEY_SPEC_VERSION = 1 as const;

export const JOURNEY_TYPE_VALUES = [
  'city_break',
  'hub_and_day_trips',
  'single_country_circuit',
  'multi_country',
  'road_trip',
  'camper',
  'cruise_shore',
  'inspiration',
] as const;

export type JourneyType = (typeof JOURNEY_TYPE_VALUES)[number];

export const JOURNEY_PLACE_ROLE_VALUES = [
  'country_scope',
  'entry',
  'exit',
  'base',
  'must_visit',
  'day_trip',
  'consider',
  'avoid',
] as const;

export type JourneyPlaceRole = (typeof JOURNEY_PLACE_ROLE_VALUES)[number];

export const JOURNEY_PACE_VALUES = ['relaxed', 'balanced', 'full'] as const;
export type JourneyPace = (typeof JOURNEY_PACE_VALUES)[number];

export const JOURNEY_CREATOR_VALUES = ['classic', 'wizard_v3', 'wizard_shape_v1', 'api', 'import'] as const;
export type JourneyCreator = (typeof JOURNEY_CREATOR_VALUES)[number];

export type JourneyDateWindow =
  | {
      mode: 'exact';
      startDate: string;
      endDate: string;
    }
  | {
      mode: 'flexible';
      durationDays: number;
      months: number[];
      season?: 'spring' | 'summer' | 'autumn' | 'winter' | 'shoulder';
    };

export interface JourneyPlaceSelection {
  entity: TravelEntityReference;
  role: JourneyPlaceRole;
  order: number;
  nights?: number;
  locked?: boolean;
}

export interface JourneyRouteConstraints {
  roundTrip: boolean;
  routeLocked: boolean;
  maxBaseChanges?: number;
  maxTransferMinutes?: number;
  transportPreferences: string[];
}

export interface JourneyPreferenceProfile {
  pace: JourneyPace;
  interestTags: string[];
  vibeTags: string[];
  freeTextPlaceRequest?: string;
  notes?: string;
}

export interface JourneyKnowledgeContext {
  datasetKey: string;
  datasetVersion: string;
  templateKey?: string;
  templateVersion?: number;
}

export interface JourneySpecV1 {
  version: typeof JOURNEY_SPEC_VERSION;
  journeyType: JourneyType;
  countryCodes: string[];
  dateWindow: JourneyDateWindow;
  durationDays: number;
  places: JourneyPlaceSelection[];
  constraints: JourneyRouteConstraints;
  preferences: JourneyPreferenceProfile;
  knowledgeContext?: JourneyKnowledgeContext;
  createdFrom: JourneyCreator;
  experimentVersion?: string;
}

export type JourneySpec = JourneySpecV1;

export interface JourneySpecValidationResult {
  valid: boolean;
  errors: string[];
}

export interface JourneySpecValidationOptions {
  phase?: 'intent' | 'route';
}

export interface LegacyJourneySpecInput {
  countries: Array<{ name: string; code: string }>;
  startDate?: string;
  endDate?: string;
  durationDays: number;
  roundTrip?: boolean;
  pace?: JourneyPace;
  flexibleMonths?: number[];
  preferences?: CreateTripPreferenceSignals;
  resolvedPlaces?: JourneyPlaceSelection[];
  journeyType?: JourneyType;
  createdFrom?: Extract<JourneyCreator, 'classic' | 'wizard_v3'>;
}

const JOURNEY_TYPE_SET = new Set<string>(JOURNEY_TYPE_VALUES);
const PLACE_ROLE_SET = new Set<string>(JOURNEY_PLACE_ROLE_VALUES);
const PACE_SET = new Set<string>(JOURNEY_PACE_VALUES);
const CREATOR_SET = new Set<string>(JOURNEY_CREATOR_VALUES);
const ENTITY_TYPE_SET = new Set<string>(TRAVEL_ENTITY_TYPE_VALUES);
const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const uniqueStrings = (values: readonly string[]): string[] =>
  Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));

const slugifyLegacyName = (value: string): string => {
  const normalized = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || 'unresolved-place';
};

const isValidIsoDate = (value: unknown): value is string => {
  if (typeof value !== 'string' || !ISO_DATE_PATTERN.test(value)) return false;
  const parsed = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(parsed);
};

const deriveExactDurationDays = (startDate: string, endDate: string): number => {
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  return Math.max(1, Math.round((end - start) / 86_400_000));
};

const inferLegacyJourneyType = (
  countries: LegacyJourneySpecInput['countries'],
  resolvedPlaces: JourneyPlaceSelection[],
  durationDays: number,
): JourneyType => {
  if (countries.length > 1) return 'multi_country';
  const selectedCities = resolvedPlaces.filter((place) => place.entity.entityType === 'city' && place.role !== 'avoid');
  if (selectedCities.length === 1 && durationDays <= 5) return 'city_break';
  if (selectedCities.some((place) => place.role === 'day_trip')) return 'hub_and_day_trips';
  return 'single_country_circuit';
};

export const normalizeJourneySpec = (spec: JourneySpec): JourneySpec => ({
  ...spec,
  countryCodes: uniqueStrings(spec.countryCodes.map((code) => code.toUpperCase())).sort(),
  places: spec.places.map((place, index) => ({
    ...place,
    order: Number.isInteger(place.order) ? place.order : index,
    entity: {
      ...place.entity,
      entityId: place.entity.entityId?.trim() || null,
      canonicalSlug: place.entity.canonicalSlug.trim().toLowerCase(),
      countryCode: place.entity.countryCode.trim().toUpperCase(),
      name: place.entity.name.trim(),
    },
  })),
  constraints: {
    ...spec.constraints,
    transportPreferences: uniqueStrings(spec.constraints.transportPreferences),
  },
  preferences: {
    ...spec.preferences,
    interestTags: uniqueStrings(spec.preferences.interestTags),
    vibeTags: uniqueStrings(spec.preferences.vibeTags),
    freeTextPlaceRequest: spec.preferences.freeTextPlaceRequest?.trim() || undefined,
    notes: spec.preferences.notes?.trim() || undefined,
  },
  knowledgeContext: spec.knowledgeContext
    ? {
        datasetKey: spec.knowledgeContext.datasetKey.trim(),
        datasetVersion: spec.knowledgeContext.datasetVersion.trim(),
        templateKey: spec.knowledgeContext.templateKey?.trim() || undefined,
        templateVersion: spec.knowledgeContext.templateVersion,
      }
    : undefined,
  experimentVersion: spec.experimentVersion?.trim() || undefined,
});

export const validateJourneySpec = (
  value: unknown,
  options: JourneySpecValidationOptions = {},
): JourneySpecValidationResult => {
  const errors: string[] = [];
  const validationPhase = options.phase ?? 'route';
  if (!isRecord(value)) return { valid: false, errors: ['JourneySpec must be an object.'] };

  if (value.version !== JOURNEY_SPEC_VERSION) errors.push('JourneySpec version must be 1.');
  if (typeof value.journeyType !== 'string' || !JOURNEY_TYPE_SET.has(value.journeyType)) {
    errors.push('JourneySpec journeyType is invalid.');
  }
  if (typeof value.createdFrom !== 'string' || !CREATOR_SET.has(value.createdFrom)) {
    errors.push('JourneySpec createdFrom is invalid.');
  }
  if (!Number.isInteger(value.durationDays) || Number(value.durationDays) < 1 || Number(value.durationDays) > 365) {
    errors.push('JourneySpec durationDays must be an integer between 1 and 365.');
  }

  const countryCodes = Array.isArray(value.countryCodes) ? value.countryCodes : [];
  if (countryCodes.length === 0 && value.journeyType !== 'inspiration') {
    errors.push('JourneySpec requires at least one country code.');
  }
  const normalizedCountryCodes = countryCodes.map((code) => String(code).toUpperCase());
  if (normalizedCountryCodes.some((code) => !COUNTRY_CODE_PATTERN.test(code))) {
    errors.push('JourneySpec countryCodes must use ISO alpha-2 codes.');
  }
  if (new Set(normalizedCountryCodes).size !== normalizedCountryCodes.length) {
    errors.push('JourneySpec countryCodes must be unique.');
  }

  if (!isRecord(value.dateWindow)) {
    errors.push('JourneySpec dateWindow is required.');
  } else if (value.dateWindow.mode === 'exact') {
    if (!isValidIsoDate(value.dateWindow.startDate) || !isValidIsoDate(value.dateWindow.endDate)) {
      errors.push('Exact JourneySpec dates must use valid YYYY-MM-DD values.');
    } else if (value.dateWindow.endDate < value.dateWindow.startDate) {
      errors.push('JourneySpec end date must not be before its start date.');
    }
  } else if (value.dateWindow.mode === 'flexible') {
    if (!Number.isInteger(value.dateWindow.durationDays) || Number(value.dateWindow.durationDays) < 1) {
      errors.push('Flexible JourneySpec durationDays must be a positive integer.');
    }
    if (!Array.isArray(value.dateWindow.months) || value.dateWindow.months.some((month) => !Number.isInteger(month) || month < 1 || month > 12)) {
      errors.push('Flexible JourneySpec months must contain values from 1 to 12.');
    }
  } else {
    errors.push('JourneySpec dateWindow mode is invalid.');
  }

  const places = Array.isArray(value.places) ? value.places : [];
  const rolesBySlug = new Map<string, Set<string>>();
  let entryCount = 0;
  let exitCount = 0;
  let baseCount = 0;
  let dayTripCount = 0;

  places.forEach((rawPlace, index) => {
    if (!isRecord(rawPlace) || !isRecord(rawPlace.entity)) {
      errors.push(`JourneySpec place ${index} is invalid.`);
      return;
    }
    const entity = rawPlace.entity;
    if (entity.entityId !== null && (typeof entity.entityId !== 'string' || !UUID_PATTERN.test(entity.entityId))) {
      errors.push(`JourneySpec place ${index} has an invalid entity ID.`);
    }
    if (typeof entity.canonicalSlug !== 'string' || !SLUG_PATTERN.test(entity.canonicalSlug)) {
      errors.push(`JourneySpec place ${index} has an invalid canonical slug.`);
    }
    if (typeof entity.entityType !== 'string' || !ENTITY_TYPE_SET.has(entity.entityType)) {
      errors.push(`JourneySpec place ${index} has an invalid entity type.`);
    }
    if (typeof entity.countryCode !== 'string' || !COUNTRY_CODE_PATTERN.test(entity.countryCode)) {
      errors.push(`JourneySpec place ${index} has an invalid country code.`);
    } else if (normalizedCountryCodes.length > 0 && !normalizedCountryCodes.includes(entity.countryCode)) {
      errors.push(`JourneySpec place ${index} is outside the selected country scope.`);
    }
    if (typeof entity.name !== 'string' || entity.name.trim().length === 0) {
      errors.push(`JourneySpec place ${index} requires a name.`);
    }
    if (entity.resolution !== 'canonical' && entity.resolution !== 'legacy_unresolved') {
      errors.push(`JourneySpec place ${index} has an invalid resolution state.`);
    }
    if (typeof rawPlace.role !== 'string' || !PLACE_ROLE_SET.has(rawPlace.role)) {
      errors.push(`JourneySpec place ${index} has an invalid role.`);
      return;
    }
    if (!Number.isInteger(rawPlace.order) || Number(rawPlace.order) < 0) {
      errors.push(`JourneySpec place ${index} has an invalid order.`);
    }
    if (rawPlace.nights !== undefined && (!Number.isInteger(rawPlace.nights) || Number(rawPlace.nights) < 0)) {
      errors.push(`JourneySpec place ${index} has invalid nights.`);
    }

    const slug = String(entity.canonicalSlug);
    const slugRoles = rolesBySlug.get(slug) ?? new Set<string>();
    slugRoles.add(String(rawPlace.role));
    rolesBySlug.set(slug, slugRoles);
    if (rawPlace.role === 'entry') entryCount += 1;
    if (rawPlace.role === 'exit') exitCount += 1;
    if (rawPlace.role === 'base') baseCount += 1;
    if (rawPlace.role === 'day_trip') dayTripCount += 1;
  });

  for (const [slug, roles] of rolesBySlug) {
    if (roles.has('avoid') && roles.size > 1) errors.push(`JourneySpec place ${slug} cannot be both avoided and selected.`);
  }
  if (entryCount > 1) errors.push('JourneySpec supports at most one entry place.');
  if (exitCount > 1) errors.push('JourneySpec supports at most one exit place.');

  if (validationPhase === 'route') {
    if (value.journeyType === 'city_break' && baseCount !== 1) {
      errors.push('A city-break JourneySpec requires exactly one base.');
    }
    if (value.journeyType === 'hub_and_day_trips' && (baseCount !== 1 || dayTripCount < 1)) {
      errors.push('A hub-and-day-trips JourneySpec requires one base and at least one day trip.');
    }
    if (value.journeyType === 'single_country_circuit' && baseCount < 2) {
      errors.push('A single-country circuit JourneySpec requires at least two bases.');
    }
  }

  if (!isRecord(value.constraints)) {
    errors.push('JourneySpec constraints are required.');
  } else {
    if (typeof value.constraints.roundTrip !== 'boolean' || typeof value.constraints.routeLocked !== 'boolean') {
      errors.push('JourneySpec roundTrip and routeLocked constraints must be boolean.');
    }
    if (value.constraints.maxBaseChanges !== undefined && (!Number.isInteger(value.constraints.maxBaseChanges) || Number(value.constraints.maxBaseChanges) < 0)) {
      errors.push('JourneySpec maxBaseChanges must be a non-negative integer.');
    }
    if (value.constraints.maxTransferMinutes !== undefined && (!Number.isInteger(value.constraints.maxTransferMinutes) || Number(value.constraints.maxTransferMinutes) < 15)) {
      errors.push('JourneySpec maxTransferMinutes must be at least 15.');
    }
    if (!Array.isArray(value.constraints.transportPreferences) || value.constraints.transportPreferences.some((item) => typeof item !== 'string')) {
      errors.push('JourneySpec transportPreferences must be a string array.');
    }
  }

  if (!isRecord(value.preferences)) {
    errors.push('JourneySpec preferences are required.');
  } else {
    if (typeof value.preferences.pace !== 'string' || !PACE_SET.has(value.preferences.pace)) {
      errors.push('JourneySpec pace is invalid.');
    }
    if (!Array.isArray(value.preferences.interestTags) || value.preferences.interestTags.some((item) => typeof item !== 'string')) {
      errors.push('JourneySpec interestTags must be a string array.');
    }
    if (!Array.isArray(value.preferences.vibeTags) || value.preferences.vibeTags.some((item) => typeof item !== 'string')) {
      errors.push('JourneySpec vibeTags must be a string array.');
    }
  }

  if (value.knowledgeContext !== undefined) {
    if (!isRecord(value.knowledgeContext)) {
      errors.push('JourneySpec knowledgeContext must be an object.');
    } else {
      if (typeof value.knowledgeContext.datasetKey !== 'string' || value.knowledgeContext.datasetKey.trim().length === 0) {
        errors.push('JourneySpec knowledgeContext requires a dataset key.');
      }
      if (typeof value.knowledgeContext.datasetVersion !== 'string' || value.knowledgeContext.datasetVersion.trim().length === 0) {
        errors.push('JourneySpec knowledgeContext requires a dataset version.');
      }
      if (value.knowledgeContext.templateKey !== undefined
        && (typeof value.knowledgeContext.templateKey !== 'string' || value.knowledgeContext.templateKey.trim().length === 0)) {
        errors.push('JourneySpec knowledgeContext template key is invalid.');
      }
      if (value.knowledgeContext.templateVersion !== undefined
        && (!Number.isInteger(value.knowledgeContext.templateVersion) || Number(value.knowledgeContext.templateVersion) < 1)) {
        errors.push('JourneySpec knowledgeContext template version must be a positive integer.');
      }
      if ((value.knowledgeContext.templateKey === undefined) !== (value.knowledgeContext.templateVersion === undefined)) {
        errors.push('JourneySpec knowledgeContext template key and version must be provided together.');
      }
    }
  }

  return { valid: errors.length === 0, errors };
};

export const isJourneySpec = (
  value: unknown,
  options: JourneySpecValidationOptions = {},
): value is JourneySpec => validateJourneySpec(value, options).valid;

export const buildJourneySpecFromLegacyCreateTrip = (input: LegacyJourneySpecInput): JourneySpec => {
  const preferences = input.preferences ?? {};
  const countrySelections: JourneyPlaceSelection[] = input.countries.map((country, index) => ({
    entity: createLegacyTravelEntityReference({
      canonicalSlug: `${country.code.toLowerCase()}-${slugifyLegacyName(country.name)}`,
      entityType: 'country',
      countryCode: country.code,
      name: country.name,
    }),
    role: 'country_scope',
    order: index,
  }));
  const resolvedPlaces = input.resolvedPlaces ?? [];
  const durationDays = Math.max(1, Math.round(input.durationDays));
  const journeyType = input.journeyType ?? inferLegacyJourneyType(input.countries, resolvedPlaces, durationDays);
  const exactDates = input.startDate && input.endDate && isValidIsoDate(input.startDate) && isValidIsoDate(input.endDate)
    ? {
        mode: 'exact' as const,
        startDate: input.startDate,
        endDate: input.endDate,
      }
    : null;
  const normalizedDurationDays = exactDates
    ? deriveExactDurationDays(exactDates.startDate, exactDates.endDate)
    : durationDays;

  return normalizeJourneySpec({
    version: JOURNEY_SPEC_VERSION,
    journeyType,
    countryCodes: input.countries.map((country) => country.code),
    dateWindow: exactDates ?? {
      mode: 'flexible',
      durationDays: normalizedDurationDays,
      months: uniqueStrings((input.flexibleMonths ?? preferences.idealMonths ?? []).map(String))
        .map(Number)
        .filter((month) => Number.isInteger(month) && month >= 1 && month <= 12),
      season: preferences.flexWindow,
    },
    durationDays: normalizedDurationDays,
    places: [...countrySelections, ...resolvedPlaces],
    constraints: {
      roundTrip: input.roundTrip ?? true,
      routeLocked: preferences.routeLock ?? false,
      transportPreferences: preferences.transportPreferences ?? [],
    },
    preferences: {
      pace: input.pace ?? 'balanced',
      interestTags: preferences.tripStyleTags ?? [],
      vibeTags: preferences.tripVibeTags ?? [],
      freeTextPlaceRequest: preferences.specificCities,
      notes: preferences.notes,
    },
    createdFrom: input.createdFrom ?? 'wizard_v3',
  });
};
