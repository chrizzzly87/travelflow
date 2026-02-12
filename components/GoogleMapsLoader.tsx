import React, { createContext, useContext, useEffect, useState } from 'react';
import { AppLanguage } from '../types';
import { getGoogleMapsApiKey, getStoredAppLanguage, normalizeAppLanguage } from '../utils';

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
};

interface GoogleMapsLoaderProps {
    children: React.ReactNode;
    language?: AppLanguage;
}

export const GoogleMapsLoader: React.FC<GoogleMapsLoaderProps> = ({ children, language }) => {
    const [isLoaded, setIsLoaded] = useState(false);
    const [loadError, setLoadError] = useState<Error | null>(null);
    const requestedLanguage = normalizeAppLanguage(language ?? getStoredAppLanguage());
    const requestedMapLanguage = MAPS_LANGUAGE_MAP[requestedLanguage] ?? 'en';

    useEffect(() => {
        const isGoogleMapsReady = () => Boolean(window.google?.maps?.Map && typeof window.google.maps.Map === 'function');
        const settleLoaded = () => {
            setIsLoaded(true);
            setLoadError(null);
        };
        let readyCheckLoop: number | null = null;
        let readyCheckTimeout: number | null = null;

        if (isGoogleMapsReady()) {
            settleLoaded();
            return;
        }

        const apiKey = getGoogleMapsApiKey();
        if (!apiKey) {
            setLoadError(new Error("Google Maps API Key is missing"));
            return;
        }

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
        };
    }, [requestedMapLanguage]);

    return (
        <GoogleMapsContext.Provider value={{ isLoaded, loadError }}>
            {children}
        </GoogleMapsContext.Provider>
    );
};
