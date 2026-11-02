import { describe, expect, it } from 'vitest';

import type { ITimelineItem } from '../../types';
import {
    buildDayTripMarkerHtml,
    buildTripMapDayTripDescriptors,
    collectDayTripMarkerIds,
    isDayTripRoundTrip,
} from '../../components/maps/tripMapDayTripModel';
import { collectCityFramingCoordinates } from '../../components/maps/tripMapCityFraming';

const lisbon: ITimelineItem = {
    id: 'lisbon', type: 'city', title: 'Lisbon', startDateOffset: 0, duration: 4, color: 'bg-sky-200',
    coordinates: { lat: 38.7223, lng: -9.1393 },
};
const porto: ITimelineItem = {
    id: 'porto', type: 'city', title: 'Porto', startDateOffset: 4, duration: 3, color: 'bg-cyan-200',
    coordinates: { lat: 41.1579, lng: -8.6291 },
};
const sintra: ITimelineItem = {
    id: 'sintra', type: 'activity', title: 'Palaces of Sintra', startDateOffset: 2.3, duration: 0.6, color: 'x',
    activityKind: 'day-trip', stayCityId: 'lisbon', location: 'Sintra, Portugal',
    coordinates: { lat: 38.7981, lng: -9.388 },
};

describe('buildTripMapDayTripDescriptors', () => {
    it('draws a day trip as a loop from its stay to the destination and back', () => {
        const [descriptor] = buildTripMapDayTripDescriptors([lisbon, porto, sintra]);
        expect(descriptor).toMatchObject({
            id: 'sintra',
            stayId: 'lisbon',
            returnStayId: 'lisbon',
            destinationLabel: 'Sintra',
            outboundPath: [{ lat: 38.7223, lng: -9.1393 }, { lat: 38.7981, lng: -9.388 }],
        });
        expect(isDayTripRoundTrip(descriptor)).toBe(true);
    });

    it('ends the day at another stay when one is picked', () => {
        const [descriptor] = buildTripMapDayTripDescriptors([lisbon, porto, { ...sintra, dayTripReturnCityId: 'porto' }]);
        expect(isDayTripRoundTrip(descriptor)).toBe(false);
        expect(descriptor.returnPath[1]).toEqual({ lat: 41.1579, lng: -8.6291 });
    });

    it('leaves a day trip without a destination position to the ordinary activity layer', () => {
        const descriptors = buildTripMapDayTripDescriptors([lisbon, { ...sintra, coordinates: undefined }]);
        expect(descriptors).toEqual([]);
        expect(collectDayTripMarkerIds(descriptors).has('sintra')).toBe(false);
    });

    it('ignores ordinary activities', () => {
        expect(buildTripMapDayTripDescriptors([lisbon, { ...sintra, activityKind: undefined }])).toEqual([]);
    });
});

describe('buildDayTripMarkerHtml', () => {
    it('escapes the label and marks the pin as a day trip', () => {
        const html = buildDayTripMarkerHtml({
            label: '<Sintra>', color: '#0ea5e9', size: 30, isSelected: false, selectedOutlineColor: '#2563eb',
        });
        expect(html).toContain('data-day-trip-marker="true"');
        expect(html).toContain('&lt;Sintra&gt;');
        expect(html).not.toContain('<Sintra>');
    });

    it('can hide the label', () => {
        const html = buildDayTripMarkerHtml({
            label: 'Sintra', color: '#0ea5e9', size: 30, isSelected: true, selectedOutlineColor: '#2563eb', showLabel: false,
        });
        expect(html).not.toContain('day-trip-marker-label');
    });
});

describe('city framing', () => {
    it('never widens a city frame to include a nearby day trip', () => {
        const framing = collectCityFramingCoordinates({ city: lisbon, items: [lisbon, sintra], cities: [lisbon] });
        expect(framing).toEqual([{ lat: 38.7223, lng: -9.1393 }]);
    });
});
