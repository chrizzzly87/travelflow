import { MODEL_TRANSPORT_MODE_VALUES } from "./transportModes.ts";
import { TRIP_ITINERARY_ACTIVITY_TYPE_VALUES } from "./aiTripItinerarySchema.ts";

export interface PreparedTripItinerary {
  data: Record<string, unknown>;
  metrics: {
    draftCharacters: number;
    compiledCharacters: number;
    derivedCountryNames: number;
    derivedTravelFields: number;
    renderedRecommendationSections: number;
  };
}

export type TripItineraryPreparationResult =
  | { ok: true; value: PreparedTripItinerary }
  | { ok: false; errors: string[] };

export interface TripItineraryPreparationOptions {
  roundTrip?: boolean;
  minimumRecommendations?: 1 | 3;
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === "object" && !Array.isArray(value)
);

const hasText = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;

const hasExactKeys = (value: Record<string, unknown>, keys: readonly string[], path: string, errors: string[]): boolean => {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length === expected.length && actual.every((key, index) => key === expected[index])) return true;
  errors.push(`${path} must contain exactly: ${keys.join(", ")}`);
  return false;
};

const isStrictNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

const countryDisplayNames = typeof Intl.DisplayNames === "function"
  ? new Intl.DisplayNames(["en"], { type: "region" })
  : null;

const renderChecklist = (heading: string, values: string[]): string => [
  `### ${heading}`,
  ...values.map((value) => "- [ ] " + value.trim().replace(/[\\`*_{}\[\]]/g, "\\$&")),
].join("\n");

const renderRecommendations = (
  value: unknown,
  path: string,
  errors: string[],
  minimumRecommendations: 1 | 3,
): string => {
  if (!isRecord(value)) {
    errors.push(`${path}.recommendations must be an object`);
    return "";
  }
  hasExactKeys(value, ["mustSee", "mustTry", "mustDo", "headsUp"], `${path}.recommendations`, errors);

  const readList = (key: string, minItems: number, maxItems: number): string[] => {
    const raw = value[key];
    if (!Array.isArray(raw)) {
      errors.push(`${path}.recommendations.${key} must be an array`);
      return [];
    }
    const entries = raw.filter(hasText).map((entry) => entry.trim());
    const maxLength = key === "headsUp" ? 120 : 80;
    if (
      entries.length < minItems
      || entries.length > maxItems
      || entries.length !== raw.length
      || entries.some((entry) => entry.length > maxLength || entry.includes("\n") || entry.includes("\r"))
    ) {
      errors.push(`${path}.recommendations.${key} must contain ${minItems}-${maxItems} non-empty strings`);
    }
    return entries.slice(0, maxItems);
  };

  const mustSee = readList("mustSee", minimumRecommendations, 4);
  const mustTry = readList("mustTry", minimumRecommendations, 4);
  const mustDo = readList("mustDo", minimumRecommendations, 4);
  const headsUp = readList("headsUp", 0, 2);

  return [
    renderChecklist("Must See", mustSee),
    renderChecklist("Must Try", mustTry),
    renderChecklist("Must Do", mustDo),
    headsUp.length > 0 ? renderChecklist("Heads Up", headsUp) : "",
  ].filter(Boolean).join("\n\n");
};

const formatDuration = (hours: number): string => {
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m`;
  if (Number.isInteger(hours)) return `${hours}h`;
  const totalMinutes = Math.round(hours * 60);
  const wholeHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (minutes === 0) return `${wholeHours}h`;
  return wholeHours > 0 ? `${wholeHours}h ${minutes}m` : `${minutes}m`;
};

const formatTransportMode = (value: string): string => value
  .split("_")
  .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
  .join(" ");

const validateCountryInfo = (value: unknown, errors: string[]): Record<string, unknown> | null => {
  if (!isRecord(value)) {
    errors.push("countryInfo must be an object");
    return null;
  }
  hasExactKeys(value, [
    "currencyCode",
    "currencyName",
    "exchangeRate",
    "languages",
    "electricSockets",
    "visaInfoUrl",
    "auswaertigesAmtUrl",
  ], "countryInfo", errors);
  const requiredText = ["currencyCode", "currencyName", "electricSockets", "visaInfoUrl", "auswaertigesAmtUrl"];
  requiredText.forEach((key) => {
    if (!hasText(value[key])) errors.push(`countryInfo.${key} must be a non-empty string`);
  });
  if (!isStrictNumber(value.exchangeRate) || value.exchangeRate <= 0) {
    errors.push("countryInfo.exchangeRate must be a positive number");
  }
  if (!Array.isArray(value.languages) || value.languages.length === 0 || !value.languages.every(hasText)) {
    errors.push("countryInfo.languages must contain non-empty strings");
  }
  return value;
};

export const prepareTripItineraryModelData = (
  draft: Record<string, unknown>,
  options: TripItineraryPreparationOptions = {},
): TripItineraryPreparationResult => {
  const errors: string[] = [];
  const minimumRecommendations = options.minimumRecommendations ?? 3;
  hasExactKeys(draft, ["tripTitle", "countryInfo", "cities", "travelSegments", "activities"], "root", errors);
  if (!hasText(draft.tripTitle) || draft.tripTitle.length > 80) errors.push("tripTitle must be a non-empty string up to 80 characters");
  if (!Array.isArray(draft.cities)) errors.push("cities must be an array");
  const rawCities = Array.isArray(draft.cities) ? draft.cities : [];
  if (rawCities.length === 0) errors.push("cities must contain at least one stop");

  let derivedCountryNames = 0;
  let renderedRecommendationSections = 0;
  const cities = rawCities.flatMap((entry, index) => {
    const path = `cities[${index}]`;
    if (!isRecord(entry)) {
      errors.push(`${path} must be an object`);
      return [];
    }
    hasExactKeys(entry, ["name", "days", "recommendations", "countryCode", "lat", "lng"], path, errors);
    if (!hasText(entry.name)) errors.push(`${path}.name must be a non-empty string`);
    const days = entry.days;
    const firstName = isRecord(rawCities[0]) && hasText(rawCities[0].name) ? rawCities[0].name.trim().toLowerCase() : "";
    const terminalRoundTrip = Boolean(
      options.roundTrip && index === rawCities.length - 1 && index > 0 && hasText(entry.name)
      && entry.name.trim().toLowerCase() === firstName && days === 0
    );
    if (!Number.isInteger(days) || (days <= 0 && !terminalRoundTrip)) errors.push(`${path}.days must be a positive whole number`);
    if (!hasText(entry.countryCode) || !/^[A-Z]{2}$/.test(entry.countryCode)) {
      errors.push(`${path}.countryCode must be an uppercase ISO alpha-2 code`);
    }
    const lat = entry.lat;
    const lng = entry.lng;
    if (!isStrictNumber(lat) || lat < -90 || lat > 90) errors.push(`${path}.lat is invalid`);
    if (!isStrictNumber(lng) || lng < -180 || lng > 180) errors.push(`${path}.lng is invalid`);
    const description = renderRecommendations(entry.recommendations, path, errors, minimumRecommendations);
    if (description) renderedRecommendationSections += description.match(/^### /gm)?.length || 0;
    const countryCode = hasText(entry.countryCode) ? entry.countryCode : "";
    const countryName = countryDisplayNames?.of(countryCode) || countryCode;
    if (countryName) derivedCountryNames += 1;
    return [{
      name: hasText(entry.name) ? entry.name.trim() : `Stop ${index + 1}`,
      days,
      description,
      countryName,
      countryCode,
      lat,
      lng,
    }];
  });

  const firstCityName = cities[0] && hasText(cities[0].name) ? String(cities[0].name).toLowerCase() : "";
  const lastCityName = cities.at(-1) && hasText(cities.at(-1)?.name) ? String(cities.at(-1)?.name).toLowerCase() : "";
  const alreadyReturnsToOrigin = Boolean(options.roundTrip && cities.length > 1 && firstCityName === lastCityName);
  if (options.roundTrip && cities.length > 0 && !alreadyReturnsToOrigin) {
    cities.push({ ...cities[0], days: 0 });
  }

  if (!Array.isArray(draft.travelSegments)) errors.push("travelSegments must be an array");
  const rawSegments = Array.isArray(draft.travelSegments) ? draft.travelSegments : [];
  const expectedSegments = Math.max(0, cities.length - 1);
  if (rawSegments.length !== expectedSegments) {
    errors.push(`travelSegments must contain exactly ${expectedSegments} consecutive segment(s)`);
  }
  let derivedTravelFields = 0;
  const travelSegments = rawSegments.flatMap((entry, index) => {
    const path = `travelSegments[${index}]`;
    if (!isRecord(entry)) {
      errors.push(`${path} must be an object`);
      return [];
    }
    hasExactKeys(entry, ["transportMode", "duration"], path, errors);
    const mode = hasText(entry.transportMode) ? entry.transportMode : "";
    if (!MODEL_TRANSPORT_MODE_VALUES.includes(mode as (typeof MODEL_TRANSPORT_MODE_VALUES)[number])) {
      errors.push(`${path}.transportMode is invalid`);
    }
    const duration = entry.duration;
    if (!isStrictNumber(duration) || duration <= 0) errors.push(`${path}.duration must be positive hours`);
    derivedTravelFields += 3;
    return [{
      fromCityIndex: index,
      toCityIndex: index + 1,
      transportMode: mode,
      description: `${formatDuration(duration)} ${formatTransportMode(mode)}`.slice(0, 60),
      duration,
    }];
  });

  if (!Array.isArray(draft.activities)) errors.push("activities must be an array");
  const rawActivities = Array.isArray(draft.activities) ? draft.activities : [];
  const activities = rawActivities.flatMap((entry, index) => {
    const path = `activities[${index}]`;
    if (!isRecord(entry)) {
      errors.push(`${path} must be an object`);
      return [];
    }
    hasExactKeys(entry, ["title", "cityIndex", "dayOffsetInCity", "duration", "description", "activityTypes"], path, errors);
    const cityIndex = entry.cityIndex;
    const dayOffset = entry.dayOffsetInCity;
    const duration = entry.duration;
    if (!Number.isInteger(cityIndex) || cityIndex < 0 || cityIndex >= cities.length) errors.push(`${path}.cityIndex is invalid`);
    const cityDays = Number.isInteger(cityIndex) && cities[cityIndex] ? Number(cities[cityIndex].days) : null;
    if (!isStrictNumber(dayOffset) || dayOffset < 0 || (cityDays !== null && dayOffset >= cityDays)) {
      errors.push(`${path}.dayOffsetInCity falls outside the stop`);
    }
    if (!isStrictNumber(duration) || duration <= 0) errors.push(`${path}.duration must be positive`);
    if (isStrictNumber(dayOffset) && isStrictNumber(duration) && cityDays !== null && dayOffset + duration > cityDays) {
      errors.push(`${path} extends beyond the stop`);
    }
    if (!hasText(entry.title)) errors.push(`${path}.title must be a non-empty string`);
    if (!hasText(entry.description) || entry.description.length > 90 || entry.description.includes("\n")) {
      errors.push(`${path}.description must be a single non-empty line up to 90 characters`);
    }
    if (
      !Array.isArray(entry.activityTypes)
      || entry.activityTypes.length < 1
      || entry.activityTypes.length > 3
      || !entry.activityTypes.every((value) => (
        hasText(value)
        && TRIP_ITINERARY_ACTIVITY_TYPE_VALUES.includes(
          value as (typeof TRIP_ITINERARY_ACTIVITY_TYPE_VALUES)[number],
        )
      ))
    ) {
      errors.push(`${path}.activityTypes must contain 1-3 values`);
    }
    return [entry];
  });

  const countryInfo = validateCountryInfo(draft.countryInfo, errors);
  if (errors.length > 0 || !countryInfo) return { ok: false, errors };

  const data: Record<string, unknown> = {
    tripTitle: String(draft.tripTitle).trim(),
    countryInfo,
    cities,
    travelSegments,
    activities,
  };
  return {
    ok: true,
    value: {
      data,
      metrics: {
        draftCharacters: JSON.stringify(draft).length,
        compiledCharacters: JSON.stringify(data).length,
        derivedCountryNames,
        derivedTravelFields,
        renderedRecommendationSections,
      },
    },
  };
};
