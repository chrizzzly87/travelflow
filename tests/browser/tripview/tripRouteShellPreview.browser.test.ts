// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ITrip } from '../../../types';

const mocks = vi.hoisted(() => ({
  trips: new Map<string, ITrip>(),
  getTripByIdCalls: 0,
}));

vi.mock('../../../services/storageService', () => ({
  getTripById: (id: string) => {
    mocks.getTripByIdCalls += 1;
    return mocks.trips.get(id);
  },
}));

vi.mock('../../../services/appRuntimeUtils', () => ({
  getStoredAppLanguage: () => 'en',
}));

import {
  readTripRouteShellPreviewDays,
  resetTripRouteShellPreviewForTests,
} from '../../../services/tripRouteShellPreview';

const buildTrip = (overrides: Partial<ITrip> = {}): ITrip => ({
  id: 'trip-1',
  title: 'Cherry Blossom Trail',
  startDate: '2026-09-19',
  items: [
    { id: 'c1', type: 'city', title: 'Tokyo', startDateOffset: 0, duration: 3 },
    { id: 'c2', type: 'city', title: 'Kyoto', startDateOffset: 3, duration: 2 },
  ],
  ...overrides,
} as ITrip);

describe('readTripRouteShellPreviewDays', () => {
  beforeEach(() => {
    resetTripRouteShellPreviewForTests();
    mocks.trips.clear();
    mocks.getTripByIdCalls = 0;
  });

  afterEach(() => {
    resetTripRouteShellPreviewForTests();
  });

  it('reads the real dates of a trip this device already has', () => {
    mocks.trips.set('trip-1', buildTrip());

    const days = readTripRouteShellPreviewDays('trip-1');

    expect(days).not.toBeNull();
    // 19 Sep 2026 through the end of the second stay: six calendar days.
    expect(days).toHaveLength(6);
    expect(days?.[0]).toMatchObject({ dayOfMonthLabel: '19', weekdayLabel: 'Sat' });
    expect(days?.[1]).toMatchObject({ dayOfMonthLabel: '20', weekdayLabel: 'Sun' });
    expect(days?.[5]).toMatchObject({ dayOfMonthLabel: '24' });
  });

  it('marks the first day and each month boundary so the strip can label them', () => {
    mocks.trips.set('trip-2', buildTrip({
      id: 'trip-2',
      startDate: '2026-09-29',
      items: [{ id: 'c1', type: 'city', title: 'Rome', startDateOffset: 0, duration: 4 }],
    } as Partial<ITrip>));

    const days = readTripRouteShellPreviewDays('trip-2');

    expect(days?.[0]).toMatchObject({ dayOfMonthLabel: '29', isMonthStart: true });
    expect(days?.[1].isMonthStart).toBe(false);
    // 1 October starts a new month and gets its own label.
    expect(days?.[2]).toMatchObject({ dayOfMonthLabel: '1', isMonthStart: true });
  });

  it('returns null for a trip this device knows nothing about', () => {
    expect(readTripRouteShellPreviewDays('unknown-trip')).toBeNull();
  });

  it('returns null when no trip id is in the route', () => {
    expect(readTripRouteShellPreviewDays(undefined)).toBeNull();
  });

  it('reads the store once per trip, since the shell renders several times per navigation', () => {
    mocks.trips.set('trip-1', buildTrip());

    readTripRouteShellPreviewDays('trip-1');
    readTripRouteShellPreviewDays('trip-1');
    readTripRouteShellPreviewDays('trip-1');

    expect(mocks.getTripByIdCalls).toBe(1);
  });

  it('caches the miss too, so an unknown trip does not reparse the store each render', () => {
    readTripRouteShellPreviewDays('unknown-trip');
    readTripRouteShellPreviewDays('unknown-trip');

    expect(mocks.getTripByIdCalls).toBe(1);
  });

  it('falls back to placeholder days when the store throws', () => {
    mocks.trips.set('broken', { get startDate(): string { throw new Error('corrupt'); } } as unknown as ITrip);

    expect(readTripRouteShellPreviewDays('broken')).toBeNull();
  });
});
