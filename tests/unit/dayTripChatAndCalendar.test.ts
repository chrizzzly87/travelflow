import { describe, expect, it } from 'vitest';
import type { TFunction } from 'i18next';

import type { ITimelineItem } from '../../types';
import type { TripAgentContextRef } from '../../shared/tripAgent';
import { buildTripAgentDayTripPresets } from '../../components/trip-agent/tripAgentDayTripPresets';
import { buildDayTripCalendarConnectors } from '../../components/tripview/DayTripCalendarConnectors';

const t = ((key: string, values?: Record<string, string>) => (
    values ? `${key}(${Object.values(values).join(',')})` : key
)) as unknown as TFunction;

const items: ITimelineItem[] = [
    { id: 'lisbon', type: 'city', title: 'Lisbon', startDateOffset: 0, duration: 4, color: 'bg-sky-200' },
    { id: 'porto', type: 'city', title: 'Porto', startDateOffset: 4, duration: 3, color: 'bg-cyan-200' },
    { id: 'tram', type: 'activity', title: 'Tram 28', startDateOffset: 1, duration: 0.2, color: 'x', stayCityId: 'lisbon' },
    {
        id: 'sintra', type: 'activity', title: 'Sintra', startDateOffset: 2, duration: 0.6, color: 'x',
        stayCityId: 'lisbon', activityKind: 'day-trip',
    },
    {
        id: 'braga', type: 'activity', title: 'Braga', startDateOffset: 5, duration: 0.6, color: 'x',
        stayCityId: 'porto', activityKind: 'day-trip', dayTripReturnCityId: 'lisbon',
    },
];

const ref = (kind: TripAgentContextRef['kind'], id: string, label: string): TripAgentContextRef => ({
    kind, id, label, tripUpdatedAt: 1,
});

describe('day-trip presets for the chat "/" menu', () => {
    it('offers the general prompt with nothing selected', () => {
        expect(buildTripAgentDayTripPresets({ t, trip: { items }, contextRefs: [] }))
            .toEqual(['tripAgent.presetDayTrips']);
    });

    it('asks for a day trip from a selected stay', () => {
        expect(buildTripAgentDayTripPresets({ t, trip: { items }, contextRefs: [ref('city', 'porto', 'Porto')] }))
            .toEqual(['tripAgent.presetDayTripFrom(Porto)', 'tripAgent.presetDayTrips']);
    });

    it('turns an ordinary activity into a day trip, and changes or removes an existing one', () => {
        expect(buildTripAgentDayTripPresets({ t, trip: { items }, contextRefs: [ref('activity', 'tram', 'Tram 28')] })[0])
            .toBe('tripAgent.presetMakeDayTrip(Tram 28)');
        expect(buildTripAgentDayTripPresets({ t, trip: { items }, contextRefs: [ref('activity', 'sintra', 'Sintra')] }).slice(0, 2))
            .toEqual(['tripAgent.presetChangeDayTrip(Sintra)', 'tripAgent.presetRemoveDayTrip(Sintra)']);
    });

    it('offers nothing for a trip without stays', () => {
        expect(buildTripAgentDayTripPresets({ t, trip: { items: [] }, contextRefs: [] })).toEqual([]);
    });
});

describe('calendar connectors for day trips', () => {
    const resolveColor = (stay: ITimelineItem) => `color-${stay.id}`;

    it('draws nothing without a selection, so the calendar stays calm', () => {
        expect(buildDayTripCalendarConnectors({ items, selectedItemId: null, resolveColor })).toEqual([]);
    });

    it('connects a selected day trip to its stay in the stay colour', () => {
        expect(buildDayTripCalendarConnectors({ items, selectedItemId: 'sintra', resolveColor })).toEqual([
            { dayTripId: 'sintra', stayId: 'lisbon', returnStayId: null, color: 'color-lisbon' },
        ]);
    });

    it('connects every day trip of a selected stay, including one that ends there', () => {
        const connectors = buildDayTripCalendarConnectors({ items, selectedItemId: 'lisbon', resolveColor });
        expect(connectors.map((connector) => connector.dayTripId)).toEqual(['sintra', 'braga']);
        expect(connectors[1]).toMatchObject({ stayId: 'porto', returnStayId: 'lisbon' });
    });

    it('ignores ordinary activities', () => {
        expect(buildDayTripCalendarConnectors({ items, selectedItemId: 'tram', resolveColor })).toEqual([]);
    });
});
