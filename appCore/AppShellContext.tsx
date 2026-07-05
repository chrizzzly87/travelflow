'use client';

import { createContext, useContext } from 'react';
import { AppLanguage, ITrip, IViewSettings } from '../types';

// Trip/session handlers owned by the app shell (App.tsx AppContent). Under
// the App Router, route pages consume these via context instead of the prop
// drilling the react-router AppRoutes tree used.
export interface AppShellValue {
    trip: ITrip | null;
    appLanguage: AppLanguage;
    onAppLanguageLoaded: (lang: AppLanguage) => void;
    onTripGenerated: (trip: ITrip) => void;
    onTripLoaded: (trip: ITrip) => void;
    onUpdateTrip: (updatedTrip: ITrip, options?: { persist?: boolean; preserveUpdatedAt?: boolean }) => void;
    onCommitState: (
        updatedTrip: ITrip,
        view: IViewSettings | undefined,
        options?: { replace?: boolean; label?: string; adminOverride?: boolean }
    ) => void;
    onViewSettingsChange: (settings: IViewSettings) => void;
    onOpenManager: () => void;
    onOpenSettings: () => void;
}

export const AppShellContext = createContext<AppShellValue | null>(null);

export const useAppShell = (): AppShellValue => {
    const value = useContext(AppShellContext);
    if (!value) {
        throw new Error('useAppShell must be used inside the App shell (App.tsx).');
    }
    return value;
};
