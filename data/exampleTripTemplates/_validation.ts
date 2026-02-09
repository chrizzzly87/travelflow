import { ITrip } from '../../types';

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
    }

    return { isValid: true };
};
