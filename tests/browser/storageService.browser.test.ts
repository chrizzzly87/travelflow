// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { makeTrip } from '../helpers/tripFixtures';
import { deleteTrip, getAllTrips, getTripById, saveTrip, setAllTrips } from '../../services/storageService';

describe('services/storageService', () => {
  it('saves, loads, and sorts trips by updatedAt desc', () => {
    const tripA = makeTrip({ id: 'a', updatedAt: 1000, title: 'A' });
    const tripB = makeTrip({ id: 'b', updatedAt: 2000, title: 'B' });

    setAllTrips([tripA, tripB]);
    const all = getAllTrips();

    expect(all.map((trip) => trip.id)).toEqual(['b', 'a']);
    expect(getTripById('a')?.title).toBe('A');
  });

  it('normalizes invalid persisted entries and statuses', () => {
    window.localStorage.setItem('travelflow_trips_v1', JSON.stringify([
      { id: 'ok', title: 'OK', items: [], status: 'expired' },
      { id: 'bad', items: [] },
    ]));

    const all = getAllTrips();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe('ok');
    expect(all[0].status).toBe('expired');
    expect(typeof all[0].createdAt).toBe('number');
  });

  it('updates existing trip and dispatches update event', () => {
    const listener = vi.fn();
    window.addEventListener('tf:trips-updated', listener as EventListener);

    const trip = makeTrip({ id: 'trip-1', title: 'Original', updatedAt: 1 });
    saveTrip(trip, { preserveUpdatedAt: true });

    const before = getTripById('trip-1');
    saveTrip({ ...trip, title: 'Updated title' });
    const after = getTripById('trip-1');

    expect(before?.title).toBe('Original');
    expect(after?.title).toBe('Updated title');
    expect(listener).toHaveBeenCalled();

    window.removeEventListener('tf:trips-updated', listener as EventListener);
  });

  it('deletes trips', () => {
    setAllTrips([makeTrip({ id: 'x' }), makeTrip({ id: 'y' })]);
    deleteTrip('x');
    expect(getTripById('x')).toBeUndefined();
    expect(getTripById('y')).toBeDefined();
  });

  it('handles malformed and non-array persisted payloads safely', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem');
    getItemSpy.mockReturnValueOnce('{invalid-json');
    expect(getAllTrips()).toEqual([]);
    getItemSpy.mockRestore();

    window.localStorage.setItem('travelflow_trips_v1', JSON.stringify({ trip: 'not-array' }));
    expect(getAllTrips()).toEqual([]);
    consoleSpy.mockRestore();
  });

  it('normalizes fallback fields and status defaults from persisted payload', () => {
    window.localStorage.setItem(
      'travelflow_trips_v1',
      JSON.stringify([
        { id: 'arch', title: 'Archived', items: [], status: 'archived', tripExpiresAt: '2026-01-01T00:00:00Z' },
        {
          id: 'fallback',
          title: 'Fallback',
          items: [],
          status: 'weird',
          isFavorite: 0,
          isPinned: 1,
          pinnedAt: 'invalid',
          tripExpiresAt: 1234,
        },
      ])
    );

    const all = getAllTrips();
    const archived = all.find((trip) => trip.id === 'arch');
    const fallback = all.find((trip) => trip.id === 'fallback');

    expect(archived?.status).toBe('archived');
    expect(archived?.tripExpiresAt).toBe('2026-01-01T00:00:00Z');
    expect(fallback?.status).toBe('active');
    expect(fallback?.tripExpiresAt).toBeNull();
    expect(fallback?.isFavorite).toBe(false);
    expect(fallback?.isPinned).toBe(true);
    expect(fallback?.pinnedAt).toBeUndefined();
    expect(fallback?.showOnPublicProfile).toBe(true);
  });

  it('persists favorite and pin metadata through storage sync', () => {
    const trip = makeTrip({
      id: 'sync-trip',
      isFavorite: false,
      isPinned: true,
      pinnedAt: 1000,
    });

    saveTrip(trip, { preserveUpdatedAt: true });
    saveTrip({ ...trip, isFavorite: true, pinnedAt: 2000 }, { preserveUpdatedAt: true });

    const syncedTrip = getTripById('sync-trip');
    expect(syncedTrip?.isFavorite).toBe(true);
    expect(syncedTrip?.isPinned).toBe(true);
    expect(syncedTrip?.pinnedAt).toBe(2000);
  });

  it('persists trip public visibility through storage sync', () => {
    const trip = makeTrip({
      id: 'visibility-trip',
      showOnPublicProfile: false,
    });

    saveTrip(trip, { preserveUpdatedAt: true });
    saveTrip({ ...trip, showOnPublicProfile: true }, { preserveUpdatedAt: true });

    const syncedTrip = getTripById('visibility-trip');
    expect(syncedTrip?.showOnPublicProfile).toBe(true);
  });

  it('swallows quota/storage write failures for save/delete/set-all', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });

    expect(() => saveTrip(makeTrip({ id: 'quota-trip' }))).not.toThrow();
    expect(() => deleteTrip('quota-trip')).not.toThrow();
    expect(() => setAllTrips([makeTrip({ id: 'quota-replace' })])).not.toThrow();
    expect(consoleSpy).toHaveBeenCalled();

    setItemSpy.mockRestore();
    consoleSpy.mockRestore();
  });

  it('prunes oldest trips when localStorage quota allows only smaller payloads', () => {
    const originalSetItem = Storage.prototype.setItem;
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key: string, value: string) {
      if (key === 'travelflow_trips_v1' && value.length > 450) {
        throw new Error('quota');
      }
      return originalSetItem.call(this, key, value);
    });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const trips = Array.from({ length: 12 }, (_, index) => makeTrip({
      id: `trip-${index + 1}`,
      title: `Trip ${index + 1}`,
      updatedAt: index + 1,
    }));

    expect(() => setAllTrips(trips)).not.toThrow();

    const persisted = getAllTrips();
    expect(persisted.length).toBeGreaterThan(0);
    expect(persisted.length).toBeLessThan(trips.length);
    expect(warnSpy).toHaveBeenCalled();

    setItemSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('emits tf:trips-pruned with count and titles when quota pruning drops trips', () => {
    const originalSetItem = Storage.prototype.setItem;
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key: string, value: string) {
      if (key === 'travelflow_trips_v1' && value.length > 450) {
        throw new Error('quota');
      }
      return originalSetItem.call(this, key, value);
    });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const prunedListener = vi.fn();
    window.addEventListener('tf:trips-pruned', prunedListener as EventListener);

    const trips = Array.from({ length: 12 }, (_, index) => makeTrip({
      id: `trip-${index + 1}`,
      title: `Trip ${index + 1}`,
      updatedAt: index + 1,
    }));

    setAllTrips(trips);

    const persisted = getAllTrips();
    expect(persisted.length).toBeLessThan(trips.length);

    expect(prunedListener).toHaveBeenCalledTimes(1);
    const detail = (prunedListener.mock.calls[0][0] as CustomEvent<{ prunedCount: number; prunedTitles: string[] }>).detail;
    expect(detail.prunedCount).toBe(trips.length - persisted.length);
    expect(detail.prunedTitles).toHaveLength(detail.prunedCount);
    // The oldest trips (lowest updatedAt) must be the pruned ones.
    const persistedIds = new Set(persisted.map((trip) => trip.id));
    for (let index = 0; index < detail.prunedCount; index += 1) {
      expect(persistedIds.has(`trip-${index + 1}`)).toBe(false);
      expect(detail.prunedTitles).toContain(`Trip ${index + 1}`);
    }

    window.removeEventListener('tf:trips-pruned', prunedListener as EventListener);
    setItemSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('emits tf:trips-pruned when a saveTrip write requires pruning', () => {
    const originalSetItem = Storage.prototype.setItem;
    const trips = Array.from({ length: 8 }, (_, index) => makeTrip({
      id: `trip-${index + 1}`,
      title: `Trip ${index + 1}`,
      updatedAt: index + 1,
    }));
    setAllTrips(trips);

    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key: string, value: string) {
      if (key === 'travelflow_trips_v1' && value.length > 450) {
        throw new Error('quota');
      }
      return originalSetItem.call(this, key, value);
    });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const prunedListener = vi.fn();
    window.addEventListener('tf:trips-pruned', prunedListener as EventListener);

    saveTrip(makeTrip({ id: 'fresh-trip', title: 'Fresh trip' }));

    expect(prunedListener).toHaveBeenCalledTimes(1);
    const detail = (prunedListener.mock.calls[0][0] as CustomEvent<{ prunedCount: number; prunedTitles: string[] }>).detail;
    expect(detail.prunedCount).toBeGreaterThan(0);
    // The trip just saved must never be part of the pruned set.
    expect(detail.prunedTitles).not.toContain('Fresh trip');
    expect(getTripById('fresh-trip')).toBeDefined();

    window.removeEventListener('tf:trips-pruned', prunedListener as EventListener);
    setItemSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('keeps the trip being saved even when it is the oldest and pruning kicks in', () => {
    const originalSetItem = Storage.prototype.setItem;
    const trips = Array.from({ length: 8 }, (_, index) => makeTrip({
      id: `trip-${index + 1}`,
      title: `Trip ${index + 1}`,
      updatedAt: 1000 + index + 1,
    }));
    setAllTrips(trips);

    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key: string, value: string) {
      if (key === 'travelflow_trips_v1' && value.length > 450) {
        throw new Error('quota');
      }
      return originalSetItem.call(this, key, value);
    });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // preserveUpdatedAt keeps the old timestamp, so without protection this trip
    // would sort last and become the first pruning victim.
    saveTrip(makeTrip({ id: 'oldest-trip', title: 'Oldest trip', updatedAt: 1 }), { preserveUpdatedAt: true });

    expect(getTripById('oldest-trip')).toBeDefined();

    setItemSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('does not emit tf:trips-pruned when writes succeed without pruning', () => {
    const prunedListener = vi.fn();
    window.addEventListener('tf:trips-pruned', prunedListener as EventListener);

    setAllTrips([makeTrip({ id: 'a' }), makeTrip({ id: 'b' })]);
    saveTrip(makeTrip({ id: 'c', title: 'C' }));
    deleteTrip('a');

    expect(prunedListener).not.toHaveBeenCalled();

    window.removeEventListener('tf:trips-pruned', prunedListener as EventListener);
  });
});
