import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { APIProvider, useApiIsLoaded } from '@vis.gl/react-google-maps';
import { AppLanguage } from '../types';
import { getGoogleMapsApiKey, getStoredAppLanguage, normalizeAppLanguage } from '../utils';
import {
  getClientMapRuntimeResolution,
  getMapRendererChoice,
  getMapboxAccessToken,
  readMapRuntimeAdminOverride,
  setMapRendererChoice,
  subscribeToMapRendererChoice,
} from '../services/mapRuntimeService';
import { resolveMapRuntime, type MapRuntimeResolution } from '../shared/mapRuntime';
import type { MapRendererChoice } from '../types';

type GoogleMapsWindow = Window & typeof globalThis & {
  gm_authFailure?: () => void;
};

interface GoogleMapsContextType {
  isLoaded: boolean;
  loadError: Error | null;
}

interface MapRuntimeContextType {
  runtime: MapRuntimeResolution;
  mapboxAccessToken: string;
  /**
   * The traveller's basemap choice. `auto` hands the decision back to the
   * deploy's preset, which is the only value that follows an administrator
   * changing the default later.
   *
   * Setting this re-resolves the runtime in place. No reload: Google's map is
   * always the interaction layer, and "Mapbox" only means its tile pane is
   * hidden and a camera-synced Mapbox canvas draws underneath, so the swap is a
   * state change the marker rebuild already reacts to.
   */
  setRendererChoice: (choice: MapRendererChoice) => void;
  rendererChoice: MapRendererChoice;
}

const createFallbackMapRuntimeResolution = (): MapRuntimeResolution => resolveMapRuntime({
  defaultPreset: 'google_all',
  availability: {
    googleMapsKeyAvailable: false,
    mapboxAccessTokenAvailable: false,
  },
});

const GoogleMapsContext = createContext<GoogleMapsContextType>({ isLoaded: false, loadError: null });
const MapRuntimeContext = createContext<MapRuntimeContextType>({
  runtime: createFallbackMapRuntimeResolution(),
  mapboxAccessToken: '',
  setRendererChoice: setMapRendererChoice,
  rendererChoice: 'auto',
});

export const useGoogleMaps = () => useContext(GoogleMapsContext);
export const useMapRuntime = () => useContext(MapRuntimeContext);

const MAPS_LANGUAGE_MAP: Record<AppLanguage, string> = {
  en: 'en',
  es: 'es',
  de: 'de',
  fr: 'fr',
  pt: 'pt',
  ru: 'ru',
  it: 'it',
  pl: 'pl',
  ko: 'ko',
  fa: 'fa',
  ur: 'ur',
};

const GOOGLE_MAPS_KEY_PATTERN = /^AIza[A-Za-z0-9_-]{35}$/;
const GOOGLE_MAPS_LIBRARIES = ['places', 'marker', 'geometry', 'routes'];

interface MapRuntimeProviderProps {
  children: React.ReactNode;
  language?: AppLanguage;
  enabled?: boolean;
}

interface GoogleMapsLoadStateBridgeProps {
  onLoadedChange: (loaded: boolean) => void;
}

const GoogleMapsLoadStateBridge: React.FC<GoogleMapsLoadStateBridgeProps> = ({ onLoadedChange }) => {
  const apiIsLoaded = useApiIsLoaded();

  useEffect(() => {
    onLoadedChange(apiIsLoaded);
  }, [apiIsLoaded, onLoadedChange]);

  return null;
};

export const MapRuntimeProvider: React.FC<MapRuntimeProviderProps> = ({
  children,
  language,
  enabled = true,
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState<Error | null>(null);
  /**
   * Read from the module store rather than from local state, so a component
   * that renders this provider inside its own JSX still sees the choice it
   * makes. See the note on the store in `mapRuntimeService`.
   */
  const rendererChoice = useSyncExternalStore(
    subscribeToMapRendererChoice,
    getMapRendererChoice,
    () => 'auto' as MapRendererChoice,
  );
  /**
   * Re-resolved whenever the traveller's choice changes. The choice is passed
   * as a `selection.renderer` partial so the existing capability gating,
   * availability fallback and warning strings are reused rather than
   * reimplemented — a missing Mapbox token still lands on Google, with a
   * warning the customize sheet can show.
   *
   * An administrator's debug cookie is read inside `getClientMapRuntimeResolution`
   * and still wins, because that is a one-browser override.
   */
  const runtime = useMemo(() => {
    const adminOverride = readMapRuntimeAdminOverride();
    if (adminOverride) {
      return getClientMapRuntimeResolution({ override: adminOverride, overrideSource: 'cookie' });
    }
    if (rendererChoice === 'auto') {
      return getClientMapRuntimeResolution({ override: null });
    }
    return getClientMapRuntimeResolution({
      override: { selection: { renderer: rendererChoice } },
      overrideSource: 'query',
    });
  }, [rendererChoice]);
  const mapboxAccessToken = useMemo(() => getMapboxAccessToken().trim(), []);
  const requestedLanguage = normalizeAppLanguage(language ?? getStoredAppLanguage());
  const requestedMapLanguage = MAPS_LANGUAGE_MAP[requestedLanguage] ?? 'en';
  const apiKey = getGoogleMapsApiKey().trim();
  const isApiKeyValid = GOOGLE_MAPS_KEY_PATTERN.test(apiKey);
  const shouldMountProvider = enabled && isApiKeyValid;
  const providerKey = `${requestedMapLanguage}:${apiKey}`;

  useEffect(() => {
    if (!enabled) {
      setIsLoaded(false);
      setLoadError(null);
      return;
    }
    if (!isApiKeyValid) {
      setIsLoaded(false);
      setLoadError(new Error('Google Maps API key is missing or invalid for this deploy context'));
      return;
    }
    setIsLoaded(false);
    setLoadError(null);
  }, [enabled, isApiKeyValid, providerKey]);

  useEffect(() => {
    if (!shouldMountProvider || typeof window === 'undefined') return;
    const mapsWindow = window as GoogleMapsWindow;
    const previousAuthFailure = mapsWindow.gm_authFailure;
    mapsWindow.gm_authFailure = () => {
      setIsLoaded(false);
      setLoadError(new Error('Google Maps authentication failed (invalid API key or referrer restriction)'));
    };

    return () => {
      mapsWindow.gm_authFailure = previousAuthFailure;
    };
  }, [shouldMountProvider]);

  const handleLoadedChange = useCallback((loaded: boolean) => {
    if (!loaded) return;
    setIsLoaded(true);
    setLoadError(null);
  }, []);

  const handleProviderLoad = useCallback(() => {
    setIsLoaded(true);
    setLoadError(null);
  }, []);

  const handleProviderError = useCallback((error: unknown) => {
    setIsLoaded(false);
    if (error instanceof Error) {
      setLoadError(error);
      return;
    }
    setLoadError(new Error('Failed to load Google Maps script'));
  }, []);

  const runtimeContextValue = useMemo<MapRuntimeContextType>(() => ({
    runtime,
    mapboxAccessToken,
    rendererChoice,
    setRendererChoice: setMapRendererChoice,
  }), [mapboxAccessToken, rendererChoice, runtime]);

  const content = !shouldMountProvider
    ? children
    : (
      <APIProvider
        key={providerKey}
        apiKey={apiKey}
        language={requestedMapLanguage}
        libraries={GOOGLE_MAPS_LIBRARIES}
        onLoad={handleProviderLoad}
        onError={handleProviderError}
      >
        <GoogleMapsLoadStateBridge onLoadedChange={handleLoadedChange} />
        {children}
      </APIProvider>
    );

  return (
    <MapRuntimeContext.Provider value={runtimeContextValue}>
      <GoogleMapsContext.Provider value={{ isLoaded, loadError }}>
        {content}
      </GoogleMapsContext.Provider>
    </MapRuntimeContext.Provider>
  );
};
