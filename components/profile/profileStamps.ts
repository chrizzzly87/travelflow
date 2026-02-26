import type { ITrip } from '../../types';
import { getTripDistanceKm } from '../../utils';
import { collectVisitedCountries } from './profileCountryUtils';

export type ProfileStampGroup = 'trips' | 'curation' | 'exploration' | 'social' | 'momentum';
export type ProfileStampSort = 'date' | 'rarity' | 'group';

type ProfileStampMetricKey =
  | 'tripCount'
  | 'activeTripCount'
  | 'favoritesCount'
  | 'pinnedCount'
  | 'countriesCount'
  | 'citiesCount'
  | 'distanceKm'
  | 'likesGiven'
  | 'likesEarned';

export interface ProfileStampDefinition {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  group: ProfileStampGroup;
  metricKey: ProfileStampMetricKey;
  target: number;
  rarityPercent: number;
  assetPath: string;
}

export interface ProfileStampMetrics {
  tripCount: number;
  activeTripCount: number;
  favoritesCount: number;
  pinnedCount: number;
  countriesCount: number;
  citiesCount: number;
  distanceKm: number;
  likesGiven: number;
  likesEarned: number;
  latestTripUpdateAt: number | null;
  tripCreatedAtAsc: number[];
  activeTripUpdatedAtAsc: number[];
  favoriteUpdatedAtAsc: number[];
  pinnedAtAsc: number[];
}

export interface ProfileStampProgress {
  definition: ProfileStampDefinition;
  achieved: boolean;
  achievedAt: number | null;
  currentValue: number;
  targetValue: number;
}

const PLACEHOLDER_ASSET_BY_GROUP: Record<ProfileStampGroup, string> = {
  trips: '/images/stamps/trips.svg',
  curation: '/images/stamps/curation.svg',
  exploration: '/images/stamps/exploration.svg',
  social: '/images/stamps/social.svg',
  momentum: '/images/stamps/momentum.svg',
};

const DEFAULT_STAMP_DEFINITIONS: ProfileStampDefinition[] = [
  {
    id: 'first_trip_created',
    title: 'First Trip',
    subtitle: 'Create your very first trip.',
    description: 'Your passport opens with the first custom trip you create.',
    group: 'trips',
    metricKey: 'tripCount',
    target: 1,
    rarityPercent: 88,
    assetPath: PLACEHOLDER_ASSET_BY_GROUP.trips,
  },
  {
    id: 'trip_architect_10',
    title: 'Trip Architect',
    subtitle: 'Create 10 trips.',
    description: 'A milestone for travelers who keep building new routes.',
    group: 'trips',
    metricKey: 'tripCount',
    target: 10,
    rarityPercent: 31,
    assetPath: PLACEHOLDER_ASSET_BY_GROUP.trips,
  },
  {
    id: 'active_planner_3',
    title: 'Active Planner',
    subtitle: 'Keep 3 active trips.',
    description: 'You are running multiple journeys in parallel.',
    group: 'trips',
    metricKey: 'activeTripCount',
    target: 3,
    rarityPercent: 24,
    assetPath: PLACEHOLDER_ASSET_BY_GROUP.momentum,
  },
  {
    id: 'first_saved_trip',
    title: 'First Save',
    subtitle: 'Save one trip to favorites.',
    description: 'You started collecting ideas and routes worth keeping.',
    group: 'curation',
    metricKey: 'favoritesCount',
    target: 1,
    rarityPercent: 71,
    assetPath: PLACEHOLDER_ASSET_BY_GROUP.curation,
  },
  {
    id: 'curator_10',
    title: 'Curator',
    subtitle: 'Save 10 trips.',
    description: 'Your travel idea shelf now has serious depth.',
    group: 'curation',
    metricKey: 'favoritesCount',
    target: 10,
    rarityPercent: 27,
    assetPath: PLACEHOLDER_ASSET_BY_GROUP.curation,
  },
  {
    id: 'pin_showcase_3',
    title: 'Showcase Ready',
    subtitle: 'Pin 3 highlight trips.',
    description: 'You curated your profile top section like a pro.',
    group: 'curation',
    metricKey: 'pinnedCount',
    target: 3,
    rarityPercent: 18,
    assetPath: PLACEHOLDER_ASSET_BY_GROUP.curation,
  },
  {
    id: 'country_collector_5',
    title: 'Country Collector',
    subtitle: 'Visit 5 countries.',
    description: 'A growing passport footprint across the map.',
    group: 'exploration',
    metricKey: 'countriesCount',
    target: 5,
    rarityPercent: 22,
    assetPath: PLACEHOLDER_ASSET_BY_GROUP.exploration,
  },
  {
    id: 'city_hopper_25',
    title: 'City Hopper',
    subtitle: 'Add 25 city stops.',
    description: 'You are moving with real momentum across destinations.',
    group: 'exploration',
    metricKey: 'citiesCount',
    target: 25,
    rarityPercent: 16,
    assetPath: PLACEHOLDER_ASSET_BY_GROUP.exploration,
  },
  {
    id: 'distance_1000',
    title: 'Kilometer Club',
    subtitle: 'Plan 1,000 km total.',
    description: 'Your journeys now stretch across major travel distances.',
    group: 'momentum',
    metricKey: 'distanceKm',
    target: 1000,
    rarityPercent: 29,
    assetPath: PLACEHOLDER_ASSET_BY_GROUP.momentum,
  },
  {
    id: 'likes_given_25',
    title: 'Signal Booster',
    subtitle: 'Give 25 likes.',
    description: 'You support other travelers and spotlight good routes.',
    group: 'social',
    metricKey: 'likesGiven',
    target: 25,
    rarityPercent: 34,
    assetPath: PLACEHOLDER_ASSET_BY_GROUP.social,
  },
  {
    id: 'likes_earned_25',
    title: 'Crowd Favorite',
    subtitle: 'Earn 25 likes.',
    description: 'Your trips are resonating with fellow travelers.',
    group: 'social',
    metricKey: 'likesEarned',
    target: 25,
    rarityPercent: 11,
    assetPath: PLACEHOLDER_ASSET_BY_GROUP.social,
  },
];

const asTimestamp = (value: unknown): number | null => {
  const numberValue = typeof value === 'number' && Number.isFinite(value) ? value : null;
  if (numberValue === null || numberValue <= 0) return null;
  return numberValue;
};

const maxTimestamp = (values: Array<number | null>): number | null => {
  const normalized = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (normalized.length === 0) return null;
  return Math.max(...normalized);
};

const nthTimestamp = (timestamps: number[], threshold: number): number | null => {
  if (threshold <= 0) return null;
  if (timestamps.length < threshold) return null;
  return timestamps[threshold - 1] ?? null;
};

export const computeProfileStampMetrics = (
  trips: ITrip[],
  options?: {
    likesGiven?: number;
    likesEarned?: number;
  }
): ProfileStampMetrics => {
  const activeTrips = trips.filter((trip) => (trip.status || 'active') === 'active');
  const favoriteTrips = trips.filter((trip) => Boolean(trip.isFavorite));
  const pinnedTrips = trips.filter((trip) => Boolean(trip.isPinned));
  const cityCount = trips.reduce((sum, trip) => (
    sum + trip.items.filter((item) => item.type === 'city').length
  ), 0);
  const tripCreatedAtAsc = trips
    .map((trip) => asTimestamp(trip.createdAt))
    .filter((value): value is number => typeof value === 'number')
    .sort((a, b) => a - b);
  const activeTripUpdatedAtAsc = activeTrips
    .map((trip) => asTimestamp(trip.updatedAt))
    .filter((value): value is number => typeof value === 'number')
    .sort((a, b) => a - b);
  const favoriteUpdatedAtAsc = favoriteTrips
    .map((trip) => asTimestamp(trip.updatedAt))
    .filter((value): value is number => typeof value === 'number')
    .sort((a, b) => a - b);
  const pinnedAtAsc = pinnedTrips
    .map((trip) => asTimestamp(trip.pinnedAt) ?? asTimestamp(trip.updatedAt))
    .filter((value): value is number => typeof value === 'number')
    .sort((a, b) => a - b);

  return {
    tripCount: trips.length,
    activeTripCount: activeTrips.length,
    favoritesCount: favoriteTrips.length,
    pinnedCount: pinnedTrips.length,
    countriesCount: collectVisitedCountries(trips).length,
    citiesCount: cityCount,
    distanceKm: trips.reduce((sum, trip) => sum + getTripDistanceKm(trip.items), 0),
    likesGiven: Math.max(0, Math.floor(options?.likesGiven ?? favoriteTrips.length)),
    likesEarned: Math.max(0, Math.floor(options?.likesEarned ?? 0)),
    latestTripUpdateAt: maxTimestamp(trips.map((trip) => asTimestamp(trip.updatedAt))),
    tripCreatedAtAsc,
    activeTripUpdatedAtAsc,
    favoriteUpdatedAtAsc,
    pinnedAtAsc,
  };
};

const resolveAchievedAt = (
  definition: ProfileStampDefinition,
  metrics: ProfileStampMetrics
): number | null => {
  if (definition.metricKey === 'tripCount') {
    return nthTimestamp(metrics.tripCreatedAtAsc, definition.target);
  }
  if (definition.metricKey === 'activeTripCount') {
    return nthTimestamp(metrics.activeTripUpdatedAtAsc, definition.target);
  }
  if (definition.metricKey === 'favoritesCount') {
    return nthTimestamp(metrics.favoriteUpdatedAtAsc, definition.target);
  }
  if (definition.metricKey === 'pinnedCount') {
    return nthTimestamp(metrics.pinnedAtAsc, definition.target);
  }
  return metrics.latestTripUpdateAt;
};

export const buildProfileStampProgress = (
  metrics: ProfileStampMetrics,
  definitions: ProfileStampDefinition[] = DEFAULT_STAMP_DEFINITIONS
): ProfileStampProgress[] => {
  return definitions.map((definition) => {
    const currentValue = metrics[definition.metricKey];
    const achieved = currentValue >= definition.target;
    return {
      definition,
      achieved,
      achievedAt: achieved ? resolveAchievedAt(definition, metrics) : null,
      currentValue,
      targetValue: definition.target,
    };
  });
};

export const getLastAchievedStamps = (stamps: ProfileStampProgress[], limit = 3): ProfileStampProgress[] => {
  return stamps
    .filter((stamp) => stamp.achieved)
    .sort((a, b) => (b.achievedAt || 0) - (a.achievedAt || 0))
    .slice(0, Math.max(0, limit));
};

export const sortProfileStamps = (stamps: ProfileStampProgress[], sortBy: ProfileStampSort): ProfileStampProgress[] => {
  const sorted = [...stamps];
  if (sortBy === 'rarity') {
    return sorted.sort((a, b) => a.definition.rarityPercent - b.definition.rarityPercent);
  }
  if (sortBy === 'group') {
    return sorted.sort((a, b) => {
      const byGroup = a.definition.group.localeCompare(b.definition.group);
      if (byGroup !== 0) return byGroup;
      return a.definition.title.localeCompare(b.definition.title);
    });
  }

  return sorted.sort((a, b) => (b.achievedAt || 0) - (a.achievedAt || 0));
};

export const PROFILE_STAMP_DEFINITIONS = DEFAULT_STAMP_DEFINITIONS;
