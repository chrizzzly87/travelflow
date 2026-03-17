import type { TripGenerationInputSnapshot } from "../types";
import type { AiRuntimeSecurityMetadata } from "../shared/aiRuntimeSecurity";

export type TripGenerationSecurityRecoveryFieldKey =
  | "trip_request"
  | "destination"
  | "destinations"
  | "specific_cities"
  | "notes"
  | "seasonal_events";

export interface TripGenerationSecurityRecoveryField {
  key: TripGenerationSecurityRecoveryFieldKey;
  value: string;
  multiline: boolean;
}

const RECOVERY_FIELD_ORDER: TripGenerationSecurityRecoveryFieldKey[] = [
  "trip_request",
  "destination",
  "destinations",
  "specific_cities",
  "notes",
  "seasonal_events",
];

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const asTrimmedString = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

const toStringList = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
        .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
        .filter(Boolean)
    : [];

const dedupeStrings = (values: string[]): string[] => {
  const seen = new Set<string>();
  const next: string[] = [];
  values.forEach((value) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    const key = trimmed.toLocaleLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    next.push(trimmed);
  });
  return next;
};

const parseTextList = (value: string): string[] =>
  dedupeStrings(
    value
      .split(/[\n,;|]+/)
      .map((entry) => entry.trim())
      .filter(Boolean),
  );

const getAvailableRecoveryFields = (
  snapshot: TripGenerationInputSnapshot,
): TripGenerationSecurityRecoveryField[] => {
  const payload = asRecord(snapshot.payload) || {};
  const options = asRecord(payload.options) || {};

  if (snapshot.flow === "classic") {
    return [
      {
        key: "trip_request",
        value: asTrimmedString(payload.destinationPrompt),
        multiline: true,
      },
      {
        key: "specific_cities",
        value: asTrimmedString(options.specificCities),
        multiline: true,
      },
      {
        key: "notes",
        value: asTrimmedString(options.notes),
        multiline: true,
      },
    ].filter((field) => field.value.length > 0);
  }

  if (snapshot.flow === "wizard") {
    return [
      {
        key: "destinations",
        value: toStringList(options.countries).join("\n"),
        multiline: true,
      },
      {
        key: "specific_cities",
        value: asTrimmedString(options.specificCities),
        multiline: true,
      },
      {
        key: "notes",
        value: asTrimmedString(options.notes),
        multiline: true,
      },
    ].filter((field) => field.value.length > 0);
  }

  return [
    {
      key: "destination",
      value: asTrimmedString(options.country),
      multiline: false,
    },
    {
      key: "seasonal_events",
      value: toStringList(options.seasonalEvents).join("\n"),
      multiline: true,
    },
    {
      key: "notes",
      value: asTrimmedString(options.notes),
      multiline: true,
    },
  ].filter((field) => field.value.length > 0);
};

export const isTripGenerationInputSecurityBlock = (
  security: AiRuntimeSecurityMetadata | null | undefined,
  errorCode?: string | null,
): boolean =>
  Boolean(
    security?.blocked &&
    security.stage === "input_preflight" &&
    (errorCode === "AI_RUNTIME_SECURITY_BLOCKED" || !errorCode),
  );

export const isTripGenerationOutputSecurityBlock = (
  security: AiRuntimeSecurityMetadata | null | undefined,
  errorCode?: string | null,
): boolean =>
  Boolean(
    security?.blocked &&
    security.stage === "output_postflight" &&
    (errorCode === "AI_RUNTIME_SECURITY_BLOCKED" || !errorCode),
  );

export const getTripGenerationSecurityRecoveryFields = (
  snapshot: TripGenerationInputSnapshot | null | undefined,
  security: AiRuntimeSecurityMetadata | null | undefined,
): TripGenerationSecurityRecoveryField[] => {
  if (!snapshot) return [];
  const available = getAvailableRecoveryFields(snapshot);
  if (available.length === 0) return [];

  const availableByKey = new Map(available.map((field) => [field.key, field]));
  const flaggedKeys = (security?.flaggedFields || []).filter(
    (field): field is TripGenerationSecurityRecoveryFieldKey =>
      availableByKey.has(field as TripGenerationSecurityRecoveryFieldKey),
  );

  const selectedKeys =
    flaggedKeys.length > 0
      ? flaggedKeys
      : isTripGenerationInputSecurityBlock(
            security,
            "AI_RUNTIME_SECURITY_BLOCKED",
          )
        ? available.map((field) => field.key)
        : [];

  return RECOVERY_FIELD_ORDER.filter((key) => selectedKeys.includes(key))
    .map((key) => availableByKey.get(key))
    .filter((field): field is TripGenerationSecurityRecoveryField =>
      Boolean(field),
    );
};

export const applyTripGenerationSecurityRecoveryUpdates = (
  snapshot: TripGenerationInputSnapshot,
  updates: Partial<Record<TripGenerationSecurityRecoveryFieldKey, string>>,
): TripGenerationInputSnapshot => {
  const payload = {
    ...snapshot.payload,
  };
  const payloadRecord = payload as Record<string, unknown>;
  const options = {
    ...(asRecord(payloadRecord.options) || {}),
  };

  if (snapshot.flow === "classic") {
    if (typeof updates.trip_request === "string") {
      payloadRecord.destinationPrompt = updates.trip_request.trim();
    }
    if (typeof updates.specific_cities === "string") {
      options.specificCities = updates.specific_cities.trim();
    }
    if (typeof updates.notes === "string") {
      options.notes = updates.notes.trim();
    }
    payloadRecord.options = options;
    return {
      ...snapshot,
      payload: payloadRecord,
    };
  }

  if (snapshot.flow === "wizard") {
    if (typeof updates.destinations === "string") {
      options.countries = parseTextList(updates.destinations);
    }
    if (typeof updates.specific_cities === "string") {
      options.specificCities = updates.specific_cities.trim();
    }
    if (typeof updates.notes === "string") {
      options.notes = updates.notes.trim();
    }
    payloadRecord.options = options;
    return {
      ...snapshot,
      payload: payloadRecord,
    };
  }

  if (typeof updates.destination === "string") {
    options.country = updates.destination.trim();
  }
  if (typeof updates.seasonal_events === "string") {
    options.seasonalEvents = parseTextList(updates.seasonal_events);
  }
  if (typeof updates.notes === "string") {
    options.notes = updates.notes.trim();
  }
  payloadRecord.options = options;
  return {
    ...snapshot,
    payload: payloadRecord,
  };
};

export const clearTripGenerationSecurityRecoveryFields = (
  snapshot: TripGenerationInputSnapshot,
  fieldKeys: TripGenerationSecurityRecoveryFieldKey[],
): TripGenerationInputSnapshot =>
  applyTripGenerationSecurityRecoveryUpdates(
    snapshot,
    Object.fromEntries(fieldKeys.map((key) => [key, ""])) as Partial<
      Record<TripGenerationSecurityRecoveryFieldKey, string>
    >,
  );

export const hasTripGenerationSecurityRecoveryChanges = (
  initialFields: TripGenerationSecurityRecoveryField[],
  draft: Partial<Record<TripGenerationSecurityRecoveryFieldKey, string>>,
): boolean =>
  initialFields.some((field) => {
    if (!(field.key in draft)) return false;
    return (draft[field.key] || "").trim() !== field.value.trim();
  });

export const isTripGenerationSecurityRecoverySnapshotValid = (
  snapshot: TripGenerationInputSnapshot | null | undefined,
): boolean => {
  if (!snapshot) return false;

  const payload = asRecord(snapshot.payload) || {};
  const options = asRecord(payload.options) || {};

  if (snapshot.flow === "classic") {
    return asTrimmedString(payload.destinationPrompt).length > 0;
  }

  if (snapshot.flow === "wizard") {
    return toStringList(options.countries).length > 0;
  }

  return asTrimmedString(options.country).length > 0;
};
