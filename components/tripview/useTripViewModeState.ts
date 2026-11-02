import { useState } from 'react';

/** `initialMode` comes from the route's validated search (`mode=print`). */
export const useTripViewModeState = (initialMode: 'planner' | 'print' = 'planner') => {
    const [viewMode, setViewMode] = useState<'planner' | 'print'>(initialMode);

    return {
        viewMode,
        setViewMode,
    };
};
