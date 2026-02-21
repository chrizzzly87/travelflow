import { useCallback, useEffect, type Dispatch, type SetStateAction } from 'react';

import type { ITrip, ITimelineItem } from '../../types';
import { getActivityColorByTypes, normalizeActivityTypes } from '../../utils';
import { stripHistoryPrefix } from './useTripHistoryPresentation';

interface AddActivityState {
    isOpen: boolean;
    dayOffset: number;
    location: string;
}

interface ToastOptions {
    tone?: 'add' | 'remove' | 'neutral' | 'info';
    title?: string;
}

interface UseTripItemMutationHandlersOptions {
    trip: ITrip;
    addActivityState: AddActivityState;
    setAddActivityState: Dispatch<SetStateAction<AddActivityState>>;
    isAddCityModalOpen: boolean;
    setIsAddCityModalOpen: Dispatch<SetStateAction<boolean>>;
    isHistoryOpen: boolean;
    selectedItemId: string | null;
    setSelectedItemId: Dispatch<SetStateAction<string | null>>;
    setSelectedCityIds: Dispatch<SetStateAction<string[]>>;
    requireEdit: () => boolean;
    markUserEdit: () => void;
    setPendingLabel: (label: string) => void;
    handleUpdateItems: (items: ITimelineItem[]) => void;
    showToast: (message: string, options?: ToastOptions) => void;
    pendingHistoryLabelRef: React.MutableRefObject<string | null>;
    onResetSuppressedCommit?: () => void;
}

export const useTripItemMutationHandlers = ({
    trip,
    addActivityState,
    setAddActivityState,
    isAddCityModalOpen,
    setIsAddCityModalOpen,
    isHistoryOpen,
    selectedItemId,
    setSelectedItemId,
    setSelectedCityIds,
    requireEdit,
    markUserEdit,
    setPendingLabel,
    handleUpdateItems,
    showToast,
    pendingHistoryLabelRef,
    onResetSuppressedCommit,
}: UseTripItemMutationHandlersOptions) => {
    const handleDeleteItem = useCallback((id: string, _strategy: 'item-only' | 'shift-gap' | 'pull-back' = 'item-only') => {
        markUserEdit();
        const item = trip.items.find((candidate) => candidate.id === id);

        if (item) {
            if (item.type === 'city') {
                pendingHistoryLabelRef.current = `Data: Removed city ${item.title}`;
            } else if (item.type === 'activity') {
                pendingHistoryLabelRef.current = `Data: Removed activity ${item.title}`;
            } else {
                pendingHistoryLabelRef.current = `Data: Removed transport ${item.title}`;
            }
        }

        const nextItems = trip.items.filter((candidate) => candidate.id !== id);
        handleUpdateItems(nextItems);

        if (item) {
            const label = stripHistoryPrefix(pendingHistoryLabelRef.current || 'Removed item');
            showToast(label, { tone: 'remove', title: 'Removed' });
        }

        setSelectedItemId(null);
        setSelectedCityIds((previous) => previous.filter((cityId) => cityId !== id));
    }, [
        handleUpdateItems,
        markUserEdit,
        pendingHistoryLabelRef,
        setSelectedCityIds,
        setSelectedItemId,
        showToast,
        trip.items,
    ]);

    useEffect(() => {
        const handleDeleteKey = (event: KeyboardEvent) => {
            if (isHistoryOpen || addActivityState.isOpen || isAddCityModalOpen) return;
            if (event.key !== 'Delete' && event.key !== 'Backspace') return;

            const target = event.target as HTMLElement | null;
            const isEditable = !!target && (
                target.tagName === 'INPUT' ||
                target.tagName === 'TEXTAREA' ||
                target.isContentEditable
            );
            if (isEditable || !selectedItemId) return;

            const selectedItem = trip.items.find((item) => item.id === selectedItemId);
            if (!selectedItem) return;
            if (selectedItem.type !== 'city' && selectedItem.type !== 'activity') return;
            if (!requireEdit()) return;

            event.preventDefault();
            handleDeleteItem(selectedItem.id);
        };

        window.addEventListener('keydown', handleDeleteKey);
        return () => window.removeEventListener('keydown', handleDeleteKey);
    }, [
        addActivityState.isOpen,
        handleDeleteItem,
        isAddCityModalOpen,
        isHistoryOpen,
        requireEdit,
        selectedItemId,
        trip.items,
    ]);

    const handleOpenAddCity = useCallback(() => {
        if (!requireEdit()) return;
        setIsAddCityModalOpen(true);
    }, [requireEdit, setIsAddCityModalOpen]);

    const handleOpenAddActivity = useCallback((dayOffset: number) => {
        if (!requireEdit()) return;

        const city = trip.items.find((item) => (
            item.type === 'city' &&
            dayOffset >= item.startDateOffset &&
            dayOffset < item.startDateOffset + item.duration
        ));

        setAddActivityState({
            isOpen: true,
            dayOffset,
            location: city?.title || trip.title,
        });
    }, [requireEdit, setAddActivityState, trip.items, trip.title]);

    const handleAddActivityItem = useCallback((itemProps: Partial<ITimelineItem>) => {
        if (!requireEdit()) return;

        markUserEdit();
        const normalizedTypes = normalizeActivityTypes(itemProps.activityType);
        const newItem: ITimelineItem = {
            id: crypto.randomUUID(),
            type: 'activity',
            title: itemProps.title || 'New Activity',
            startDateOffset: itemProps.startDateOffset || addActivityState.dayOffset,
            duration: itemProps.duration || (1 / 24),
            description: itemProps.description || '',
            location: itemProps.location || addActivityState.location,
            ...itemProps,
            activityType: normalizedTypes,
            color: itemProps.color || getActivityColorByTypes(normalizedTypes),
        } as ITimelineItem;

        onResetSuppressedCommit?.();
        setPendingLabel(`Data: Added activity ${newItem.title}`);
        handleUpdateItems([...trip.items, newItem]);
        showToast(`Activity "${newItem.title}" added`, { tone: 'add', title: 'Added' });
    }, [
        addActivityState.dayOffset,
        addActivityState.location,
        handleUpdateItems,
        markUserEdit,
        requireEdit,
        setPendingLabel,
        showToast,
        trip.items,
    ]);

    const handleAddCityItem = useCallback((itemProps: Partial<ITimelineItem>) => {
        if (!requireEdit()) return;

        markUserEdit();
        const lastOffset = trip.items.reduce(
            (maxOffset, item) => Math.max(maxOffset, item.startDateOffset + item.duration),
            0
        );

        const newItem: ITimelineItem = {
            id: crypto.randomUUID(),
            type: 'city',
            title: itemProps.title || 'New City',
            startDateOffset: lastOffset,
            duration: itemProps.duration || 2,
            color: itemProps.color || 'bg-emerald-100 border-emerald-200 text-emerald-700',
            loading: false,
            ...itemProps,
        } as ITimelineItem;

        onResetSuppressedCommit?.();
        setPendingLabel(`Data: Added city ${newItem.title}`);
        handleUpdateItems([...trip.items, newItem]);
        setSelectedItemId(newItem.id);
        setSelectedCityIds([newItem.id]);
        showToast(`City "${newItem.title}" added`, { tone: 'add', title: 'Added' });
        setIsAddCityModalOpen(false);
    }, [
        handleUpdateItems,
        markUserEdit,
        requireEdit,
        setIsAddCityModalOpen,
        setPendingLabel,
        setSelectedCityIds,
        setSelectedItemId,
        showToast,
        onResetSuppressedCommit,
        trip.items,
    ]);

    return {
        handleDeleteItem,
        handleOpenAddCity,
        handleOpenAddActivity,
        handleAddActivityItem,
        handleAddCityItem,
    };
};
