import React, { createContext, useContext, useEffect, useState } from 'react';
import { getGoogleMapsApiKey } from '../utils';

interface GoogleMapsContextType {
    isLoaded: boolean;
    loadError: Error | null;
}

const GoogleMapsContext = createContext<GoogleMapsContextType>({ isLoaded: false, loadError: null });

export const useGoogleMaps = () => useContext(GoogleMapsContext);

export const GoogleMapsLoader: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isLoaded, setIsLoaded] = useState(false);
    const [loadError, setLoadError] = useState<Error | null>(null);

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
        if (document.getElementById(scriptId)) {
             // Script already exists, wait for it
             const checkLoop = setInterval(() => {
                 if (window.google?.maps) {
                     clearInterval(checkLoop);
                     setIsLoaded(true);
                 }
             }, 100);
             return;
        }

        const script = document.createElement('script');
        script.id = scriptId;
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,marker,geometry`;
        script.async = true;
        script.defer = true;
        
        script.onload = () => setIsLoaded(true);
        script.onerror = (e) => setLoadError(new Error("Failed to load Google Maps script"));

        document.head.appendChild(script);

        return () => {
            // Optional cleanup if needed
        };
    }, []);

    return (
        <GoogleMapsContext.Provider value={{ isLoaded, loadError }}>
            {children}
        </GoogleMapsContext.Provider>
    );
};
