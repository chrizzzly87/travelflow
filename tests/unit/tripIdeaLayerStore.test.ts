// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';

import { readTripIdeaLayerVisible, writeTripIdeaLayerVisible } from '../../services/tripIdeaLayerStore';

describe('services/tripIdeaLayerStore', () => {
    beforeEach(() => {
        window.localStorage.clear();
    });

    it('is off until switched on, per trip', () => {
        expect(readTripIdeaLayerVisible('trip-a')).toBe(false);
        // The key must be in the cookie registry, or the write is silently refused.
        expect(writeTripIdeaLayerVisible('trip-a', true)).toBe(true);
        expect(readTripIdeaLayerVisible('trip-a')).toBe(true);
        expect(readTripIdeaLayerVisible('trip-b')).toBe(false);
        writeTripIdeaLayerVisible('trip-a', false);
        expect(readTripIdeaLayerVisible('trip-a')).toBe(false);
    });

    it('survives a value it cannot read', () => {
        window.localStorage.setItem('tf_trip_idea_layer_v1', '{not json');
        expect(readTripIdeaLayerVisible('trip-a')).toBe(false);
    });
});
