import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearTripGenerationCompletionWatchesForTests,
  listTripGenerationCompletionWatches,
  registerTripGenerationCompletionWatch,
  removeTripGenerationCompletionWatch,
  subscribeTripGenerationCompletionWatches,
} from '../../services/tripGenerationCompletionWatchService';

describe('tripGenerationCompletionWatchService', () => {
  beforeEach(() => {
    clearTripGenerationCompletionWatchesForTests();
  });

  it('registers a watch entry for a trip id', () => {
    const watch = registerTripGenerationCompletionWatch('trip-1', 'auth_queue_claim_login', 1_000);

    expect(watch).toEqual({
      tripId: 'trip-1',
      source: 'auth_queue_claim_login',
      startedAt: 1_000,
      updatedAt: 1_000,
    });
    expect(listTripGenerationCompletionWatches()).toHaveLength(1);
  });

  it('updates source and updatedAt when same trip is registered again', () => {
    registerTripGenerationCompletionWatch('trip-1', 'auth_queue_claim_login', 1_000);
    const updated = registerTripGenerationCompletionWatch('trip-1', 'auth_queue_claim_trip_view', 2_500);

    expect(updated).toEqual({
      tripId: 'trip-1',
      source: 'auth_queue_claim_trip_view',
      startedAt: 1_000,
      updatedAt: 2_500,
    });
    expect(listTripGenerationCompletionWatches()).toHaveLength(1);
  });

  it('notifies subscribers when watch list changes', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeTripGenerationCompletionWatches(listener);

    registerTripGenerationCompletionWatch('trip-1', 'auth_queue_claim_login', 1_000);
    removeTripGenerationCompletionWatch('trip-1');
    unsubscribe();
    registerTripGenerationCompletionWatch('trip-1', 'auth_queue_claim_login', 2_000);

    expect(listener).toHaveBeenCalledTimes(2);
  });
});
