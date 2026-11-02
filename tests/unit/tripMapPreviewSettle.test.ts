import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  TRIP_MAP_PREVIEW_SETTLE_MS,
  forgetSettledTripMapPreview,
  resolveSettledTripMapPreviewUrl,
} from '../../services/tripMapPreviewSettleService';

const STORAGE_KEY = 'tf_trip_map_preview_settle_v1';

const NOW = 1_800_000_000_000;
const OLD_URL = '/api/trip-map-preview?coords=52.520000,13.405000';
const NEW_URL = '/api/trip-map-preview?coords=48.856600,2.352200';

const createMemoryStorage = (): Storage => {
  const map = new Map<string, string>();
  return {
    get length() { return map.size; },
    clear: () => map.clear(),
    getItem: (key: string) => (map.has(key) ? map.get(key)! : null),
    key: (index: number) => Array.from(map.keys())[index] ?? null,
    removeItem: (key: string) => { map.delete(key); },
    setItem: (key: string, value: string) => { map.set(key, value); },
  } as Storage;
};

describe('services/tripMapPreviewSettleService', () => {
  beforeEach(() => {
    (globalThis as { window?: unknown }).window = { localStorage: createMemoryStorage() };
  });

  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
  });

  it('renders a trip it has never seen immediately', () => {
    const result = resolveSettledTripMapPreviewUrl({
      tripId: 'trip-1',
      updatedAt: NOW,
      freshUrl: NEW_URL,
      now: NOW,
    });

    expect(result).toEqual({ url: NEW_URL, isHeldBack: false });
  });

  it('holds the known picture while the trip is still being edited', () => {
    resolveSettledTripMapPreviewUrl({ tripId: 'trip-1', updatedAt: NOW - 60_000, freshUrl: OLD_URL, now: NOW - 60_000 });

    const result = resolveSettledTripMapPreviewUrl({
      tripId: 'trip-1',
      updatedAt: NOW,
      freshUrl: NEW_URL,
      now: NOW + 1_000,
    });

    expect(result).toEqual({ url: OLD_URL, isHeldBack: true });
  });

  it('collapses a burst of edits into one adopted picture', () => {
    resolveSettledTripMapPreviewUrl({ tripId: 'trip-1', updatedAt: NOW, freshUrl: OLD_URL, now: NOW });

    // Five intermediate states, each looked at while the trip is still moving.
    const intermediate = [1, 2, 3, 4, 5].map((step) => resolveSettledTripMapPreviewUrl({
      tripId: 'trip-1',
      updatedAt: NOW + step * 10_000,
      freshUrl: `${NEW_URL}&step=${step}`,
      now: NOW + step * 10_000 + 500,
    }));

    expect(intermediate.map((entry) => entry.url)).toEqual(Array(5).fill(OLD_URL));

    const settled = resolveSettledTripMapPreviewUrl({
      tripId: 'trip-1',
      updatedAt: NOW + 50_000,
      freshUrl: `${NEW_URL}&step=5`,
      now: NOW + 50_000 + TRIP_MAP_PREVIEW_SETTLE_MS,
    });

    expect(settled).toEqual({ url: `${NEW_URL}&step=5`, isHeldBack: false });
  });

  it('adopts the new picture once the trip has been quiet for the settle window', () => {
    resolveSettledTripMapPreviewUrl({ tripId: 'trip-1', updatedAt: NOW, freshUrl: OLD_URL, now: NOW });

    const result = resolveSettledTripMapPreviewUrl({
      tripId: 'trip-1',
      updatedAt: NOW + 1_000,
      freshUrl: NEW_URL,
      now: NOW + 1_000 + TRIP_MAP_PREVIEW_SETTLE_MS,
    });

    expect(result).toEqual({ url: NEW_URL, isHeldBack: false });
  });

  it('keeps serving the same URL for an unchanged trip', () => {
    resolveSettledTripMapPreviewUrl({ tripId: 'trip-1', updatedAt: NOW, freshUrl: OLD_URL, now: NOW });

    const result = resolveSettledTripMapPreviewUrl({
      tripId: 'trip-1',
      updatedAt: NOW,
      freshUrl: OLD_URL,
      now: NOW + TRIP_MAP_PREVIEW_SETTLE_MS * 10,
    });

    expect(result).toEqual({ url: OLD_URL, isHeldBack: false });
  });

  it('does not hold back a trip whose edit predates this device seeing it', () => {
    resolveSettledTripMapPreviewUrl({ tripId: 'trip-1', updatedAt: NOW, freshUrl: OLD_URL, now: NOW });

    // Edited an hour ago, looked at now: the picture is already settled.
    const result = resolveSettledTripMapPreviewUrl({
      tripId: 'trip-1',
      updatedAt: NOW + 3_600_000,
      freshUrl: NEW_URL,
      now: NOW + 3_600_000 + 3_600_000,
    });

    expect(result.url).toBe(NEW_URL);
  });

  it('keeps trips independent of each other', () => {
    resolveSettledTripMapPreviewUrl({ tripId: 'trip-1', updatedAt: NOW, freshUrl: OLD_URL, now: NOW });
    const other = resolveSettledTripMapPreviewUrl({
      tripId: 'trip-2',
      updatedAt: NOW,
      freshUrl: NEW_URL,
      now: NOW + 1_000,
    });

    expect(other).toEqual({ url: NEW_URL, isHeldBack: false });
  });

  it('forgets a trip on request', () => {
    resolveSettledTripMapPreviewUrl({ tripId: 'trip-1', updatedAt: NOW, freshUrl: OLD_URL, now: NOW });
    forgetSettledTripMapPreview('trip-1');

    const result = resolveSettledTripMapPreviewUrl({
      tripId: 'trip-1',
      updatedAt: NOW,
      freshUrl: NEW_URL,
      now: NOW + 1_000,
    });

    expect(result).toEqual({ url: NEW_URL, isHeldBack: false });
  });

  it('caps what it remembers so the key cannot grow without bound', () => {
    for (let index = 0; index < 260; index += 1) {
      resolveSettledTripMapPreviewUrl({
        tripId: `trip-${index}`,
        updatedAt: NOW + index,
        freshUrl: `${OLD_URL}&i=${index}`,
        now: NOW + index,
      });
    }

    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}');
    expect(Object.keys(stored).length).toBeLessThanOrEqual(200);
    // The most recently seen trips are the ones kept.
    expect(stored['trip-259']).toBeTruthy();
  });

  it('renders normally when storage is unavailable (regression: private mode)', () => {
    (globalThis as { window?: unknown }).window = {
      localStorage: {
        getItem: () => { throw new Error('blocked'); },
        setItem: () => { throw new Error('blocked'); },
        removeItem: () => { throw new Error('blocked'); },
        clear: () => {},
        key: () => null,
        length: 0,
      } as unknown as Storage,
    };

    const result = resolveSettledTripMapPreviewUrl({
      tripId: 'trip-1',
      updatedAt: NOW,
      freshUrl: NEW_URL,
      now: NOW,
    });

    expect(result.url).toBe(NEW_URL);
  });

  it('passes a missing preview through untouched', () => {
    expect(resolveSettledTripMapPreviewUrl({
      tripId: 'trip-1',
      updatedAt: NOW,
      freshUrl: null,
      now: NOW,
    })).toEqual({ url: null, isHeldBack: false });
  });
});
