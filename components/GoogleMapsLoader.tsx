import React from 'react';
import { AppLanguage } from '../types';
import {
    GoogleMapsApiGate,
    MapRuntimeProvider,
    useGoogleMaps,
    useMapRuntime,
} from './MapRuntimeProvider';

interface GoogleMapsLoaderProps {
    children: React.ReactNode;
    language?: AppLanguage;
}

export { useGoogleMaps, useMapRuntime, GoogleMapsApiGate, MapRuntimeProvider };

/**
 * Map runtime plus the Google Maps script, for a page whose map is on screen
 * from the start.
 *
 * A screen that defers its map must not use this: mount `MapRuntimeProvider`
 * high, and `GoogleMapsApiGate` around the map component itself. Toggling a
 * gate around long-lived UI re-parents it, and React answers that by
 * remounting the whole subtree.
 */
export const GoogleMapsLoader: React.FC<GoogleMapsLoaderProps> = ({ children, language }) => {
    return (
        <MapRuntimeProvider language={language}>
            <GoogleMapsApiGate>{children}</GoogleMapsApiGate>
        </MapRuntimeProvider>
    );
};
