import { describe, expect, it, vi } from 'vitest';
import { appendHistoryEntry, findHistoryEntryByUrl, getHistoryEntries } from '../../services/historyService';
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

  it('swallows storage write failures while still emitting history events', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    const listener = vi.fn();
    window.addEventListener('tf:history', listener as EventListener);

    expect(() => appendHistoryEntry('trip-write-fail', '/trip/trip-write-fail?v=1', 'v1', { ts: 1 })).not.toThrow();
    expect(consoleSpy).toHaveBeenCalled();
    expect(listener).toHaveBeenCalledTimes(1);

    window.removeEventListener('tf:history', listener as EventListener);
    setItemSpy.mockRestore();
    consoleSpy.mockRestore();
  });
});
