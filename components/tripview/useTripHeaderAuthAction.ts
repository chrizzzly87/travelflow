import { useCallback, useState } from 'react';

import { trackEvent } from '../../services/analyticsService';
import { buildPathFromLocationParts } from '../../services/authNavigationService';

interface OpenLoginModalOptions {
    source: string;
    nextPath: string;
    reloadOnSuccess?: boolean;
}

interface UseTripHeaderAuthActionOptions {
    tripId: string;
    isAuthenticated: boolean;
    isAnonymous: boolean;
    logout: () => Promise<void>;
    openLoginModal: (options: OpenLoginModalOptions) => void;
    locationPathname: string;
    locationSearch: string;
    locationHash: string;
}

interface UseTripHeaderAuthActionResult {
    canUseAuthenticatedSession: boolean;
    isHeaderAuthSubmitting: boolean;
    handleHeaderAuthAction: () => Promise<void>;
}

export const useTripHeaderAuthAction = ({
    tripId,
    isAuthenticated,
    isAnonymous,
    logout,
    openLoginModal,
    locationPathname,
    locationSearch,
    locationHash,
}: UseTripHeaderAuthActionOptions): UseTripHeaderAuthActionResult => {
    const [isHeaderAuthSubmitting, setIsHeaderAuthSubmitting] = useState(false);
    const canUseAuthenticatedSession = isAuthenticated && !isAnonymous;

    const handleHeaderAuthAction = useCallback(async () => {
        if (isHeaderAuthSubmitting) return;

        if (canUseAuthenticatedSession) {
            setIsHeaderAuthSubmitting(true);
            trackEvent('trip_view__auth--logout', { trip_id: tripId });
            try {
                await logout();
                if (typeof window !== 'undefined') {
                    window.location.reload();
                    return;
                }
            } finally {
                setIsHeaderAuthSubmitting(false);
            }
            return;
        }

        trackEvent('trip_view__auth--login', { trip_id: tripId });
        openLoginModal({
            source: 'trip_view_header',
            nextPath: buildPathFromLocationParts({
                pathname: locationPathname,
                search: locationSearch,
                hash: locationHash,
            }),
            reloadOnSuccess: true,
        });
    }, [
        canUseAuthenticatedSession,
        isHeaderAuthSubmitting,
        locationHash,
        locationPathname,
        locationSearch,
        logout,
        openLoginModal,
        tripId,
    ]);

    return {
        canUseAuthenticatedSession,
        isHeaderAuthSubmitting,
        handleHeaderAuthAction,
    };
};
