import { describe, expect, it } from 'vitest';

import type { ITrip, TripGenerationInputSnapshot } from '../../types';
import { decodeTripPrefill } from '../../services/tripPrefillDecoder';
import {
  buildCreateSimilarTripPath,
  buildTripClaimConflictPath,
  buildTripClaimLoginReturnPath,
} from '../../services/tripClaimConflictService';

const makeTrip = (snapshot: TripGenerationInputSnapshot): ITrip => ({
  id: 'trip-1',
  title: snapshot.destinationLabel || 'Trip',
  startDate: snapshot.startDate || '2026-04-01',
  items: [],
  createdAt: 0,
  updatedAt: 0,
  aiMeta: {
    provider: 'openai',
    model: 'gpt-5.4',
    generatedAt: '2026-03-11T08:00:00.000Z',
    generation: {
      state: 'failed',
      inputSnapshot: snapshot,
      latestAttempt: {
        id: 'attempt-1',
        flow: snapshot.flow,
        source: 'create_trip_pending_auth',
        state: 'failed',
        startedAt: '2026-03-11T08:00:00.000Z',
      },
    },
  },
});

const readPrefillFromPath = (path: string) => {
  const url = new URL(path, 'https://travelflow.local');
  const encoded = url.searchParams.get('prefill');
  expect(encoded).toBeTruthy();
  return decodeTripPrefill(encoded!);
};

describe('services/tripClaimConflictService', () => {
  it('replaces the claim query with a stable claim-conflict marker', () => {
    expect(buildTripClaimConflictPath('/trip/trip-1?claim=req-1&view=map#details')).toBe(
      '/trip/trip-1?view=map&claim_conflict=already_claimed#details',
    );
  });

  it('restores a login return path with claim id and no conflict marker', () => {
    expect(buildTripClaimLoginReturnPath('/trip/trip-1?claim_conflict=already_claimed#details', 'req-2')).toBe(
      '/trip/trip-1?claim=req-2#details',
    );
  });

  it('builds a wizard create-similar prefill with the full normalized draft', () => {
    const trip = makeTrip({
      flow: 'wizard',
      destinationLabel: 'Mallorca',
      startDate: '2026-04-01',
      endDate: '2026-04-10',
      createdAt: '2026-03-11T08:00:00.000Z',
      payload: {
        options: {
          countries: ['Mallorca, Spain'],
          startDate: '2026-04-01',
          endDate: '2026-04-10',
          roundTrip: true,
          budget: 'Luxury',
          pace: 'Balanced',
          notes: 'Beach clubs, but avoid long transfers.',
          specificCities: 'Palma, Port de Sóller',
          dateInputMode: 'flex',
          flexWeeks: 2,
          flexWindow: 'shoulder',
          startDestination: 'Mallorca, Spain',
          destinationOrder: ['Mallorca, Spain'],
          routeLock: true,
          travelerType: 'friends',
          travelerDetails: {
            friendsCount: 4,
            friendsEnergy: 'mixed',
          },
          tripStyleTags: ['luxury', 'beach'],
          tripVibeTags: ['nightlife'],
          transportPreferences: ['car'],
          hasTransportOverride: true,
          idealMonths: ['May', 'June'],
          shoulderMonths: ['April'],
          recommendedDurationDays: 10,
          selectedIslandNames: ['Mallorca, Spain'],
          enforceIslandOnly: true,
        },
        wizardBranch: 'known_destinations_flexible_dates',
      },
    });

    const path = buildCreateSimilarTripPath({
      trip,
      pathname: '/de/trip/trip-1',
      source: 'trip_claim_conflict',
    });

    expect(path.startsWith('/de/create-trip/wizard?prefill=')).toBe(true);
    const parsed = readPrefillFromPath(path);
    expect(parsed?.countries).toEqual(['Mallorca']);
    expect(parsed?.mode).toBe('wizard');
    expect(parsed?.cities).toBe('Palma, Port de Sóller');
    expect(parsed?.styles).toEqual(['luxury', 'beach']);
    expect(parsed?.vibes).toEqual(['nightlife']);
    expect(parsed?.meta).toMatchObject({
      source: 'trip_claim_conflict',
      label: 'Mallorca',
      draft: {
        version: 2,
        wizardBranch: 'known_destinations_flexible_dates',
        dateInputMode: 'flex',
        flexWeeks: 2,
        flexWindow: 'shoulder',
        startDestination: 'Mallorca',
        destinationOrder: ['Mallorca'],
        routeLock: true,
        travelerType: 'friends',
        transportPreferences: ['car'],
        hasTransportOverride: true,
        specificCities: 'Palma, Port de Sóller',
        selectedIslandNames: ['Mallorca'],
        enforceIslandOnly: true,
      },
    });
  });

  it('builds a classic create-similar prefill with the new traveler and transport signals', () => {
    const trip = makeTrip({
      flow: 'classic',
      destinationLabel: 'Japan, South Korea',
      startDate: '2026-05-05',
      endDate: '2026-05-16',
      createdAt: '2026-03-11T08:00:00.000Z',
      payload: {
        destinationPrompt: 'Japan, South Korea',
        options: {
          budget: 'High',
          pace: 'Fast',
          roundTrip: false,
          dateInputMode: 'exact',
          startDestination: 'Japan',
          destinationOrder: ['Japan', 'South Korea'],
          routeLock: true,
          travelerType: 'couple',
          travelerDetails: {
            coupleTravelerA: 'female',
            coupleTravelerB: 'non-binary',
            coupleOccasion: 'city-break',
          },
          tripStyleTags: ['food', 'culture'],
          transportPreferences: ['train', 'plane'],
          hasTransportOverride: true,
          notes: 'Prioritize premium trains.',
        },
      },
    });

    const path = buildCreateSimilarTripPath({
      trip,
      pathname: '/trip/trip-1',
      source: 'trip_claim_conflict',
    });

    expect(path.startsWith('/create-trip?prefill=')).toBe(true);
    const parsed = readPrefillFromPath(path);
    expect(parsed?.countries).toEqual(['Japan', 'South Korea']);
    expect(parsed?.mode).toBe('classic');
    expect(parsed?.notes).toBe('Prioritize premium trains.');
    expect(parsed?.meta).toMatchObject({
      draft: {
        version: 2,
        startDestination: 'Japan',
        destinationOrder: ['Japan', 'South Korea'],
        routeLock: true,
        travelerType: 'couple',
        transportPreferences: ['train', 'plane'],
        hasTransportOverride: true,
        tripStyleTags: ['food', 'culture'],
      },
    });
  });
});
