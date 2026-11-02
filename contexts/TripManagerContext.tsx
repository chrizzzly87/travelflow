import React, { createContext, useContext, useMemo } from 'react';

export interface ActiveTripSession {
    tripId: string;
    onUpdateTrip: (trip: import('../types').ITrip) => void;
}

interface TripManagerContextValue {
    openTripManager: () => void;
    prewarmTripManager: () => void;
    registerTripSession?: (session: ActiveTripSession) => () => void;
}

const TripManagerContext = createContext<TripManagerContextValue | null>(null);

export const TripManagerProvider: React.FC<{
    openTripManager: () => void;
    prewarmTripManager: () => void;
    registerTripSession?: TripManagerContextValue['registerTripSession'];
    children: React.ReactNode;
}> = ({ openTripManager, prewarmTripManager, registerTripSession, children }) => {
    const value = useMemo(() => ({ openTripManager, prewarmTripManager, registerTripSession }), [openTripManager, prewarmTripManager, registerTripSession]);
    return <TripManagerContext.Provider value={value}>{children}</TripManagerContext.Provider>;
};

export const useTripManager = (): TripManagerContextValue => {
    const ctx = useContext(TripManagerContext);
    if (!ctx) throw new Error('useTripManager must be used within TripManagerProvider');
    return ctx;
};
