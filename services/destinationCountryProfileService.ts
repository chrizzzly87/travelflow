import type {
  DestinationCountryProfileResult,
  DestinationCountrySourceProfile,
  DestinationSourceProvenance,
} from '../shared/destinationCountryProfile';

interface DestinationProfileApiResponse {
  data?: {
    sourceProfile?: DestinationCountrySourceProfile;
    provenance?: DestinationSourceProvenance | null;
  };
}

const profileCache = new Map<string, DestinationCountryProfileResult>();
const pendingProfiles = new Map<string, Promise<DestinationCountryProfileResult | null>>();

const normalizeCountrySlug = (countrySlug: string): string => countrySlug.trim().toLocaleLowerCase();

export const getCachedDestinationCountryProfile = (
  countrySlug: string,
): DestinationCountryProfileResult | null => profileCache.get(normalizeCountrySlug(countrySlug)) || null;

export const loadDestinationCountryProfile = async (
  countrySlug: string,
  signal?: AbortSignal,
): Promise<DestinationCountryProfileResult | null> => {
  const normalizedSlug = normalizeCountrySlug(countrySlug);
  const cached = profileCache.get(normalizedSlug);
  if (cached) return cached;

  const pending = pendingProfiles.get(normalizedSlug);
  if (pending && !signal) return pending;

  const request = (async () => {
    const response = await fetch(
      `/api/destinations/${encodeURIComponent(normalizedSlug)}?include=source-profile`,
      { headers: { accept: 'application/json' }, signal },
    );
    if (!response.ok) throw new Error(`Destination profile request failed with ${response.status}`);

    const payload = await response.json() as DestinationProfileApiResponse;
    if (!payload.data?.sourceProfile) return null;

    const result = {
      profile: payload.data.sourceProfile,
      provenance: payload.data.provenance || null,
    };
    profileCache.set(normalizedSlug, result);
    return result;
  })();

  if (!signal) pendingProfiles.set(normalizedSlug, request);
  try {
    return await request;
  } finally {
    if (!signal) pendingProfiles.delete(normalizedSlug);
  }
};

export const clearDestinationCountryProfileCacheForTests = (): void => {
  profileCache.clear();
  pendingProfiles.clear();
};
