import { TripPrefillData } from '../types';
import { getDestinationOptionByName } from './destinationService';

const VALID_BUDGETS = ['Low', 'Medium', 'High', 'Luxury'];
const VALID_PACES = ['Relaxed', 'Balanced', 'Fast'];
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Upper bound for structured prefill city lists, to keep encoded links small. */
export const MAX_PREFILL_CITY_LIST = 24;

const normalizeCityList = (value: unknown): string[] | null => {
    if (!Array.isArray(value)) return null;
    const cities = value
        .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
        .filter((entry) => entry.length > 0)
        .slice(0, MAX_PREFILL_CITY_LIST);
    return cities.length > 0 ? cities : null;
};

const LEGACY_BUDGET_MAP: Record<string, string> = {
    Budget: 'Low',
    Medium: 'Medium',
    Premium: 'High',
    Luxury: 'Luxury',
};

const LEGACY_PACE_MAP: Record<string, string> = {
    Relaxed: 'Relaxed',
    Balanced: 'Balanced',
    Intensive: 'Fast',
};

const normalizeBudget = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;
    if (VALID_BUDGETS.includes(value)) return value;
    return LEGACY_BUDGET_MAP[value] || null;
};

const normalizePace = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;
    if (VALID_PACES.includes(value)) return value;
    return LEGACY_PACE_MAP[value] || null;
};

export const decodeTripPrefill = (encoded: string): TripPrefillData | null => {
    try {
        const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
        const binary = atob(base64);
        const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
        const json = new TextDecoder().decode(bytes);
        const parsed = JSON.parse(json);
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;

        const result: TripPrefillData = {};

        if (Array.isArray(parsed.countries)) {
            const seen = new Set<string>();
            const resolvedCountries = parsed.countries
                .map((candidate: unknown) => {
                    if (typeof candidate !== 'string') return null;
                    const destination = getDestinationOptionByName(candidate);
                    if (!destination) return null;
                    const key = destination.name.toLocaleLowerCase();
                    if (seen.has(key)) return null;
                    seen.add(key);
                    return destination.name;
                })
                .filter((name): name is string => Boolean(name));

            if (resolvedCountries.length > 0) {
                result.countries = resolvedCountries;
            }
        }
        if (typeof parsed.startDate === 'string' && ISO_DATE_RE.test(parsed.startDate) && !isNaN(Date.parse(parsed.startDate))) {
            result.startDate = parsed.startDate;
        }
        if (typeof parsed.endDate === 'string' && ISO_DATE_RE.test(parsed.endDate) && !isNaN(Date.parse(parsed.endDate))) {
            result.endDate = parsed.endDate;
        }
        const normalizedBudget = normalizeBudget(parsed.budget);
        if (normalizedBudget) result.budget = normalizedBudget;
        const normalizedPace = normalizePace(parsed.pace);
        if (normalizedPace) result.pace = normalizedPace;
        const cityList = normalizeCityList(parsed.cityList);
        if (cityList) result.cityList = cityList;
        if (typeof parsed.cities === 'string') {
            result.cities = parsed.cities;
        } else if (cityList) {
            // Legacy consumers only read `cities`, so always keep the string mirror populated.
            result.cities = cityList.join(', ');
        }
        if (typeof parsed.notes === 'string') result.notes = parsed.notes;
        if (typeof parsed.roundTrip === 'boolean') result.roundTrip = parsed.roundTrip;
        if (parsed.mode === 'classic' || parsed.mode === 'wizard') result.mode = parsed.mode;
        if (Array.isArray(parsed.styles)) result.styles = parsed.styles.filter((s: unknown) => typeof s === 'string');
        if (Array.isArray(parsed.vibes)) result.vibes = parsed.vibes.filter((s: unknown) => typeof s === 'string');
        if (Array.isArray(parsed.logistics)) result.logistics = parsed.logistics.filter((s: unknown) => typeof s === 'string');
        if (typeof parsed.meta === 'object' && parsed.meta !== null && !Array.isArray(parsed.meta)) {
            result.meta = parsed.meta;
        }

        return Object.keys(result).length > 0 ? result : null;
    } catch {
        return null;
    }
};
