import React, { useCallback } from 'react';
import { useNavigate, useParams } from '@/app/navigation';
import { useAuth } from '../hooks/useAuth';
import { useDbSync } from '../hooks/useDbSync';
import { DB_ENABLED } from '../config/db';
import { resolveTripExpiryFromEntitlements } from '../config/productLimits';
import { dbCanCreateTrip, dbCreateTripVersion, dbGetSharedTrip, dbUpdateSharedTrip, dbUpsertTrip } from '../services/dbApi';
import { saveTrip } from '../services/storageService';
import { buildShareUrl, buildTripUrl, generateTripId } from '../utils';
import type { ITrip, IViewSettings } from '../types';
import type { CommitOptions, SharedTripLoaderRouteProps } from './tripRouteTypes';
import type { SharedTripRouteData } from '../features/trips/routeData';
import { useRouteViewSettings } from '../features/trips/useRouteViewSettings';
import { useTripCopyLimit } from '../features/trips/useTripCopyLimit';
import { createLocalHistoryEntry } from '../features/trips/tripSessionModel';
import { LazyTripView } from '../components/tripview/LazyTripView';
import { TripRouteLoadingShell } from '../components/tripview/TripRouteLoadingShell';

export const SharedTripLoaderRoute: React.FC<SharedTripLoaderRouteProps & { data: SharedTripRouteData }> = ({ data, trip, onTripLoaded, onOpenManager, onOpenSettings, appLanguage, onViewSettingsChange, onLanguageLoaded }) => {
    const { token } = useParams();
    const navigate = useNavigate();
    const { access } = useAuth();
    useDbSync(onLanguageLoaded);
    const activeTrip = trip ?? data.trip;
    const { shareMode, allowCopy, snapshotState, sourceShareVersionId } = data;
    const [viewSettings, updateViewSettings] = useRouteViewSettings(data.view);
    const handleTripLimitReached = useTripCopyLimit('shared_trip');
    const handleCommitShared = (updatedTrip: ITrip, view: IViewSettings | undefined, options?: CommitOptions) => {
        if (shareMode !== 'edit' || !token) return;
        const label = options?.label || 'Updated trip';
        const commitTs = Date.now();
        createLocalHistoryEntry(navigate, updatedTrip, view, label, options, commitTs, buildShareUrl(token));

        const commit = async () => {
            const version = await dbUpdateSharedTrip(token, updatedTrip, view, label);
            if (!version) return;
        };
        void commit().catch(() => undefined);
    };

    const handleCopyTrip = async () => {
        if (DB_ENABLED) {
            const limit = await dbCanCreateTrip();
            if (!limit.allowCreate) {
                await handleTripLimitReached(limit);
                return;
            }
        }
        let resolvedSourceShareVersionId = sourceShareVersionId;
        if (!resolvedSourceShareVersionId && token && DB_ENABLED) {
            const sharedNow = await dbGetSharedTrip(token);
            resolvedSourceShareVersionId = sharedNow?.latestVersionId ?? null;
        }
        const now = Date.now();
        const cloned: ITrip = {
            ...activeTrip,
            id: generateTripId(),
            createdAt: now,
            updatedAt: now,
            isFavorite: false,
            status: 'active',
            tripExpiresAt: resolveTripExpiryFromEntitlements(
                now,
                undefined,
                access?.entitlements.tripExpirationDays
            ),
            sourceKind: 'duplicate_shared',
            forkedFromTripId: activeTrip.id,
            forkedFromShareToken: token || undefined,
            forkedFromShareVersionId: resolvedSourceShareVersionId || undefined,
        };
        if (typeof window !== 'undefined') {
            try {
                window.sessionStorage.setItem('tf_trip_copy_notice', JSON.stringify({
                    tripId: cloned.id,
                    sourceTripId: activeTrip.id,
                    sourceTitle: activeTrip.title,
                    sourceShareToken: token || null,
                    sourceShareVersionId: resolvedSourceShareVersionId || null,
                    createdAt: Date.now(),
                }));
            } catch {
                // ignore storage issues
            }
        }
        saveTrip(cloned);
        if (DB_ENABLED) {
            await dbUpsertTrip(cloned, viewSettings);
            await dbCreateTripVersion(cloned, viewSettings, 'Data: Copied trip');
            createLocalHistoryEntry(navigate, cloned, viewSettings, 'Data: Copied trip', undefined, Date.now());
            return;
        }
        navigate(buildTripUrl(cloned.id));
    };

    const handleRouteViewSettingsChange = useCallback((settings: IViewSettings) => {
        if (updateViewSettings(settings)) onViewSettingsChange(settings);
    }, [onViewSettingsChange, updateViewSettings]);
    return (
        <React.Suspense fallback={<TripRouteLoadingShell variant="preparingSharedPlanner" />}>
            <LazyTripView
                trip={activeTrip}
                initialViewSettings={viewSettings ?? activeTrip.defaultView}
                onUpdateTrip={(updatedTrip) => onTripLoaded(updatedTrip, viewSettings ?? updatedTrip.defaultView)}
                onCommitState={handleCommitShared}
                onViewSettingsChange={handleRouteViewSettingsChange}
                onOpenManager={onOpenManager}
                onOpenSettings={onOpenSettings}
                appLanguage={appLanguage}
                readOnly={shareMode === 'view'}
                canShare={false}
                shareStatus={shareMode}
                shareSnapshotMeta={snapshotState ?? undefined}
                onCopyTrip={allowCopy ? handleCopyTrip : undefined}
            />
        </React.Suspense>
    );
};
