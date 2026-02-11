import { GoogleGenAI, Type } from "@google/genai";
import { ICoordinates, ITimelineItem, ITrip } from "../types";
import {
    ALL_ACTIVITY_TYPES,
    getActivityColorByTypes,
    getNormalizedCityName,
    getRandomCityColor,
    normalizeCityColors,
    TRAVEL_COLOR,
    getGeminiApiKey,
    normalizeActivityTypes,
    generateTripId,
} from "../utils";

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

const itinerarySchema = {
  type: Type.OBJECT,
  properties: {
    tripTitle: { type: Type.STRING },
    countryInfo: {
        type: Type.OBJECT,
        properties: {
            currencyCode: { type: Type.STRING, description: "ISO code, e.g. JPY" },
            currencyName: { type: Type.STRING, description: "e.g. Japanese Yen" },
            exchangeRate: { type: Type.NUMBER, description: "Approximate exchange rate: 1 EUR = X local currency" },
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
            transportMode: { type: Type.STRING, enum: ['plane', 'train', 'bus', 'boat', 'car', 'walk', 'bicycle', 'motorcycle'] },
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

export interface GenerateOptions {
    roundTrip?: boolean;
    totalDays?: number;
    numCities?: number;
    specificCities?: string;
    budget?: string;
    pace?: string;
    interests?: string[];
    selectedIslandNames?: string[];
    enforceIslandOnly?: boolean;
}

export interface WizardGenerateOptions {
    countries: string[];
    startDate?: string;
    endDate?: string;
    roundTrip?: boolean;
    totalDays?: number;
    notes?: string;
    budget?: string;
    pace?: string;
    travelStyles?: string[];
    travelVibes?: string[];
    travelLogistics?: string[];
    idealMonths?: string[];
    shoulderMonths?: string[];
    recommendedDurationDays?: number;
    selectedIslandNames?: string[];
    enforceIslandOnly?: boolean;
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
         Use - [ ] for all items to make them checkboxes.
      4. Provide Country Info (Currency, Exchange Rate to EUR, Languages, Sockets, Visa Link, Auswärtiges Amt Link).
      5. For EVERY activity, you MUST return "activityTypes" as an array with 1-3 values ONLY from this list:
         [${ACTIVITY_TYPES_PROMPT_LIST}]
         Do not return unknown activity types and do not leave activityTypes empty.
    `;

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

const buildTripFromModelData = (
    data: any,
    startDate?: string,
    options?: Pick<GenerateOptions, 'roundTrip'>
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
                const activityDuration = Number.isFinite(parsedDuration) && parsedDuration > 0 ? parsedDuration : 1;
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
            const parsedHours = Number(travel.duration);
            const durationDays = Number.isFinite(parsedHours) && parsedHours > 0 ? (parsedHours / 24) : 0.1;

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
                transportMode: travel.transportMode
            });
        });
    }

    const now = Date.now();
    return {
        id: generateTripId(),
        title: data.tripTitle || "My Trip",
        startDate: startDate || new Date().toISOString(),
        items: normalizeCityColors(items),
        countryInfo: data.countryInfo,
        createdAt: now,
        updatedAt: now,
        isFavorite: false,
        roundTrip: options?.roundTrip ? true : undefined,
    };
};

const generateItineraryFromPrompt = async (
    detailedPrompt: string,
    startDate?: string,
    options?: Pick<GenerateOptions, 'roundTrip'>
): Promise<ITrip> => {
  try {
    const apiKey = getGeminiApiKey();
    if (!apiKey) throw new Error("API Key is missing or invalid. Please check your environment configuration.");

    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: detailedPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: itinerarySchema,
      },
    });

    const data = JSON.parse(response.text || '{}');
    return buildTripFromModelData(data, startDate, options);

  } catch (error) {
    console.error("AI Generation failed:", error);
    throw error;
  }
};

export const generateItinerary = async (prompt: string, startDate?: string, options?: GenerateOptions): Promise<ITrip> => {
    let detailedPrompt = `Plan a detailed travel itinerary for: ${prompt}. `;

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
        detailedPrompt += buildIslandConstraintPrompt(options.selectedIslandNames, options.enforceIslandOnly);
    }

    detailedPrompt += BASE_ITINERARY_RULES_PROMPT;
    return generateItineraryFromPrompt(detailedPrompt, startDate, options);
};

export const generateWizardItinerary = async (options: WizardGenerateOptions): Promise<ITrip> => {
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
    if (options.recommendedDurationDays) {
        detailedPrompt += `Wizard recommended duration is ${options.recommendedDurationDays} days. Keep overall pacing aligned to this recommendation. `;
    }

    const styleSignals = (options.travelStyles || []).filter(Boolean);
    const vibeSignals = (options.travelVibes || []).filter(Boolean);
    const logisticsSignals = (options.travelLogistics || []).filter(Boolean);

    if (styleSignals.length > 0) {
        detailedPrompt += `Traveler profile styles: ${styleSignals.join(', ')}. `;
    }
    if (vibeSignals.length > 0) {
        detailedPrompt += `Preferred trip vibes/interests: ${vibeSignals.join(', ')}. `;
    }
    if (logisticsSignals.length > 0) {
        detailedPrompt += `Trip logistics preferences: ${logisticsSignals.join(', ')}. `;
    }
    if (options.idealMonths && options.idealMonths.length > 0) {
        detailedPrompt += `Best common travel months from local season data: ${options.idealMonths.join(', ')}. `;
    }
    if (options.shoulderMonths && options.shoulderMonths.length > 0) {
        detailedPrompt += `Shoulder backup months: ${options.shoulderMonths.join(', ')}. `;
    }
    if (options.budget) {
        detailedPrompt += `Budget level: ${options.budget}. Tailor accommodation, dining, and activity suggestions to this budget tier. `;
    }
    if (options.pace) {
        detailedPrompt += `Travel pace: ${options.pace}. Adjust the number of activities per day and free time accordingly. `;
    }
    if (options.notes && options.notes.trim()) {
        detailedPrompt += `Additional user notes: ${options.notes.trim()}. `;
    }
    detailedPrompt += buildIslandConstraintPrompt(options.selectedIslandNames, options.enforceIslandOnly);

    detailedPrompt += `
      Wizard-specific constraints:
      - Prioritize destinations and city sequence that match the selected profile signals.
      - Keep transitions realistic and avoid overpacked travel days.
      - Pick activities that clearly reflect both style and vibe signals.
      - If multiple countries are selected, distribute time fairly while minimizing inefficient backtracking.
    `;

    detailedPrompt += BASE_ITINERARY_RULES_PROMPT;
    return generateItineraryFromPrompt(detailedPrompt, options.startDate, options);
};

export const generateSurpriseItinerary = async (options: SurpriseGenerateOptions): Promise<ITrip> => {
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
    return generateItineraryFromPrompt(detailedPrompt, options.startDate, { roundTrip: true });
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
