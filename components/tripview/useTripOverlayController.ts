import { useCallback, useEffect, useReducer, type Dispatch, type SetStateAction } from 'react';

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

interface TripOverlayState {
    isHistoryOpen: boolean;
    isTripInfoOpen: boolean;
    isTripInfoHistoryExpanded: boolean;
    isMobileMapExpanded: boolean;
}

type TripOverlayKey = keyof TripOverlayState;

type TripOverlayAction =
    | { type: 'set'; key: TripOverlayKey; value: SetStateAction<boolean> }
    | { type: 'resetTripOverlays' }
    | { type: 'closeFirstOpenOverlay' };

const INITIAL_TRIP_OVERLAY_STATE: TripOverlayState = {
    isHistoryOpen: false,
    isTripInfoOpen: false,
    isTripInfoHistoryExpanded: false,
    isMobileMapExpanded: false,
};

const resolveBooleanStateAction = (
    current: boolean,
    action: SetStateAction<boolean>
): boolean => (
    typeof action === 'function' ? (action as (value: boolean) => boolean)(current) : action
);

const tripOverlayReducer = (
    state: TripOverlayState,
    action: TripOverlayAction
): TripOverlayState => {
    switch (action.type) {
        case 'set': {
            const nextValue = resolveBooleanStateAction(state[action.key], action.value);
            return state[action.key] === nextValue ? state : {
                ...state,
                [action.key]: nextValue,
            };
        }
        case 'resetTripOverlays':
            return {
                ...state,
                isMobileMapExpanded: false,
                isTripInfoOpen: false,
                isTripInfoHistoryExpanded: false,
            };
        case 'closeFirstOpenOverlay':
            if (state.isHistoryOpen) {
                return { ...state, isHistoryOpen: false };
            }
            if (state.isTripInfoOpen) {
                return { ...state, isTripInfoOpen: false };
            }
            if (state.isMobileMapExpanded) {
                return { ...state, isMobileMapExpanded: false };
            }
            return state;
        default:
            return state;
    }
};

export const useTripOverlayController = ({
    tripId,
    isMobileViewport,
    prewarmTripInfoModal,
}: UseTripOverlayControllerOptions): UseTripOverlayControllerResult => {
    const [state, dispatch] = useReducer(tripOverlayReducer, INITIAL_TRIP_OVERLAY_STATE);

    const setIsHistoryOpen = useCallback<Dispatch<SetStateAction<boolean>>>((value) => {
        dispatch({ type: 'set', key: 'isHistoryOpen', value });
    }, []);

    const setIsTripInfoOpen = useCallback<Dispatch<SetStateAction<boolean>>>((value) => {
        dispatch({ type: 'set', key: 'isTripInfoOpen', value });
    }, []);

    const setIsTripInfoHistoryExpanded = useCallback<Dispatch<SetStateAction<boolean>>>((value) => {
        dispatch({ type: 'set', key: 'isTripInfoHistoryExpanded', value });
    }, []);

    const setIsMobileMapExpanded = useCallback<Dispatch<SetStateAction<boolean>>>((value) => {
        dispatch({ type: 'set', key: 'isMobileMapExpanded', value });
    }, []);

    const openTripInfoModal = useCallback(() => {
        prewarmTripInfoModal?.();
        dispatch({ type: 'set', key: 'isTripInfoOpen', value: true });
    }, [prewarmTripInfoModal]);

    const closeTripInfoModal = useCallback(() => {
        dispatch({ type: 'set', key: 'isTripInfoOpen', value: false });
    }, []);

    useEffect(() => {
        dispatch({ type: 'resetTripOverlays' });
    }, [tripId]);

    useEffect(() => {
        if (isMobileViewport) return;
        dispatch({ type: 'resetTripOverlays' });
    }, [isMobileViewport]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            dispatch({ type: 'closeFirstOpenOverlay' });
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    return {
        isHistoryOpen: state.isHistoryOpen,
        setIsHistoryOpen,
        isTripInfoOpen: state.isTripInfoOpen,
        setIsTripInfoOpen,
        isTripInfoHistoryExpanded: state.isTripInfoHistoryExpanded,
        setIsTripInfoHistoryExpanded,
        isMobileMapExpanded: state.isMobileMapExpanded,
        setIsMobileMapExpanded,
        openTripInfoModal,
        closeTripInfoModal,
    };
};
