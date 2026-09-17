import { describe, expect, it } from 'vitest';

import { composePlaceQuery, formatLatLng, hasUsableCoordinates } from '../../shared/mapPlaceLinks';

describe('shared/mapPlaceLinks', () => {
    describe('hasUsableCoordinates', () => {
        it('accepts a real position', () => {
            expect(hasUsableCoordinates({ lat: 38.6916, lng: -9.2158 })).toBe(true);
        });

        it('rejects nothing at all', () => {
            expect(hasUsableCoordinates(null)).toBe(false);
            expect(hasUsableCoordinates(undefined)).toBe(false);
        });

        it('rejects values that are not finite numbers', () => {
            expect(hasUsableCoordinates({ lat: Number.NaN, lng: 12 })).toBe(false);
            expect(hasUsableCoordinates({ lat: 12, lng: Number.POSITIVE_INFINITY })).toBe(false);
        });

        it('rejects an out-of-range pair, which is what a swapped lat/lng looks like', () => {
            // A longitude in the latitude slot is still a finite number, so the
            // range check is the only thing between it and a link to the wrong
            // hemisphere.
            expect(hasUsableCoordinates({ lat: 121.53, lng: 25.03 })).toBe(false);
            expect(hasUsableCoordinates({ lat: 25.03, lng: 121.53 })).toBe(true);
        });
    });

    describe('formatLatLng', () => {
        it('writes a position at roughly ten-centimetre precision', () => {
            expect(formatLatLng({ lat: 25.0338891234, lng: 121.5321345678 })).toBe('25.033889,121.532135');
        });

        it('does not pad a round number with zeroes', () => {
            expect(formatLatLng({ lat: 25, lng: -9.5 })).toBe('25,-9.5');
        });
    });

    describe('composePlaceQuery', () => {
        it('qualifies a place with its city', () => {
            expect(composePlaceQuery('Belém Tower', 'Lisbon')).toBe('Belém Tower, Lisbon');
        });

        it('keeps the address when it already ends with the city', () => {
            expect(composePlaceQuery('Rua de Belém 84-92, Lisbon', 'Lisbon'))
                .toBe('Rua de Belém 84-92, Lisbon');
        });

        it('keeps the location when it already starts with the name', () => {
            // The redundant side is not always the same one, which is why the
            // containment check runs both ways.
            expect(composePlaceQuery('Louvre', 'Louvre, Paris')).toBe('Louvre, Paris');
        });

        it('keeps the city when the name only mentions it in passing', () => {
            // Found on the Deploy Preview: a generated activity title that
            // happens to contain its city. A plain "contains" test dropped the
            // city and left a search for a name nobody has ever heard of.
            expect(composePlaceQuery('Old Taipei Temple and Street-Food Quest', 'Taipei'))
                .toBe('Old Taipei Temple and Street-Food Quest, Taipei');
            expect(composePlaceQuery('Lisbon Cathedral by night', 'Lisbon'))
                .toBe('Lisbon Cathedral by night, Lisbon');
        });

        it('ignores case when deciding whether one repeats the other', () => {
            expect(composePlaceQuery('rua de belém 84, LISBON', 'Lisbon')).toBe('rua de belém 84, LISBON');
        });

        it('copes with either side missing', () => {
            expect(composePlaceQuery('', 'Lisbon')).toBe('Lisbon');
            expect(composePlaceQuery('Belém Tower', undefined)).toBe('Belém Tower');
            expect(composePlaceQuery(null, null)).toBe('');
        });

        it('trims before comparing, so whitespace does not defeat the dedupe', () => {
            expect(composePlaceQuery('  Lisbon  ', ' Lisbon ')).toBe('Lisbon');
        });
    });
});
