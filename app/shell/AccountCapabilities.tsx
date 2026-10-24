import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from '../navigation';
import { useAuth } from '../../hooks/useAuth';
import { listTripGenerationCompletionWatches, removeTripGenerationCompletionWatch, subscribeTripGenerationCompletionWatches } from '../../services/tripGenerationCompletionWatchService';
import { dbGetTrip } from '../../services/dbApi';
import { getTripGenerationState } from '../../services/tripGenerationDiagnosticsService';
import { showAppToast } from '../../components/ui/appToast';
import { trackEvent } from '../../services/analyticsService';
export default function AccountCapabilities() {
    const { access, isAuthenticated } = useAuth();
    const navigate = useNavigate();
    const { t } = useTranslation(['common', 'profile']);
    useEffect(() => {
        if (!isAuthenticated || !access || access.isAnonymous) return;

        const WATCH_STALE_AFTER_MS = 30 * 60 * 1000;
        let isCancelled = false;
        const inFlight = new Set<string>();

        const pollCompletionWatches = async (): Promise<void> => {
            if (isCancelled) return;
            const watches = listTripGenerationCompletionWatches();
            if (!watches.length) return;

            const now = Date.now();
            await Promise.all(watches.map(async (watch) => {
                if (isCancelled || inFlight.has(watch.tripId)) return;

                if ((now - watch.startedAt) > WATCH_STALE_AFTER_MS) {
                    removeTripGenerationCompletionWatch(watch.tripId);
                    return;
                }

                inFlight.add(watch.tripId);
                try {
                    const remoteTripResult = await dbGetTrip(watch.tripId);
                    const remoteTrip = remoteTripResult?.trip;
                    if (!remoteTrip) return;

                    const state = getTripGenerationState(remoteTrip, Date.now());
                    if (state === 'running' || state === 'queued') return;

                    removeTripGenerationCompletionWatch(watch.tripId);
                    const actionLabel = t('cards.actions.open', { ns: 'profile' });
                    const action = {
                        label: actionLabel,
                        onClick: () => {
                            trackEvent('trip_generation__background_completion_toast--open', {
                                trip_id: watch.tripId,
                                source: watch.source,
                                state,
                            });
                            navigate(`/trip/${watch.tripId}`);
                        },
                    };

                    trackEvent('trip_generation__background_completion_toast--shown', {
                        trip_id: watch.tripId,
                        source: watch.source,
                        state,
                    });

                    if (state === 'succeeded') {
                        showAppToast({
                            tone: 'add',
                            title: t('tripView.generation.retry.completedTitle'),
                            description: t('tripView.generation.retry.completed'),
                            action,
                        });
                    } else {
                        showAppToast({
                            tone: 'warning',
                            title: t('tripView.generation.retry.failedTitle'),
                            description: t('tripView.generation.strip.failedDefault'),
                            action,
                        });
                    }
                } catch {
                    // Ignore transient fetch errors; next poll continues.
                } finally {
                    inFlight.delete(watch.tripId);
                }
            }));
        };

        const unsubscribe = subscribeTripGenerationCompletionWatches(() => {
            void pollCompletionWatches();
        });
        void pollCompletionWatches();
        const intervalId = window.setInterval(() => {
            void pollCompletionWatches();
        }, 5000);

        return () => {
            isCancelled = true;
            unsubscribe();
            window.clearInterval(intervalId);
        };
    }, [access, isAuthenticated, navigate, t]);
    return null;
}
