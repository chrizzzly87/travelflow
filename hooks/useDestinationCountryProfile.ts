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

const isPrerendering = (): boolean => (
  typeof window !== 'undefined'
  && (window as unknown as { __TF_PRERENDER_EAGER__?: boolean }).__TF_PRERENDER_EAGER__ === true
);

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

    // During prerendering the /api/* edge routes are not reachable, so the fetch
    // settles into the error state and that markup gets baked into the static
    // HTML. The browser then hydrates from the loading state, the two trees
    // disagree in node count, and React mis-associates the sections that follow
    // - which corrupted the layout of every section below this one. Staying in
    // the loading state keeps the prerendered HTML identical to the first client
    // render; the real fetch runs after hydration.
    if (isPrerendering()) {
      setState({ result: null, isLoading: true, hasError: false });
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
