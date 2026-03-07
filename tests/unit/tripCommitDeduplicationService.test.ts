import { describe, expect, it } from 'vitest';

import type { ITrip, IViewSettings } from '../../types';
import {
  buildTripCommitFingerprint,
  createTripCommitDeduplicationState,
  markTripCommitFingerprintCompleted,
  markTripCommitFingerprintFailed,
  markTripCommitFingerprintStarted,
  shouldSkipTripCommitFingerprint,
} from '../../services/tripCommitDeduplicationService';

const createTrip = (overrides: Partial<ITrip> = {}): ITrip => ({
  id: 'trip-1',
  title: 'Poland',
  startDate: '2026-03-27',
  items: [
    {
      id: 'city-1',
      type: 'city',
      title: 'Warsaw',
      startDateOffset: 0,
      duration: 3,
      description: 'Stop 1',
      color: 'bg-rose-100 border-rose-200 text-rose-700',
      location: 'Warsaw',
    },
  ],
  createdAt: 100,
  updatedAt: 200,
  isFavorite: false,
  status: 'active',
  sourceKind: 'created',
  tripExpiresAt: null,
  showOnPublicProfile: true,
  ...overrides,
});

const createView = (overrides: Partial<IViewSettings> = {}): IViewSettings => ({
  layoutMode: 'horizontal',
  timelineMode: 'calendar',
  timelineView: 'horizontal',
  mapDockMode: 'docked',
  mapStyle: 'standard',
  zoomLevel: 1,
  routeMode: 'simple',
  showCityNames: true,
  sidebarWidth: 560,
  timelineHeight: 340,
  ...overrides,
});

describe('tripCommitDeduplicationService', () => {
  it('ignores top-level updatedAt churn when fingerprinting the same commit payload', () => {
    const view = createView();
    const first = buildTripCommitFingerprint({
      trip: createTrip({ updatedAt: 200 }),
      view,
      label: 'Data: Updated trip',
    });
    const second = buildTripCommitFingerprint({
      trip: createTrip({ updatedAt: 999999 }),
      view,
      label: 'Data: Updated trip',
    });

    expect(first).toBe(second);
  });

  it('suppresses identical in-flight and immediately repeated committed fingerprints', () => {
    const state = createTripCommitDeduplicationState();
    const fingerprint = buildTripCommitFingerprint({
      trip: createTrip(),
      view: createView(),
      label: 'Data: Updated trip',
    });

    expect(shouldSkipTripCommitFingerprint(state, fingerprint)).toBe(false);

    markTripCommitFingerprintStarted(state, fingerprint);
    expect(shouldSkipTripCommitFingerprint(state, fingerprint)).toBe(true);

    markTripCommitFingerprintCompleted(state, fingerprint);
    expect(shouldSkipTripCommitFingerprint(state, fingerprint)).toBe(true);
  });

  it('allows retries after a failed identical commit and allows later reverts after a different commit', () => {
    const state = createTripCommitDeduplicationState();
    const firstFingerprint = buildTripCommitFingerprint({
      trip: createTrip({ isFavorite: false }),
      view: createView(),
      label: 'Data: Updated trip',
    });
    const secondFingerprint = buildTripCommitFingerprint({
      trip: createTrip({ isFavorite: true }),
      view: createView(),
      label: 'Data: Updated trip',
    });

    markTripCommitFingerprintStarted(state, firstFingerprint);
    markTripCommitFingerprintFailed(state, firstFingerprint);
    expect(shouldSkipTripCommitFingerprint(state, firstFingerprint)).toBe(false);

    markTripCommitFingerprintStarted(state, secondFingerprint);
    markTripCommitFingerprintCompleted(state, secondFingerprint);
    expect(shouldSkipTripCommitFingerprint(state, secondFingerprint)).toBe(true);
    expect(shouldSkipTripCommitFingerprint(state, firstFingerprint)).toBe(false);
  });
});
