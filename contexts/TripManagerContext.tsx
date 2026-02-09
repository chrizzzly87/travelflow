import React, { createContext, useContext } from 'react';

interface TripManagerContextValue {
    openTripManager: () => void;
}

const TripManagerContext = createContext<TripManagerContextValue | null>(null);

export const TripManagerProvider: React.FC<{
    openTripManager: () => void;
    children: React.ReactNode;
}> = ({ openTripManager, children }) => (
    <TripManagerContext.Provider value={{ openTripManager }}>
        {children}
    </TripManagerContext.Provider>
);

export const useTripManager = (): TripManagerContextValue => {
    const ctx = useContext(TripManagerContext);
    if (!ctx) throw new Error('useTripManager must be used within TripManagerProvider');
    return ctx;
};
