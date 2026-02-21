import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';

interface UseTripOverlayControllerOptions {
    tripId: string;
    isMobileViewport: boolean;
    prewarmTripInfoModal?: () => void;
}

interface UseTripOverlayControllerResult {
    isHistoryOpen: boolean;
    setIsHistoryOpen: Dispatch<SetStateAction<boolean>>;
    isTripInfoOpen: boolean;
    setIsTripInfoOpen: Dispatch<SetStateAction<boolean>>;
    isTripInfoHistoryExpanded: boolean;
    setIsTripInfoHistoryExpanded: Dispatch<SetStateAction<boolean>>;
    isMobileMapExpanded: boolean;
    setIsMobileMapExpanded: Dispatch<SetStateAction<boolean>>;
    openTripInfoModal: () => void;
    closeTripInfoModal: () => void;
}

export const useTripOverlayController = ({
    tripId,
    isMobileViewport,
    prewarmTripInfoModal,
}: UseTripOverlayControllerOptions): UseTripOverlayControllerResult => {
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [isTripInfoOpen, setIsTripInfoOpen] = useState(false);
    const [isTripInfoHistoryExpanded, setIsTripInfoHistoryExpanded] = useState(false);
    const [isMobileMapExpanded, setIsMobileMapExpanded] = useState(false);

    const openTripInfoModal = useCallback(() => {
        prewarmTripInfoModal?.();
        setIsTripInfoOpen(true);
    }, [prewarmTripInfoModal]);

    const closeTripInfoModal = useCallback(() => {
        setIsTripInfoOpen(false);
    }, []);

    useEffect(() => {
        setIsMobileMapExpanded(false);
        setIsTripInfoOpen(false);
        setIsTripInfoHistoryExpanded(false);
    }, [tripId]);

    useEffect(() => {
        if (isMobileViewport) return;
        setIsMobileMapExpanded(false);
        setIsTripInfoOpen(false);
        setIsTripInfoHistoryExpanded(false);
    }, [isMobileViewport]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            if (isHistoryOpen) {
                setIsHistoryOpen(false);
                return;
            }
            if (isTripInfoOpen) {
                setIsTripInfoOpen(false);
                return;
            }
            if (isMobileMapExpanded) {
                setIsMobileMapExpanded(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isHistoryOpen, isTripInfoOpen, isMobileMapExpanded]);

    return {
        isHistoryOpen,
        setIsHistoryOpen,
        isTripInfoOpen,
        setIsTripInfoOpen,
        isTripInfoHistoryExpanded,
        setIsTripInfoHistoryExpanded,
        isMobileMapExpanded,
        setIsMobileMapExpanded,
        openTripInfoModal,
        closeTripInfoModal,
    };
};
