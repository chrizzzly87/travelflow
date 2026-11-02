import { describe, expect, it } from 'vitest';
import type { ITrip, IViewSettings } from '../../types';
import { normalizeSettingsForPersistence, normalizeTripForRuntimeLoad } from '../../features/trips/tripSessionModel';

describe('trip session normalization', () => {
    it('retains the object identity of an already valid trip', () => {
        const trip = { items: [{ id: 'city', type: 'city' }, { id: 'flight', type: 'travel', transportMode: 'plane' }] } as ITrip;
        expect(normalizeTripForRuntimeLoad(trip)).toBe(trip);
    });

    it('invalidates route metrics when normalizing an unavailable transport mode', () => {
        const trip = { items: [{ id: 'travel', type: 'travel', transportMode: 'na', routeDistanceKm: 500, routeDurationHours: 2 }] } as ITrip;
        const normalized = normalizeTripForRuntimeLoad(trip);
        expect(normalized.items[0]).toMatchObject({ type: 'travel-empty', transportMode: 'na', routeDistanceKm: undefined, routeDurationHours: undefined });
        expect(trip.items[0].type).toBe('travel');
    });

    it('bounds numeric preference serialization without persisting invalid numbers', () => {
        const settings = { zoomLevel: Number.NaN, sidebarWidth: Infinity, timelineHeight: 340.6, showCityNames: 1 } as unknown as IViewSettings;
        expect(normalizeSettingsForPersistence(settings)).toMatchObject({ zoomLevel: 1, sidebarWidth: 560, timelineHeight: 341, showCityNames: true });
    });
});
