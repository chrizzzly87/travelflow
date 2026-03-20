// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import {
  appendHistoryEntry,
  createTripHistorySnapshotEntry,
  findHistoryEntryByUrl,
  getHistoryEntries,
} from '../../services/historyService';
import { makeTrip } from '../helpers/tripFixtures';

describe('services/historyService', () => {
  it('appends entries, sorts desc, and filters by trip/share url prefixes', () => {
    const tripId = 'trip-1';

    appendHistoryEntry(tripId, '/trip/trip-1?v=1', 'Version 1', { ts: 10 });
    appendHistoryEntry(tripId, '/trip/trip-1?v=2', 'Version 2', { ts: 20 });
    appendHistoryEntry(tripId, '/s/share-token', 'Shared', { ts: 15 });
    appendHistoryEntry(tripId, '/profile', 'Wrong scope', { ts: 99 });

    const entries = getHistoryEntries(tripId);
    expect(entries.map((entry) => entry.url)).toEqual([
      '/trip/trip-1?v=2',
      '/s/share-token',
      '/trip/trip-1?v=1',
    ]);
  });

  it('dedupes repeated latest url and can find by url', () => {
    const tripId = 'trip-2';
    appendHistoryEntry(tripId, '/trip/trip-2?v=1', 'Version 1', { ts: 1 });
    appendHistoryEntry(tripId, '/trip/trip-2?v=1', 'Version 1 duplicate', { ts: 2 });

    const entries = getHistoryEntries(tripId);
    expect(entries).toHaveLength(1);

    const found = findHistoryEntryByUrl(tripId, '/trip/trip-2?v=1');
    expect(found?.url).toBe('/trip/trip-2?v=1');
  });

  it('dispatches tf:history events on append', () => {
    const listener = vi.fn();
    window.addEventListener('tf:history', listener as EventListener);

    appendHistoryEntry('trip-3', '/trip/trip-3?v=1', 'v1', {
      ts: 1,
      snapshot: {
        trip: makeTrip({ id: 'trip-3' }),
      },
    });

    expect(listener).toHaveBeenCalledTimes(1);
    const event = listener.mock.calls[0][0] as CustomEvent;
    expect(event.detail.tripId).toBe('trip-3');

    window.removeEventListener('tf:history', listener as EventListener);
  });

  it('caps per-trip history to max size', () => {
    const tripId = 'trip-max';
    for (let i = 0; i < 220; i += 1) {
      appendHistoryEntry(tripId, `/trip/${tripId}?v=${i}`, `v${i}`, { ts: i });
    }

    const entries = getHistoryEntries(tripId);
    expect(entries.length).toBeLessThanOrEqual(200);
    expect(entries[0].url).toBe(`/trip/${tripId}?v=219`);
  });

  it('returns empty history for malformed storage payloads', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    window.localStorage.setItem('travelflow_history_v1', '{bad-json');
    expect(getHistoryEntries('trip-bad')).toEqual([]);
    consoleSpy.mockRestore();
  });

  it('filters by encoded trip prefix and returns null for missing lookups', () => {
    const tripId = 'trip/encoded';
    appendHistoryEntry(tripId, `/trip/${encodeURIComponent(tripId)}?v=1`, 'encoded', { ts: 1 });
    appendHistoryEntry(tripId, `/trip/${tripId}?v=2`, 'wrong-shape', { ts: 2 });

    const entries = getHistoryEntries(tripId);
    expect(entries).toHaveLength(1);
    expect(entries[0].url).toBe(`/trip/${encodeURIComponent(tripId)}?v=1`);
    expect(findHistoryEntryByUrl(tripId, '/trip/missing')).toBeNull();
  });

  it('falls back to the base trip url when a snapshot write cannot persist', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    const listener = vi.fn();
    window.addEventListener('tf:history', listener as EventListener);
    const trip = makeTrip({ id: 'trip-write-fail' });

    const result = createTripHistorySnapshotEntry({
      tripId: trip.id,
      trip,
      label: 'Visual: Changed map style',
      ts: 1,
      baseUrlOverride: '/trip/trip-write-fail?mode=planner',
    });

    expect(result).toEqual({
      url: '/trip/trip-write-fail?mode=planner',
      persisted: false,
    });
    expect(consoleSpy).toHaveBeenCalled();
    expect(listener).not.toHaveBeenCalled();
    expect(getHistoryEntries(trip.id)).toEqual([]);

    window.removeEventListener('tf:history', listener as EventListener);
    setItemSpy.mockRestore();
    consoleSpy.mockRestore();
  });

  it('prunes older history entries before failing a new write', () => {
    const tripId = 'trip-prune';
    const originalSetItem = Storage.prototype.setItem;
    window.localStorage.setItem('travelflow_history_v1', JSON.stringify({
      [tripId]: [
        {
          id: 'old-1',
          tripId,
          url: `/trip/${tripId}?v=old-1`,
          label: 'Old one',
          ts: 1,
          snapshot: {
            trip: makeTrip({ id: tripId, title: 'Old one' }),
          },
        },
        {
          id: 'old-2',
          tripId,
          url: `/trip/${tripId}?v=old-2`,
          label: 'Old two',
          ts: 2,
          snapshot: {
            trip: makeTrip({ id: tripId, title: 'Old two' }),
          },
        },
      ],
    }));

    let writeAttempts = 0;
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
      if (key === 'travelflow_history_v1' && writeAttempts === 0) {
        writeAttempts += 1;
        throw new Error('quota');
      }
      return originalSetItem.call(this, key, value);
    });

    const persisted = appendHistoryEntry(tripId, `/trip/${tripId}?v=new`, 'Newest', {
      ts: 3,
      snapshot: {
        trip: makeTrip({ id: tripId, title: 'Newest' }),
      },
    });

    expect(persisted).toBe(true);
    expect(getHistoryEntries(tripId).map((entry) => entry.url)).toEqual([
      `/trip/${tripId}?v=new`,
      `/trip/${tripId}?v=old-2`,
    ]);

    setItemSpy.mockRestore();
  });

  it('compacts legacy visual entries that still store full trip snapshots', () => {
    const trip = makeTrip({ id: 'trip-compact' });
    window.localStorage.setItem('travelflow_history_v1', JSON.stringify({
      [trip.id]: [
        {
          id: 'legacy-visual',
          tripId: trip.id,
          url: `/trip/${trip.id}?v=legacy`,
          label: 'Visual: Map view standard -> dark',
          ts: 1,
          snapshot: {
            trip,
            view: {
              mapStyle: 'dark',
              layoutMode: 'horizontal',
              timelineMode: 'calendar',
              timelineView: 'horizontal',
              mapDockMode: 'docked',
              routeMode: 'simple',
              showCityNames: true,
              zoomLevel: 1,
              zoomBehavior: 'fit',
              sidebarWidth: 550,
              detailsWidth: 440,
              timelineHeight: 340,
            },
          },
        },
      ],
    }));

    const entry = getHistoryEntries(trip.id)[0];
    expect(entry.snapshot?.trip).toBeUndefined();
    expect(entry.snapshot?.view?.mapStyle).toBe('dark');
  });
});
