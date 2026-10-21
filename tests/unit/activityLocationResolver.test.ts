import { beforeEach, describe, expect, it, vi } from 'vitest';

const searchPlaceLocation = vi.fn();

vi.mock('../../services/locationSearchService', () => ({
  searchPlaceLocation: (...args: unknown[]) => searchPlaceLocation(...args),
}));

const {
  buildItemLocationQuery,
  needsCoordinateResolution,
  resetActivityLocationResolverCache,
  resolveItemCoordinates,
} = await import('../../services/activityLocationResolver');

const activity = {
  title: 'Taipei 101',
  location: 'Xinyi District',
};

describe('services/activityLocationResolver', () => {
  beforeEach(() => {
    searchPlaceLocation.mockReset();
    resetActivityLocationResolverCache();
  });

  it('adds the owner city so a bare location is not ambiguous', () => {
    expect(buildItemLocationQuery({
      item: { title: 'Rooftop bar', location: 'Zhongshan District' },
      contextLabel: 'Taipei',
    })).toBe('Rooftop bar, Zhongshan District, Taipei');
  });

  it('leaves out the owner city the name already states', () => {
    expect(buildItemLocationQuery({ item: activity, contextLabel: 'Taipei' }))
      .toBe('Taipei 101, Xinyi District');
  });

  it('still adds the owner city when a word merely starts with it', () => {
    expect(buildItemLocationQuery({
      item: { title: 'Parisian Bistro', location: '' },
      contextLabel: 'Paris',
    })).toBe('Parisian Bistro, Paris');
  });

  it('stores the query it resolved from, and does not call again for it', async () => {
    searchPlaceLocation.mockResolvedValue({
      coordinates: { lat: 25.03, lng: 121.56 },
      placeId: 'place-1',
    });

    const update = await resolveItemCoordinates({ item: activity, contextLabel: 'Taipei' });
    expect(update).toEqual({
      coordinates: { lat: 25.03, lng: 121.56 },
      coordinatesSource: 'places',
      coordinatesQuery: 'taipei 101, xinyi district',
      placeId: 'place-1',
    });

    const resolved = { ...activity, ...update! };
    expect(needsCoordinateResolution({ item: resolved, contextLabel: 'Taipei' })).toBe(false);
    expect(await resolveItemCoordinates({ item: resolved, contextLabel: 'Taipei' })).toBeNull();
    expect(searchPlaceLocation).toHaveBeenCalledTimes(1);
  });

  it('resolves again once the location changes', () => {
    const resolved = {
      ...activity,
      coordinates: { lat: 25.03, lng: 121.56 },
      coordinatesSource: 'places' as const,
      coordinatesQuery: 'taipei 101, xinyi district',
    };

    expect(needsCoordinateResolution({
      item: { ...resolved, location: 'Zhongshan District' },
      contextLabel: 'Taipei',
    })).toBe(true);
  });

  it('never overwrites a position the traveller picked by hand', async () => {
    const picked = {
      ...activity,
      location: 'Somewhere else entirely',
      coordinates: { lat: 1, lng: 2 },
      coordinatesSource: 'user' as const,
    };

    expect(needsCoordinateResolution({ item: picked })).toBe(false);
    expect(await resolveItemCoordinates({ item: picked })).toBeNull();
    expect(searchPlaceLocation).not.toHaveBeenCalled();
  });

  it('does not persist a failed lookup, and stops retrying it', async () => {
    searchPlaceLocation.mockResolvedValue(null);

    expect(await resolveItemCoordinates({ item: activity, contextLabel: 'Taipei' })).toBeNull();
    expect(await resolveItemCoordinates({ item: activity, contextLabel: 'Taipei' })).toBeNull();
    expect(searchPlaceLocation).toHaveBeenCalledTimes(1);
  });

  it('shares one request between callers asking at the same time', async () => {
    searchPlaceLocation.mockResolvedValue({ coordinates: { lat: 1, lng: 2 } });

    const [first, second] = await Promise.all([
      resolveItemCoordinates({ item: activity, contextLabel: 'Taipei' }),
      resolveItemCoordinates({ item: activity, contextLabel: 'Taipei' }),
    ]);

    expect(first).toEqual(second);
    expect(searchPlaceLocation).toHaveBeenCalledTimes(1);
  });

  it('does nothing for an item with no name or location', async () => {
    expect(await resolveItemCoordinates({ item: { title: '', location: '' } })).toBeNull();
    expect(searchPlaceLocation).not.toHaveBeenCalled();
  });
});
