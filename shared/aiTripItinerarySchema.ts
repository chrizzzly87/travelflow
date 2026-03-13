import type { ActivityType } from "../types";
import { MODEL_TRANSPORT_MODE_VALUES } from "./transportModes";

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

const ACTIVITY_TYPE_VALUES = [
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

const CITY_DESCRIPTION_REQUIRED_SECTIONS_PATTERN =
  "(?=[\\s\\S]*###\\s*Must\\s*See)(?=[\\s\\S]*###\\s*Must\\s*Try)(?=[\\s\\S]*###\\s*Must\\s*Do)[\\s\\S]*";

export const TRIP_ITINERARY_SCHEMA_NAME = "travelflow_trip_itinerary_v1";

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
    days: { type: "number", minimum: 0 },
    description: {
      type: "string",
      minLength: 1,
      pattern: CITY_DESCRIPTION_REQUIRED_SECTIONS_PATTERN,
    },
    lat: { type: "number", minimum: -90, maximum: 90 },
    lng: { type: "number", minimum: -180, maximum: 180 },
  },
  required: ["name", "days", "description", "lat", "lng"],
} as const;

const tripTravelSegmentJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    fromCityIndex: { type: "integer", minimum: 0 },
    toCityIndex: { type: "integer", minimum: 0 },
    transportMode: { type: "string", enum: [...MODEL_TRANSPORT_MODE_VALUES] },
    description: { type: "string", minLength: 1, maxLength: 60 },
    duration: { type: "number", exclusiveMinimum: 0 },
  },
  required: ["fromCityIndex", "toCityIndex", "transportMode", "description", "duration"],
} as const;

const tripActivityJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string", minLength: 1 },
    cityIndex: { type: "integer", minimum: 0 },
    dayOffsetInCity: { type: "number", minimum: 0 },
    duration: { type: "number", exclusiveMinimum: 0 },
    description: { type: "string", minLength: 1, maxLength: 90 },
    activityTypes: {
      type: "array",
      minItems: 1,
      maxItems: 3,
      items: { type: "string", enum: [...ACTIVITY_TYPE_VALUES] },
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
          days: { type: Type.NUMBER, description: "Number of days to stay" },
          description: { type: Type.STRING, description: "Markdown text that MUST contain 3 sections: '### Must See', '### Must Try', and '### Must Do' with checkbox lists." },
          lat: { type: Type.NUMBER, description: "Latitude of the city center" },
          lng: { type: Type.NUMBER, description: "Longitude of the city center" },
        },
        required: ["name", "days", "description", "lat", "lng"],
      },
    },
    travelSegments: {
      type: Type.ARRAY,
      description: "Transport between cities",
      items: {
        type: Type.OBJECT,
        properties: {
          fromCityIndex: { type: Type.NUMBER },
          toCityIndex: { type: Type.NUMBER },
          transportMode: { type: Type.STRING, enum: [...MODEL_TRANSPORT_MODE_VALUES] },
          description: { type: Type.STRING, description: "e.g. 2h Flight" },
          duration: { type: Type.NUMBER, description: "Duration in hours (e.g. 1.5 for 1h 30m)" },
        },
        required: ["fromCityIndex", "toCityIndex", "transportMode", "description", "duration"],
      },
    },
    activities: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          cityIndex: { type: Type.NUMBER, description: "Index of the city this activity belongs to (0-based)" },
          dayOffsetInCity: { type: Type.NUMBER, description: "Day number within the city stay (starts at 0)" },
          duration: { type: Type.NUMBER, description: "Duration in days (usually 1)" },
          description: { type: Type.STRING },
          activityTypes: {
            type: Type.ARRAY,
            description: "Array with 1-3 activity types chosen only from the allowed list.",
            items: { type: Type.STRING, enum: [...ACTIVITY_TYPE_VALUES] },
          },
        },
        required: ["title", "cityIndex", "dayOffsetInCity", "duration", "description", "activityTypes"],
      },
    },
  },
  required: ["tripTitle", "cities", "activities", "travelSegments", "countryInfo"],
});
