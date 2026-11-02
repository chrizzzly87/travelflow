/**
 * Contract for trips planned by outside assistants (MCP, WebMCP, HTTP, paste).
 *
 * The itinerary itself is `travelflow_trip_plan_v3`, the same document our own
 * generator asks models for, so a valid external draft goes through the same
 * validator and builder as a generated trip. This module adds the request
 * envelope, size caps, documentation for assistants and a worked example.
 * Nothing here calls a model. See docs/EXTERNAL_TRIP_DRAFTS.md.
 */
import { TRIP_ITINERARY_ACTIVITY_TYPE_VALUES, TRIP_ITINERARY_JSON_SCHEMA, TRIP_ITINERARY_SCHEMA_NAME } from "./aiTripItinerarySchema.ts";
import { prepareTripItineraryModelData, type PreparedTripItinerary } from "./aiTripItineraryPreparation.ts";
import { MODEL_TRANSPORT_MODE_VALUES } from "./transportModes.ts";

export const TRIP_DRAFT_SOURCES = ["api", "mcp", "webmcp", "paste"] as const;
export type TripDraftSource = (typeof TRIP_DRAFT_SOURCES)[number];

export const TRIP_DRAFT_LIMITS = {
  maxBodyBytes: 256 * 1024,
  maxCities: 40,
  maxActivities: 300,
  maxDayTrips: 60,
  maxClientLabelLength: 80,
  defaultStartOffsetDays: 30,
  expiryDays: 30,
} as const;

export const TRIP_DRAFT_ID_PATTERN = /^drf_[A-Za-z0-9]{24}$/;

export interface TripDraftClientInfo {
  name: string | null;
  model: string | null;
}

export interface TripDraftRequest {
  trip: Record<string, unknown>;
  startDate: string;
  roundTrip: boolean;
  client: TripDraftClientInfo;
}

export interface PreparedTripDraft {
  request: TripDraftRequest;
  prepared: PreparedTripItinerary;
  cityCount: number;
  activityCount: number;
  countryCodes: string[];
}

export type TripDraftValidationResult =
  | { ok: true; value: PreparedTripDraft }
  | { ok: false; errors: string[] };

const BASE62 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

/** `drf_` plus 24 random base62 characters (~142 bits). The id is the capability in the link. */
export const generateTripDraftId = (): string => {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  // 248 is the largest multiple of 62 below 256; rejecting above it keeps the alphabet unbiased.
  let id = "";
  let index = 0;
  while (id.length < 24) {
    if (index >= bytes.length) {
      crypto.getRandomValues(bytes);
      index = 0;
    }
    const byte = bytes[index++];
    if (byte < 248) id += BASE62[byte % 62];
  }
  return `drf_${id}`;
};

export const isTripDraftId = (value: unknown): value is string => (
  typeof value === "string" && TRIP_DRAFT_ID_PATTERN.test(value)
);

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === "object" && !Array.isArray(value)
);

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const isValidIsoDate = (value: string): boolean => {
  if (!ISO_DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

export const defaultTripDraftStartDate = (now: Date = new Date()): string => {
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  date.setUTCDate(date.getUTCDate() + TRIP_DRAFT_LIMITS.defaultStartOffsetDays);
  return date.toISOString().slice(0, 10);
};

const readClientLabel = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.replace(/[\u0000-\u001f]/g, "").trim();
  return trimmed ? trimmed.slice(0, TRIP_DRAFT_LIMITS.maxClientLabelLength) : null;
};

/**
 * Accepts the envelope `{ trip, startDate?, roundTrip?, client? }`. A bare
 * itinerary (an object with `tripTitle` at the root) is accepted too, because
 * that is what an assistant pasting "the JSON" most often produces.
 */
export const parseTripDraftRequest = (body: unknown, now: Date = new Date()): { ok: true; value: TripDraftRequest } | { ok: false; errors: string[] } => {
  if (!isRecord(body)) return { ok: false, errors: ["The request body must be a JSON object."] };
  const envelope = isRecord(body.trip) ? body : { trip: body };
  const errors: string[] = [];
  if (envelope === body) {
    const allowed = new Set(["trip", "startDate", "roundTrip", "client"]);
    for (const key of Object.keys(body)) {
      if (!allowed.has(key)) errors.push(`Unknown top-level field "${key}". Allowed: trip, startDate, roundTrip, client.`);
    }
  }

  let startDate = defaultTripDraftStartDate(now);
  if (envelope.startDate !== undefined && envelope.startDate !== null) {
    if (typeof envelope.startDate !== "string" || !isValidIsoDate(envelope.startDate)) {
      errors.push("startDate must be a calendar date in YYYY-MM-DD format.");
    } else {
      startDate = envelope.startDate;
    }
  }

  let roundTrip = false;
  if (envelope.roundTrip !== undefined && envelope.roundTrip !== null) {
    if (typeof envelope.roundTrip !== "boolean") errors.push("roundTrip must be true or false.");
    else roundTrip = envelope.roundTrip;
  }

  const client = isRecord(envelope.client) ? envelope.client : {};
  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      trip: envelope.trip as Record<string, unknown>,
      startDate,
      roundTrip,
      client: { name: readClientLabel(client.name), model: readClientLabel(client.model) },
    },
  };
};

const countArray = (value: unknown): number => (Array.isArray(value) ? value.length : 0);

/** Size caps first, then the generator's own validator with the compact recommendation minimum. */
export const validateTripDraftRequest = (request: TripDraftRequest): TripDraftValidationResult => {
  const { trip } = request;
  const errors: string[] = [];
  if (countArray(trip.cities) > TRIP_DRAFT_LIMITS.maxCities) errors.push(`cities can contain at most ${TRIP_DRAFT_LIMITS.maxCities} stops.`);
  if (countArray(trip.activities) > TRIP_DRAFT_LIMITS.maxActivities) errors.push(`activities can contain at most ${TRIP_DRAFT_LIMITS.maxActivities} entries.`);
  if (countArray(trip.dayTrips) > TRIP_DRAFT_LIMITS.maxDayTrips) errors.push(`dayTrips can contain at most ${TRIP_DRAFT_LIMITS.maxDayTrips} entries.`);
  if (errors.length > 0) return { ok: false, errors };

  const result = prepareTripItineraryModelData(trip, { roundTrip: request.roundTrip, minimumRecommendations: 1 });
  if (!result.ok) return { ok: false, errors: result.errors };

  const cities = Array.isArray(result.value.data.cities) ? result.value.data.cities as Array<Record<string, unknown>> : [];
  const countryCodes = [...new Set(cities.flatMap((city) => typeof city.countryCode === "string" && city.countryCode ? [city.countryCode] : []))];
  return {
    ok: true,
    value: {
      request,
      prepared: result.value,
      cityCount: countArray(trip.cities),
      activityCount: countArray(trip.activities) + countArray(trip.dayTrips),
      countryCodes,
    },
  };
};

export const validateTripDraftBody = (body: unknown, now: Date = new Date()): TripDraftValidationResult => {
  const parsed = parseTripDraftRequest(body, now);
  if (!parsed.ok) return parsed;
  return validateTripDraftRequest(parsed.value);
};

// ---------------------------------------------------------------------------
// Documentation served to assistants (schema endpoint, MCP, WebMCP, llms.txt)
// ---------------------------------------------------------------------------

const FIELD_DESCRIPTIONS: Record<string, string> = {
  tripTitle: "Short, human trip title, at most 80 characters, e.g. 'Portugal: Lisbon to Porto'.",
  countryInfo: "Practical facts for the main destination country. Every field is required.",
  "countryInfo.currencyCode": "ISO 4217 code, e.g. 'EUR'.",
  "countryInfo.currencyName": "e.g. 'Euro'.",
  "countryInfo.exchangeRate": "Local currency units for exactly 1 EUR, as a number (1 for the euro).",
  "countryInfo.languages": "Main spoken languages.",
  "countryInfo.electricSockets": "Socket types, e.g. 'Type C, Type F'.",
  "countryInfo.visaInfoUrl": "A URL about visa rules (Wikipedia visa policy page or an official site).",
  "countryInfo.auswaertigesAmtUrl": "The country page on auswaertiges-amt.de (German Foreign Office travel advice).",
  cities: "Overnight stops in travel order. Do not repeat the first city at the end; set roundTrip instead.",
  "cities.name": "City or town name as a traveller would search it.",
  "cities.days": "Nights spent at this stop, a positive whole number. The trip length is the sum of all nights.",
  "cities.recommendations": "1-4 short strings each for mustSee, mustTry, mustDo (each at most 80 characters) and 0-2 headsUp warnings (each at most 120 characters).",
  "cities.countryCode": "ISO 3166-1 alpha-2 country code in uppercase, e.g. 'PT'.",
  "cities.lat": "Latitude of the city centre.",
  "cities.lng": "Longitude of the city centre.",
  travelSegments: "Exactly one leg between each pair of consecutive cities (cities.length - 1 legs; cities.length legs when roundTrip is true, the last one returning to the first city).",
  "travelSegments.transportMode": `One of: ${MODEL_TRANSPORT_MODE_VALUES.join(", ")}.`,
  "travelSegments.duration": "Door-to-door travel time in HOURS, e.g. 2.5.",
  activities: "Things to do inside a stop. Optional but strongly recommended: 1-3 per full day.",
  "activities.cityIndex": "0-based index into cities.",
  "activities.dayOffsetInCity": "Day within that stop, starting at 0. Must be less than the stop's days.",
  "activities.duration": "Length in DAYS: 0.125 (3 h), 0.25 (6 h) or 0.5 (half day). dayOffsetInCity + duration must not exceed the stop's days.",
  "activities.description": "One line, at most 90 characters.",
  "activities.activityTypes": `1-3 of: ${TRIP_ITINERARY_ACTIVITY_TYPE_VALUES.join(", ")}.`,
  dayTrips: "Same-day excursions from a stop that return in the evening. Use an empty array when there are none.",
  "dayTrips.destination": "Place visited, e.g. 'Sintra'.",
  "dayTrips.lat": "Latitude of the destination.",
  "dayTrips.lng": "Longitude of the destination.",
  "dayTrips.duration": "Length in DAYS, usually 0.5 or 0.75, never more than 1.",
};

const describeSchema = (node: unknown, path: string): unknown => {
  if (Array.isArray(node)) return node.map((entry) => describeSchema(entry, path));
  if (!isRecord(node)) return node;
  const copy: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (key === "properties" && isRecord(value)) {
      copy.properties = Object.fromEntries(Object.entries(value).map(([name, child]) => {
        const childPath = path ? `${path}.${name}` : name;
        const described = describeSchema(child, childPath) as Record<string, unknown>;
        const description = FIELD_DESCRIPTIONS[childPath];
        return [name, description ? { ...described, description } : described];
      }));
    } else if (key === "items") {
      copy.items = describeSchema(value, path);
    } else {
      copy[key] = describeSchema(value, path);
    }
  }
  return copy;
};

/** The itinerary schema with field descriptions for assistants. Same constraints as the generator's. */
export const TRIP_DRAFT_ITINERARY_JSON_SCHEMA = describeSchema(TRIP_ITINERARY_JSON_SCHEMA, "") as Record<string, unknown>;

export const TRIP_DRAFT_REQUEST_JSON_SCHEMA: Record<string, unknown> = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "TravelFlow trip draft request",
  type: "object",
  additionalProperties: false,
  properties: {
    trip: {
      ...TRIP_DRAFT_ITINERARY_JSON_SCHEMA,
      description: `The itinerary, in TravelFlow's ${TRIP_ITINERARY_SCHEMA_NAME} format.`,
    },
    startDate: {
      type: "string",
      format: "date",
      description: "First day of the trip, YYYY-MM-DD. Defaults to 30 days from today.",
    },
    roundTrip: {
      type: "boolean",
      description: "True when the trip ends back in the first city. Do not repeat that city in cities; add the return leg to travelSegments.",
    },
    client: {
      type: "object",
      additionalProperties: false,
      description: "Who is calling, for TravelFlow's statistics. Optional.",
      properties: {
        name: { type: "string", maxLength: 80, description: "Assistant or app name, e.g. 'chatgpt', 'claude'." },
        model: { type: "string", maxLength: 80, description: "Model name, if known." },
      },
    },
  },
  required: ["trip"],
};

export const TRIP_DRAFT_RULES: readonly string[] = [
  "Send the itinerary as `trip` inside the request; every object must contain exactly the listed fields, no extras.",
  "cities[].days counts nights and must be a positive whole number. Total trip length = sum of days.",
  "travelSegments has exactly cities.length - 1 legs in order (cities.length legs when roundTrip is true). duration is in HOURS.",
  "activities[].cityIndex points into cities (0-based). dayOffsetInCity < that city's days, and dayOffsetInCity + duration <= days. duration is in DAYS (0.125, 0.25, 0.5).",
  "Descriptions are single lines: activities at most 90 characters, recommendation entries at most 80, headsUp at most 120.",
  "Use real coordinates (lat/lng) for every city and day trip, and uppercase ISO alpha-2 country codes.",
  "countryInfo describes the main country; all seven fields are required. exchangeRate is local units per 1 EUR.",
  "Call validate first if unsure: it returns a precise list of errors and stores nothing.",
  "The response contains a link. Give it to the traveller: they can view the plan right away and save it to their TravelFlow account to edit it.",
  "TravelFlow does not generate trips for you here; plan the trip yourself, then send it.",
];

const exampleRecommendations = (mustSee: string[], mustTry: string[], mustDo: string[], headsUp: string[] = []) => ({ mustSee, mustTry, mustDo, headsUp });

export const TRIP_DRAFT_EXAMPLE_REQUEST = {
  startDate: "2027-05-03",
  roundTrip: false,
  client: { name: "example", model: "none" },
  trip: {
    tripTitle: "Portugal: Lisbon to Porto",
    countryInfo: {
      currencyCode: "EUR",
      currencyName: "Euro",
      exchangeRate: 1,
      languages: ["Portuguese"],
      electricSockets: "Type C, Type F",
      visaInfoUrl: "https://en.wikipedia.org/wiki/Visa_policy_of_Portugal",
      auswaertigesAmtUrl: "https://www.auswaertiges-amt.de/de/service/laender/portugal-node",
    },
    cities: [
      {
        name: "Lisbon",
        days: 4,
        recommendations: exampleRecommendations(
          ["Belém Tower", "Alfama", "Jerónimos Monastery"],
          ["Pastel de nata", "Bifana", "Ginjinha"],
          ["Ride tram 28", "Sunset at a miradouro", "Fado night"],
          ["Steep, slippery cobblestones"],
        ),
        countryCode: "PT",
        lat: 38.7223,
        lng: -9.1393,
      },
      {
        name: "Porto",
        days: 3,
        recommendations: exampleRecommendations(
          ["Ribeira", "Livraria Lello", "Dom Luís I Bridge"],
          ["Francesinha", "Port wine", "Grilled sardines"],
          ["Port cellar tour in Gaia", "Douro river cruise", "Walk the Ribeira at dusk"],
        ),
        countryCode: "PT",
        lat: 41.1579,
        lng: -8.6291,
      },
    ],
    travelSegments: [{ transportMode: "train", duration: 3 }],
    activities: [
      { title: "Alfama walk", cityIndex: 0, dayOffsetInCity: 0, duration: 0.25, description: "Lanes, viewpoints and the castle above the old town.", activityTypes: ["culture", "sightseeing"] },
      { title: "Belém", cityIndex: 0, dayOffsetInCity: 1, duration: 0.5, description: "Monastery, tower and the original pastéis de Belém.", activityTypes: ["culture", "food"] },
      { title: "LX Factory", cityIndex: 0, dayOffsetInCity: 3, duration: 0.25, description: "Creative hub with shops, cafés and a huge bookshop.", activityTypes: ["shopping"] },
      { title: "Gaia cellars", cityIndex: 1, dayOffsetInCity: 0, duration: 0.25, description: "Port tasting across the river from Ribeira.", activityTypes: ["food", "culture"] },
      { title: "Douro cruise", cityIndex: 1, dayOffsetInCity: 1, duration: 0.25, description: "Six bridges cruise on the Douro.", activityTypes: ["sightseeing"] },
    ],
    dayTrips: [
      { title: "Sintra", cityIndex: 0, dayOffsetInCity: 2, duration: 0.75, destination: "Sintra", lat: 38.7975, lng: -9.3906, description: "Pena Palace and Quinta da Regaleira in the hills.", activityTypes: ["culture", "nature"] },
    ],
  },
} as const;

export interface TripDraftSchemaDocument {
  name: string;
  version: string;
  description: string;
  endpoints: Record<string, string>;
  rules: readonly string[];
  requestSchema: Record<string, unknown>;
  example: typeof TRIP_DRAFT_EXAMPLE_REQUEST;
  limits: typeof TRIP_DRAFT_LIMITS;
}

export const buildTripDraftSchemaDocument = (origin: string): TripDraftSchemaDocument => ({
  name: "travelflow-trip-draft",
  version: TRIP_ITINERARY_SCHEMA_NAME,
  description: "Plan a trip yourself and send it to TravelFlow. TravelFlow validates it, stores it as a draft and returns a link the traveller can open and save to their account. TravelFlow does not run any AI for this request.",
  endpoints: {
    schema: `${origin}/api/trip-drafts/schema`,
    validate: `POST ${origin}/api/trip-drafts/validate`,
    create: `POST ${origin}/api/trip-drafts`,
    read: `GET ${origin}/api/trip-drafts/{draftId}`,
    openapi: `${origin}/api/trip-drafts/openapi.json`,
    mcp: `${origin}/api/mcp`,
    pasteFallback: `${origin}/import-trip`,
  },
  rules: TRIP_DRAFT_RULES,
  requestSchema: TRIP_DRAFT_REQUEST_JSON_SCHEMA,
  example: TRIP_DRAFT_EXAMPLE_REQUEST,
  limits: TRIP_DRAFT_LIMITS,
});

export const buildTripDraftUrl = (origin: string, draftId: string): string => `${origin.replace(/\/+$/, "")}/draft/${draftId}`;
