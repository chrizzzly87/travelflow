import { describe, expect, it } from 'vitest';
import { makeCityItem, makeTrip } from '../helpers/tripFixtures';
import {
  buildProfileStampProgress,
  computeProfileStampMetrics,
  getLastAchievedStamps,
} from '../../components/profile/profileStamps';

describe('components/profile/profileStamps', () => {
  it('computes metrics and unlocks basic trip milestones', () => {
    const trips = Array.from({ length: 10 }, (_, index) => makeTrip({
      id: `trip-${index + 1}`,
      createdAt: 100 + index,
      updatedAt: 200 + index,
      isFavorite: index < 2,
      isPinned: index < 1,
      pinnedAt: index < 1 ? 350 : undefined,
      items: [
        { ...makeCityItem({ id: `city-${index + 1}`, title: `City ${index + 1}`, startDateOffset: 0, duration: 2 }), countryName: 'Germany' },
      ],
    }));

    const metrics = computeProfileStampMetrics(trips, {
      likesGiven: 0,
      likesEarned: 0,
    });
    const progress = buildProfileStampProgress(metrics);

    const firstTrip = progress.find((stamp) => stamp.definition.id === 'first_trip_created');
    const tripArchitect = progress.find((stamp) => stamp.definition.id === 'trip_architect_10');

    expect(metrics.tripCount).toBe(10);
    expect(firstTrip?.achieved).toBe(true);
    expect(tripArchitect?.achieved).toBe(true);
    expect(tripArchitect?.achievedAt).toBe(109);
  });

  it('returns latest achieved stamps sorted by achieved date desc', () => {
    const trips = [
      makeTrip({
        id: 'trip-a',
        createdAt: 100,
        updatedAt: 500,
        isFavorite: true,
        items: [{ ...makeCityItem({ id: 'city-a', title: 'Berlin', startDateOffset: 0, duration: 3 }), countryName: 'Germany' }],
      }),
      makeTrip({
        id: 'trip-b',
        createdAt: 200,
        updatedAt: 600,
        isFavorite: true,
        items: [{ ...makeCityItem({ id: 'city-b', title: 'Paris', startDateOffset: 0, duration: 3 }), countryName: 'France' }],
      }),
    ];

    const metrics = computeProfileStampMetrics(trips, {
      likesGiven: 0,
      likesEarned: 0,
    });
    const progress = buildProfileStampProgress(metrics);
    const latest = getLastAchievedStamps(progress, 2);

    expect(latest).toHaveLength(2);
    expect((latest[0].achievedAt || 0) >= (latest[1].achievedAt || 0)).toBe(true);
  });
});
