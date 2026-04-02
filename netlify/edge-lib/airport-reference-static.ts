import {
  normalizeAirportReferenceMetadata,
  normalizeAirportSnapshot,
  type AirportReference,
  type AirportReferenceMetadata,
} from '../../shared/airportReference.ts';

const AIRPORTS_SNAPSHOT_ASSET_PATH = '/data/airports/commercialAirports.generated.json';
const AIRPORTS_METADATA_ASSET_PATH = '/data/airports/metadata.generated.json';

const snapshotCache = new Map<string, Promise<AirportReference[]>>();
const metadataCache = new Map<string, Promise<AirportReferenceMetadata | null>>();

const resolveAssetUrl = (requestUrl: string | URL, assetPath: string): string => (
  new URL(assetPath, requestUrl).toString()
);

const loadJson = async (requestUrl: string | URL, assetPath: string, fetchImpl: typeof fetch): Promise<unknown> => {
  const response = await fetchImpl(resolveAssetUrl(requestUrl, assetPath));
  if (!response.ok) {
    throw new Error(`Failed to load ${assetPath}: ${response.status} ${response.statusText}`);
  }
  return response.json();
};

export const loadCommercialAirportReferencesFromStaticAsset = async (
  requestUrl: string | URL,
  fetchImpl: typeof fetch = fetch,
): Promise<AirportReference[]> => {
  const cacheKey = new URL(requestUrl).origin;
  if (!snapshotCache.has(cacheKey)) {
    snapshotCache.set(cacheKey, loadJson(requestUrl, AIRPORTS_SNAPSHOT_ASSET_PATH, fetchImpl)
      .then((payload) => normalizeAirportSnapshot(payload))
      .catch(() => []));
  }
  return snapshotCache.get(cacheKey)!;
};

export const loadAirportReferenceMetadataFromStaticAsset = async (
  requestUrl: string | URL,
  fetchImpl: typeof fetch = fetch,
): Promise<AirportReferenceMetadata | null> => {
  const cacheKey = new URL(requestUrl).origin;
  if (!metadataCache.has(cacheKey)) {
    metadataCache.set(cacheKey, loadJson(requestUrl, AIRPORTS_METADATA_ASSET_PATH, fetchImpl)
      .then((payload) => normalizeAirportReferenceMetadata(payload))
      .catch(() => null));
  }
  return metadataCache.get(cacheKey)!;
};

export const __airportReferenceStaticInternals = {
  resolveAssetUrl,
};
