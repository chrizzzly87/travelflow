import { useEffect, useState } from 'react';
import type { DestinationCountryProfileResult } from '../shared/destinationCountryProfile';
import {
  getCachedDestinationCountryProfile,
  loadDestinationCountryProfile,
} from '../services/destinationCountryProfileService';

interface DestinationCountryProfileState {
  result: DestinationCountryProfileResult | null;
  isLoading: boolean;
  hasError: boolean;
}

export const useDestinationCountryProfile = (
  countrySlug: string,
  enabled = true,
): DestinationCountryProfileState => {
  const cached = enabled ? getCachedDestinationCountryProfile(countrySlug) : null;
  const [state, setState] = useState<DestinationCountryProfileState>(() => ({
    result: cached,
    isLoading: enabled && !cached,
    hasError: false,
  }));

  useEffect(() => {
    if (!enabled) {
      setState({ result: null, isLoading: false, hasError: false });
      return undefined;
    }

    const cachedResult = getCachedDestinationCountryProfile(countrySlug);
    if (cachedResult) {
      setState({ result: cachedResult, isLoading: false, hasError: false });
      return undefined;
    }

    const controller = new AbortController();
    setState({ result: null, isLoading: true, hasError: false });
    loadDestinationCountryProfile(countrySlug, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setState({ result, isLoading: false, hasError: false });
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ result: null, isLoading: false, hasError: true });
      });

    return () => controller.abort();
  }, [countrySlug, enabled]);

  return state;
};
