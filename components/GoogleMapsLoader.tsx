import React from 'react';
import { AppLanguage } from '../types';
import { MapRuntimeProvider, useGoogleMaps, useMapRuntime } from './MapRuntimeProvider';

interface GoogleMapsLoaderProps {
    children: React.ReactNode;
    language?: AppLanguage;
    enabled?: boolean;
}

export { useGoogleMaps, useMapRuntime };

export const GoogleMapsLoader: React.FC<GoogleMapsLoaderProps> = ({ children, language, enabled = true }) => {
    return (
        <MapRuntimeProvider language={language} enabled={enabled}>
            {children}
        </MapRuntimeProvider>
    );
};
