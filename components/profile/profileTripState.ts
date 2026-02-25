import type { ITrip } from '../../types';

export type ProfileTripTab = 'recent' | 'favorites' | 'all' | 'liked';
export type ProfileRecentSort = 'created' | 'updated';

export const PROFILE_TRIP_TABS: ProfileTripTab[] = ['recent', 'favorites', 'all', 'liked'];
export const PROFILE_RECENT_SORTS: ProfileRecentSort[] = ['created', 'updated'];
export const MAX_PINNED_TRIPS = 3;

export type TripSourceLabelKey =
  | 'createdByYou'
  | 'copiedFromShared'
  | 'copiedFromYourTrip'
  | 'startedFromExample';

const normalizeTimestamp = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

export const normalizeProfileTripTab = (value: string | null | undefined): ProfileTripTab =>
  value === 'favorites' || value === 'all' || value === 'liked' || value === 'recent'
    ? value
    : 'recent';

export const normalizeProfileRecentSort = (value: string | null | undefined): ProfileRecentSort =>
  value === 'updated' || value === 'created'
    ? value
    : 'created';

export const getTripSourceLabelKey = (trip: ITrip): TripSourceLabelKey => {
  if (trip.sourceKind === 'duplicate_shared' || trip.forkedFromShareToken) {
    return 'copiedFromShared';
  }
  if (trip.sourceKind === 'duplicate_trip' || trip.forkedFromTripId) {
    return 'copiedFromYourTrip';
  }
  if (trip.sourceKind === 'example' || trip.forkedFromExampleTemplateId || trip.isExample) {
    return 'startedFromExample';
  }
  return 'createdByYou';
};

export const sortTripsByCreatedDesc = (trips: ITrip[]): ITrip[] =>
  [...trips].sort((a, b) => {
    const byCreated = normalizeTimestamp(b.createdAt) - normalizeTimestamp(a.createdAt);
    if (byCreated !== 0) return byCreated;
    return normalizeTimestamp(b.updatedAt) - normalizeTimestamp(a.updatedAt);
  });

export const sortTripsByUpdatedDesc = (trips: ITrip[]): ITrip[] =>
  [...trips].sort((a, b) => {
    const byUpdated = normalizeTimestamp(b.updatedAt) - normalizeTimestamp(a.updatedAt);
    if (byUpdated !== 0) return byUpdated;
    return normalizeTimestamp(b.createdAt) - normalizeTimestamp(a.createdAt);
  });

export const getRecentTrips = (trips: ITrip[], sort: ProfileRecentSort): ITrip[] =>
  sort === 'updated' ? sortTripsByUpdatedDesc(trips) : sortTripsByCreatedDesc(trips);

export const getTripsForProfileTab = (
  trips: ITrip[],
  tab: ProfileTripTab,
  recentSort: ProfileRecentSort
): ITrip[] => {
  if (tab === 'liked') return [];
  if (tab === 'favorites') {
    return sortTripsByUpdatedDesc(trips.filter((trip) => Boolean(trip.isFavorite)));
  }
  if (tab === 'all') {
    return sortTripsByUpdatedDesc(trips);
  }
  return getRecentTrips(trips, recentSort);
};

const comparePinnedAsc = (a: ITrip, b: ITrip): number => {
  const byPinnedAt = normalizeTimestamp(a.pinnedAt) - normalizeTimestamp(b.pinnedAt);
  if (byPinnedAt !== 0) return byPinnedAt;

  const byCreated = normalizeTimestamp(a.createdAt) - normalizeTimestamp(b.createdAt);
  if (byCreated !== 0) return byCreated;

  return a.id.localeCompare(b.id);
};

export const getPinnedTrips = (trips: ITrip[]): ITrip[] =>
  [...trips]
    .filter((trip) => Boolean(trip.isPinned))
    .sort((a, b) => comparePinnedAsc(b, a));

interface ToggleFavoriteResult {
  trips: ITrip[];
  nextFavoriteState: boolean;
}

export const toggleTripFavorite = (
  trips: ITrip[],
  tripId: string,
  now: number = Date.now()
): ToggleFavoriteResult => {
  let nextFavoriteState = false;
  const nextTrips = trips.map((trip) => {
    if (trip.id !== tripId) return trip;
    nextFavoriteState = !Boolean(trip.isFavorite);
    return {
      ...trip,
      isFavorite: nextFavoriteState,
      updatedAt: now,
    };
  });

  return {
    trips: nextTrips,
    nextFavoriteState,
  };
};

interface TogglePinnedResult {
  trips: ITrip[];
  nextPinnedState: boolean;
  evictedTripIds: string[];
}

export const toggleTripPinned = (
  trips: ITrip[],
  tripId: string,
  now: number = Date.now(),
  maxPinnedTrips: number = MAX_PINNED_TRIPS
): TogglePinnedResult => {
  let nextPinnedState = false;
  const baseTrips = trips.map((trip) => {
    if (trip.id !== tripId) return trip;
    nextPinnedState = !Boolean(trip.isPinned);
    return {
      ...trip,
      isPinned: nextPinnedState,
      pinnedAt: nextPinnedState ? now : undefined,
      updatedAt: now,
    };
  });

  const pinned = baseTrips.filter((trip) => Boolean(trip.isPinned)).sort(comparePinnedAsc);
  const overflowCount = Math.max(0, pinned.length - maxPinnedTrips);
  const evictedTripIds = pinned.slice(0, overflowCount).map((trip) => trip.id);

  if (evictedTripIds.length === 0) {
    return {
      trips: baseTrips,
      nextPinnedState,
      evictedTripIds,
    };
  }

  const evictedIdSet = new Set(evictedTripIds);
  const nextTrips = baseTrips.map((trip) => {
    if (!evictedIdSet.has(trip.id)) return trip;
    return {
      ...trip,
      isPinned: false,
      pinnedAt: undefined,
      updatedAt: now,
    };
  });

  return {
    trips: nextTrips,
    nextPinnedState: nextPinnedState && !evictedIdSet.has(tripId),
    evictedTripIds,
  };
};
