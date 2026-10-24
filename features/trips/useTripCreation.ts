import type { ITrip } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { useNavigate } from '../../app/navigation';
import { useConnectivityStatus } from '../../hooks/useConnectivityStatus';
import { DB_ENABLED } from '../../config/db';
import { dbCanCreateTrip } from '../../services/dbApi';
import { getTripById, saveTrip } from '../../services/storageService';
import { resolveTripExpiryFromEntitlements } from '../../config/productLimits';
import { trackEvent } from '../../services/analyticsService';
import { showAppToast } from '../../components/ui/appToast';
import { createLocalHistoryEntry } from './tripSessionModel';
import { useTripPersistence } from './useTripPersistence';
export const useTripCreation = () => {
    const { access } = useAuth();
    const navigate = useNavigate();
    const { snapshot: connectivitySnapshot } = useConnectivityStatus();
    const { commitOwnedTripResilient } = useTripPersistence();
    const handleTripGenerated = (newTrip: ITrip) => {
        const create = async () => {
            const existingTrip = getTripById(newTrip.id);
            if (existingTrip) {
                const now = Date.now();
                const updatedTrip: ITrip = {
                    ...existingTrip,
                    ...newTrip,
                    createdAt: typeof existingTrip.createdAt === 'number'
                        ? existingTrip.createdAt
                        : (typeof newTrip.createdAt === 'number' ? newTrip.createdAt : now),
                    updatedAt: now,
                    isFavorite: existingTrip.isFavorite ?? newTrip.isFavorite ?? false,
                    status: newTrip.status || existingTrip.status || 'active',
                    tripExpiresAt: resolveTripExpiryFromEntitlements(
                        now,
                        newTrip.tripExpiresAt || existingTrip.tripExpiresAt,
                        access?.entitlements.tripExpirationDays
                    ),
                    sourceKind: newTrip.sourceKind || existingTrip.sourceKind || 'created',
                };


                saveTrip(updatedTrip);
                const commitTs = Date.now();
                createLocalHistoryEntry(navigate, updatedTrip, undefined, 'Data: Updated generated trip', { replace: true }, commitTs);

                if (DB_ENABLED) {
                    await commitOwnedTripResilient(updatedTrip, undefined, 'Data: Updated generated trip');
                }
                return;
            }

            if (DB_ENABLED && connectivitySnapshot.state === 'online') {
                const limit = await dbCanCreateTrip();
                if (!limit.allowCreate) {
                    showAppToast({ tone: 'warning', title: `Trip limit reached (${limit.activeTripCount}/${limit.maxTripCount}). Archive a trip or upgrade to continue.` });
                    navigate('/pricing');
                    return;
                }
            }

            const now = Date.now();
            const preparedTrip: ITrip = {
                ...newTrip,
                createdAt: typeof newTrip.createdAt === 'number' ? newTrip.createdAt : now,
                updatedAt: now,
                status: 'active',
                tripExpiresAt: resolveTripExpiryFromEntitlements(
                    now,
                    newTrip.tripExpiresAt,
                    access?.entitlements.tripExpirationDays
                ),
                sourceKind: newTrip.sourceKind || 'created',
            };
            const cityCount = newTrip.items.filter((item) => item.type === 'city').length;
            const activityCount = newTrip.items.filter((item) => item.type === 'activity').length;
            const travelSegmentCount = newTrip.items.filter((item) => item.type === 'travel').length;
            trackEvent('app__trip--create', {
                city_count: cityCount,
                activity_count: activityCount,
                travel_segment_count: travelSegmentCount,
                total_item_count: newTrip.items.length,
            });


            saveTrip(preparedTrip);
            const createdTs = Date.now();
            if (!DB_ENABLED) {
                createLocalHistoryEntry(navigate, preparedTrip, undefined, 'Data: Created trip', undefined, createdTs);
                return;
            }

            createLocalHistoryEntry(navigate, preparedTrip, undefined, 'Data: Created trip', undefined, createdTs);
            await commitOwnedTripResilient(preparedTrip, undefined, 'Data: Created trip');
        };

        void create();
    };

    return handleTripGenerated;
};
