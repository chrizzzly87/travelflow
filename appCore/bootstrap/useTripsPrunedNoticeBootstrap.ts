import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { TRIPS_PRUNED_EVENT, type TripsPrunedEventDetail } from '../../services/storageService';
import { showAppToast } from '../../components/ui/appToast';

const TRIPS_PRUNED_TOAST_ID = 'tf-trips-pruned-notice';

/**
 * Surfaces a user-visible notice whenever the local trip storage hit the
 * browser quota and older trips had to be removed to complete a save.
 * The storage service emits the event; this bootstrap converts it to a toast.
 */
export const useTripsPrunedNoticeBootstrap = (): void => {
    const { t } = useTranslation('common');

    useEffect(() => {
        const handleTripsPruned = (event: Event) => {
            const detail = (event as CustomEvent<TripsPrunedEventDetail>).detail;
            const prunedCount = detail?.prunedCount ?? 0;
            if (prunedCount < 1) return;

            showAppToast({
                id: TRIPS_PRUNED_TOAST_ID,
                tone: 'warning',
                title: t('storageNotice.tripsPrunedTitle'),
                description: t('storageNotice.tripsPrunedDescription', { count: prunedCount }),
            });
        };

        window.addEventListener(TRIPS_PRUNED_EVENT, handleTripsPruned);
        return () => window.removeEventListener(TRIPS_PRUNED_EVENT, handleTripsPruned);
    }, [t]);
};
