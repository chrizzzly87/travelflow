import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import {
  dismissCountryOrigin,
  ensureCountryOriginLoaded,
  getCountryOriginServerSnapshot,
  getCountryOriginSnapshot,
  restoreCountryOrigin,
  subscribeCountryOrigin,
  type CountryOriginSnapshot,
} from '../services/countryOriginService';
import { buildCountryDistanceIndex } from '../services/countryDistanceService';

export interface UseCountryOriginResult extends CountryOriginSnapshot {
  /** Straight-line km per country code. Empty whenever we have no usable origin. */
  distanceKmByCountry: ReadonlyMap<string, number>;
  /** True only when a distance sort would produce a real order. */
  canSortByDistance: boolean;
  dismiss: () => void;
  restore: () => void;
}

const EMPTY_DISTANCES: ReadonlyMap<string, number> = new Map();

/**
 * Reads the approximate, IP-derived origin and turns it into the distance index the explorer
 * sorts by.
 *
 * The lookup is **opt-in**: nothing is fetched until `enabled` is true, which the page only sets
 * once the traveller actually asks for the "nearest to me" sort (or arrives on a shared URL that
 * already requests it). That keeps a geolocation call off the critical path of an ordinary visit.
 *
 * The single effect exists to drive a network request from render-derived intent — the one case
 * the repo's effect policy allows, and the same pattern as
 * {@link ../app/bootstrap/useRuntimeLocationBootstrap}. Everything else is derived, and the
 * snapshot itself comes from `useSyncExternalStore` rather than mirrored into local state.
 */
export const useCountryOrigin = (
  countryCodes: readonly string[],
  enabled: boolean,
): UseCountryOriginResult => {
  const snapshot = useSyncExternalStore(
    subscribeCountryOrigin,
    getCountryOriginSnapshot,
    getCountryOriginServerSnapshot,
  );

  const shouldLoad = enabled && (snapshot.status === 'idle' || snapshot.status === 'unavailable');

  useEffect(() => {
    // `unavailable` is included so a retry is possible, but `ensureCountryOriginLoaded` caches the
    // session result, so a genuinely failed lookup is not re-attempted on every render.
    if (!shouldLoad) return;
    void ensureCountryOriginLoaded();
  }, [shouldLoad]);

  const distanceKmByCountry = useMemo(() => (
    snapshot.origin ? buildCountryDistanceIndex(countryCodes, snapshot.origin) : EMPTY_DISTANCES
  ), [snapshot.origin, countryCodes]);

  const dismiss = useCallback(() => { dismissCountryOrigin(); }, []);
  const restore = useCallback(() => { restoreCountryOrigin(); }, []);

  return {
    ...snapshot,
    distanceKmByCountry,
    canSortByDistance: distanceKmByCountry.size > 0,
    dismiss,
    restore,
  };
};
