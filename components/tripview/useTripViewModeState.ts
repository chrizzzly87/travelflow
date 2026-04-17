import { useState } from 'react';

export type TripViewMode = 'planner' | 'prep' | 'print';
export type TripWorkspaceMode = Exclude<TripViewMode, 'print'>;

export const useTripViewModeState = () => {
    const [viewMode, setViewMode] = useState<TripViewMode>(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const mode = params.get('mode');
            if (mode === 'print' || mode === 'prep') return mode;
            return 'planner';
        }
        return 'planner';
    });

    return {
        viewMode,
        setViewMode,
    };
};
