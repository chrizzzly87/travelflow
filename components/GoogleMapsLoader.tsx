import React, { createContext, useContext, useEffect, useState } from 'react';
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
};

const GOOGLE_MAPS_KEY_PATTERN = /^AIza[A-Za-z0-9_-]{35}$/;

interface GoogleMapsLoaderProps {
    children: React.ReactNode;
    language?: AppLanguage;
    enabled?: boolean;
}

export const GoogleMapsLoader: React.FC<GoogleMapsLoaderProps> = ({ children, language, enabled = true }) => {
    const [isLoaded, setIsLoaded] = useState(false);
    const [loadError, setLoadError] = useState<Error | null>(null);
    const requestedLanguage = normalizeAppLanguage(language ?? getStoredAppLanguage());
    const requestedMapLanguage = MAPS_LANGUAGE_MAP[requestedLanguage] ?? 'en';

    useEffect(() => {
        if (!enabled) {
            setIsLoaded(false);
            setLoadError(null);
            return;
        }

        const mapsWindow = window as GoogleMapsWindow;
        const isGoogleMapsReady = () => Boolean(window.google?.maps?.Map && typeof window.google.maps.Map === 'function');
        const settleLoaded = () => {
            setIsLoaded(true);
            setLoadError(null);
        };
        let readyCheckLoop: number | null = null;
        let readyCheckTimeout: number | null = null;
        const previousAuthFailure = mapsWindow.gm_authFailure;

        if (isGoogleMapsReady()) {
            settleLoaded();
            return;
        }

        const apiKey = getGoogleMapsApiKey().trim();
        if (!GOOGLE_MAPS_KEY_PATTERN.test(apiKey)) {
            setLoadError(new Error('Google Maps API key is missing or invalid for this deploy context'));
            return;
        }

        mapsWindow.gm_authFailure = () => {
            setLoadError(new Error('Google Maps authentication failed (invalid API key or referrer restriction)'));
        };

        const scriptId = 'google-maps-script';
        const existingScript = document.getElementById(scriptId);
        if (existingScript) {
            // Script already exists; poll until constructors are ready.
            const checkLoop = window.setInterval(() => {
                if (isGoogleMapsReady()) {
                    window.clearInterval(checkLoop);
                    settleLoaded();
                }
            }, 50);
            return () => {
                window.clearInterval(checkLoop);
                mapsWindow.gm_authFailure = previousAuthFailure;
            };
        }

        const script = document.createElement('script');
        script.id = scriptId;
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,marker,geometry&language=${encodeURIComponent(requestedMapLanguage)}&loading=async`;
        script.dataset.language = requestedMapLanguage;
        script.async = true;
        script.defer = true;
        
        script.onload = () => {
            if (isGoogleMapsReady()) {
                settleLoaded();
                return;
            }

            // Some environments expose `google.maps` before constructors are fully ready.
            readyCheckLoop = window.setInterval(() => {
                if (isGoogleMapsReady()) {
                    if (readyCheckLoop !== null) {
                        window.clearInterval(readyCheckLoop);
                        readyCheckLoop = null;
                    }
                    if (readyCheckTimeout !== null) {
                        window.clearTimeout(readyCheckTimeout);
                        readyCheckTimeout = null;
                    }
                    settleLoaded();
                }
            }, 50);

            readyCheckTimeout = window.setTimeout(() => {
                if (readyCheckLoop !== null) {
                    window.clearInterval(readyCheckLoop);
                    readyCheckLoop = null;
                }
                readyCheckTimeout = null;
                if (!isGoogleMapsReady()) {
                    setLoadError(new Error('Google Maps constructors did not initialize in time'));
                }
            }, 10000);
        };
        script.onerror = () => setLoadError(new Error("Failed to load Google Maps script"));

        document.head.appendChild(script);

        return () => {
            if (readyCheckLoop !== null) {
                window.clearInterval(readyCheckLoop);
                readyCheckLoop = null;
            }
            if (readyCheckTimeout !== null) {
                window.clearTimeout(readyCheckTimeout);
                readyCheckTimeout = null;
            }
            mapsWindow.gm_authFailure = previousAuthFailure;
        };
    }, [requestedMapLanguage, enabled]);

    return (
        <GoogleMapsContext.Provider value={{ isLoaded, loadError }}>
            {children}
        </GoogleMapsContext.Provider>
    );
};
