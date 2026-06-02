import React, { createContext, useContext, useMemo } from 'react';

interface TripManagerContextValue {
    openTripManager: () => void;
    prewarmTripManager: () => void;
}

const TripManagerContext = createContext<TripManagerContextValue | null>(null);

export const TripManagerProvider: React.FC<{
    openTripManager: () => void;
    prewarmTripManager: () => void;
    children: React.ReactNode;
}> = ({ openTripManager, prewarmTripManager, children }) => {
    const value = useMemo(
        () => ({ openTripManager, prewarmTripManager }),
        [openTripManager, prewarmTripManager],
    );

    return (
        <TripManagerContext.Provider value={value}>
            {children}
        </TripManagerContext.Provider>
    );
};

export const useTripManager = (): TripManagerContextValue => {
    const ctx = useContext(TripManagerContext);
    if (!ctx && typeof window === 'undefined') {
        return {
            openTripManager: () => undefined,
            prewarmTripManager: () => undefined,
        };
    }
    if (!ctx) throw new Error('useTripManager must be used within TripManagerProvider');
    return ctx;
};
