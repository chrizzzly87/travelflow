import { GoogleGenAI, Type } from "@google/genai";
import { ITimelineItem, ITrip, ActivityType, ICountryInfo } from "../types";
import { getRandomCityColor, getRandomActivityColor, TRAVEL_COLOR, getApiKey } from "../utils";

/**
 * ==============================================================================
 * CRITICAL CONFIGURATION
 * ==============================================================================
 * The API Key retrieval logic has been centralized in `utils.ts` to ensure
 * consistency across the application, including the hardcoded fallback.
 * ==============================================================================
 */

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
            transportMode: { type: Type.STRING, enum: ['plane', 'train', 'bus', 'boat', 'car'] },
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
          type: { 
              type: Type.STRING, 
              enum: ["activity", "food", "landmark", "sports", "hiking", "wildlife", "shopping", "adventure", "beach", "nature", "culture", "relaxation", "nightlife"]
          },
        },
        required: ["title", "cityIndex", "dayOffsetInCity", "duration", "description", "type"],
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
        type: { 
            type: Type.STRING, 
            enum: ['general', 'food', 'culture', 'sightseeing', 'relaxation', 'nightlife', 'sports', 'hiking', 'wildlife', 'shopping', 'adventure', 'beach', 'nature'] 
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
            type: { 
                type: Type.STRING, 
                enum: ['general', 'food', 'culture', 'sightseeing', 'relaxation', 'nightlife', 'sports', 'hiking', 'wildlife', 'shopping', 'adventure', 'beach', 'nature'] 
            }
        },
        required: ["title", "description", "cost", "bestTime", "tips", "type"]
    }
};

const cityNotesSchema = {
    type: Type.OBJECT,
    properties: {
        notes: { type: Type.STRING, description: "Markdown text with checkboxes for Must See, Must Try (Foods), and Must Do." }
    },
    required: ["notes"]
};

interface GenerateOptions {
    roundTrip: boolean;
    numCities?: number;
    specificCities?: string;
    budget?: string;
    pace?: string;
}

export const generateItinerary = async (prompt: string, startDate?: string, options?: GenerateOptions): Promise<ITrip> => {
  try {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("API Key is missing or invalid. Please check your environment configuration.");
    
    const ai = new GoogleGenAI({ apiKey });
    
    let detailedPrompt = `Plan a detailed travel itinerary for: ${prompt}. `;
    
    if (options) {
        if (options.roundTrip) detailedPrompt += ` This is a roundtrip, so the itinerary MUST end at the starting city/region. `;
        if (options.numCities) detailedPrompt += ` Visit exactly ${options.numCities} distinct cities/stops. `;
        if (options.specificCities) detailedPrompt += ` You MUST include these cities: ${options.specificCities}. `;
        if (options.budget) detailedPrompt += ` Budget level: ${options.budget}. `;
        if (options.pace) detailedPrompt += ` Travel pace: ${options.pace}. `;
    }

    detailedPrompt += `
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
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: detailedPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: itinerarySchema,
      },
    });

    const data = JSON.parse(response.text || '{}');
    
    const items: ITimelineItem[] = [];
    let currentDayOffset = 0;
    const cityOffsets: number[] = [];

    // Process Cities
    if (data.cities) {
        data.cities.forEach((city: any, index: number) => {
        cityOffsets[index] = currentDayOffset;
        items.push({
            id: `city-${index}-${Date.now()}`,
            type: 'city',
            title: city.name,
            startDateOffset: currentDayOffset,
            duration: city.days,
            color: getRandomCityColor(index),
            description: city.description || "",
            location: city.name,
            coordinates: { lat: city.lat, lng: city.lng }
        });

        // Process Activities for this city
        if (data.activities) {
            const cityActivities = data.activities.filter((a: any) => a.cityIndex === index);
            cityActivities.forEach((act: any, actIndex: number) => {
                items.push({
                id: `act-${index}-${actIndex}-${Date.now()}`,
                type: 'activity',
                title: act.title,
                startDateOffset: currentDayOffset + (act.dayOffsetInCity || 0),
                duration: act.duration || 1,
                color: getRandomActivityColor(),
                description: act.description,
                location: city.name,
                // AI returns single type string, map to array
                activityType: act.type ? [act.type] : ['general']
                });
            });
        }

        currentDayOffset += city.days;
        });
    }

    // Process Travel Segments (placed between cities)
    if (data.travelSegments) {
        data.travelSegments.forEach((travel: any, index: number) => {
            if (travel.fromCityIndex < cityOffsets.length) {
                const startOffset = cityOffsets[travel.fromCityIndex] + data.cities[travel.fromCityIndex].days - 0.5; // Start half day before end of city A
                
                // Convert hours to days for the timeline
                // Default to 0.1 days (approx 2.4 hrs) if missing, but schema requires it.
                // Ensure at least minimal visibility
                const durationDays = travel.duration ? (travel.duration / 24) : 0.1;
                
                items.push({
                    id: `travel-${index}-${Date.now()}`,
                    type: 'travel',
                    title: travel.description,
                    startDateOffset: startOffset,
                    duration: durationDays, 
                    color: TRAVEL_COLOR,
                    description: `Travel from ${data.cities[travel.fromCityIndex].name} to ${data.cities[travel.toCityIndex]?.name || 'next stop'}`,
                    transportMode: travel.transportMode
                });
            }
        });
    }

    const now = Date.now();
    return {
      id: `trip-${now}`,
      title: data.tripTitle || "My Trip",
      startDate: startDate || new Date().toISOString(),
      items: items,
      countryInfo: data.countryInfo,
      createdAt: now,
      updatedAt: now
    };

  } catch (error) {
    console.error("AI Generation failed:", error);
    throw error;
  }
};


export const suggestActivityDetails = async (activityName: string, location: string): Promise<any> => {
    try {
        const apiKey = getApiKey();
        if (!apiKey) return { cost: "Unknown", bestTime: "Anytime", tips: "API Key missing.", type: 'general' };

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
        return JSON.parse(text);
    } catch (e) {
        console.error("Gemini Suggest Error:", e);
        return { cost: "Unknown", bestTime: "Anytime", tips: "No details available.", type: 'general' };
    }
}

export const generateActivityProposals = async (prompt: string, location: string, context?: any): Promise<any[]> => {
    try {
        const apiKey = getApiKey();
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
            `,
            config: {
                 responseMimeType: "application/json",
                 responseSchema: activityProposalsSchema
            }
        });
        
        const text = response.text;
        if (!text) return [];
        return JSON.parse(text);
    } catch (e) {
        console.error("Failed to generate proposals", e);
        return [];
    }
}

export const enhanceCityNotes = async (city: string, currentNotes: string): Promise<string> => {
    try {
        const apiKey = getApiKey();
        if (!apiKey) return currentNotes;

        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `Create or enhance travel notes for "${city}". 
            
            Current Notes: "${currentNotes}"

            The output must be in Markdown format. 
            MANDATORY: You must generate 3 sections using H3 Headers (###) and Checkbox Lists (- [ ]):
            ### Must See
            - [ ] Landmark 1
            ### Must Try
            - [ ] Food Name (Description)
            ### Must Do
            - [ ] Activity 1

            If the current notes already have content, preserve it and append/merge these lists at the end nicely.
            `,
            config: {
                responseMimeType: "application/json",
                responseSchema: cityNotesSchema
            }
        });
        
        const text = response.text;
        if (!text) return currentNotes;
        const data = JSON.parse(text);
        return data.notes || currentNotes;
    } catch (e) {
        console.error("Failed to enhance notes", e);
        return currentNotes;
    }
}