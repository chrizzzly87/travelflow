import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import { useAuth } from '../hooks/useAuth';
import { useDbSync } from '../hooks/useDbSync';
import { DB_ENABLED } from '../config/db';
import { ANONYMOUS_TRIP_EXPIRATION_DAYS, buildTripExpiryIso } from '../config/productLimits';
import { getTripLifecycleState } from '../config/paywall';
import {
    dbCanCreateTrip,
    dbCreateTripVersion,
    dbGetSharedTrip,
    dbGetSharedTripVersion,
    dbGetTripVersion,
    dbUpdateSharedTrip,
    dbUpsertTrip,
} from '../services/dbApi';
import { appendHistoryEntry, findHistoryEntryByUrl } from '../services/historyService';
import { saveTrip } from '../services/storageService';
import {
    buildShareUrl,
    buildTripUrl,
    generateTripId,
    generateVersionId,
    isUuid,
} from '../utils';
import type { ITrip, IViewSettings } from '../types';
import type { CommitOptions, SharedTripLoaderRouteProps } from './tripRouteTypes';
import { TripView } from '../components/TripView';

const createLocalHistoryEntry = (
    navigate: ReturnType<typeof useNavigate>,
    updatedTrip: ITrip,
    view: IViewSettings | undefined,
    label: string,
    options?: { replace?: boolean },
    ts?: number,
    baseUrlOverride?: string
) => {
    const versionId = generateVersionId();
    const url = baseUrlOverride ? `${baseUrlOverride}?v=${versionId}` : buildTripUrl(updatedTrip.id, versionId);
    navigate(url, { replace: options?.replace ?? false });
    appendHistoryEntry(updatedTrip.id, url, label, { snapshot: { trip: updatedTrip, view }, ts });
    return url;
};

export const SharedTripLoaderRoute: React.FC<SharedTripLoaderRouteProps> = ({
    trip,
    onTripLoaded,
    onOpenManager,
    onOpenSettings,
    appLanguage,
    onViewSettingsChange,
    onLanguageLoaded,
}) => {
    const { token } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const { access } = useAuth();
    const lastLoadRef = useRef<string | null>(null);
    const [shareMode, setShareMode] = useState<'view' | 'edit'>('view');
    const [allowCopy, setAllowCopy] = useState(true);
    const [viewSettings, setViewSettings] = useState<IViewSettings | undefined>(undefined);
    const [snapshotState, setSnapshotState] = useState<{ hasNewer: boolean; latestUrl: string } | null>(null);
    const [sourceShareVersionId, setSourceShareVersionId] = useState<string | null>(null);

    const resolveTripExpiry = (createdAtMs: number, existingTripExpiry?: string | null): string | null => {
        if (typeof existingTripExpiry === 'string' && existingTripExpiry) return existingTripExpiry;
        const expirationDays = access?.entitlements.tripExpirationDays;
        if (expirationDays === null) return null;
        if (typeof expirationDays === 'number' && expirationDays > 0) {
            return buildTripExpiryIso(createdAtMs, expirationDays);
        }
        return buildTripExpiryIso(createdAtMs, ANONYMOUS_TRIP_EXPIRATION_DAYS);
    };

    const versionId = useMemo(() => {
        const params = new URLSearchParams(location.search);
        return params.get('v');
    }, [location.search]);

    useDbSync(onLanguageLoaded);

    useEffect(() => {
        if (!token) return;
        const loadKey = `${token}:${location.search}`;
        if (lastLoadRef.current === loadKey) return;
        lastLoadRef.current = loadKey;

        const load = async () => {
            if (!DB_ENABLED) {
                navigate('/share-unavailable', { replace: true });
                return;
            }

            setViewSettings(undefined);
            setSnapshotState(null);
            setSourceShareVersionId(null);
            await ensureDbSession();
            const shared = await dbGetSharedTrip(token);
            if (!shared) {
                navigate('/share-unavailable', { replace: true });
                return;
            }
            if (getTripLifecycleState(shared.trip) !== 'active') {
                navigate('/share-unavailable', { replace: true });
                return;
            }

            setShareMode(shared.mode);
            setAllowCopy(shared.allowCopy ?? true);

            if (versionId && isUuid(versionId)) {
                const sharedVersion = await dbGetSharedTripVersion(token, versionId);
                if (sharedVersion?.trip) {
                    const resolvedView = sharedVersion.view ?? sharedVersion.trip.defaultView;
                    setViewSettings(resolvedView);
                    onTripLoaded(sharedVersion.trip, resolvedView);
                    setSourceShareVersionId(sharedVersion.versionId);
                    const latestVersionId = sharedVersion.latestVersionId ?? shared.latestVersionId ?? null;
                    setSnapshotState({
                        hasNewer: Boolean(latestVersionId && latestVersionId !== sharedVersion.versionId),
                        latestUrl: buildShareUrl(token),
                    });
                    return;
                }

                const version = await dbGetTripVersion(shared.trip.id, versionId);
                if (version?.trip) {
                    const latestVersionMismatch = Boolean(shared.latestVersionId && shared.latestVersionId !== versionId);
                    const sharedUpdatedAt = typeof shared.trip.updatedAt === 'number' ? shared.trip.updatedAt : null;
                    const snapshotUpdatedAt = typeof version.trip.updatedAt === 'number' ? version.trip.updatedAt : null;
                    const newerByTimestamp = sharedUpdatedAt !== null && snapshotUpdatedAt !== null && sharedUpdatedAt > snapshotUpdatedAt;
                    const resolvedView = version.view ?? version.trip.defaultView;
                    setViewSettings(resolvedView);
                    onTripLoaded(version.trip, resolvedView);
                    setSourceShareVersionId(versionId);
                    setSnapshotState({
                        hasNewer: latestVersionMismatch || newerByTimestamp,
                        latestUrl: buildShareUrl(token),
                    });
                    return;
                }
            }

            if (versionId) {
                const localEntry = findHistoryEntryByUrl(shared.trip.id, buildShareUrl(token, versionId));
                if (localEntry?.snapshot?.trip) {
                    const resolvedView = localEntry.snapshot.view ?? localEntry.snapshot.trip.defaultView;
                    setViewSettings(resolvedView);
                    onTripLoaded(localEntry.snapshot.trip, resolvedView);
                    setSourceShareVersionId(isUuid(versionId) ? versionId : null);
                    setSnapshotState({
                        hasNewer: true,
                        latestUrl: buildShareUrl(token),
                    });
                    return;
                }
            }

            const resolvedView = shared.view ?? shared.trip.defaultView;
            setViewSettings(resolvedView);
            onTripLoaded(shared.trip, resolvedView);
            setSourceShareVersionId(shared.latestVersionId ?? null);
        };

        void load();
    }, [token, versionId, location.search, navigate, onTripLoaded]);

    const handleCommitShared = (updatedTrip: ITrip, view: IViewSettings | undefined, options?: CommitOptions) => {
        if (shareMode !== 'edit' || !token) return;
        const label = options?.label || 'Updated trip';
        const commitTs = Date.now();
        createLocalHistoryEntry(navigate, updatedTrip, view, label, options, commitTs, buildShareUrl(token));

        const commit = async () => {
            const sessionId = await ensureDbSession();
            if (!sessionId) return;
            const version = await dbUpdateSharedTrip(token, updatedTrip, view, label);
            if (!version) return;
        };
        void commit();
    };

    const handleCopyTrip = async () => {
        if (!trip) return;
        if (DB_ENABLED) {
            const limit = await dbCanCreateTrip();
            if (!limit.allowCreate) {
                window.alert(`Trip limit reached (${limit.activeTripCount}/${limit.maxTripCount}). Archive a trip or upgrade to continue.`);
                navigate('/pricing');
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
            ...trip,
            id: generateTripId(),
            createdAt: now,
            updatedAt: now,
            isFavorite: false,
            status: 'active',
            tripExpiresAt: resolveTripExpiry(now),
            sourceKind: 'duplicate_shared',
            forkedFromTripId: trip.id,
            forkedFromShareToken: token || undefined,
            forkedFromShareVersionId: resolvedSourceShareVersionId || undefined,
        };
        if (typeof window !== 'undefined') {
            try {
                window.sessionStorage.setItem('tf_trip_copy_notice', JSON.stringify({
                    tripId: cloned.id,
                    sourceTripId: trip.id,
                    sourceTitle: trip.title,
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

    if (!trip) return null;

    return (
        <TripView
            trip={trip}
            initialViewSettings={viewSettings ?? trip.defaultView}
            onUpdateTrip={(updatedTrip) => onTripLoaded(updatedTrip, viewSettings ?? updatedTrip.defaultView)}
            onCommitState={handleCommitShared}
            onViewSettingsChange={(settings) => {
                setViewSettings(settings);
                onViewSettingsChange(settings);
            }}
            onOpenManager={onOpenManager}
            onOpenSettings={onOpenSettings}
            appLanguage={appLanguage}
            readOnly={shareMode === 'view'}
            canShare={false}
            shareStatus={shareMode}
            shareSnapshotMeta={snapshotState ?? undefined}
            onCopyTrip={allowCopy ? handleCopyTrip : undefined}
        />
    );
};
