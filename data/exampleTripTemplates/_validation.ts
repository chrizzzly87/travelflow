import { ITrip, ITimelineItem } from '../../types';
import { isDayTrip, resolveStayForOffset } from '../../shared/activityStay';

interface ValidationResult {
    isValid: boolean;
    error?: string;
}

/**
 * Validates a trip object against required constraints.
 * This acts as a runtime schema check for test data.
 */
export const validateTripSchema = (trip: Partial<ITrip>): ValidationResult => {
    if (!trip.title) return { isValid: false, error: "Missing Trip Title" };
    if (!trip.items || !Array.isArray(trip.items)) return { isValid: false, error: "Missing Items Array" };

    for (let i = 0; i < trip.items.length; i++) {
        const item = trip.items[i];
        if (!item.id) return { isValid: false, error: `Item at index ${i} missing ID` };
        if (!item.type) return { isValid: false, error: `Item ${item.id} missing Type` };
        if (typeof item.startDateOffset !== 'number') return { isValid: false, error: `Item ${item.id} invalid startDateOffset` };
        if (typeof item.duration !== 'number') return { isValid: false, error: `Item ${item.id} invalid duration` };

        if (item.type === 'city' && !item.coordinates) {
             console.warn(`Warning: City ${item.title} missing coordinates`);
        }
        if (item.stayCityId && !trip.items.some((candidate) => candidate.id === item.stayCityId && candidate.type === 'city')) {
            return { isValid: false, error: `Activity ${item.id} points at unknown stay ${item.stayCityId}` };
        }
        if (item.dayTripReturnCityId && !trip.items.some((candidate) => candidate.id === item.dayTripReturnCityId && candidate.type === 'city')) {
            return { isValid: false, error: `Day trip ${item.id} returns to unknown stay ${item.dayTripReturnCityId}` };
        }
        if (isDayTrip(item) && !item.coordinates) {
            return { isValid: false, error: `Day trip ${item.id} has no destination coordinates` };
        }
    }

    return { isValid: true };
};

/**
 * Turns template items into a trip's items: every id gets the trip's suffix,
 * and so does every reference to an id (hotels, an activity's stay, a day
 * trip's return stay), otherwise the references would point at nothing.
 * Activities without an explicit stay get the one whose dates contain them.
 */
export const instantiateTemplateItems = (items: ITimelineItem[], uniqueSuffix: number | string): ITimelineItem[] => {
    const cities = items.filter((item) => item.type === 'city');
    const suffixed = (id: string) => `${id}-${uniqueSuffix}`;
    return items.map((item) => {
        const stayCityId = item.type === 'activity'
            ? (item.stayCityId ?? resolveStayForOffset(item.startDateOffset, cities)?.id)
            : undefined;
        return {
            ...item,
            id: suffixed(item.id),
            ...(item.hotels ? { hotels: item.hotels.map((hotel) => ({ ...hotel, id: suffixed(hotel.id) })) } : {}),
            ...(stayCityId ? { stayCityId: suffixed(stayCityId) } : {}),
            ...(item.dayTripReturnCityId ? { dayTripReturnCityId: suffixed(item.dayTripReturnCityId) } : {}),
        };
    });
};
