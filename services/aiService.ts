import { GoogleGenAI, Type } from "@google/genai";
import { ICoordinates, ITimelineItem, ITrip, TripGenerationAttemptSummary, TripGenerationFlow, TripGenerationFailureKind } from "../types";
import type { AiProviderId } from "../config/aiProviderCatalog";
import { getDefaultCreateTripModel } from "../config/aiModelCatalog";
import { buildDurationPromptGuidance, parseFlexibleDurationDays, parseFlexibleDurationHours } from "../shared/durationParsing";
import { buildTransportModePromptGuidance, MODEL_TRANSPORT_MODE_VALUES, normalizeTransportMode } from "../shared/transportModes";
import type {
    CreateTripPreferenceSignals,
    CreateTripTransportPreference,
    CreateTripTravelerDetails,
    CreateTripTravelerType,
} from "../shared/createTripPreferences";
import {
    ALL_ACTIVITY_TYPES,
    applyCityPaletteToItems,
    DEFAULT_CITY_COLOR_PALETTE_ID,
    DEFAULT_MAP_COLOR_MODE,
    getActivityColorByTypes,
    getNormalizedCityName,
    getRandomCityColor,
    normalizeCityColors,
    TRAVEL_COLOR,
    getGeminiApiKey,
    normalizeActivityTypes,
    generateTripId,
} from "../utils";
import { trackEvent } from "./analyticsService";

/**
 * ==============================================================================
 * CRITICAL CONFIGURATION
 * ==============================================================================
 * The API Key retrieval logic has been centralized in `utils.ts` to ensure
 * consistency across the application.
 * ==============================================================================
 */

const ACTIVITY_TYPE_ENUM = [...ALL_ACTIVITY_TYPES];
const ACTIVITY_TYPES_PROMPT_LIST = ACTIVITY_TYPE_ENUM.join(", ");
const TRANSPORT_MODE_ENUM = [...MODEL_TRANSPORT_MODE_VALUES];
const TRANSPORT_MODES_PROMPT_LIST = TRANSPORT_MODE_ENUM.join(", ");
const TRANSPORT_MODE_PROMPT_GUIDANCE = buildTransportModePromptGuidance();
const DURATION_PROMPT_GUIDANCE = buildDurationPromptGuidance();
const DEFAULT_CREATE_TRIP_MODEL = getDefaultCreateTripModel();
const DEFAULT_PROVIDER = DEFAULT_CREATE_TRIP_MODEL.provider;
const DEFAULT_MODEL = DEFAULT_CREATE_TRIP_MODEL.model;

const itinerarySchema = {
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
            auswaertigesAmtUrl: { type: Type.STRING, description: "URL to the country page on auswaertiges-amt.de" }
        },
        required: ["currencyCode", "currencyName", "exchangeRate", "languages", "electricSockets"]
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
            transportMode: { type: Type.STRING, enum: TRANSPORT_MODE_ENUM },
            description: { type: Type.STRING, description: "e.g. 2h Flight" },
            duration: { type: Type.NUMBER, description: "Duration in hours (e.g. 1.5 for 1h 30m)" }
        },
        required: ["fromCityIndex", "toCityIndex", "transportMode", "description", "duration"]
      }
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
              items: { type: Type.STRING, enum: ACTIVITY_TYPE_ENUM }
          },
          type: { 
              type: Type.STRING, 
              enum: ACTIVITY_TYPE_ENUM
          },
        },
        required: ["title", "cityIndex", "dayOffsetInCity", "duration", "description", "activityTypes"],
      },
    },
  },
  required: ["tripTitle", "cities", "activities", "travelSegments", "countryInfo"],
};

const activityDetailsSchema = {
    type: Type.OBJECT,
    properties: {
        cost: { type: Type.STRING, description: "Estimated cost, e.g. '$20' or 'Free'" },
        bestTime: { type: Type.STRING, description: "Best time of day to visit" },
        tips: { type: Type.STRING, description: "Practical tip for visitors" },
        activityTypes: {
            type: Type.ARRAY,
            items: { type: Type.STRING, enum: ACTIVITY_TYPE_ENUM }
        },
        type: { 
            type: Type.STRING, 
            enum: ACTIVITY_TYPE_ENUM
        }
    },
    required: ["cost", "bestTime", "tips", "type"]
};

const activityProposalsSchema = {
    type: Type.ARRAY,
    items: {
        type: Type.OBJECT,
        properties: {
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            cost: { type: Type.STRING },
            bestTime: { type: Type.STRING },
            tips: { type: Type.STRING },
            activityTypes: {
                type: Type.ARRAY,
                items: { type: Type.STRING, enum: ACTIVITY_TYPE_ENUM }
            },
            type: { 
                type: Type.STRING, 
                enum: ACTIVITY_TYPE_ENUM
            }
        },
        required: ["title", "description", "cost", "bestTime", "tips", "activityTypes"]
    }
};

const cityNotesSchema = {
    type: Type.OBJECT,
    properties: {
        notes: { type: Type.STRING, description: "Markdown text with checkboxes for Must See, Must Try (Foods), and Must Do." }
    },
    required: ["notes"]
};

export interface GenerateOptions extends CreateTripPreferenceSignals {
    roundTrip?: boolean;
    totalDays?: number;
    numCities?: number;
    budget?: string;
    pace?: string;
    interests?: string[];
    aiTarget?: {
        provider: AiProviderId;
        model: string;
    };
    promptMode?: 'default' | 'benchmark_compact';
    generationContext?: TripGenerationRequestContext;
}

export interface WizardGenerateOptions extends CreateTripPreferenceSignals {
    countries: string[];
    startDate?: string;
    endDate?: string;
    roundTrip?: boolean;
    totalDays?: number;
    budget?: string;
    pace?: string;
    interests?: string[];
    travelStyles?: string[];
    travelVibes?: string[];
    travelLogistics?: string[];
    aiTarget?: {
        provider: AiProviderId;
        model: string;
    };
    promptMode?: GenerateOptions['promptMode'];
    generationContext?: TripGenerationRequestContext;
}

export interface SurpriseGenerateOptions {
    country: string;
    startDate?: string;
    endDate?: string;
    totalDays?: number;
    monthLabels?: string[];
    durationWeeks?: number;
    seasonalEvents?: string[];
    notes?: string;
    aiTarget?: {
        provider: AiProviderId;
        model: string;
    };
    generationContext?: TripGenerationRequestContext;
}

export interface TripGenerationRequestContext {
    requestId?: string;
    tripId?: string;
    attemptId?: string;
    flow?: TripGenerationFlow;
    source?: string;
    retryOfAttemptId?: string;
}

type ActiveGenerationAbortControllerMap = Map<string, AbortController>;

const ACTIVE_GENERATION_ABORT_CONTROLLERS_BY_TRIP_ID: ActiveGenerationAbortControllerMap = new Map();
const ACTIVE_GENERATION_ABORT_CONTROLLERS_BY_REQUEST_ID: ActiveGenerationAbortControllerMap = new Map();

const registerActiveGenerationAbortController = (
    context: TripGenerationRequestContext | undefined,
    controller: AbortController | null,
): (() => void) => {
    if (!controller) return () => {};
    const tripId = typeof context?.tripId === 'string' ? context.tripId.trim() : '';
    const requestId = typeof context?.requestId === 'string' ? context.requestId.trim() : '';

    if (!tripId && !requestId) return () => {};

    if (tripId) {
        const previous = ACTIVE_GENERATION_ABORT_CONTROLLERS_BY_TRIP_ID.get(tripId);
        if (previous && previous !== controller) {
            previous.abort('superseded');
        }
        ACTIVE_GENERATION_ABORT_CONTROLLERS_BY_TRIP_ID.set(tripId, controller);
    }
    if (requestId) {
        const previous = ACTIVE_GENERATION_ABORT_CONTROLLERS_BY_REQUEST_ID.get(requestId);
        if (previous && previous !== controller) {
            previous.abort('superseded');
        }
        ACTIVE_GENERATION_ABORT_CONTROLLERS_BY_REQUEST_ID.set(requestId, controller);
    }

    return () => {
        if (tripId && ACTIVE_GENERATION_ABORT_CONTROLLERS_BY_TRIP_ID.get(tripId) === controller) {
            ACTIVE_GENERATION_ABORT_CONTROLLERS_BY_TRIP_ID.delete(tripId);
        }
        if (requestId && ACTIVE_GENERATION_ABORT_CONTROLLERS_BY_REQUEST_ID.get(requestId) === controller) {
            ACTIVE_GENERATION_ABORT_CONTROLLERS_BY_REQUEST_ID.delete(requestId);
        }
    };
};

export const abortActiveTripGenerationRequest = (params: {
    tripId?: string | null;
    requestId?: string | null;
    reason?: string;
}): boolean => {
    const requestId = typeof params.requestId === 'string' ? params.requestId.trim() : '';
    const tripId = typeof params.tripId === 'string' ? params.tripId.trim() : '';
    const reason = (typeof params.reason === 'string' && params.reason.trim()) ? params.reason.trim() : 'user_abort';
    const byRequest = requestId ? ACTIVE_GENERATION_ABORT_CONTROLLERS_BY_REQUEST_ID.get(requestId) : null;
    const byTrip = tripId ? ACTIVE_GENERATION_ABORT_CONTROLLERS_BY_TRIP_ID.get(tripId) : null;
    const controller = byRequest || byTrip || null;
    if (!controller) return false;
    controller.abort(reason);
    return true;
};

export class TripGenerationError extends Error {
    code: string | null;
    status: number | null;
    details: string | null;
    requestId: string | null;
    durationMs: number | null;
    provider: string | null;
    model: string | null;
    providerModel: string | null;
    failureKind: TripGenerationFailureKind | null;
    aborted: boolean;
    requestPayload: Record<string, unknown> | null;

    constructor(message: string, details?: {
        code?: string | null;
        status?: number | null;
        details?: string | null;
        requestId?: string | null;
        durationMs?: number | null;
        provider?: string | null;
        model?: string | null;
        providerModel?: string | null;
        failureKind?: TripGenerationFailureKind | null;
        aborted?: boolean;
        requestPayload?: Record<string, unknown> | null;
    }) {
        super(message);
        this.name = 'TripGenerationError';
        this.code = details?.code ?? null;
        this.status = details?.status ?? null;
        this.details = details?.details ?? null;
        this.requestId = details?.requestId ?? null;
        this.durationMs = details?.durationMs ?? null;
        this.provider = details?.provider ?? null;
        this.model = details?.model ?? null;
        this.providerModel = details?.providerModel ?? null;
        this.failureKind = details?.failureKind ?? null;
        this.aborted = details?.aborted === true;
        this.requestPayload = details?.requestPayload ?? null;
    }
}

interface ParsedCityStop {
    name: string;
    days: number;
    description: string;
    coordinates?: ICoordinates;
    sourceIndex: number;
}

export type CityNotesEnhancementMode =
    | 'expand-checklists'
    | 'local-tips'
    | 'day-plan';

const BASE_ITINERARY_RULES_PROMPT = `
      Return a list of consecutive cities/stops.
      Important Rules for complex trips:
      1. Provide accurate Latitude and Longitude for each city/stop.
      2. Treat multi-day excursions (like treks, cruises, jungle expeditions, or hikes) as separate 'cities/stops' with their own duration (days) and coordinates.
      3. For EACH city description, you MUST include these exact markdown sections:
         ### Must See (3-4 items)
         ### Must Try (3-4 local foods)
         ### Must Do (3-4 activities)
         If needed, you MAY add an additional final section named "### Heads Up" with 1-2 concise practical cautions.
         Use - [ ] for all items to make them checkboxes.
      4. Provide Country Info (Currency, Exchange Rate to EUR, Languages, Sockets, Visa Link, Auswärtiges Amt Link).
         - countryInfo MUST be a single OBJECT (not an array, not a map keyed by country code).
         - Required keys inside countryInfo: currency, exchangeRate, languages, sockets, visaLink, auswaertigesAmtLink.
         - languages MUST be an ARRAY of strings.
         - countryInfo.exchangeRate MUST be a NUMBER only (local currency units for 1 EUR).
         - Valid example: "exchangeRate": 163
         - Invalid example: "exchangeRateToEUR": "1 EUR ≈ 160 JPY"
         - Do NOT include text, units, symbols, or approximation words in exchangeRate.
      5. For EVERY activity, you MUST return "activityTypes" as an array with 1-3 values ONLY from this list:
         [${ACTIVITY_TYPES_PROMPT_LIST}]
         Do not return unknown activity types and do not leave activityTypes empty.
      6. For EVERY travel segment, you MUST return "transportMode" in lowercase from:
         [${TRANSPORT_MODES_PROMPT_LIST}]
      7. Follow strict duration formatting.
         ${DURATION_PROMPT_GUIDANCE.trim()}
      ${TRANSPORT_MODE_PROMPT_GUIDANCE.trim()}
    `;

const BASE_ITINERARY_RULES_PROMPT_COMPACT = `
      Return a concise list of consecutive cities/stops.
      Important Rules for compact benchmark output:
      1. Provide accurate Latitude and Longitude for each city/stop.
      2. Treat multi-day excursions (like treks, cruises, jungle expeditions, or hikes) as separate 'cities/stops' with their own duration (days) and coordinates.
      3. For EACH city description, you MUST include these exact markdown sections:
         ### Must See
         ### Must Try
         ### Must Do
         If needed, you MAY add an additional final section named "### Heads Up" with 1 concise practical caution.
         Use - [ ] checkboxes with exactly 1 bullet per heading. Keep each bullet 3-6 words.
      4. Provide Country Info (Currency, Exchange Rate to EUR, Languages, Sockets, Visa Link, Auswärtiges Amt Link).
         - countryInfo MUST be a single OBJECT (not an array, not a map keyed by country code).
         - Required keys inside countryInfo: currency, exchangeRate, languages, sockets, visaLink, auswaertigesAmtLink.
         - languages MUST be an ARRAY of strings.
         - countryInfo.exchangeRate MUST be a NUMBER only (local currency units for 1 EUR).
      5. For EVERY activity, you MUST return "activityTypes" as an array with 1-3 values ONLY from this list:
         [${ACTIVITY_TYPES_PROMPT_LIST}]
         Do not return unknown activity types and do not leave activityTypes empty.
      6. For EVERY travel segment, you MUST return "transportMode" in lowercase from:
         [${TRANSPORT_MODES_PROMPT_LIST}]
      7. Follow strict duration formatting.
         ${DURATION_PROMPT_GUIDANCE.trim()}
      ${TRANSPORT_MODE_PROMPT_GUIDANCE.trim()}
    `;

const STRICT_JSON_OBJECT_CONTRACT_PROMPT = `
      Output contract requirements (must be strictly followed):
      1. Return ONLY a single JSON object. Do NOT return an array as top-level output.
      2. Do NOT include markdown code fences.
      3. The root object MUST include exactly these keys:
         - tripTitle
         - countryInfo
         - cities
         - travelSegments
         - activities
      4. "cities" must be an array of objects with:
         - name
         - days
         - description
         - lat
         - lng
      5. "travelSegments" must be an array (can be empty) of objects with:
         - fromCityIndex
         - toCityIndex
         - transportMode
         - description
         - duration
      6. "activities" must be an array (can be empty) of objects with:
         - title
         - cityIndex
         - dayOffsetInCity
         - duration
         - description
         - activityTypes
      7. transportMode must be lowercase and match:
         [${TRANSPORT_MODES_PROMPT_LIST}]
      8. travelSegments.duration must be NUMBER (hours), never a string with units.
      9. activities.duration must be NUMBER (days), never a string with units.
      10. countryInfo.exchangeRate must be NUMBER only (example valid: 163; invalid: "1 EUR ≈ 160 JPY").
      11. Before finalizing your answer, run a self-check:
         - Every city.description contains all three headings: "### Must See", "### Must Try", "### Must Do".
         - Only add "### Heads Up" when a practical warning is genuinely needed.
         - countryInfo is a single object and languages is an array.
         - Return exactly one JSON object and nothing else.
    `;

const BENCHMARK_COMPACT_OUTPUT_PROMPT = `
      Benchmark compact-output mode:
      1. Keep the full JSON concise and valid even under strict timeout budgets.
      2. For EACH city.description, include all required markdown headings, but keep text short:
         - exactly 1 checkbox bullet per heading.
         - each bullet should be short (about 3-6 words; hard max 8 words).
         - city.description must stay under 500 characters total.
      3. Keep travelSegments.description short and practical (hard max 60 characters).
      4. Keep activities concise:
         - activities.description must be a single short sentence (hard max 90 characters, no line breaks).
      5. Keep tripTitle concise (hard max 80 characters).
      6. Prioritize valid complete JSON over extra detail.
    `;

const buildItineraryRulesPrompt = (promptMode: GenerateOptions['promptMode'] | undefined): string => {
    if (promptMode === 'benchmark_compact') {
        return BASE_ITINERARY_RULES_PROMPT_COMPACT;
    }
    return BASE_ITINERARY_RULES_PROMPT;
};

const buildIslandConstraintPrompt = (
    selectedIslandNames: string[] | undefined,
    enforceIslandOnly: boolean | undefined
): string => {
    const islands = (selectedIslandNames || []).map((name) => name.trim()).filter(Boolean);
    if (islands.length === 0) return '';

    let prompt = `Selected island destinations: ${islands.join(', ')}. `;
    if (enforceIslandOnly !== false) {
        prompt += `
        Island-only mode is ON.
        - Treat selected islands as destination boundaries.
        - If exactly one island is selected, all city/stops MUST stay on that same island.
        - If multiple islands are selected, you may use one or more selected islands, but do NOT add mainland or non-selected islands.
        - Do NOT include city/stops outside the selected island set.
        `;
        return prompt;
    }

    prompt += `
    Island-only mode is OFF.
    - Prioritize the selected islands first.
    - Nearby mainland or non-selected islands are allowed only if they clearly improve route quality.
    `;
    return prompt;
};

const CREATE_TRIP_SPECIALIST_POLICY_PROMPT = `
      TravelFlow planning policy:
      - You are a specialized travel agent and trip generator for TravelFlow.
      - Treat traveler setup, style, transport, timing, and notes as real planning constraints, not decoration.
      - Favor realistic sequencing, practical transfer days, and activities that fit the traveler profile.
      - If a user-selected destination creates suitability, safety, or logistics concerns, do NOT silently drop it.
      - Keep requested destinations when possible, adapt the route and recommendations, and add a short practical warning under an optional "### Heads Up" section inside the relevant city.description.
      - When traveler profile and destination fit are clearly in tension, surface it explicitly instead of implying it.
      - For material profile-specific concerns such as LGBTQ+ legal or social restrictions, accessibility problems, or family-unfriendly logistics, add a final "### Heads Up" section to each affected city.description.
    `;

const TRANSPORT_PREFERENCE_LABELS: Record<CreateTripTransportPreference, string> = {
    auto: 'automatic transport choice',
    plane: 'plane',
    car: 'car',
    train: 'train',
    bus: 'bus',
    cycle: 'cycling',
    walk: 'walking',
    camper: 'campervan road trip',
};

const normalizePromptList = (values: Array<string | null | undefined>): string[] => (
    values.map((value) => (typeof value === 'string' ? value.trim() : ''))
        .filter(Boolean)
);

const appendPromptSentence = (buffer: string[], sentence: string | null | undefined): void => {
    const trimmed = typeof sentence === 'string' ? sentence.trim() : '';
    if (!trimmed) return;
    buffer.push(trimmed.endsWith('.') ? trimmed : `${trimmed}.`);
};

const getTripStyleSignals = (options: Pick<WizardGenerateOptions, 'tripStyleTags' | 'travelStyles'>): string[] => (
    normalizePromptList([
        ...(options.tripStyleTags || []),
        ...(options.travelStyles || []),
    ]).filter((value, index, source) => source.indexOf(value) === index)
);

const getTripVibeSignals = (options: Pick<WizardGenerateOptions, 'tripVibeTags' | 'travelVibes'>): string[] => (
    normalizePromptList([
        ...(options.tripVibeTags || []),
        ...(options.travelVibes || []),
    ]).filter((value, index, source) => source.indexOf(value) === index)
);

const getTripLogisticsSignals = (options: Pick<WizardGenerateOptions, 'travelLogistics'>): string[] => (
    normalizePromptList(options.travelLogistics || [])
        .filter((value, index, source) => source.indexOf(value) === index)
);

const describeTravelerProfile = (
    travelerType: CreateTripTravelerType | undefined,
    travelerDetails: CreateTripTravelerDetails | undefined,
): string | null => {
    if (!travelerType) return null;
    const details = travelerDetails || {};

    if (travelerType === 'solo') {
        const descriptors = normalizePromptList([
            details.soloGender,
            details.soloAge ? `${details.soloAge} years old` : null,
            details.soloComfort ? `${details.soloComfort} comfort preference` : null,
        ]);
        return descriptors.length > 0
            ? `Traveler setup: solo traveler (${descriptors.join(', ')})`
            : 'Traveler setup: solo traveler';
    }

    if (travelerType === 'couple') {
        const descriptors = normalizePromptList([
            details.coupleTravelerA ? `traveler A ${details.coupleTravelerA}` : null,
            details.coupleTravelerB ? `traveler B ${details.coupleTravelerB}` : null,
            details.coupleOccasion && details.coupleOccasion !== 'none'
                ? `${details.coupleOccasion} trip`
                : null,
        ]);
        return descriptors.length > 0
            ? `Traveler setup: couple (${descriptors.join(', ')})`
            : 'Traveler setup: couple';
    }

    if (travelerType === 'friends') {
        const descriptors = normalizePromptList([
            typeof details.friendsCount === 'number' ? `${details.friendsCount} travelers` : null,
            details.friendsEnergy ? `${details.friendsEnergy} group energy` : null,
        ]);
        return descriptors.length > 0
            ? `Traveler setup: friends group (${descriptors.join(', ')})`
            : 'Traveler setup: friends group';
    }

    const familyDescriptors = normalizePromptList([
        typeof details.familyAdults === 'number' ? `${details.familyAdults} adults` : null,
        typeof details.familyChildren === 'number' ? `${details.familyChildren} children` : null,
        typeof details.familyBabies === 'number' ? `${details.familyBabies} babies` : null,
    ]);
    return familyDescriptors.length > 0
        ? `Traveler setup: family (${familyDescriptors.join(', ')})`
        : 'Traveler setup: family';
};

const isLgbtqCouple = (
    travelerType: CreateTripTravelerType | undefined,
    travelerDetails: CreateTripTravelerDetails | undefined,
): boolean => {
    if (travelerType !== 'couple') return false;
    const travelerA = travelerDetails?.coupleTravelerA;
    const travelerB = travelerDetails?.coupleTravelerB;

    if (travelerA === 'non-binary' || travelerB === 'non-binary') return true;
    if ((travelerA === 'female' || travelerA === 'male') && travelerA === travelerB) return true;
    return false;
};

const buildTravelerConstraintPrompt = (
    travelerType: CreateTripTravelerType | undefined,
    travelerDetails: CreateTripTravelerDetails | undefined,
): string => {
    if (!travelerType) return '';

    const lines: string[] = [];
    appendPromptSentence(lines, describeTravelerProfile(travelerType, travelerDetails));

    if (travelerType === 'family') {
        const familyChildren = travelerDetails?.familyChildren ?? 0;
        const familyBabies = travelerDetails?.familyBabies ?? 0;
        if (familyChildren > 0 || familyBabies > 0) {
            appendPromptSentence(
                lines,
                'Because children or babies are traveling, avoid long overnight buses, repeated hotel changes, and exhausting multi-hour walking transfers'
            );
            appendPromptSentence(
                lines,
                'Prefer family-friendly cities, gentler pacing, practical meal breaks, and child-suitable activities'
            );
        }
    }

    if (travelerType === 'friends' && travelerDetails?.friendsEnergy === 'chill') {
        appendPromptSentence(lines, 'Favor shared experiences with relaxed pacing over constant transit or back-to-back late nights');
    }

    if (travelerType === 'solo' && travelerDetails?.soloComfort === 'private') {
        appendPromptSentence(lines, 'Prefer calmer neighborhoods, smoother arrivals, and lower-friction logistics over party-heavy routing');
    }

    if (isLgbtqCouple(travelerType, travelerDetails)) {
        appendPromptSentence(
            lines,
            'This appears to be an LGBTQ+ couple, so prefer destinations, neighborhoods, and activities with stronger inclusivity reputations'
        );
        appendPromptSentence(
            lines,
            'If a selected stop may create material legal, social, or safety constraints for this traveler profile, keep it when user-requested but you MUST add a short practical note in a final "### Heads Up" section for that city description'
        );
    }

    return lines.length > 0 ? `${lines.join(' ')} ` : '';
};

const buildRouteConstraintPrompt = (
    options: Pick<GenerateOptions, 'destinationOrder' | 'startDestination' | 'routeLock' | 'specificCities'>,
): string => {
    const lines: string[] = [];
    const destinationOrder = normalizePromptList(options.destinationOrder || []);

    if (destinationOrder.length > 0 && options.routeLock) {
        appendPromptSentence(lines, `Destination order is fixed. Follow this order exactly: ${destinationOrder.join(' -> ')}`);
    } else if (destinationOrder.length > 1) {
        appendPromptSentence(lines, `Selected destination order preference: ${destinationOrder.join(' -> ')}`);
    }

    if (typeof options.startDestination === 'string' && options.startDestination.trim()) {
        appendPromptSentence(lines, `Prefer starting the trip from ${options.startDestination.trim()} when feasible`);
    }

    if (typeof options.specificCities === 'string' && options.specificCities.trim()) {
        appendPromptSentence(lines, `Specific requested cities or stops: ${options.specificCities.trim()}`);
    }

    return lines.length > 0 ? `${lines.join(' ')} ` : '';
};

const buildTimingConstraintPrompt = (
    options: Pick<GenerateOptions, 'dateInputMode' | 'flexWindow' | 'flexWeeks' | 'idealMonths' | 'shoulderMonths' | 'recommendedDurationDays'>,
): string => {
    const lines: string[] = [];

    if (options.dateInputMode === 'flex') {
        if (typeof options.flexWeeks === 'number' && Number.isFinite(options.flexWeeks) && options.flexWeeks > 0) {
            appendPromptSentence(lines, `Dates are flexible and the target trip length is about ${options.flexWeeks} week(s)`);
        } else {
            appendPromptSentence(lines, 'Dates are flexible');
        }

        if (typeof options.flexWindow === 'string' && options.flexWindow.trim()) {
            appendPromptSentence(lines, `Preferred seasonal window: ${options.flexWindow.trim()}`);
        }
    }

    const idealMonths = normalizePromptList(options.idealMonths || []);
    if (idealMonths.length > 0) {
        appendPromptSentence(lines, `Preferred months from season data: ${idealMonths.join(', ')}`);
    }

    const shoulderMonths = normalizePromptList(options.shoulderMonths || []);
    if (shoulderMonths.length > 0) {
        appendPromptSentence(lines, `Backup shoulder months: ${shoulderMonths.join(', ')}`);
    }

    if (typeof options.recommendedDurationDays === 'number' && Number.isFinite(options.recommendedDurationDays) && options.recommendedDurationDays > 0) {
        appendPromptSentence(lines, `Keep pacing aligned to a recommended duration of about ${options.recommendedDurationDays} days`);
    }

    return lines.length > 0 ? `${lines.join(' ')} ` : '';
};

const buildStyleConstraintPrompt = (
    options: Pick<WizardGenerateOptions, 'tripStyleTags' | 'tripVibeTags' | 'travelStyles' | 'travelVibes' | 'travelLogistics'>,
): string => {
    const lines: string[] = [];
    const tripStyles = getTripStyleSignals(options);
    const tripVibes = getTripVibeSignals(options);
    const logisticsSignals = getTripLogisticsSignals(options);

    if (tripStyles.length > 0) {
        appendPromptSentence(lines, `Trip style signals: ${tripStyles.join(', ')}`);
    }
    if (tripVibes.length > 0) {
        appendPromptSentence(lines, `Trip vibe and activity signals: ${tripVibes.join(', ')}`);
    }
    if (logisticsSignals.length > 0) {
        appendPromptSentence(lines, `Logistics preference signals: ${logisticsSignals.join(', ')}`);
    }

    if (tripStyles.length > 0 || tripVibes.length > 0) {
        appendPromptSentence(lines, 'Choose city sequence, pacing, and activities so they clearly reflect these signals');
    }

    return lines.length > 0 ? `${lines.join(' ')} ` : '';
};

const buildTransportConstraintPrompt = (
    transportPreferences: CreateTripTransportPreference[] | undefined,
    hasTransportOverride: boolean | undefined,
    travelerType: CreateTripTravelerType | undefined,
    travelerDetails: CreateTripTravelerDetails | undefined,
): string => {
    const explicitPreferences = (transportPreferences || []).filter((mode) => mode !== 'auto');
    if (!hasTransportOverride && explicitPreferences.length === 0) return '';

    const lines: string[] = [];
    if (explicitPreferences.length > 0) {
        appendPromptSentence(
            lines,
            `Preferred transport modes: ${explicitPreferences.map((mode) => TRANSPORT_PREFERENCE_LABELS[mode]).join(', ')}`
        );
        appendPromptSentence(
            lines,
            'Favor these modes when choosing travelSegments, and only switch away when required for realism, distance, or geography'
        );
    } else {
        appendPromptSentence(lines, 'No fixed transport override is selected, so choose the most practical transport per leg');
    }

    if (explicitPreferences.includes('camper')) {
        appendPromptSentence(
            lines,
            'Camper preference means favor scenic road-trip routing, fewer base changes, and use "car" as the travelSegments.transportMode for campervan legs'
        );
    }

    if (explicitPreferences.includes('cycle')) {
        appendPromptSentence(lines, 'Cycling preference means favor shorter regional hops and avoid unrealistic long-distance bicycle legs');
    }

    if (explicitPreferences.includes('walk')) {
        appendPromptSentence(lines, 'Walking preference means keep the route compact and urban instead of spreading stops far apart');
    }

    if (travelerType === 'family' && (travelerDetails?.familyChildren ?? 0) + (travelerDetails?.familyBabies ?? 0) > 0 && explicitPreferences.includes('bus')) {
        appendPromptSentence(lines, 'Because young travelers are included, avoid extremely long bus days even if bus is preferred');
    }

    return lines.length > 0 ? `${lines.join(' ')} ` : '';
};

const buildPreferenceSignalsPrompt = (
    options: Pick<
        WizardGenerateOptions,
        | 'dateInputMode'
        | 'destinationOrder'
        | 'enforceIslandOnly'
        | 'flexWeeks'
        | 'flexWindow'
        | 'hasTransportOverride'
        | 'idealMonths'
        | 'notes'
        | 'recommendedDurationDays'
        | 'routeLock'
        | 'selectedIslandNames'
        | 'shoulderMonths'
        | 'specificCities'
        | 'startDestination'
        | 'transportPreferences'
        | 'travelerDetails'
        | 'travelerType'
        | 'tripStyleTags'
        | 'tripVibeTags'
        | 'travelLogistics'
        | 'travelStyles'
        | 'travelVibes'
    >,
): string => {
    const prompt = [
        CREATE_TRIP_SPECIALIST_POLICY_PROMPT.trim(),
        buildTravelerConstraintPrompt(options.travelerType, options.travelerDetails).trim(),
        buildStyleConstraintPrompt(options).trim(),
        buildTransportConstraintPrompt(options.transportPreferences, options.hasTransportOverride, options.travelerType, options.travelerDetails).trim(),
        buildTimingConstraintPrompt(options).trim(),
        buildRouteConstraintPrompt({
            destinationOrder: options.destinationOrder,
            startDestination: options.startDestination,
            routeLock: options.routeLock,
            specificCities: options.specificCities,
        }).trim(),
        buildIslandConstraintPrompt(options.selectedIslandNames, options.enforceIslandOnly).trim(),
        options.notes?.trim() ? `Additional traveler notes: ${options.notes.trim()}.` : '',
    ].filter(Boolean).join(' ');

    return prompt ? `${prompt} ` : '';
};

const buildTripFromModelData = (
    data: any,
    startDate?: string,
    options?: Pick<GenerateOptions, 'roundTrip' | 'aiTarget'>
): ITrip => {
    const items: ITimelineItem[] = [];
    let currentDayOffset = 0;
    const cityOffsets: number[] = [];
    const cityDurations: number[] = [];

    const parsedCities: ParsedCityStop[] = (Array.isArray(data.cities) ? data.cities : []).map((city: any, index: number) => {
        const parsedCityDays = Number(city?.days);
        const cityDays = Number.isFinite(parsedCityDays) && parsedCityDays > 0 ? parsedCityDays : 1;
        const cityLat = Number(city?.lat);
        const cityLng = Number(city?.lng);
        const hasCoordinates = Number.isFinite(cityLat) && Number.isFinite(cityLng);

        return {
            name: city?.name || `Stop ${index + 1}`,
            days: cityDays,
            description: city?.description || "",
            coordinates: hasCoordinates ? { lat: cityLat, lng: cityLng } : undefined,
            sourceIndex: index,
        };
    });

    if (options?.roundTrip && parsedCities.length > 0) {
        const firstCity = parsedCities[0];
        const lastCity = parsedCities[parsedCities.length - 1];
        if (getNormalizedCityName(firstCity.name) !== getNormalizedCityName(lastCity.name)) {
            parsedCities.push({
                ...firstCity,
                days: 1,
                sourceIndex: -1,
            });
        }
    }

    parsedCities.forEach((city, index) => {
        cityOffsets[index] = currentDayOffset;
        cityDurations[index] = city.days;

        items.push({
            id: `city-${index}-${Date.now()}`,
            type: 'city',
            title: city.name,
            startDateOffset: currentDayOffset,
            duration: city.days,
            color: getRandomCityColor(index),
            description: city.description,
            location: city.name,
            coordinates: city.coordinates
        });

        if (Array.isArray(data.activities) && city.sourceIndex >= 0) {
            const cityActivities = data.activities.filter((a: any) => Number(a.cityIndex) === city.sourceIndex);
            cityActivities.forEach((act: any, actIndex: number) => {
                const parsedDayOffsetInCity = Number(act.dayOffsetInCity);
                const dayOffsetInCity = Number.isFinite(parsedDayOffsetInCity) ? parsedDayOffsetInCity : 0;
                const parsedDuration = Number(act.duration);
                const parsedDurationDays = parseFlexibleDurationDays(act.duration);
                const activityDuration = Number.isFinite(parsedDurationDays) && (parsedDurationDays as number) > 0
                    ? (parsedDurationDays as number)
                    : (Number.isFinite(parsedDuration) && parsedDuration > 0 ? parsedDuration : 1);
                const activityTypes = normalizeActivityTypes(act.activityTypes ?? act.type);

                items.push({
                    id: `act-${index}-${actIndex}-${Date.now()}`,
                    type: 'activity',
                    title: act.title || "Planned Activity",
                    startDateOffset: currentDayOffset + dayOffsetInCity,
                    duration: activityDuration,
                    color: getActivityColorByTypes(activityTypes),
                    description: act.description || "",
                    location: city.name,
                    activityType: activityTypes
                });
            });
        }

        currentDayOffset += city.days;
    });

    if (Array.isArray(data.travelSegments)) {
        data.travelSegments.forEach((travel: any, index: number) => {
            const fromCityIndex = Number(travel.fromCityIndex);
            const toCityIndex = Number(travel.toCityIndex);

            if (!Number.isFinite(fromCityIndex) || fromCityIndex < 0 || fromCityIndex >= cityOffsets.length) return;

            const startOffset = cityOffsets[fromCityIndex] + (cityDurations[fromCityIndex] || 1) - 0.5;
            const parsedHours = parseFlexibleDurationHours(travel.duration);
            const durationDays = Number.isFinite(parsedHours) && (parsedHours as number) > 0 ? ((parsedHours as number) / 24) : 0.1;

            const fromCityName = parsedCities[fromCityIndex]?.name || 'previous stop';
            const toCityName = Number.isFinite(toCityIndex) && toCityIndex >= 0 && toCityIndex < parsedCities.length
                ? parsedCities[toCityIndex]?.name
                : 'next stop';

            items.push({
                id: `travel-${index}-${Date.now()}`,
                type: 'travel',
                title: travel.description || 'Travel',
                startDateOffset: startOffset,
                duration: durationDays,
                color: TRAVEL_COLOR,
                description: `Travel from ${fromCityName} to ${toCityName || 'next stop'}`,
                transportMode: normalizeTransportMode(travel.transportMode)
            });
        });
    }

    const now = Date.now();
    const normalizedItems = normalizeCityColors(items);
    const paletteAppliedItems = applyCityPaletteToItems(normalizedItems, DEFAULT_CITY_COLOR_PALETTE_ID);
    return {
        id: generateTripId(),
        title: data.tripTitle || "My Trip",
        startDate: startDate || new Date().toISOString(),
        items: paletteAppliedItems,
        countryInfo: data.countryInfo,
        createdAt: now,
        updatedAt: now,
        isFavorite: false,
        roundTrip: options?.roundTrip ? true : undefined,
        cityColorPaletteId: DEFAULT_CITY_COLOR_PALETTE_ID,
        mapColorMode: DEFAULT_MAP_COLOR_MODE,
        aiMeta: {
            provider: options?.aiTarget?.provider || DEFAULT_PROVIDER,
            model: options?.aiTarget?.model || DEFAULT_MODEL,
            generatedAt: new Date(now).toISOString(),
        },
    };
};

const CLIENT_AI_GENERATION_TIMEOUT_MS = 60_000;

const generateItineraryFromPrompt = async (
    detailedPrompt: string,
    startDate?: string,
    options?: Pick<GenerateOptions, 'roundTrip' | 'aiTarget' | 'generationContext'>
): Promise<ITrip> => {
  const requestStartedAtMs = Date.now();
  const selectedProvider = options?.aiTarget?.provider || DEFAULT_PROVIDER;
  const selectedModel = options?.aiTarget?.model || DEFAULT_MODEL;
  const requestId = options?.generationContext?.requestId
    || (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `gen-${Date.now().toString(36)}`);
  let serverFailureTracked = false;
  const requestBody = {
    prompt: detailedPrompt,
    requestId,
    target: options?.aiTarget ? {
        provider: options.aiTarget.provider,
        model: options.aiTarget.model,
    } : undefined,
    context: options?.generationContext ? {
        tripId: options.generationContext.tripId,
        attemptId: options.generationContext.attemptId,
        flow: options.generationContext.flow,
        source: options.generationContext.source,
        retryOfAttemptId: options.generationContext.retryOfAttemptId,
    } : undefined,
  };

  const createFailureKind = (
    code: string | null,
    status: number | null,
    message: string,
  ): TripGenerationFailureKind => {
    const normalizedCode = (code || '').toLowerCase();
    const normalizedMessage = message.toLowerCase();
    if (status === 408 || status === 504 || normalizedCode.includes('timeout') || normalizedMessage.includes('timed out')) {
        return 'timeout';
    }
    if (normalizedCode.includes('abort') || normalizedMessage.includes('abort')) {
        return 'abort';
    }
    if (normalizedCode.includes('parse') || normalizedCode.includes('quality') || normalizedMessage.includes('quality')) {
        return 'quality';
    }
    if (
        normalizedCode.includes('provider')
        || normalizedCode.includes('model_not_allowed')
        || normalizedCode.includes('key_missing')
        || normalizedCode.includes('request_failed')
    ) {
        return 'provider';
    }
    if (normalizedCode.includes('network') || normalizedMessage.includes('network') || normalizedMessage.includes('failed to fetch')) {
        return 'network';
    }
    return 'unknown';
  };

  let releaseActiveAbortController = () => {};
  let activeAbortController: AbortController | null = null;

  try {
    const abortController = typeof AbortController !== 'undefined'
        ? new AbortController()
        : null;
    activeAbortController = abortController;
    releaseActiveAbortController = registerActiveGenerationAbortController({
        ...(options?.generationContext || {}),
        requestId,
    }, abortController);
    const timeoutId = abortController
        ? globalThis.setTimeout(() => {
            abortController.abort('timeout');
        }, CLIENT_AI_GENERATION_TIMEOUT_MS)
        : null;

    let edgeResponse: Response;
    try {
        edgeResponse = await fetch('/api/ai/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
            signal: abortController?.signal,
        });
    } finally {
        if (timeoutId !== null) {
            clearTimeout(timeoutId);
        }
    }

    if (!edgeResponse.ok) {
        let message = 'Server-side generation failed.';
        let errorCode: string | null = null;
        let errorDetails: string | null = null;
        let failureRequestId: string | null = requestId;
        let failureDurationMs: number | null = null;
        let failureProvider: string | null = selectedProvider;
        let failureModel: string | null = selectedModel;
        let failureProviderModel: string | null = null;
        try {
            const payload = await edgeResponse.json();
            if (payload?.error && typeof payload.error === 'string') {
                message = payload.error;
            }
            if (payload?.code && typeof payload.code === 'string') {
                errorCode = payload.code;
            }
            if (payload?.details && typeof payload.details === 'string') {
                errorDetails = payload.details;
            }
            if (payload?.meta && typeof payload.meta === 'object') {
                if (typeof payload.meta.requestId === 'string') {
                    failureRequestId = payload.meta.requestId;
                }
                const parsedDuration = Number(payload.meta.durationMs);
                failureDurationMs = Number.isFinite(parsedDuration) ? parsedDuration : null;
                if (typeof payload.meta.provider === 'string') {
                    failureProvider = payload.meta.provider;
                }
                if (typeof payload.meta.model === 'string') {
                    failureModel = payload.meta.model;
                }
                if (typeof payload.meta.providerModel === 'string') {
                    failureProviderModel = payload.meta.providerModel;
                }
            }
        } catch {
            // noop
        }
        trackEvent('create_trip__ai_request--failed', {
            provider: selectedProvider,
            model: selectedModel,
            status: edgeResponse.status,
            duration_ms: Date.now() - requestStartedAtMs,
            error_code: errorCode,
        });
        serverFailureTracked = true;
        throw new TripGenerationError(message, {
            code: errorCode,
            status: edgeResponse.status,
            details: errorDetails,
            requestId: failureRequestId,
            durationMs: failureDurationMs ?? (Date.now() - requestStartedAtMs),
            provider: failureProvider,
            model: failureModel,
            providerModel: failureProviderModel,
            failureKind: createFailureKind(errorCode, edgeResponse.status, message),
            requestPayload: requestBody,
        });
    }

    const payload = await edgeResponse.json();
    const data = payload?.data || {};
    const provider = payload?.meta?.provider || options?.aiTarget?.provider || DEFAULT_PROVIDER;
    const model = payload?.meta?.model || options?.aiTarget?.model || DEFAULT_MODEL;
    const responseDurationMs = Number(payload?.meta?.durationMs);
    trackEvent('create_trip__ai_request--success', {
        provider,
        model,
        status: edgeResponse.status,
        duration_ms: Number.isFinite(responseDurationMs) ? responseDurationMs : Date.now() - requestStartedAtMs,
        request_id: typeof payload?.meta?.requestId === 'string' ? payload.meta.requestId : requestId,
    });

    const normalizedProvider = provider === 'openai'
        || provider === 'anthropic'
        || provider === 'gemini'
        || provider === 'openrouter'
        || provider === 'perplexity'
        || provider === 'qwen'
        ? provider
        : DEFAULT_PROVIDER;

    const builtTrip = buildTripFromModelData(data, startDate, {
        roundTrip: options?.roundTrip,
        aiTarget: {
            provider: normalizedProvider,
            model,
        },
    });
    const finishedAtIso = new Date().toISOString();
    const generatedAttempt: TripGenerationAttemptSummary = {
        id: options?.generationContext?.attemptId || (typeof payload?.meta?.requestId === 'string' ? payload.meta.requestId : requestId),
        flow: options?.generationContext?.flow || 'classic',
        source: options?.generationContext?.source || 'create_trip',
        state: 'succeeded',
        startedAt: new Date(requestStartedAtMs).toISOString(),
        finishedAt: finishedAtIso,
        durationMs: Number.isFinite(responseDurationMs) ? responseDurationMs : Math.max(0, Date.now() - requestStartedAtMs),
        requestId: typeof payload?.meta?.requestId === 'string' ? payload.meta.requestId : requestId,
        provider: normalizedProvider,
        model,
        providerModel: typeof payload?.meta?.providerModel === 'string' ? payload.meta.providerModel : null,
        statusCode: edgeResponse.status,
        metadata: {
            source: options?.generationContext?.source || 'create_trip',
            requestPayload: requestBody,
        },
    };

    return {
        ...builtTrip,
        aiMeta: {
            ...(builtTrip.aiMeta || {
                provider: normalizedProvider,
                model,
                generatedAt: finishedAtIso,
            }),
            provider: normalizedProvider,
            model,
            generatedAt: finishedAtIso,
            generation: {
                state: 'succeeded',
                latestAttempt: generatedAttempt,
                attempts: [generatedAttempt],
                inputSnapshot: builtTrip.aiMeta?.generation?.inputSnapshot || null,
                retryCount: builtTrip.aiMeta?.generation?.retryCount || 0,
                retryRequestedAt: builtTrip.aiMeta?.generation?.retryRequestedAt || null,
                lastSucceededAt: finishedAtIso,
                lastFailedAt: null,
            },
        },
    };
  } catch (serverError) {
    const isAbortError = (
        (typeof DOMException !== 'undefined' && serverError instanceof DOMException && serverError.name === 'AbortError')
        || (serverError instanceof Error && serverError.name === 'AbortError')
    );
    const abortReason = activeAbortController?.signal?.reason;
    const timedOut = isAbortError && (
        abortReason === 'timeout'
        || (Date.now() - requestStartedAtMs) >= (CLIENT_AI_GENERATION_TIMEOUT_MS - 50)
    );
    if (isAbortError) {
        const timeoutError = new TripGenerationError(
            timedOut
                ? `Trip generation timed out after ${Math.round(CLIENT_AI_GENERATION_TIMEOUT_MS / 1000)} seconds.`
                : 'Trip generation was aborted before completion.',
            {
                code: timedOut ? 'AI_GENERATION_TIMEOUT' : 'AI_GENERATION_ABORTED',
                status: timedOut ? 408 : 499,
                details: serverError instanceof Error ? serverError.message : null,
                requestId,
                durationMs: Date.now() - requestStartedAtMs,
                provider: selectedProvider,
                model: selectedModel,
                failureKind: timedOut ? 'timeout' : 'abort',
                aborted: !timedOut,
                requestPayload: requestBody,
            }
        );
        trackEvent('create_trip__ai_request--failed', {
            provider: selectedProvider,
            model: selectedModel,
            status: timeoutError.status ?? 500,
            duration_ms: Date.now() - requestStartedAtMs,
            error_code: timeoutError.code,
        });
        throw timeoutError;
    }

    if (!serverFailureTracked) {
        const typedError = serverError as TripGenerationError;
        trackEvent('create_trip__ai_request--failed', {
            provider: selectedProvider,
            model: selectedModel,
            status: typeof typedError?.status === 'number' ? typedError.status : 500,
            duration_ms: Date.now() - requestStartedAtMs,
            error_code: typedError?.code || (serverError instanceof Error ? serverError.name : 'UNKNOWN_SERVER_ERROR'),
        });
    }

    const isGeminiFallbackAllowed = !options?.aiTarget || options.aiTarget.provider === 'gemini';
    if (!isGeminiFallbackAllowed) {
        console.error('AI Generation failed:', serverError);
        if (serverError instanceof TripGenerationError) {
            throw serverError;
        }
        throw new TripGenerationError('AI generation failed.', {
            code: serverError instanceof Error ? serverError.name : 'AI_GENERATION_ERROR',
            status: 500,
            details: serverError instanceof Error ? serverError.message : 'Unknown error',
            requestId,
            durationMs: Date.now() - requestStartedAtMs,
            provider: selectedProvider,
            model: selectedModel,
            failureKind: createFailureKind(
                serverError instanceof Error ? serverError.name : null,
                500,
                serverError instanceof Error ? serverError.message : 'Unknown error'
            ),
            requestPayload: requestBody,
        });
    }

    const fallbackStartedAtMs = Date.now();
    try {
        const apiKey = getGeminiApiKey();
        if (!apiKey) throw new Error('API Key is missing or invalid. Please check your environment configuration.');

        const ai = new GoogleGenAI({ apiKey });
        const selectedModel = options?.aiTarget?.model || DEFAULT_MODEL;

        const response = await ai.models.generateContent({
          model: selectedModel,
          contents: detailedPrompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: itinerarySchema,
          },
        });

        const data = JSON.parse(response.text || '{}');
        trackEvent('create_trip__ai_request--fallback_success', {
            provider: 'gemini',
            model: selectedModel,
            status: 200,
            duration_ms: Date.now() - fallbackStartedAtMs,
        });
        const builtTrip = buildTripFromModelData(data, startDate, options);
        const finishedAtIso = new Date().toISOString();
        const durationMs = Math.max(0, Date.now() - fallbackStartedAtMs);
        const generatedAttempt: TripGenerationAttemptSummary = {
            id: options?.generationContext?.attemptId || requestId,
            flow: options?.generationContext?.flow || 'classic',
            source: options?.generationContext?.source || 'create_trip_fallback',
            state: 'succeeded',
            startedAt: new Date(fallbackStartedAtMs).toISOString(),
            finishedAt: finishedAtIso,
            durationMs,
            requestId,
            provider: 'gemini',
            model: selectedModel,
            providerModel: null,
            statusCode: 200,
            metadata: {
                source: options?.generationContext?.source || 'create_trip_fallback',
                fallback: true,
                requestPayload: requestBody,
            },
        };
        return {
            ...builtTrip,
            aiMeta: {
                ...(builtTrip.aiMeta || {
                    provider: 'gemini',
                    model: selectedModel,
                    generatedAt: finishedAtIso,
                }),
                provider: 'gemini',
                model: selectedModel,
                generatedAt: finishedAtIso,
                generation: {
                    state: 'succeeded',
                    latestAttempt: generatedAttempt,
                    attempts: [generatedAttempt],
                    inputSnapshot: builtTrip.aiMeta?.generation?.inputSnapshot || null,
                    retryCount: builtTrip.aiMeta?.generation?.retryCount || 0,
                    retryRequestedAt: builtTrip.aiMeta?.generation?.retryRequestedAt || null,
                    lastSucceededAt: finishedAtIso,
                    lastFailedAt: null,
                },
            },
        };
    } catch (fallbackError) {
        trackEvent('create_trip__ai_request--fallback_failed', {
            provider: 'gemini',
            model: options?.aiTarget?.model || DEFAULT_MODEL,
            status: 500,
            duration_ms: Date.now() - fallbackStartedAtMs,
            error_code: fallbackError instanceof Error ? fallbackError.name : 'UNKNOWN_FALLBACK_ERROR',
        });
        console.error('AI Generation failed (server and fallback):', { serverError, fallbackError });
        throw new TripGenerationError(
            fallbackError instanceof Error ? fallbackError.message : 'AI generation fallback failed.',
            {
                code: fallbackError instanceof Error ? fallbackError.name : 'AI_GENERATION_FALLBACK_FAILED',
                status: 500,
                details: fallbackError instanceof Error ? fallbackError.message : 'Unknown fallback error',
                requestId,
                durationMs: Date.now() - requestStartedAtMs,
                provider: 'gemini',
                model: options?.aiTarget?.model || DEFAULT_MODEL,
                failureKind: createFailureKind(
                    fallbackError instanceof Error ? fallbackError.name : null,
                    500,
                    fallbackError instanceof Error ? fallbackError.message : 'Unknown fallback error'
                ),
                requestPayload: requestBody,
            }
        );
    }
  } finally {
    releaseActiveAbortController();
  }
};

export const generateItinerary = async (prompt: string, startDate?: string, options?: GenerateOptions): Promise<ITrip> => {
    const detailedPrompt = buildClassicItineraryPrompt(prompt, options);
    return generateItineraryFromPrompt(detailedPrompt, startDate, options);
};

export const buildClassicItineraryPrompt = (prompt: string, options?: GenerateOptions): string => {
    let detailedPrompt = `Plan a detailed travel itinerary for: ${prompt}. `;
    const promptMode = options?.promptMode;

    if (options) {
        if (options.roundTrip) {
            detailedPrompt += ` Roundtrip is enabled. The FINAL city in "cities" MUST be the same place as the FIRST city (same city name and coordinates), representing the return to start. `;
        }
        if (options.totalDays) detailedPrompt += ` The full itinerary MUST cover exactly ${options.totalDays} total days across all city stays. `;
        if (options.numCities) detailedPrompt += ` Visit exactly ${options.numCities} distinct cities/stops. `;
        if (options.specificCities) detailedPrompt += ` You MUST include these cities: ${options.specificCities}. `;
        if (options.budget) detailedPrompt += ` Budget level: ${options.budget}. `;
        if (options.pace) detailedPrompt += ` Travel pace: ${options.pace}. `;
        if (options.interests && options.interests.length > 0) detailedPrompt += ` Focus on these interests: ${options.interests.join(", ")}. `;
        detailedPrompt += buildPreferenceSignalsPrompt({
            dateInputMode: options.dateInputMode,
            destinationOrder: options.destinationOrder,
            enforceIslandOnly: options.enforceIslandOnly,
            flexWeeks: options.flexWeeks,
            flexWindow: options.flexWindow,
            hasTransportOverride: options.hasTransportOverride,
            idealMonths: options.idealMonths,
            notes: options.notes,
            recommendedDurationDays: options.recommendedDurationDays,
            routeLock: options.routeLock,
            selectedIslandNames: options.selectedIslandNames,
            shoulderMonths: options.shoulderMonths,
            specificCities: options.specificCities,
            startDestination: options.startDestination,
            transportPreferences: options.transportPreferences,
            travelerDetails: options.travelerDetails,
            travelerType: options.travelerType,
            tripStyleTags: options.tripStyleTags,
            tripVibeTags: options.tripVibeTags,
        });
        if (options.promptMode === 'benchmark_compact') {
            detailedPrompt += BENCHMARK_COMPACT_OUTPUT_PROMPT;
        }
    }

    detailedPrompt += buildItineraryRulesPrompt(promptMode);
    detailedPrompt += STRICT_JSON_OBJECT_CONTRACT_PROMPT;
    return detailedPrompt;
};

export const buildWizardItineraryPrompt = (options: WizardGenerateOptions): string => {
    const countries = options.countries.map((country) => country.trim()).filter(Boolean);
    if (countries.length === 0) {
        throw new Error('Please select at least one destination for the wizard flow.');
    }

    let detailedPrompt = `Plan a detailed, realistic multi-stop travel itinerary for these destinations: ${countries.join(', ')}. `;
    detailedPrompt += `This request comes from a guided travel wizard, so preference signals are important and should influence route choice, stop durations, and activity suggestions. `;

    if (options.roundTrip) {
        detailedPrompt += `Roundtrip is enabled. The FINAL city in "cities" MUST be the same place as the FIRST city (same city name and coordinates), representing the return to start. `;
    }
    if (options.totalDays) {
        detailedPrompt += `The full itinerary MUST cover exactly ${options.totalDays} total days across all city stays. `;
    }
    if (options.budget) {
        detailedPrompt += `Budget level: ${options.budget}. `;
    }
    if (options.pace) {
        detailedPrompt += `Travel pace: ${options.pace}. `;
    }
    if (options.interests && options.interests.length > 0) {
        detailedPrompt += `Focus on these interests: ${options.interests.join(', ')}. `;
    }
    detailedPrompt += buildPreferenceSignalsPrompt({
        dateInputMode: options.dateInputMode,
        destinationOrder: options.destinationOrder || countries,
        enforceIslandOnly: options.enforceIslandOnly,
        flexWeeks: options.flexWeeks,
        flexWindow: options.flexWindow,
        hasTransportOverride: options.hasTransportOverride,
        idealMonths: options.idealMonths,
        notes: options.notes,
        recommendedDurationDays: options.recommendedDurationDays,
        routeLock: options.routeLock,
        selectedIslandNames: options.selectedIslandNames,
        shoulderMonths: options.shoulderMonths,
        specificCities: options.specificCities,
        startDestination: options.startDestination,
        transportPreferences: options.transportPreferences,
        travelerDetails: options.travelerDetails,
        travelerType: options.travelerType,
        tripStyleTags: options.tripStyleTags,
        tripVibeTags: options.tripVibeTags,
        travelLogistics: options.travelLogistics,
        travelStyles: options.travelStyles,
        travelVibes: options.travelVibes,
    });

    detailedPrompt += `
      Wizard-specific constraints:
      - Prioritize destinations and city sequence that match the selected profile signals.
      - Keep transitions realistic and avoid overpacked travel days.
      - Pick activities that clearly reflect both style and vibe signals and stay credible for the traveler setup.
      - If multiple countries are selected, distribute time fairly while minimizing inefficient backtracking.
      - Use transport preferences to influence route choice and transfer recommendations.
    `;

    detailedPrompt += buildItineraryRulesPrompt(options.promptMode);
    detailedPrompt += STRICT_JSON_OBJECT_CONTRACT_PROMPT;
    return detailedPrompt;
};

export const buildSurpriseItineraryPrompt = (options: SurpriseGenerateOptions): string => {
    const country = options.country.trim();
    if (!country) {
        throw new Error('Please pick a destination before generating a surprise trip.');
    }

    let detailedPrompt = `Create a surprise travel itinerary for ${country}. `;
    detailedPrompt += `This request comes from the "Surprise Me" flow, so the plan should feel exciting, varied, and season-aware while still practical. `;

    if (options.totalDays) {
        detailedPrompt += `The full itinerary MUST cover exactly ${options.totalDays} total days across all city stays. `;
    }
    if (options.monthLabels && options.monthLabels.length > 0) {
        detailedPrompt += `Travel window months: ${options.monthLabels.join(', ')}. `;
    }
    if (options.durationWeeks && options.durationWeeks > 0) {
        detailedPrompt += `Requested trip length is about ${options.durationWeeks} week(s). `;
    }
    if (options.seasonalEvents && options.seasonalEvents.length > 0) {
        detailedPrompt += `Prioritize seasonal highlights such as: ${options.seasonalEvents.join(', ')}. `;
    }
    if (options.notes && options.notes.trim()) {
        detailedPrompt += `Additional user notes: ${options.notes.trim()}. `;
    }

    detailedPrompt += `
      Surprise-specific constraints:
      - Include a compelling but realistic mix of highlights and local experiences.
      - Keep logistics smooth and avoid unnecessary backtracking.
      - Keep at least one distinctive seasonal or culturally timely experience.
      - Favor broadly appealing pacing suitable for most travelers.
    `;

    detailedPrompt += BASE_ITINERARY_RULES_PROMPT;
    return detailedPrompt;
};

export const generateWizardItinerary = async (options: WizardGenerateOptions): Promise<ITrip> => {
    const detailedPrompt = buildWizardItineraryPrompt(options);
    return generateItineraryFromPrompt(detailedPrompt, options.startDate, options);
};

export const generateSurpriseItinerary = async (options: SurpriseGenerateOptions): Promise<ITrip> => {
    const detailedPrompt = buildSurpriseItineraryPrompt(options);
    return generateItineraryFromPrompt(detailedPrompt, options.startDate, {
        roundTrip: true,
        aiTarget: options.aiTarget,
        generationContext: options.generationContext,
    });
};

export const generateTripFromInputSnapshot = async (
    snapshot: {
        flow: TripGenerationFlow;
        startDate?: string;
        payload: Record<string, unknown>;
    },
    options?: {
        aiTarget?: { provider: AiProviderId; model: string };
        generationContext?: TripGenerationRequestContext;
    },
): Promise<ITrip> => {
    const payload = snapshot.payload;
    if (snapshot.flow === 'classic') {
        const destinationPrompt = typeof payload.destinationPrompt === 'string' ? payload.destinationPrompt.trim() : '';
        if (!destinationPrompt) {
            throw new TripGenerationError('Retry payload is missing destination prompt.', {
                code: 'GENERATION_INPUT_SNAPSHOT_INVALID',
                status: 400,
                failureKind: 'quality',
            });
        }
        const classicOptions = (payload.options && typeof payload.options === 'object')
            ? payload.options as GenerateOptions
            : {} as GenerateOptions;
        return generateItinerary(destinationPrompt, snapshot.startDate, {
            ...classicOptions,
            aiTarget: options?.aiTarget || classicOptions.aiTarget,
            generationContext: options?.generationContext,
        });
    }

    if (snapshot.flow === 'wizard') {
        const wizardOptions = (payload.options && typeof payload.options === 'object')
            ? payload.options as WizardGenerateOptions
            : { countries: [] } as WizardGenerateOptions;
        return generateWizardItinerary({
            ...wizardOptions,
            aiTarget: options?.aiTarget || wizardOptions.aiTarget,
            generationContext: options?.generationContext,
        });
    }

    const surpriseOptions = (payload.options && typeof payload.options === 'object')
        ? payload.options as SurpriseGenerateOptions
        : { country: '' } as SurpriseGenerateOptions;
    return generateSurpriseItinerary({
        ...surpriseOptions,
        aiTarget: options?.aiTarget || surpriseOptions.aiTarget,
        generationContext: options?.generationContext,
    });
};


export const suggestActivityDetails = async (activityName: string, location: string): Promise<any> => {
    try {
        const apiKey = getGeminiApiKey();
        if (!apiKey) return { cost: "Unknown", bestTime: "Anytime", tips: "API Key missing.", type: 'general', activityTypes: ['general'] };

        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `Provide brief details for a travel activity: "${activityName}" in "${location}".`,
            config: {
                 responseMimeType: "application/json",
                 responseSchema: activityDetailsSchema
            }
        });
        const text = response.text;
        if (!text) throw new Error("No response from AI");
        const parsed = JSON.parse(text);
        const activityTypes = normalizeActivityTypes(parsed.activityTypes ?? parsed.type);
        return {
            ...parsed,
            activityTypes,
            type: activityTypes[0],
        };
    } catch (e) {
        console.error("Gemini Suggest Error:", e);
        return { cost: "Unknown", bestTime: "Anytime", tips: "No details available.", type: 'general', activityTypes: ['general'] };
    }
}

export const generateActivityProposals = async (prompt: string, location: string, context?: any): Promise<any[]> => {
    try {
        const apiKey = getGeminiApiKey();
        if (!apiKey) return [];

        const ai = new GoogleGenAI({ apiKey });
        
        let contextString = "";
        if (context) {
            // Flatten the itinerary context
            const citiesStr = context.cities?.map((c:any) => `${c.name} (Day ${Math.floor(c.dayOffset)+1}-${Math.floor(c.dayOffset + c.duration)+1})`).join(', ');
            const existingActsStr = context.activities?.map((a:any) => `Day ${Math.floor(a.dayOffset)+1}: ${a.title}`).join('; ');

            contextString = `
            TRIP CONTEXT:
            - Trip Title: ${context.tripTitle}
            - Style/Preferences: ${context.preferences}
            - Target Date: Day ${context.dayNumber + 1}
            - Full Itinerary Stops: ${citiesStr}
            - Existing Activities: ${existingActsStr}
            `;
        }

        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `Suggest 3 distinct travel activities for "${location}" based on this specific user wish: "${prompt}".
            ${contextString}
            IMPORTANT RULES:
            1. Ensure the suggestions fit the user's style defined in context.
            2. DO NOT duplicate any activities listed in "Existing Activities".
            3. Consider the flow of the itinerary.
            4. Return "activityTypes" as an array with 1-3 values from: [${ACTIVITY_TYPES_PROMPT_LIST}].
            `,
            config: {
                 responseMimeType: "application/json",
                 responseSchema: activityProposalsSchema
            }
        });
        
        const text = response.text;
        if (!text) return [];
        const parsed = JSON.parse(text);
        if (!Array.isArray(parsed)) return [];
        return parsed.map((proposal: any) => {
            const activityTypes = normalizeActivityTypes(proposal.activityTypes ?? proposal.type);
            return {
                ...proposal,
                activityTypes,
                type: activityTypes[0],
            };
        });
    } catch (e) {
        console.error("Failed to generate proposals", e);
        return [];
    }
}

const getCityNotesModeInstruction = (mode: CityNotesEnhancementMode): string => {
    if (mode === 'local-tips') {
        return `
        Add practical local tips that improve the trip:
        - transport and neighborhood tips
        - timing and reservation tips
        - safety/crowd/weather awareness
        Prefer checklist items and concise bullet points.
        `;
    }

    if (mode === 'day-plan') {
        return `
        Add short day-by-day suggestions:
        - use H3 headers by day idea (for example: "### Day Plan Ideas")
        - include compact checklists for morning/afternoon/evening
        Keep it realistic and not overpacked.
        `;
    }

    return `
    Expand and improve the classic travel sections:
    - Must See
    - Must Try
    - Must Do
    Add useful items that are not already present.
    `;
};

export const generateCityNotesAddition = async (
    city: string,
    currentNotes: string,
    mode: CityNotesEnhancementMode = 'expand-checklists'
): Promise<string> => {
    try {
        const apiKey = getGeminiApiKey();
        if (!apiKey) return '';

        const ai = new GoogleGenAI({ apiKey });
        const modeInstruction = getCityNotesModeInstruction(mode);
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `Generate ONLY additional markdown for city travel notes in "${city}".

            Current notes that already exist:
            """
            ${currentNotes || '(no notes yet)'}
            """

            Your task:
            ${modeInstruction}

            Rules:
            1. Return ONLY content to append (no explanations outside markdown).
            2. Do NOT rewrite, summarize, or duplicate the existing notes.
            3. Prefer markdown checkbox lists (- [ ]) for actionable items.
            4. Keep it concise and useful (roughly 6-14 lines).
            `,
            config: {
                responseMimeType: "application/json",
                responseSchema: cityNotesSchema
            }
        });
        
        const text = response.text;
        if (!text) return '';
        const data = JSON.parse(text);
        return data.notes || '';
    } catch (e) {
        console.error("Failed to enhance notes", e);
        return '';
    }
}

export const enhanceCityNotes = async (city: string, currentNotes: string): Promise<string> => {
    const addition = await generateCityNotesAddition(city, currentNotes, 'expand-checklists');
    const trimmedAddition = addition.trim();
    const trimmedCurrentNotes = currentNotes.trim();

    if (!trimmedAddition) return currentNotes;
    if (!trimmedCurrentNotes) return trimmedAddition;

    return `${currentNotes.trimEnd()}\n\n${trimmedAddition}`;
}
