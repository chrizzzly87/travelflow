import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { APIProvider, useApiIsLoaded } from '@vis.gl/react-google-maps';
import { AppLanguage } from '../types';
import { getGoogleMapsApiKey, getStoredAppLanguage, normalizeAppLanguage } from '../utils';

type GoogleMapsWindow = Window & typeof globalThis & {
    gm_authFailure?: () => void;
};

interface GoogleMapsContextType {
    isLoaded: boolean;
    loadError: Error | null;
}

const GoogleMapsContext = createContext<GoogleMapsContextType>({ isLoaded: false, loadError: null });

export const useGoogleMaps = () => useContext(GoogleMapsContext);

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

interface GoogleMapsLoaderProps {
    children: React.ReactNode;
    language?: AppLanguage;
    enabled?: boolean;
}

const GOOGLE_MAPS_LIBRARIES = ['places', 'marker', 'geometry', 'routes'];

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

export const GoogleMapsLoader: React.FC<GoogleMapsLoaderProps> = ({ children, language, enabled = true }) => {
    const [isLoaded, setIsLoaded] = useState(false);
    const [loadError, setLoadError] = useState<Error | null>(null);
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

    const contextValue = React.useMemo<GoogleMapsContextType>(() => {
        if (!enabled) {
            return { isLoaded: false, loadError: null };
        }

        if (!isApiKeyValid) {
            return {
                isLoaded: false,
                loadError: loadError ?? new Error('Google Maps API key is missing or invalid for this deploy context'),
            };
        }

        return { isLoaded, loadError };
    }, [enabled, isApiKeyValid, isLoaded, loadError]);

    if (!shouldMountProvider) {
        return (
            <GoogleMapsContext.Provider value={contextValue}>
                {children}
            </GoogleMapsContext.Provider>
        );
    }

    return (
        <GoogleMapsContext.Provider value={contextValue}>
            <React.Fragment key={providerKey}>
                <APIProvider
                    apiKey={apiKey}
                    language={requestedMapLanguage}
                    libraries={GOOGLE_MAPS_LIBRARIES}
                    onLoad={handleProviderLoad}
                    onError={handleProviderError}
                >
                    <GoogleMapsLoadStateBridge onLoadedChange={handleLoadedChange} />
                    {children}
                </APIProvider>
            </React.Fragment>
        </GoogleMapsContext.Provider>
    );
};
