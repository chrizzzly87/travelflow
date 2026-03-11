// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';

import { setAllTrips } from '../../services/storageService';
import {
  clearE2ETripClaimSandbox,
  resolveE2ETripClaimSandboxScenario,
  setE2ETripClaimSandboxState,
} from '../../services/e2eTripClaimSandboxService';

describe('services/e2eTripClaimSandboxService', () => {
  beforeEach(() => {
    clearE2ETripClaimSandbox();
    setAllTrips([]);
  });

  it('returns a sandbox claim conflict scenario without a trip payload', () => {
    setE2ETripClaimSandboxState({
      'request-1': {
        outcome: 'claimed_by_another_user',
      },
    });

    expect(resolveE2ETripClaimSandboxScenario('request-1')).toEqual({
      outcome: 'claimed_by_another_user',
      tripId: null,
      trip: null,
    });
  });

  it('resolves a recovered claim scenario against a locally saved trip', () => {
    setAllTrips([{
      id: 'trip-1',
      title: 'Recovered trip',
      startDate: '2026-04-01',
      items: [],
      createdAt: 1,
      updatedAt: 1,
    }]);
    setE2ETripClaimSandboxState({
      'request-2': {
        outcome: 'recovered_existing_claim',
        tripId: 'trip-1',
      },
    });

    expect(resolveE2ETripClaimSandboxScenario('request-2')).toMatchObject({
      outcome: 'recovered_existing_claim',
      tripId: 'trip-1',
      trip: {
        id: 'trip-1',
        title: 'Recovered trip',
      },
    });
  });
});
