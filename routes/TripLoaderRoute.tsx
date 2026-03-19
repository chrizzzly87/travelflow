import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import { useAuth } from '../hooks/useAuth';
import { useDbSync } from '../hooks/useDbSync';
import { useConnectivityStatus } from '../hooks/useConnectivityStatus';
import { DB_ENABLED } from '../config/db';
import {
    dbGetTrip,
    dbGetTripVersion,
    dbUpdateTripShareViewSettings,
    type DbTripAccess,
} from '../services/dbApi';
import { findHistoryEntryByUrl } from '../services/historyService';
import { getTripById, saveTrip } from '../services/storageService';
import { resolveTripInitialViewSettings } from '../services/tripViewSettingsService';
import {
    buildTripUrl,
    decompressTrip,
    isUuid,
} from '../utils';
import {
    buildPathFromLocationParts,
    rememberAuthReturnPath,
} from '../services/authNavigationService';
import type { ITrip, IViewSettings } from '../types';
import { normalizeTripForRuntime, normalizeViewSettingsForRuntime } from '../shared/tripRuntimeNormalization';
import { areViewSettingsEqual } from '../shared/viewSettings';
import type { TripLoaderRouteProps } from './tripRouteTypes';
import { LazyTripView } from '../components/tripview/LazyTripView';
import { TripRouteLoadingShell } from '../components/tripview/TripRouteLoadingShell';

const resolveTripInitialMapFocusQuery = (trip: ITrip): string | undefined => {
    const locations = trip.items
        .filter((item) => item.type === 'city' && typeof item.location === 'string')
        .map((item) => item.location?.trim() ?? '')
        .filter((location) => location.length > 0);
    const uniqueLocations = Array.from(new Set(locations));
    if (uniqueLocations.length === 0) return undefined;
    return uniqueLocations.join(' || ');
};

const resolveSharedTripPathByTripId = async (tripId: string, versionId?: string | null): Promise<string | null> => {
    if (!tripId) return null;
    const params = new URLSearchParams();
    params.set('trip', tripId);
    if (versionId) params.set('v', versionId);

    try {
        const response = await fetch(`/api/trip-share-resolve?${params.toString()}`, {
            method: 'GET',
            headers: {
                Accept: 'application/json',
            },
        });
        if (!response.ok) return null;
        const payload = await response.json() as { path?: unknown };
        return typeof payload?.path === 'string' && payload.path.startsWith('/s/')
            ? payload.path
            : null;
    } catch {
        return null;
    }
};

export const TripLoaderRoute: React.FC<TripLoaderRouteProps> = ({
    trip,
    onTripLoaded,
    onUpdateTrip,
    onCommitState,
    onOpenManager,
    onOpenSettings,
    appLanguage,
    onViewSettingsChange,
    onLanguageLoaded,
}) => {
    const { tripId } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
    const { snapshot: connectivitySnapshot } = useConnectivityStatus();
    const lastLoadRef = useRef<string | null>(null);
    const lastRouteTargetRef = useRef<string | null>(null);
    const latestViewSettingsRef = useRef<IViewSettings | undefined>(undefined);
    const hasInSessionViewOverrideRef = useRef(false);
    const versionId = useMemo(() => {
        const params = new URLSearchParams(location.search);
        return params.get('v');
    }, [location.search]);

    const [viewSettings, setViewSettings] = useState<IViewSettings | undefined>(undefined);
    const [tripAccess, setTripAccess] = useState<DbTripAccess | null>(null);
    const normalizedRenderedTrip = useMemo(() => (trip ? normalizeTripForRuntime(trip) : null), [trip]);

    useDbSync(onLanguageLoaded);

    useEffect(() => {
        latestViewSettingsRef.current = viewSettings;
    }, [viewSettings]);

    useEffect(() => {
        if (isAuthLoading) return;
        if (!tripId) return;
        const loadKey = `${tripId}:${versionId || ''}:${connectivitySnapshot.state}`;
        if (lastLoadRef.current === loadKey) return;
        lastLoadRef.current = loadKey;
        const routeTargetKey = `${tripId}:${versionId || ''}`;
        const didRouteTargetChange = lastRouteTargetRef.current !== routeTargetKey;
        lastRouteTargetRef.current = routeTargetKey;

        const load = async () => {
            const connectivityState = connectivitySnapshot.state;
            const currentPath = buildPathFromLocationParts({
                pathname: location.pathname,
                search: location.search,
                hash: location.hash,
            });

            // Preserve in-session view preferences during connectivity refreshes
            // for the same route target so late loader responses cannot snap UI
            // controls (e.g. timeline mode) back to stale defaults.
            if (didRouteTargetChange) {
                setViewSettings(undefined);
                setTripAccess(null);
                latestViewSettingsRef.current = undefined;
                hasInSessionViewOverrideRef.current = false;
            }

            const resolveEffectiveView = (resolvedView?: IViewSettings, fallbackView?: IViewSettings) => {
                const normalizedResolvedView = normalizeViewSettingsForRuntime(resolvedView);
                const normalizedFallbackView = normalizeViewSettingsForRuntime(fallbackView);
                if (!didRouteTargetChange && hasInSessionViewOverrideRef.current) {
                    return normalizeViewSettingsForRuntime(latestViewSettingsRef.current) ?? normalizedResolvedView ?? normalizedFallbackView;
                }
                return normalizedResolvedView ?? normalizedFallbackView;
            };

            const sharedState = decompressTrip(tripId);
            if (sharedState) {
                const { trip: loadedTrip, view } = sharedState;
                const localTrip = getTripById(loadedTrip.id);
                const mergedTrip: ITrip = {
                    ...loadedTrip,
                    isFavorite: localTrip?.isFavorite ?? loadedTrip.isFavorite ?? false,
                };
                const normalizedTrip = normalizeTripForRuntime(mergedTrip);
                const effectiveView = resolveEffectiveView(view, normalizedTrip.defaultView);
                setViewSettings(effectiveView);
                onTripLoaded(normalizedTrip, effectiveView);
                return;
            }

            let localResolvedTrip: ITrip | null = null;
            let localResolvedView: IViewSettings | undefined;

            if (versionId) {
                const localEntry = findHistoryEntryByUrl(tripId, buildTripUrl(tripId, versionId));
                if (localEntry?.snapshot?.trip) {
                    const normalizedLocalSnapshotTrip = normalizeTripForRuntime(localEntry.snapshot.trip);
                    saveTrip(normalizedLocalSnapshotTrip, { preserveUpdatedAt: true });
                    localResolvedTrip = normalizedLocalSnapshotTrip;
                    localResolvedView = resolveEffectiveView(localEntry.snapshot.view, normalizedLocalSnapshotTrip.defaultView);
                    setViewSettings(localResolvedView);
                    onTripLoaded(localResolvedTrip, localResolvedView);
                    return;
                }
            }

            const localTrip = getTripById(tripId);
            if (!localResolvedTrip && localTrip && connectivityState !== 'online') {
                const normalizedLocalTrip = normalizeTripForRuntime(localTrip);
                if (normalizedLocalTrip !== localTrip) {
                    saveTrip(normalizedLocalTrip, { preserveUpdatedAt: true });
                }
                localResolvedTrip = normalizedLocalTrip;
                localResolvedView = resolveEffectiveView(normalizedLocalTrip.defaultView, normalizedLocalTrip.defaultView);
                setViewSettings(localResolvedView);
                onTripLoaded(normalizedLocalTrip, localResolvedView);
                if (connectivityState === 'offline') return;
            }

            if (DB_ENABLED && connectivityState !== 'offline') {
                if (versionId && isUuid(versionId)) {
                    const version = await dbGetTripVersion(tripId, versionId);
                    if (version?.trip) {
                        const normalizedVersionTrip = normalizeTripForRuntime(version.trip);
                        saveTrip(normalizedVersionTrip, { preserveUpdatedAt: true });
                        const resolvedView = resolveEffectiveView(version.view, normalizedVersionTrip.defaultView);
                        const localUpdatedAt = localResolvedTrip?.updatedAt ?? 0;
                        const dbUpdatedAt = normalizedVersionTrip.updatedAt ?? 0;
                        if (!localResolvedTrip || dbUpdatedAt >= localUpdatedAt) {
                            setViewSettings(resolvedView);
                            onTripLoaded(normalizedVersionTrip, resolvedView);
                        }
                        return;
                    }
                }
                const dbTrip = await dbGetTrip(tripId);
                if (dbTrip?.trip) {
                    const normalizedDbTrip = normalizeTripForRuntime(dbTrip.trip);
                    if (dbTrip.access.source === 'owner') {
                        saveTrip(normalizedDbTrip, { preserveUpdatedAt: true });
                    }
                    const resolvedView = resolveEffectiveView(dbTrip.view, normalizedDbTrip.defaultView);
                    const localUpdatedAt = localResolvedTrip?.updatedAt ?? 0;
                    const dbUpdatedAt = normalizedDbTrip.updatedAt ?? 0;
                    if (!localResolvedTrip || dbUpdatedAt >= localUpdatedAt) {
                        setTripAccess(dbTrip.access);
                        setViewSettings(resolvedView);
                        onTripLoaded(normalizedDbTrip, resolvedView);
                    }
                    return;
                }
            }

            if (localResolvedTrip || localTrip) {
                return;
            }

            if (DB_ENABLED) {
                if (connectivityState !== 'online') {
                    navigate('/share-unavailable?reason=offline', { replace: true });
                    return;
                }
                const sharedPath = await resolveSharedTripPathByTripId(tripId, versionId);
                if (sharedPath) {
                    navigate(sharedPath, { replace: true });
                    return;
                }
                if (!isAuthenticated) {
                    rememberAuthReturnPath(currentPath);
                    navigate('/login', {
                        replace: true,
                        state: { from: currentPath },
                    });
                    return;
                }
                navigate('/share-unavailable', { replace: true });
                return;
            }

            navigate('/create-trip', { replace: true });
        };

        void load();
    }, [
        isAuthLoading,
        isAuthenticated,
        location.hash,
        location.pathname,
        location.search,
        navigate,
        onTripLoaded,
        tripId,
        versionId,
        connectivitySnapshot.state,
    ]);

    const handleRouteViewSettingsChange = useCallback((settings: IViewSettings) => {
        const normalizedSettings = normalizeViewSettingsForRuntime(settings);
        if (!normalizedSettings) return;
        if (areViewSettingsEqual(latestViewSettingsRef.current, normalizedSettings)) return;
        hasInSessionViewOverrideRef.current = true;
        latestViewSettingsRef.current = normalizedSettings;
        setViewSettings(normalizedSettings);
        onViewSettingsChange(normalizedSettings);
        if (!DB_ENABLED || !tripId) return;
        if (tripAccess?.source === 'public_read' || tripAccess?.source === 'admin_fallback') return;
        void dbUpdateTripShareViewSettings(tripId, normalizedSettings).catch(() => undefined);
    }, [onViewSettingsChange, tripAccess?.source, tripId]);

    if (!normalizedRenderedTrip) {
        return <TripRouteLoadingShell variant="loadingTrip" />;
    }
    const adminFallbackAccess = tripAccess?.source === 'admin_fallback' ? tripAccess : undefined;
    const isPublicReadView = tripAccess?.source === 'public_read';
    const tripViewKey = `${normalizedRenderedTrip.id}:${adminFallbackAccess ? 'admin-fallback' : isPublicReadView ? 'public-read' : 'default'}`;
    const initialRouteViewSettings = resolveTripInitialViewSettings({
        preferredView: normalizeViewSettingsForRuntime(viewSettings),
        fallbackView: normalizedRenderedTrip.defaultView,
        allowPersistedOverrides: !versionId && !adminFallbackAccess && !isPublicReadView,
    });

    return (
        <React.Suspense fallback={<TripRouteLoadingShell variant="preparingPlanner" />}>
            <LazyTripView
                key={tripViewKey}
                trip={normalizedRenderedTrip}
                initialMapFocusQuery={resolveTripInitialMapFocusQuery(normalizedRenderedTrip)}
                initialViewSettings={initialRouteViewSettings}
                onUpdateTrip={onUpdateTrip}
                onCommitState={onCommitState}
                onViewSettingsChange={handleRouteViewSettingsChange}
                onOpenManager={onOpenManager}
                onOpenSettings={onOpenSettings}
                appLanguage={appLanguage}
                readOnly={Boolean(isPublicReadView)}
                canShare={!adminFallbackAccess && !isPublicReadView}
                adminAccess={adminFallbackAccess}
                tripAccess={tripAccess || undefined}
            />
        </React.Suspense>
    );
};
