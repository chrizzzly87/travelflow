import { useEffect, useSyncExternalStore } from 'react';

import { shouldOfferUserLocation } from '../components/maps/userLocationMarker';
import {
  ensureRuntimeLocationLoaded,
  getRuntimeLocationSnapshot,
  subscribeRuntimeLocation,
} from '../services/runtimeLocationService';
import {
  acquireUserLocationWatch,
  getUserLocationSnapshot,
  subscribeUserLocation,
  type UserLocationSnapshot,
} from '../services/userLocationService';
import type { ITimelineItem } from '../types';

const subscribeRuntimeLocationStore = (onChange: () => void) => subscribeRuntimeLocation(() => onChange());

export interface TripUserLocation extends UserLocationSnapshot {
  /** The control is shown, and the watch may run. False keeps the feature entirely invisible. */
  isOffered: boolean;
}

/**
 * The traveller's own position for one trip map.
 *
 * Two effects, both synchronising with something outside React: the IP country lookup (a network
 * request, only needed when the trip is not running today) and the geolocation watch, which is
 * held for as long as a map offering the dot is mounted.
 */
export const useTripUserLocation = ({
  enabled,
  items,
  todayDayOffset,
}: {
  enabled: boolean;
  items: ITimelineItem[];
  todayDayOffset: number | null | undefined;
}): TripUserLocation => {
  const snapshot = useSyncExternalStore(subscribeUserLocation, getUserLocationSnapshot, getUserLocationSnapshot);
  const runtimeLocation = useSyncExternalStore(
    subscribeRuntimeLocationStore,
    getRuntimeLocationSnapshot,
    getRuntimeLocationSnapshot,
  );

  const isTripRunning = typeof todayDayOffset === 'number' && Number.isFinite(todayDayOffset);
  const needsCountryLookup = enabled && !isTripRunning;

  useEffect(() => {
    if (!needsCountryLookup) return;
    void ensureRuntimeLocationLoaded();
  }, [needsCountryLookup]);

  const isOffered = enabled && shouldOfferUserLocation({
    todayDayOffset,
    items,
    visitorCountryCode: runtimeLocation.location.countryCode,
  });

  useEffect(() => {
    if (!isOffered) return;
    return acquireUserLocationWatch();
  }, [isOffered]);

  return { ...snapshot, isOffered };
};
