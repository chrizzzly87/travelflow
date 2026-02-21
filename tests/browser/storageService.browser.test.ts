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
});
