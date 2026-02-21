import { useState } from 'react';

interface AddActivityState {
    isOpen: boolean;
    dayOffset: number;
    location: string;
}

export const useTripEditModalState = () => {
    const [addActivityState, setAddActivityState] = useState<AddActivityState>({
        isOpen: false,
        dayOffset: 0,
        location: '',
    });
    const [isAddCityModalOpen, setIsAddCityModalOpen] = useState(false);

    return {
        addActivityState,
        setAddActivityState,
        isAddCityModalOpen,
        setIsAddCityModalOpen,
    };
};
