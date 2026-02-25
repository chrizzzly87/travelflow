import React, { createContext, useContext } from 'react';

interface TripManagerContextValue {
    openTripManager: () => void;
    prewarmTripManager: () => void;
}

const TripManagerContext = createContext<TripManagerContextValue | null>(null);

export const TripManagerProvider: React.FC<{
    openTripManager: () => void;
    prewarmTripManager: () => void;
    children: React.ReactNode;
}> = ({ openTripManager, prewarmTripManager, children }) => (
    <TripManagerContext.Provider value={{ openTripManager, prewarmTripManager }}>
        {children}
    </TripManagerContext.Provider>
);

export const useTripManager = (): TripManagerContextValue => {
    const ctx = useContext(TripManagerContext);
    if (!ctx) throw new Error('useTripManager must be used within TripManagerProvider');
    return ctx;
};
