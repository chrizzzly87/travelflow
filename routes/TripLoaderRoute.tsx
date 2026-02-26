import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import { useAuth } from '../hooks/useAuth';
import { useDbSync } from '../hooks/useDbSync';
import { useConnectivityStatus } from '../hooks/useConnectivityStatus';
import { DB_ENABLED } from '../config/db';
import {
    dbGetTrip,
    dbGetTripVersion,
    ensureDbSession,
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
import type { ITrip, IViewSettings } from '../types';
import type { TripLoaderRouteProps } from './tripRouteTypes';
import { TripView } from '../components/TripView';

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
    const versionId = useMemo(() => {
        const params = new URLSearchParams(location.search);
        return params.get('v');
    }, [location.search]);

    const [viewSettings, setViewSettings] = useState<IViewSettings | undefined>(undefined);
    const [tripAccess, setTripAccess] = useState<DbTripAccess | null>(null);

    useDbSync(onLanguageLoaded);

    useEffect(() => {
        if (isAuthLoading) return;
        if (!tripId) return;
        const loadKey = `${tripId}:${versionId || ''}:${connectivitySnapshot.state}`;
        if (lastLoadRef.current === loadKey) return;
        lastLoadRef.current = loadKey;

        const load = async () => {
            const connectivityState = connectivitySnapshot.state;
            const currentPath = buildPathFromLocationParts({
                pathname: location.pathname,
                search: location.search,
                hash: location.hash,
            });

            setViewSettings(undefined);
            setTripAccess(null);

            const sharedState = decompressTrip(tripId);
            if (sharedState) {
                const { trip: loadedTrip, view } = sharedState;
                const localTrip = getTripById(loadedTrip.id);
                const mergedTrip: ITrip = {
                    ...loadedTrip,
                    isFavorite: localTrip?.isFavorite ?? loadedTrip.isFavorite ?? false,
                };
                const resolvedView = view ?? mergedTrip.defaultView;
                setViewSettings(resolvedView);
                onTripLoaded(mergedTrip, resolvedView);
                return;
            }

            let localResolvedTrip: ITrip | null = null;
            let localResolvedView: IViewSettings | undefined;

            if (versionId) {
                const localEntry = findHistoryEntryByUrl(tripId, buildTripUrl(tripId, versionId));
                if (localEntry?.snapshot?.trip) {
                    saveTrip(localEntry.snapshot.trip);
                    localResolvedTrip = localEntry.snapshot.trip;
                    localResolvedView = localEntry.snapshot.view ?? localEntry.snapshot.trip.defaultView;
                    setViewSettings(localResolvedView);
                    onTripLoaded(localResolvedTrip, localResolvedView);
                    if (connectivityState === 'offline') return;
                }
            }

            const localTrip = getTripById(tripId);
            if (!localResolvedTrip && localTrip && connectivityState !== 'online') {
                localResolvedTrip = localTrip;
                localResolvedView = localTrip.defaultView;
                setViewSettings(localResolvedView);
                onTripLoaded(localTrip, localResolvedView);
                if (connectivityState === 'offline') return;
            }

            if (DB_ENABLED && connectivityState !== 'offline') {
                await ensureDbSession();
                if (versionId && isUuid(versionId)) {
                    const version = await dbGetTripVersion(tripId, versionId);
                    if (version?.trip) {
                        saveTrip(version.trip);
                        const resolvedView = version.view ?? version.trip.defaultView;
                        const localUpdatedAt = localResolvedTrip?.updatedAt ?? 0;
                        const dbUpdatedAt = version.trip.updatedAt ?? 0;
                        if (!localResolvedTrip || dbUpdatedAt >= localUpdatedAt) {
                            setViewSettings(resolvedView);
                            onTripLoaded(version.trip, resolvedView);
                        }
                        return;
                    }
                }
                const dbTrip = await dbGetTrip(tripId);
                if (dbTrip?.trip) {
                    saveTrip(dbTrip.trip);
                    const resolvedView = dbTrip.view ?? dbTrip.trip.defaultView;
                    const localUpdatedAt = localResolvedTrip?.updatedAt ?? 0;
                    const dbUpdatedAt = dbTrip.trip.updatedAt ?? 0;
                    if (!localResolvedTrip || dbUpdatedAt >= localUpdatedAt) {
                        setTripAccess(dbTrip.access);
                        setViewSettings(resolvedView);
                        onTripLoaded(dbTrip.trip, resolvedView);
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

    if (!trip) return null;
    const adminFallbackAccess = tripAccess?.source === 'admin_fallback' ? tripAccess : undefined;
    const tripViewKey = `${trip.id}:${adminFallbackAccess ? 'admin-fallback' : 'default'}`;

    return (
        <TripView
            key={tripViewKey}
            trip={trip}
            initialMapFocusQuery={resolveTripInitialMapFocusQuery(trip)}
            initialViewSettings={viewSettings ?? trip.defaultView}
            onUpdateTrip={onUpdateTrip}
            onCommitState={onCommitState}
            onViewSettingsChange={(settings) => {
                setViewSettings(settings);
                onViewSettingsChange(settings);
            }}
            onOpenManager={onOpenManager}
            onOpenSettings={onOpenSettings}
            appLanguage={appLanguage}
            canShare={!adminFallbackAccess}
            adminAccess={adminFallbackAccess}
        />
    );
};
