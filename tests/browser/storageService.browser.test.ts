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
        { id: 'fallback', title: 'Fallback', items: [], status: 'weird', isFavorite: 0, tripExpiresAt: 1234 },
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
});
