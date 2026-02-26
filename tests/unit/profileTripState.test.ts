import { describe, expect, it } from 'vitest';
import { makeTrip } from '../helpers/tripFixtures';
import {
  getRecentTrips,
  getTripSourceLabelKey,
  getTripsForProfileTab,
  toggleTripPinned,
  toggleTripFavorite,
} from '../../components/profile/profileTripState';

describe('components/profile/profileTripState', () => {
  it('maps trip source labels from source metadata', () => {
    expect(getTripSourceLabelKey(makeTrip({ sourceKind: 'created' }))).toBe('createdByYou');
    expect(getTripSourceLabelKey(makeTrip({ sourceKind: 'duplicate_shared' }))).toBe('copiedFromShared');
    expect(getTripSourceLabelKey(makeTrip({ sourceKind: 'duplicate_trip' }))).toBe('copiedFromYourTrip');
    expect(getTripSourceLabelKey(makeTrip({ sourceKind: 'example' }))).toBe('startedFromExample');
    expect(getTripSourceLabelKey(makeTrip({ forkedFromShareToken: 'share-token' }))).toBe('copiedFromShared');
    expect(getTripSourceLabelKey(makeTrip({ forkedFromTripId: 'trip-id' }))).toBe('copiedFromYourTrip');
    expect(getTripSourceLabelKey(makeTrip({ forkedFromExampleTemplateId: 'template-id' }))).toBe('startedFromExample');
  });

  it('sorts recent trips by created or updated date', () => {
    const trips = [
      makeTrip({ id: 'a', createdAt: 300, updatedAt: 100 }),
      makeTrip({ id: 'b', createdAt: 100, updatedAt: 500 }),
      makeTrip({ id: 'c', createdAt: 200, updatedAt: 200 }),
    ];

    expect(getRecentTrips(trips, 'created').map((trip) => trip.id)).toEqual(['a', 'c', 'b']);
    expect(getRecentTrips(trips, 'updated').map((trip) => trip.id)).toEqual(['b', 'c', 'a']);
  });

  it('filters favorites and all trips for profile tabs', () => {
    const trips = [
      makeTrip({ id: 'fav', isFavorite: true, updatedAt: 500 }),
      makeTrip({ id: 'plain', isFavorite: false, updatedAt: 900 }),
      makeTrip({ id: 'fav-2', isFavorite: true, updatedAt: 700 }),
    ];

    expect(getTripsForProfileTab(trips, 'favorites', 'created').map((trip) => trip.id)).toEqual(['fav-2', 'fav']);
    expect(getTripsForProfileTab(trips, 'all', 'updated').map((trip) => trip.id)).toEqual(['plain', 'fav-2', 'fav']);
    expect(getTripsForProfileTab(trips, 'liked', 'updated')).toEqual([]);
  });

  it('caps pinning at three trips and evicts the oldest pinned trip deterministically', () => {
    const baseTrips = [
      makeTrip({ id: 't1', isPinned: true, pinnedAt: 100, updatedAt: 100 }),
      makeTrip({ id: 't2', isPinned: true, pinnedAt: 200, updatedAt: 200 }),
      makeTrip({ id: 't3', isPinned: true, pinnedAt: 300, updatedAt: 300 }),
      makeTrip({ id: 't4', isPinned: false, updatedAt: 400 }),
    ];

    const result = toggleTripPinned(baseTrips, 't4', 500, 3);

    expect(result.nextPinnedState).toBe(true);
    expect(result.evictedTripIds).toEqual(['t1']);

    const pinnedIds = result.trips.filter((trip) => trip.isPinned).map((trip) => trip.id).sort();
    expect(pinnedIds).toEqual(['t2', 't3', 't4']);

    const t1 = result.trips.find((trip) => trip.id === 't1');
    expect(t1?.isPinned).toBe(false);
    expect(t1?.pinnedAt).toBeUndefined();
  });

  it('toggles favorite state with updated timestamp', () => {
    const trips = [makeTrip({ id: 'fav-toggle', isFavorite: false, updatedAt: 10 })];

    const result = toggleTripFavorite(trips, 'fav-toggle', 1234);

    expect(result.nextFavoriteState).toBe(true);
    expect(result.trips[0].isFavorite).toBe(true);
    expect(result.trips[0].updatedAt).toBe(1234);
  });
});
