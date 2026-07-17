import { describe, expect, it } from 'vitest';

import {
  resolveTripJourneyOverviewRollout,
  shouldRenderTripJourneyOverview,
} from '../../config/journeyOverviewExperience';

describe('journeyOverviewExperience', () => {
  it('keeps the TripView integration off for absent and unknown rollout values', () => {
    expect(resolveTripJourneyOverviewRollout(undefined)).toBe('off');
    expect(resolveTripJourneyOverviewRollout('unknown')).toBe('off');
    expect(shouldRenderTripJourneyOverview({
      rollout: 'off',
      hasCity: true,
      isPaywallLocked: false,
    })).toBe(false);
  });

  it('enables the integration only for trips with a visible city route', () => {
    expect(resolveTripJourneyOverviewRollout(' TRIPVIEW ')).toBe('tripview');
    expect(shouldRenderTripJourneyOverview({
      rollout: 'tripview',
      hasCity: true,
      isPaywallLocked: false,
    })).toBe(true);
    expect(shouldRenderTripJourneyOverview({
      rollout: 'tripview',
      hasCity: false,
      isPaywallLocked: false,
    })).toBe(false);
    expect(shouldRenderTripJourneyOverview({
      rollout: 'tripview',
      hasCity: true,
      isPaywallLocked: true,
    })).toBe(false);
  });
});
