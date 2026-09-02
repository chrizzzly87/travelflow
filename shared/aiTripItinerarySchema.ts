import type { ActivityType } from "../types.ts";
import { MODEL_TRANSPORT_MODE_VALUES } from "./transportModes.ts";

export interface StructuredOutputJsonSchema {
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
}

interface GeminiSchemaTypeBag<TValue extends string | number> {
  OBJECT: TValue;
  ARRAY: TValue;
  STRING: TValue;
  NUMBER: TValue;
}

export const TRIP_ITINERARY_ACTIVITY_TYPE_VALUES = [
  "general",
  "food",
  "culture",
  "sightseeing",
  "relaxation",
  "nightlife",
  "sports",
  "hiking",
  "wildlife",
  "shopping",
  "adventure",
  "beach",
  "nature",
] as const satisfies readonly ActivityType[];

export const TRIP_ITINERARY_SCHEMA_NAME = "travelflow_trip_plan_v3";

const tripCountryInfoJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    currencyCode: { type: "string", minLength: 1 },
    currencyName: { type: "string", minLength: 1 },
    exchangeRate: { type: "number", exclusiveMinimum: 0 },
    languages: {
      type: "array",
      minItems: 1,
      items: { type: "string", minLength: 1 },
    },
    electricSockets: { type: "string", minLength: 1 },
    visaInfoUrl: { type: "string", minLength: 1 },
    auswaertigesAmtUrl: { type: "string", minLength: 1 },
  },
  required: [
    "currencyCode",
    "currencyName",
    "exchangeRate",
    "languages",
    "electricSockets",
    "visaInfoUrl",
    "auswaertigesAmtUrl",
  ],
} as const;

const tripCityJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    name: { type: "string", minLength: 1 },
    days: { type: "integer", minimum: 0 },
    recommendations: {
      type: "object",
      additionalProperties: false,
      properties: {
        mustSee: { type: "array", minItems: 3, maxItems: 4, items: { type: "string", minLength: 1, maxLength: 80 } },
        mustTry: { type: "array", minItems: 3, maxItems: 4, items: { type: "string", minLength: 1, maxLength: 80 } },
        mustDo: { type: "array", minItems: 3, maxItems: 4, items: { type: "string", minLength: 1, maxLength: 80 } },
        headsUp: { type: "array", maxItems: 2, items: { type: "string", minLength: 1, maxLength: 120 } },
      },
      required: ["mustSee", "mustTry", "mustDo", "headsUp"],
    },
    countryCode: { type: "string", pattern: "^[A-Z]{2}$" },
    lat: { type: "number", minimum: -90, maximum: 90 },
    lng: { type: "number", minimum: -180, maximum: 180 },
  },
  required: ["name", "days", "recommendations", "countryCode", "lat", "lng"],
} as const;

const tripTravelSegmentJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    transportMode: { type: "string", enum: [...MODEL_TRANSPORT_MODE_VALUES] },
    duration: { type: "number", exclusiveMinimum: 0 },
  },
  required: ["transportMode", "duration"],
} as const;

const tripActivityJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string", minLength: 1 },
    cityIndex: { type: "integer", minimum: 0 },
    dayOffsetInCity: { type: "number", minimum: 0, description: "Day offset within the city; offset plus duration must not exceed city days." },
    duration: { type: "number", exclusiveMinimum: 0, description: "Duration in days, typically 0.125, 0.25, or 0.5; must fit within the city stay." },
    description: { type: "string", minLength: 1, maxLength: 90 },
    activityTypes: {
      type: "array",
      minItems: 1,
      maxItems: 3,
      items: { type: "string", enum: [...TRIP_ITINERARY_ACTIVITY_TYPE_VALUES] },
    },
  },
  required: ["title", "cityIndex", "dayOffsetInCity", "duration", "description", "activityTypes"],
} as const;

export const TRIP_ITINERARY_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    tripTitle: { type: "string", minLength: 1, maxLength: 80 },
    countryInfo: tripCountryInfoJsonSchema,
    cities: {
      type: "array",
      minItems: 1,
      items: tripCityJsonSchema,
    },
    travelSegments: {
      type: "array",
      items: tripTravelSegmentJsonSchema,
    },
    activities: {
      type: "array",
      items: tripActivityJsonSchema,
    },
  },
  required: ["tripTitle", "countryInfo", "cities", "travelSegments", "activities"],
} as const satisfies Record<string, unknown>;

export const TRIP_ITINERARY_STRUCTURED_OUTPUT_SCHEMA: StructuredOutputJsonSchema = {
  name: TRIP_ITINERARY_SCHEMA_NAME,
  schema: TRIP_ITINERARY_JSON_SCHEMA,
  strict: true,
};

const createCompactTripItineraryJsonSchema = (): Record<string, unknown> => {
  const schema = JSON.parse(JSON.stringify(TRIP_ITINERARY_JSON_SCHEMA)) as Record<string, unknown>;
  const rootProperties = schema.properties as Record<string, unknown>;
  const cityArray = rootProperties.cities as Record<string, unknown>;
  const city = cityArray.items as Record<string, unknown>;
  const cityProperties = city.properties as Record<string, unknown>;
  const recommendations = cityProperties.recommendations as Record<string, unknown>;
  const recommendationProperties = recommendations.properties as Record<string, Record<string, unknown>>;
  for (const key of ["mustSee", "mustTry", "mustDo"]) recommendationProperties[key].minItems = 1;
  return schema;
};

export const TRIP_ITINERARY_COMPACT_JSON_SCHEMA = createCompactTripItineraryJsonSchema();

export const TRIP_ITINERARY_COMPACT_STRUCTURED_OUTPUT_SCHEMA: StructuredOutputJsonSchema = {
  name: `${TRIP_ITINERARY_SCHEMA_NAME}_compact`,
  schema: TRIP_ITINERARY_COMPACT_JSON_SCHEMA,
  strict: true,
};

export const TRIP_ITINERARY_SCHEDULE_REPAIR_STRUCTURED_OUTPUT_SCHEMA: StructuredOutputJsonSchema = {
  name: `${TRIP_ITINERARY_SCHEMA_NAME}_schedule_repair`,
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      travelSegments: {
        type: "array",
        items: tripTravelSegmentJsonSchema,
      },
      activitySchedules: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            activityIndex: { type: "integer", minimum: 0 },
            cityIndex: { type: "integer", minimum: 0 },
            dayOffsetInCity: { type: "number", minimum: 0 },
            duration: { type: "number", exclusiveMinimum: 0 },
          },
          required: ["activityIndex", "cityIndex", "dayOffsetInCity", "duration"],
        },
      },
    },
    required: ["travelSegments", "activitySchedules"],
  },
};

export const createGeminiTripItineraryResponseSchema = <TValue extends string | number>(
  Type: GeminiSchemaTypeBag<TValue>,
) => ({
  type: Type.OBJECT,
  properties: {
    tripTitle: { type: Type.STRING },
    countryInfo: {
      type: Type.OBJECT,
      properties: {
        currencyCode: { type: Type.STRING, description: "ISO code, e.g. JPY" },
        currencyName: { type: Type.STRING, description: "e.g. Japanese Yen" },
        exchangeRate: { type: Type.NUMBER, description: "Number only: local currency units for exactly 1 EUR (example: 163)" },
        languages: { type: Type.ARRAY, items: { type: Type.STRING } },
        electricSockets: { type: Type.STRING, description: "Short description of socket types, e.g. 'Type A, Type B'" },
        visaInfoUrl: { type: Type.STRING, description: "Generic URL to visa policy on Wikipedia or official gov site" },
        auswaertigesAmtUrl: { type: Type.STRING, description: "URL to the country page on auswaertiges-amt.de" },
      },
      required: ["currencyCode", "currencyName", "exchangeRate", "languages", "electricSockets", "visaInfoUrl", "auswaertigesAmtUrl"],
    },
    cities: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          days: { type: Type.NUMBER, description: "Number of nights to stay in this stop" },
          recommendations: {
            type: Type.OBJECT,
            properties: {
              mustSee: { type: Type.ARRAY, items: { type: Type.STRING } },
              mustTry: { type: Type.ARRAY, items: { type: Type.STRING } },
              mustDo: { type: Type.ARRAY, items: { type: Type.STRING } },
              headsUp: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ["mustSee", "mustTry", "mustDo", "headsUp"],
          },
          countryCode: { type: Type.STRING, description: "ISO 3166-1 alpha-2 country code in uppercase, e.g. ES" },
          lat: { type: Type.NUMBER, description: "Latitude of the city center" },
          lng: { type: Type.NUMBER, description: "Longitude of the city center" },
        },
        required: ["name", "days", "recommendations", "countryCode", "lat", "lng"],
      },
    },
    travelSegments: {
      type: Type.ARRAY,
      description: "Transport between cities",
      items: {
        type: Type.OBJECT,
        properties: {
          transportMode: { type: Type.STRING, enum: [...MODEL_TRANSPORT_MODE_VALUES] },
          duration: { type: Type.NUMBER, description: "Duration in hours (e.g. 1.5 for 1h 30m)" },
        },
        required: ["transportMode", "duration"],
      },
    },
    activities: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          cityIndex: { type: Type.NUMBER, description: "Index of the city this activity belongs to (0-based)" },
          dayOffsetInCity: { type: Type.NUMBER, description: "Day offset within the city; offset plus duration must not exceed city days" },
          duration: { type: Type.NUMBER, description: "Duration in days, typically 0.125, 0.25, or 0.5; must fit within the city stay" },
          description: { type: Type.STRING },
          activityTypes: {
            type: Type.ARRAY,
            description: "Array with 1-3 activity types chosen only from the allowed list.",
            items: { type: Type.STRING, enum: [...TRIP_ITINERARY_ACTIVITY_TYPE_VALUES] },
          },
        },
        required: ["title", "cityIndex", "dayOffsetInCity", "duration", "description", "activityTypes"],
      },
    },
  },
  required: ["tripTitle", "cities", "activities", "travelSegments", "countryInfo"],
});
