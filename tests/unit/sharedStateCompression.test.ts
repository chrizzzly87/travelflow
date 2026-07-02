import { describe, expect, it, vi } from 'vitest';
import LZString from 'lz-string';

import { compressTrip, decompressTrip, decompressTripFromUrl } from '../../utils';
import { makeCityItem, makeTrip } from '../helpers/tripFixtures';

const encodePayload = (payload: unknown): string =>
  LZString.compressToEncodedURIComponent(JSON.stringify(payload));

describe('shared trip compression', () => {
  it('round-trips valid shared trip payloads', () => {
    const trip = makeTrip({ title: 'Compressed trip' });
    const encoded = compressTrip(trip, {
      layoutMode: 'horizontal',
      timelineMode: 'calendar',
      timelineView: 'horizontal',
      mapDockMode: 'floating',
      mapStyle: 'standard',
      routeMode: 'simple',
      showCityNames: true,
      zoomLevel: 1.25,
      sidebarWidth: 640,
      detailsWidth: 420,
      timelineHeight: 360,
    });

    expect(decompressTrip(encoded)).toEqual({
      trip: expect.objectContaining({
        id: trip.id,
        title: 'Compressed trip',
        items: trip.items,
        status: 'active',
      }),
      view: expect.objectContaining({
        mapDockMode: 'floating',
        detailsWidth: 420,
      }),
    });
  });

  it('returns null without logging for non-shared route ids', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(decompressTrip('trip-plain-route-id')).toBeNull();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('returns null for junk lz-string input', () => {
    expect(decompressTrip('!!!not-a-real-payload###')).toBeNull();
  });

  it('returns null when the shared payload has no trip items', () => {
    const { items: _items, ...tripWithoutItems } = makeTrip();
    const encoded = encodePayload({ trip: tripWithoutItems });

    expect(decompressTrip(encoded)).toBeNull();
  });

  it('returns null when trip items is not an array', () => {
    const encoded = encodePayload({ trip: { ...makeTrip(), items: 'not-an-array' } });

    expect(decompressTrip(encoded)).toBeNull();
  });

  it('returns null when the shared trip is not an object', () => {
    expect(decompressTrip(encodePayload({ trip: 'nope' }))).toBeNull();
    expect(decompressTrip(encodePayload('just-a-string'))).toBeNull();
    expect(decompressTrip(encodePayload(42))).toBeNull();
  });

  it('drops malformed items but keeps valid ones', () => {
    const city = makeCityItem({ id: 'city-1', title: 'Lisbon', startDateOffset: 0, duration: 3 });
    const encoded = encodePayload({
      trip: { ...makeTrip(), items: [city, { rogue: true }, null, { id: 'no-type' }] },
    });

    const result = decompressTrip(encoded);
    expect(result?.trip.items).toEqual([city]);
  });

  it('applies defaults to partially valid trips (backward-compatible bare trip payload)', () => {
    const bareTrip = {
      id: 'trip-bare',
      title: 'Bare trip',
      startDate: '2026-05-01',
      endDate: '2026-05-05',
      items: [],
    };

    const result = decompressTrip(encodePayload(bareTrip));

    expect(result?.trip).toMatchObject({
      id: 'trip-bare',
      isFavorite: false,
      status: 'active',
      tripExpiresAt: null,
    });
    expect(typeof result?.trip.createdAt).toBe('number');
    expect(typeof result?.trip.updatedAt).toBe('number');
  });

  it('ignores non-object view payloads instead of passing them through', () => {
    const encoded = encodePayload({ trip: makeTrip(), view: 'broken-view' });

    const result = decompressTrip(encoded);
    expect(result?.trip.id).toBe('trip-1');
    expect(result?.view).toBeUndefined();
  });
});

describe('decompressTripFromUrl', () => {
  it('decodes a valid trip payload', () => {
    const trip = makeTrip({ title: 'Url trip' });
    const encoded = LZString.compressToEncodedURIComponent(JSON.stringify(trip));

    expect(decompressTripFromUrl(encoded)?.title).toBe('Url trip');
  });

  it('returns null for payloads without items', () => {
    const { items: _items, ...tripWithoutItems } = makeTrip();
    const encoded = LZString.compressToEncodedURIComponent(JSON.stringify(tripWithoutItems));

    expect(decompressTripFromUrl(encoded)).toBeNull();
  });

  it('returns null when items is not an array', () => {
    const encoded = LZString.compressToEncodedURIComponent(
      JSON.stringify({ ...makeTrip(), items: {} }),
    );

    expect(decompressTripFromUrl(encoded)).toBeNull();
  });

  it('returns null for junk input', () => {
    expect(decompressTripFromUrl('%%%junk###')).toBeNull();
  });
});
