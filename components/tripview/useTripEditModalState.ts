import { useState } from 'react';

import type { ITimelineItem } from '../../types';

interface AddActivityState {
    isOpen: boolean;
    dayOffset: number;
    location: string;
    initialDraft: Partial<ITimelineItem> | null;
}

export const useTripEditModalState = () => {
    const [addActivityState, setAddActivityState] = useState<AddActivityState>({
        isOpen: false,
        dayOffset: 0,
        location: '',
        initialDraft: null,
    });
    const [isAddCityModalOpen, setIsAddCityModalOpen] = useState(false);

    return {
        addActivityState,
        setAddActivityState,
        isAddCityModalOpen,
        setIsAddCityModalOpen,
    };
};
