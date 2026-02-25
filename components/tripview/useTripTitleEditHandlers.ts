import { useCallback, useEffect } from 'react';

import type { ITrip, IViewSettings } from '../../types';

interface UseTripTitleEditHandlersOptions {
    canManageTripMetadata: boolean;
    isMobile: boolean;
    isEditingTitle: boolean;
    editTitleValue: string;
    trip: ITrip;
    currentViewSettings: IViewSettings;
    editTitleInputRef: React.MutableRefObject<HTMLInputElement | null>;
    setEditTitleValue: (value: string) => void;
    setIsEditingTitle: (isEditing: boolean) => void;
    requireEdit: () => boolean;
    markUserEdit: () => void;
    setPendingLabel: (label: string) => void;
    safeUpdateTrip: (updatedTrip: ITrip, options?: { persist?: boolean }) => void;
    scheduleCommit: (updatedTrip?: ITrip, view?: IViewSettings) => void;
}

export const useTripTitleEditHandlers = ({
    canManageTripMetadata,
    isMobile,
    isEditingTitle,
    editTitleValue,
    trip,
    currentViewSettings,
    editTitleInputRef,
    setEditTitleValue,
    setIsEditingTitle,
    requireEdit,
    markUserEdit,
    setPendingLabel,
    safeUpdateTrip,
    scheduleCommit,
}: UseTripTitleEditHandlersOptions) => {
    const handleStartTitleEdit = useCallback(() => {
        if (!canManageTripMetadata) return;
        if (!requireEdit()) return;

        setEditTitleValue(trip.title);
        setIsEditingTitle(true);
    }, [canManageTripMetadata, requireEdit, setEditTitleValue, setIsEditingTitle, trip.title]);

    useEffect(() => {
        if (!isEditingTitle || isMobile || typeof window === 'undefined') return;

        const rafId = window.requestAnimationFrame(() => {
            editTitleInputRef.current?.focus();
        });
        return () => window.cancelAnimationFrame(rafId);
    }, [editTitleInputRef, isEditingTitle, isMobile]);

    const handleCommitTitleEdit = useCallback(() => {
        if (!canManageTripMetadata) {
            setIsEditingTitle(false);
            return;
        }

        const nextTitle = editTitleValue.trim();
        setIsEditingTitle(false);
        if (!nextTitle || nextTitle === trip.title) return;
        if (!requireEdit()) return;

        markUserEdit();
        const updatedTrip: ITrip = {
            ...trip,
            title: nextTitle,
            updatedAt: Date.now(),
        };

        setPendingLabel('Data: Renamed trip');
        safeUpdateTrip(updatedTrip);
        scheduleCommit(updatedTrip, currentViewSettings);
    }, [
        canManageTripMetadata,
        currentViewSettings,
        editTitleValue,
        markUserEdit,
        requireEdit,
        safeUpdateTrip,
        scheduleCommit,
        setIsEditingTitle,
        setPendingLabel,
        trip,
    ]);

    return {
        handleStartTitleEdit,
        handleCommitTitleEdit,
    };
};
