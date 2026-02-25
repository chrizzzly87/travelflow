import { useState } from 'react';

export const useTripViewModeState = () => {
    const [viewMode, setViewMode] = useState<'planner' | 'print'>(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            return params.get('mode') === 'print' ? 'print' : 'planner';
        }
        return 'planner';
    });

    return {
        viewMode,
        setViewMode,
    };
};
