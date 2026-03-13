import { parseFlexibleDurationDays, parseFlexibleDurationHours } from "./durationParsing.ts";
import { MODEL_TRANSPORT_MODE_VALUES, parseTransportMode } from "./transportModes.ts";

export interface ValidationResult {
  schemaValid: boolean;
  checks: Record<string, unknown>;
  errors: string[];
  warnings: string[];
}

export interface ValidationOptions {
  roundTrip?: boolean;
}

export type BenchmarkRunStatus = "queued" | "running" | "completed" | "failed";
export type BenchmarkRunSatisfactionRating = "good" | "medium" | "bad";

export interface BenchmarkRunLatencyLike {
  latency_ms: number | null;
  started_at?: string | null;
}

export interface BenchmarkRunCommentRowLike {
  id: string;
  provider: string;
  model: string;
  run_comment: string | null;
  run_comment_updated_at: string | null;
  created_at: string;
  status: BenchmarkRunStatus | null;
  satisfaction_rating: BenchmarkRunSatisfactionRating | null;
}

export interface BenchmarkRunCommentTelemetryEntry {
  runId: string;
  provider: string;
  model: string;
  comment: string;
  status: BenchmarkRunStatus | null;
  satisfactionRating: BenchmarkRunSatisfactionRating | null;
  createdAt: string;
  updatedAt: string;
}

export interface BenchmarkRunCommentTelemetryGroup {
  provider: string;
  model: string;
  key: string;
  total: number;
  latestCommentAt: string;
  comments: BenchmarkRunCommentTelemetryEntry[];
}

export const BENCHMARK_ACTIVITY_TYPES = [
  "general",
  "sightseeing",
  "food",
  "culture",
  "relaxation",
  "nightlife",
  "sports",
  "hiking",
  "wildlife",
  "nature",
  "shopping",
  "adventure",
  "beach",
] as const;

export const BENCHMARK_RUN_COMMENT_MAX_LENGTH = 2000;

const ALLOWED_MODEL_TRANSPORT_MODE_SET = new Set<string>(MODEL_TRANSPORT_MODE_VALUES);

const COUNTRY_INFO_FIELD_KEYS = [
  "currency",
  "currencyCode",
  "currencyName",
  "exchangeRate",
  "exchangeRateToEUR",
  "languages",
  "sockets",
  "electricSockets",
  "visaLink",
  "visaInfoUrl",
  "auswaertigesAmtLink",
  "auswaertigesAmtUrl",
] as const;

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === "object" && !Array.isArray(value)
);

const hasText = (value: unknown): boolean => typeof value === "string" && value.trim().length > 0;

const hasOwn = (value: Record<string, unknown>, key: string): boolean => (
  Object.prototype.hasOwnProperty.call(value, key)
);

const tokenizeActivity = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.flatMap(tokenizeActivity);
  }
  if (typeof value !== "string") return [];
  return value
    .split(/[\s,|/;]+/)
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);
};

const countryInfoHasSignalFields = (value: Record<string, unknown>): boolean => (
  COUNTRY_INFO_FIELD_KEYS.some((key) => hasOwn(value, key))
);

const tokenizeCsvText = (value: string): string[] => (
  value
    .split(/[|,;/]+/)
    .map((token) => token.trim())
    .filter(Boolean)
);

const normalizeCountryInfoLanguages = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.filter(hasText).map((entry) => String(entry).trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return tokenizeCsvText(value);
  }
  return [];
};

const pickFirstCountryInfoText = (
  entries: Record<string, unknown>[],
  keys: readonly string[],
): string | null => {
  for (const entry of entries) {
    for (const key of keys) {
      const value = entry[key];
      if (hasText(value)) return String(value).trim();
    }
  }
  return null;
};

const collectCountryInfoText = (
  entries: Record<string, unknown>[],
  keys: readonly string[],
): string[] => {
  const values = new Set<string>();
  entries.forEach((entry) => {
    keys.forEach((key) => {
      const value = entry[key];
      if (hasText(value)) values.add(String(value).trim());
    });
  });
  return [...values];
};

export const normalizeCityName = (value: string): string => (
  value.trim().toLocaleLowerCase().replace(/\s+/g, " ")
);

export const normalizeActivityTypes = (value: unknown): string[] => {
  const tokens = tokenizeActivity(value);
  const accepted = new Set<string>();
  tokens.forEach((token) => {
    if (BENCHMARK_ACTIVITY_TYPES.includes(token as (typeof BENCHMARK_ACTIVITY_TYPES)[number])) {
      accepted.add(token);
      return;
    }
    if (token.includes("food") || token.includes("dining")) accepted.add("food");
    if (token.includes("culture") || token.includes("museum") || token.includes("history")) accepted.add("culture");
    if (token.includes("sight") || token.includes("landmark")) accepted.add("sightseeing");
    if (token.includes("beach") || token.includes("coast")) accepted.add("beach");
    if (token.includes("hike") || token.includes("trek")) accepted.add("hiking");
    if (token.includes("night") || token.includes("party") || token.includes("bar")) accepted.add("nightlife");
    if (token.includes("nature") || token.includes("park")) accepted.add("nature");
    if (token.includes("wildlife") || token.includes("safari")) accepted.add("wildlife");
    if (token.includes("shop") || token.includes("market")) accepted.add("shopping");
    if (token.includes("adventure")) accepted.add("adventure");
    if (token.includes("sport")) accepted.add("sports");
    if (token.includes("relax") || token.includes("spa")) accepted.add("relaxation");
  });

  if (accepted.size === 0) return ["general"];
  return BENCHMARK_ACTIVITY_TYPES.filter((type) => accepted.has(type));
};

export const collectCountryInfoEntries = (value: unknown): Record<string, unknown>[] => {
  if (Array.isArray(value)) {
    return value.filter(isRecord);
  }
  if (!isRecord(value)) return [];
  if (countryInfoHasSignalFields(value)) {
    return [value];
  }
  const nested = Object.values(value).filter(isRecord);
  return nested.filter(countryInfoHasSignalFields);
};

export const collectCountryInfoLanguages = (entries: Record<string, unknown>[]): string[] => {
  const values = new Set<string>();
  entries.forEach((entry) => {
    normalizeCountryInfoLanguages(entry.languages).forEach((language) => values.add(language));
  });
  return [...values];
};

export const pickCountryInfoExchangeRate = (entries: Record<string, unknown>[]): number | null => {
  for (const entry of entries) {
    const direct = Number(entry.exchangeRate);
    if (Number.isFinite(direct)) return direct;
    const fallback = Number(entry.exchangeRateToEUR);
    if (Number.isFinite(fallback)) return fallback;
  }
  return null;
};

export const normalizeRunComment = (
  value: unknown,
): { ok: true; comment: string | null } | { ok: false; error: string } => {
  if (value === null) {
    return {
      ok: true,
      comment: null,
    };
  }

  if (typeof value !== "string") {
    return {
      ok: false,
      error: "Invalid comment. Expected string or null.",
    };
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return {
      ok: true,
      comment: null,
    };
  }

  if (trimmed.length > BENCHMARK_RUN_COMMENT_MAX_LENGTH) {
    return {
      ok: false,
      error: `Comment too long. Max ${BENCHMARK_RUN_COMMENT_MAX_LENGTH} characters.`,
    };
  }

  return {
    ok: true,
    comment: trimmed,
  };
};

export const validateModelData = (data: Record<string, unknown>, options: ValidationOptions = {}): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const cities = Array.isArray(data.cities) ? data.cities : [];
  const activities = Array.isArray(data.activities) ? data.activities : [];
  const travelSegments = Array.isArray(data.travelSegments) ? data.travelSegments : [];
  const firstCity = cities.length > 0 && isRecord(cities[0]) ? (cities[0] as Record<string, unknown>) : null;
  const firstCityName = firstCity && hasText(firstCity.name) ? normalizeCityName(String(firstCity.name)) : null;
  let hasTerminalRoundTripZeroDayCity = false;

  const requiredTopLevelKeys = ["tripTitle", "cities", "travelSegments", "activities"];
  const topLevelContractValid = requiredTopLevelKeys.every((key) => hasOwn(data, key));
  if (!topLevelContractValid) {
    errors.push("Top-level contract missing one or more required keys");
  }

  const cityCountValid = cities.length > 0;
  if (!cityCountValid) {
    errors.push("No cities returned");
  }

  const cityRequiredFieldsValid = cities.every((city, index) => {
    if (!isRecord(city)) return false;
    const daysValue = Number(city.days);
    const isFiniteDays = Number.isFinite(daysValue);
    const hasPositiveDays = isFiniteDays && daysValue > 0;
    const isTerminalRoundTripZeroDayCity = Boolean(
      options.roundTrip
      && isFiniteDays
      && daysValue === 0
      && index === cities.length - 1
      && index > 0
      && firstCityName
      && hasText(city.name)
      && normalizeCityName(String(city.name)) === firstCityName,
    );
    if (isTerminalRoundTripZeroDayCity) {
      hasTerminalRoundTripZeroDayCity = true;
    }
    return (
      hasText(city.name) &&
      hasText(city.description) &&
      (hasPositiveDays || isTerminalRoundTripZeroDayCity) &&
      Number.isFinite(Number(city.lat)) &&
      Number.isFinite(Number(city.lng))
    );
  });

  const travelRequiredFieldsValid = travelSegments.every((segment) => {
    if (!isRecord(segment)) return false;
    return (
      hasOwn(segment, "fromCityIndex") &&
      hasOwn(segment, "toCityIndex") &&
      hasOwn(segment, "transportMode") &&
      hasOwn(segment, "description") &&
      hasOwn(segment, "duration") &&
      hasText(segment.description)
    );
  });

  const activityRequiredFieldsValid = activities.every((activity) => {
    if (!isRecord(activity)) return false;
    return (
      hasText(activity.title) &&
      hasOwn(activity, "cityIndex") &&
      hasOwn(activity, "dayOffsetInCity") &&
      hasOwn(activity, "duration") &&
      hasText(activity.description) &&
      Array.isArray(activity.activityTypes) &&
      activity.activityTypes.length > 0
    );
  });

  const requiredFieldsValid = cityRequiredFieldsValid && travelRequiredFieldsValid && activityRequiredFieldsValid;
  if (!requiredFieldsValid) {
    errors.push("One or more entries are missing mandatory fields or have wrong field types");
  }
  if (hasTerminalRoundTripZeroDayCity) {
    warnings.push("Terminal round-trip city returned with 0 days; normalized to 1 day during trip build (non-blocking)");
  }

  const cityCoordinatesValid = cities.every((city) => {
    if (!isRecord(city)) return false;
    return Number.isFinite(Number(city.lat)) && Number.isFinite(Number(city.lng));
  });
  if (!cityCoordinatesValid) {
    errors.push("One or more cities have invalid coordinates");
  }

  const countryInfoEntries = collectCountryInfoEntries(data.countryInfo);
  const countryInfoPresent = countryInfoEntries.length > 0;
  const countryInfoCurrencies = collectCountryInfoText(countryInfoEntries, ["currency"]);
  const countryInfoCurrencyCodes = collectCountryInfoText(countryInfoEntries, ["currencyCode"]);
  const countryInfoCurrencyNames = collectCountryInfoText(countryInfoEntries, ["currencyName"]);
  const countryInfoLanguages = collectCountryInfoLanguages(countryInfoEntries);
  const countryInfoExchangeRate = pickCountryInfoExchangeRate(countryInfoEntries);
  const countryInfoSockets = pickFirstCountryInfoText(countryInfoEntries, ["electricSockets", "sockets"]);
  const countryInfoVisa = pickFirstCountryInfoText(countryInfoEntries, ["visaInfoUrl", "visaLink"]);
  const countryInfoAmt = pickFirstCountryInfoText(countryInfoEntries, ["auswaertigesAmtUrl", "auswaertigesAmtLink"]);
  const countryInfoCanonicalObject = isRecord(data.countryInfo) && countryInfoHasSignalFields(data.countryInfo);
  const countryInfoValid = countryInfoPresent && (
    countryInfoCurrencies.length > 0 ||
    (countryInfoCurrencyCodes.length > 0 && countryInfoCurrencyNames.length > 0)
  ) && (
    Number.isFinite(countryInfoExchangeRate)
  ) && (
    countryInfoLanguages.length > 0
  ) && (
    Boolean(countryInfoSockets)
  ) && (
    Boolean(countryInfoVisa)
  ) && (
    Boolean(countryInfoAmt)
  );
  if (!countryInfoPresent) {
    warnings.push("countryInfo is missing (non-blocking)");
  } else if (!countryInfoValid) {
    warnings.push("countryInfo is missing required fields or has invalid formatting (non-blocking)");
  } else if (!countryInfoCanonicalObject) {
    warnings.push("countryInfo uses non-canonical structure (array/map); normalized for validation (non-blocking)");
  }

  const markdownSectionsValid = cities.every((city) => {
    if (!isRecord(city)) return false;
    const description = String(city.description || "");
    return (
      /###\s*Must\s*See/i.test(description) &&
      /###\s*Must\s*Try/i.test(description) &&
      /###\s*Must\s*Do/i.test(description)
    );
  });
  if (!markdownSectionsValid) {
    errors.push("One or more city descriptions are missing required markdown sections");
  }

  const cityIndexValid = activities.every((activity) => {
    if (!isRecord(activity)) return false;
    const cityIndex = Number(activity.cityIndex);
    return Number.isFinite(cityIndex) && cityIndex >= 0 && cityIndex < cities.length;
  });
  if (!cityIndexValid) {
    errors.push("One or more activities have invalid cityIndex values");
  }

  const activityTypesValid = activities.every((activity) => {
    if (!isRecord(activity)) return false;
    const normalized = normalizeActivityTypes(activity.activityTypes ?? activity.type);
    return normalized.length > 0;
  });
  if (!activityTypesValid) {
    errors.push("One or more activities have invalid activityTypes values");
  }

  const activityTypesCanonicalValid = activities.every((activity) => {
    if (!isRecord(activity)) return false;
    if (!Array.isArray(activity.activityTypes)) return false;
    const values = activity.activityTypes;
    if (values.length < 1 || values.length > 3) return false;
    return values.every((entry) => {
      if (typeof entry !== "string") return false;
      const token = entry.trim();
      const lowerToken = token.toLocaleLowerCase();
      return token === lowerToken && BENCHMARK_ACTIVITY_TYPES.includes(lowerToken as (typeof BENCHMARK_ACTIVITY_TYPES)[number]);
    });
  });
  if (activityTypesValid && !activityTypesCanonicalValid) {
    warnings.push("One or more activities use non-canonical activityTypes values (auto-normalized)");
  }

  const activityDurationFormatValid = activities.every((activity) => {
    if (!isRecord(activity)) return false;
    const parsedDays = parseFlexibleDurationDays(activity.duration);
    return Number.isFinite(parsedDays) && (parsedDays as number) > 0;
  });
  if (!activityDurationFormatValid) {
    errors.push("One or more activities have invalid duration format (expected numeric days)");
  }

  const activityDurationCanonicalTypeValid = activities.every((activity) => {
    if (!isRecord(activity)) return false;
    return typeof activity.duration === "number" && Number.isFinite(activity.duration) && activity.duration > 0;
  });
  if (activityDurationFormatValid && !activityDurationCanonicalTypeValid) {
    warnings.push("One or more activities use non-canonical duration values (expected numeric days, parser normalized strings)");
  }

  const transportModesValid = travelSegments.every((segment) => {
    if (!isRecord(segment)) return false;
    const parsed = parseTransportMode(segment.transportMode);
    return (
      parsed.recognized &&
      parsed.mode !== "na" &&
      ALLOWED_MODEL_TRANSPORT_MODE_SET.has(parsed.mode)
    );
  });
  if (!transportModesValid && travelSegments.length > 0) {
    errors.push("One or more travel segments have invalid transportMode values (must map to a supported enum value)");
  }

  const transportModesCanonicalValid = travelSegments.every((segment) => {
    if (!isRecord(segment)) return false;
    const parsed = parseTransportMode(segment.transportMode);
    const raw = typeof segment.transportMode === "string" ? segment.transportMode.trim() : "";
    return (
      parsed.recognized &&
      parsed.mode !== "na" &&
      ALLOWED_MODEL_TRANSPORT_MODE_SET.has(parsed.mode) &&
      raw === parsed.mode
    );
  });
  if (travelSegments.length > 0 && transportModesValid && !transportModesCanonicalValid) {
    warnings.push("One or more travel segments use non-canonical transportMode values (expected lowercase enum, aliases/casing were normalized)");
  }

  const travelDurationFormatValid = travelSegments.every((segment) => {
    if (!isRecord(segment)) return false;
    const parsedHours = parseFlexibleDurationHours(segment.duration);
    return Number.isFinite(parsedHours) && (parsedHours as number) > 0;
  });
  if (!travelDurationFormatValid && travelSegments.length > 0) {
    errors.push("One or more travel segments have invalid duration format (expected numeric hours)");
  }

  const travelDurationCanonicalTypeValid = travelSegments.every((segment) => {
    if (!isRecord(segment)) return false;
    return typeof segment.duration === "number" && Number.isFinite(segment.duration) && segment.duration > 0;
  });
  if (travelSegments.length > 0 && travelDurationFormatValid && !travelDurationCanonicalTypeValid) {
    warnings.push("One or more travel segments use non-canonical duration values (expected numeric hours, parser normalized strings)");
  }

  const travelSegmentIndicesValid = travelSegments.every((segment) => {
    if (!isRecord(segment)) return false;
    const fromCityIndex = Number(segment.fromCityIndex);
    const toCityIndex = Number(segment.toCityIndex);
    return (
      Number.isFinite(fromCityIndex) &&
      Number.isFinite(toCityIndex) &&
      fromCityIndex >= 0 &&
      toCityIndex >= 0 &&
      fromCityIndex < cities.length &&
      toCityIndex < cities.length &&
      fromCityIndex !== toCityIndex
    );
  });
  if (!travelSegmentIndicesValid && travelSegments.length > 0) {
    errors.push("One or more travel segments have invalid city index values");
  }

  const checks = {
    topLevelContractValid,
    cityCountValid,
    requiredFieldsValid,
    cityCoordinatesValid,
    countryInfoPresent,
    countryInfoValid,
    activityTypesValid,
    activityTypesCanonicalValid,
    activityDurationFormatValid,
    activityDurationCanonicalTypeValid,
    cityIndexValid,
    markdownSectionsValid,
    transportModesValid: travelSegments.length === 0 ? true : transportModesValid,
    transportModesCanonicalValid: travelSegments.length === 0 ? true : transportModesCanonicalValid,
    travelDurationFormatValid: travelSegments.length === 0 ? true : travelDurationFormatValid,
    travelDurationCanonicalTypeValid: travelSegments.length === 0 ? true : travelDurationCanonicalTypeValid,
    travelSegmentIndicesValid: travelSegments.length === 0 ? true : travelSegmentIndicesValid,
    warningCount: warnings.length,
    validationWarnings: warnings,
  };

  const blockingChecks = [
    topLevelContractValid,
    cityCountValid,
    requiredFieldsValid,
    cityCoordinatesValid,
    activityTypesValid,
    activityDurationFormatValid,
    cityIndexValid,
    markdownSectionsValid,
    travelSegments.length === 0 ? true : transportModesValid,
    travelSegments.length === 0 ? true : travelDurationFormatValid,
    travelSegments.length === 0 ? true : travelSegmentIndicesValid,
  ];
  const schemaValid = blockingChecks.every(Boolean);

  return {
    schemaValid,
    checks,
    errors,
    warnings,
  };
};

export const toBenchmarkRunCommentTelemetryEntries = (
  rows: BenchmarkRunCommentRowLike[],
): BenchmarkRunCommentTelemetryEntry[] => {
  return rows
    .map((row) => {
      const comment = typeof row.run_comment === "string" ? row.run_comment.trim() : "";
      if (!comment) return null;
      const updatedAt = row.run_comment_updated_at || row.created_at;
      if (!updatedAt) return null;
      return {
        runId: row.id,
        provider: row.provider,
        model: row.model,
        comment,
        status: row.status,
        satisfactionRating: row.satisfaction_rating,
        createdAt: row.created_at,
        updatedAt,
      } satisfies BenchmarkRunCommentTelemetryEntry;
    })
    .filter((entry): entry is BenchmarkRunCommentTelemetryEntry => Boolean(entry))
    .sort((left, right) => {
      const rightTs = Date.parse(right.updatedAt);
      const leftTs = Date.parse(left.updatedAt);
      const safeRight = Number.isFinite(rightTs) ? rightTs : 0;
      const safeLeft = Number.isFinite(leftTs) ? leftTs : 0;
      return safeRight - safeLeft;
    });
};

export const groupBenchmarkRunComments = (
  entries: BenchmarkRunCommentTelemetryEntry[],
): BenchmarkRunCommentTelemetryGroup[] => {
  const grouped = new Map<string, BenchmarkRunCommentTelemetryGroup>();

  entries.forEach((entry) => {
    const key = `${entry.provider}:${entry.model}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        provider: entry.provider,
        model: entry.model,
        key,
        total: 0,
        latestCommentAt: entry.updatedAt,
        comments: [],
      });
    }

    const group = grouped.get(key);
    if (!group) return;
    group.total += 1;
    group.comments.push(entry);

    const latestTs = Date.parse(group.latestCommentAt);
    const nextTs = Date.parse(entry.updatedAt);
    if (!Number.isFinite(latestTs) || (Number.isFinite(nextTs) && nextTs > latestTs)) {
      group.latestCommentAt = entry.updatedAt;
    }
  });

  return Array.from(grouped.values())
    .map((group) => ({
      ...group,
      comments: [...group.comments].sort((left, right) => {
        const rightTs = Date.parse(right.updatedAt);
        const leftTs = Date.parse(left.updatedAt);
        const safeRight = Number.isFinite(rightTs) ? rightTs : 0;
        const safeLeft = Number.isFinite(leftTs) ? leftTs : 0;
        return safeRight - safeLeft;
      }),
    }))
    .sort((left, right) => {
      if (right.total !== left.total) return right.total - left.total;
      const rightTs = Date.parse(right.latestCommentAt);
      const leftTs = Date.parse(left.latestCommentAt);
      const safeRight = Number.isFinite(rightTs) ? rightTs : 0;
      const safeLeft = Number.isFinite(leftTs) ? leftTs : 0;
      if (safeRight !== safeLeft) return safeRight - safeLeft;
      return left.key.localeCompare(right.key);
    });
};

export const resolveRunLatencyMs = (run: BenchmarkRunLatencyLike): number => {
  if (typeof run.latency_ms === "number" && Number.isFinite(run.latency_ms) && run.latency_ms >= 0) {
    return run.latency_ms;
  }
  const startedMs = run.started_at ? Date.parse(run.started_at) : NaN;
  if (!Number.isFinite(startedMs)) return 0;
  return Math.max(0, Date.now() - startedMs);
};
