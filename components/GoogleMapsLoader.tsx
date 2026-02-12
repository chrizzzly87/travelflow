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
    de: 'de',
    fr: 'fr',
    it: 'it',
    ru: 'ru',
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
        if (window.google?.maps) {
            setIsLoaded(true);
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
            // Keep using the first loaded script instance to avoid map runtime teardown.
            // If language differs, we safely fall back to the already-loaded maps locale.
            const checkLoop = setInterval(() => {
                if (window.google?.maps) {
                    clearInterval(checkLoop);
                    setIsLoaded(true);
                }
            }, 100);
            return () => clearInterval(checkLoop);
        }

        const script = document.createElement('script');
        script.id = scriptId;
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,marker,geometry&language=${encodeURIComponent(requestedMapLanguage)}`;
        script.dataset.language = requestedMapLanguage;
        script.async = true;
        script.defer = true;
        
        script.onload = () => setIsLoaded(true);
        script.onerror = (e) => setLoadError(new Error("Failed to load Google Maps script"));

        document.head.appendChild(script);

        return () => {
            // Optional cleanup if needed
        };
    }, [requestedMapLanguage]);

    return (
        <GoogleMapsContext.Provider value={{ isLoaded, loadError }}>
            {children}
        </GoogleMapsContext.Provider>
    );
};
