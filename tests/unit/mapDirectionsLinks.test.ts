import { describe, expect, it } from 'vitest';

import {
    buildActivityDirectionsLabel,
    buildDirectionsLinks,
    resolveDirectionsPlatform,
} from '../../shared/mapDirectionsLinks';

describe('shared/mapDirectionsLinks', () => {
    describe('resolveDirectionsPlatform', () => {
        it('detects Android, which is the only platform with a native map chooser', () => {
            expect(resolveDirectionsPlatform('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36'))
                .toBe('android');
        });

        it('detects iPhone and iPad', () => {
            expect(resolveDirectionsPlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe('ios');
            expect(resolveDirectionsPlatform('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)')).toBe('ios');
        });

        it('falls back to the web for desktop browsers and an unknown agent', () => {
            expect(resolveDirectionsPlatform('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe('web');
            expect(resolveDirectionsPlatform(undefined)).toBe('web');
            expect(resolveDirectionsPlatform('')).toBe('web');
        });
    });

    describe('buildDirectionsLinks', () => {
        it('builds coordinate links, labelling the Android pin', () => {
            const links = buildDirectionsLinks({
                coordinates: { lat: 38.7071, lng: -9.1355 },
                label: 'Pastéis de Belém',
            });

            expect(links).not.toBeNull();
            expect(links!.geoUri).toBe('geo:38.7071,-9.1355?q=38.7071%2C-9.1355(Past%C3%A9is%20de%20Bel%C3%A9m)');
            expect(links!.appleMapsUrl).toContain('maps://?daddr=38.7071%2C-9.1355');
            expect(links!.googleMapsUrl).toContain('destination=38.7071%2C-9.1355');
        });

        it('falls back to a place query when the stop has no coordinates', () => {
            const links = buildDirectionsLinks({ coordinates: null, label: 'Belém Tower, Lisbon' });

            expect(links!.geoUri).toBe('geo:0,0?q=Bel%C3%A9m%20Tower%2C%20Lisbon');
            expect(links!.appleMapsUrl).toContain('daddr=Bel%C3%A9m%20Tower%2C%20Lisbon');
            expect(links!.googleMapsUrl).toContain('destination=Bel%C3%A9m%20Tower%2C%20Lisbon');
        });

        it('ignores coordinates that are not real positions', () => {
            const links = buildDirectionsLinks({
                coordinates: { lat: Number.NaN, lng: 12 },
                label: 'Somewhere',
            });

            expect(links!.geoUri).toBe('geo:0,0?q=Somewhere');
        });

        it('returns nothing when there is neither a position nor a name to search for', () => {
            expect(buildDirectionsLinks({ coordinates: null, label: '   ' })).toBeNull();
        });
    });

    describe('buildActivityDirectionsLabel', () => {
        it('qualifies the activity with its city, since activities often have no coordinates', () => {
            expect(buildActivityDirectionsLabel('Belém Tower', undefined, 'Lisbon')).toBe('Belém Tower, Lisbon');
        });

        it('prefers an explicit location over the activity title', () => {
            expect(buildActivityDirectionsLabel('Lunch', 'Time Out Market', 'Lisbon'))
                .toBe('Time Out Market, Lisbon');
        });

        it('does not repeat the city when the address already contains it', () => {
            expect(buildActivityDirectionsLabel('Lisbon', undefined, 'Lisbon')).toBe('Lisbon');
            expect(buildActivityDirectionsLabel('Pastéis de Belém', 'Rua de Belém 84-92, Lisbon', 'Lisbon'))
                .toBe('Rua de Belém 84-92, Lisbon');
        });

        it('falls back to the city alone when the activity has no usable name', () => {
            expect(buildActivityDirectionsLabel('', undefined, 'Lisbon')).toBe('Lisbon');
        });

        it('copes with a missing city', () => {
            expect(buildActivityDirectionsLabel('Belém Tower', undefined, undefined)).toBe('Belém Tower');
        });
    });
});
