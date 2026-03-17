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
import {
    buildTripUrl,
    decompressTrip,
    isUuid,
} from '../utils';
import {
    buildPathFromLocationParts,
    rememberAuthReturnPath,
} from '../services/authNavigationService';
import type { ITrip, ITimelineItem, IViewSettings } from '../types';
import { normalizeTransportMode } from '../shared/transportModes';
import type { TripLoaderRouteProps } from './tripRouteTypes';
import { LazyTripView } from '../components/tripview/LazyTripView';
import { TripRouteLoadingShell } from '../components/tripview/TripRouteLoadingShell';

const areViewSettingsEqual = (a?: IViewSettings, b?: IViewSettings): boolean => {
    if (!a && !b) return true;
    if (!a || !b) return false;
    return (
        a.layoutMode === b.layoutMode
        && a.timelineMode === b.timelineMode
        && a.timelineView === b.timelineView
        && a.mapDockMode === b.mapDockMode
        && a.mapStyle === b.mapStyle
        && a.routeMode === b.routeMode
        && a.showCityNames === b.showCityNames
        && a.zoomLevel === b.zoomLevel
        && a.zoomBehavior === b.zoomBehavior
        && a.sidebarWidth === b.sidebarWidth
        && a.timelineHeight === b.timelineHeight
    );
};

const resolveTripInitialMapFocusQuery = (trip: ITrip): string | undefined => {
    const locations = trip.items
        .filter((item) => item.type === 'city' && typeof item.location === 'string')
        .map((item) => item.location?.trim() ?? '')
        .filter((location) => location.length > 0);
    const uniqueLocations = Array.from(new Set(locations));
    if (uniqueLocations.length === 0) return undefined;
    return uniqueLocations.join(' || ');
};

const normalizeTripForRouteLoad = (trip: ITrip): ITrip => {
    let didChange = false;

    const normalizedItems = trip.items.map((item) => {
        if (item.type !== 'travel' && item.type !== 'travel-empty') return item;

        const nextMode = normalizeTransportMode(item.transportMode);
        const nextType: ITimelineItem['type'] = nextMode === 'na' ? 'travel-empty' : 'travel';
        const modeChanged = item.transportMode !== nextMode;
        const typeChanged = item.type !== nextType;
        const shouldClearRouteMetrics = (
            modeChanged || nextMode === 'na'
        ) && (
            item.routeDistanceKm !== undefined || item.routeDurationHours !== undefined
        );

        if (!modeChanged && !typeChanged && !shouldClearRouteMetrics) return item;

        didChange = true;
        return {
            ...item,
            type: nextType,
            transportMode: nextMode,
            routeDistanceKm: shouldClearRouteMetrics ? undefined : item.routeDistanceKm,
            routeDurationHours: shouldClearRouteMetrics ? undefined : item.routeDurationHours,
        };
    });

    if (!didChange) return trip;
    return {
        ...trip,
        items: normalizedItems,
    };
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
                if (!didRouteTargetChange && hasInSessionViewOverrideRef.current) {
                    return latestViewSettingsRef.current ?? resolvedView ?? fallbackView;
                }
                return resolvedView ?? fallbackView;
            };

            const sharedState = decompressTrip(tripId);
            if (sharedState) {
                const { trip: loadedTrip, view } = sharedState;
                const localTrip = getTripById(loadedTrip.id);
                const mergedTrip: ITrip = {
                    ...loadedTrip,
                    isFavorite: localTrip?.isFavorite ?? loadedTrip.isFavorite ?? false,
                };
                const normalizedTrip = normalizeTripForRouteLoad(mergedTrip);
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
                    const normalizedLocalSnapshotTrip = normalizeTripForRouteLoad(localEntry.snapshot.trip);
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
                const normalizedLocalTrip = normalizeTripForRouteLoad(localTrip);
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
                        const normalizedVersionTrip = normalizeTripForRouteLoad(version.trip);
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
                    const normalizedDbTrip = normalizeTripForRouteLoad(dbTrip.trip);
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
        if (areViewSettingsEqual(latestViewSettingsRef.current, settings)) return;
        hasInSessionViewOverrideRef.current = true;
        latestViewSettingsRef.current = settings;
        setViewSettings(settings);
        onViewSettingsChange(settings);
        if (!DB_ENABLED || !tripId) return;
        if (tripAccess?.source === 'public_read' || tripAccess?.source === 'admin_fallback') return;
        void dbUpdateTripShareViewSettings(tripId, settings).catch(() => undefined);
    }, [onViewSettingsChange, tripAccess?.source, tripId]);

    if (!trip) {
        return <TripRouteLoadingShell variant="loadingTrip" />;
    }
    const adminFallbackAccess = tripAccess?.source === 'admin_fallback' ? tripAccess : undefined;
    const isPublicReadView = tripAccess?.source === 'public_read';
    const tripViewKey = `${trip.id}:${adminFallbackAccess ? 'admin-fallback' : isPublicReadView ? 'public-read' : 'default'}`;

    return (
        <React.Suspense fallback={<TripRouteLoadingShell variant="preparingPlanner" />}>
            <LazyTripView
                key={tripViewKey}
                trip={trip}
                initialMapFocusQuery={resolveTripInitialMapFocusQuery(trip)}
                initialViewSettings={viewSettings ?? trip.defaultView}
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
