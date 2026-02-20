import { TripPrefillData } from '../types';
import { getDestinationOptionByName } from './destinationService';

const VALID_BUDGETS = ['Low', 'Medium', 'High', 'Luxury'];
const VALID_PACES = ['Relaxed', 'Balanced', 'Fast'];
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

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
        if (typeof parsed.budget === 'string' && VALID_BUDGETS.includes(parsed.budget)) {
            result.budget = parsed.budget;
        }
        if (typeof parsed.pace === 'string' && VALID_PACES.includes(parsed.pace)) {
            result.pace = parsed.pace;
        }
        if (typeof parsed.cities === 'string') result.cities = parsed.cities;
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
