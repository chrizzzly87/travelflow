import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import { useAuth } from '../hooks/useAuth';
import { useDbSync } from '../hooks/useDbSync';
import { DB_ENABLED } from '../config/db';
import { ANONYMOUS_TRIP_EXPIRATION_DAYS, buildTripExpiryIso } from '../config/productLimits';
import { getTripLifecycleState } from '../config/paywall';
import { trackEvent } from '../services/analyticsService';
import {
    dbCanCreateTrip,
    dbCreateTripVersion,
    dbGetSharedTrip,
    dbGetSharedTripVersion,
    dbGetTrip,
    dbGetTripVersion,
    dbUpdateSharedTrip,
    dbUpsertTrip,
    ensureDbSession,
    type DbTripAccess,
} from '../services/dbApi';
import { appendHistoryEntry, findHistoryEntryByUrl } from '../services/historyService';
import { getTripById, saveTrip } from '../services/storageService';
import {
    buildCreateTripUrl,
    buildShareUrl,
    buildTripUrl,
    decompressTrip,
    generateTripId,
    generateVersionId,
    isUuid,
} from '../utils';
import type { AppLanguage, ITrip, IViewSettings } from '../types';
import { TripView } from '../components/TripView';

type CommitOptions = {
    replace?: boolean;
    label?: string;
    adminOverride?: boolean;
};

type RouteCommonProps = {
    trip: ITrip | null;
    onTripLoaded: (trip: ITrip, view?: IViewSettings) => void;
    onOpenManager: () => void;
    onOpenSettings: () => void;
    appLanguage: AppLanguage;
    onViewSettingsChange: (settings: IViewSettings) => void;
    onLanguageLoaded?: (lang: AppLanguage) => void;
};

type ExampleTemplateFactory = (createdAtIso: string) => ITrip;
type ExampleTripCardSummary = {
    title: string;
    countries: { name: string }[];
};
type ExampleTripPrefetchState = {
    useExampleSharedTransition?: boolean;
    prefetchedExampleTrip?: ITrip;
    prefetchedExampleView?: IViewSettings;
    prefetchedTemplateTitle?: string;
    prefetchedTemplateCountries?: string[];
};

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

const resolveTripInitialMapFocusQuery = (trip: ITrip): string | undefined => {
    const locations = trip.items
        .filter((item) => item.type === 'city' && typeof item.location === 'string')
        .map((item) => item.location?.trim() ?? '')
        .filter((location) => location.length > 0);
    const uniqueLocations = Array.from(new Set(locations));
    if (uniqueLocations.length === 0) return undefined;
    return uniqueLocations.join(' || ');
};

type TripLoaderRouteProps = RouteCommonProps & {
    onUpdateTrip: (trip: ITrip, options?: { persist?: boolean }) => void;
    onCommitState: (trip: ITrip, view: IViewSettings | undefined, options?: CommitOptions) => void;
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
    const lastLoadRef = useRef<string | null>(null);
    const versionId = useMemo(() => {
        const params = new URLSearchParams(location.search);
        return params.get('v');
    }, [location.search]);

    const [viewSettings, setViewSettings] = useState<IViewSettings | undefined>(undefined);
    const [tripAccess, setTripAccess] = useState<DbTripAccess | null>(null);

    useDbSync(onLanguageLoaded);

    useEffect(() => {
        if (!tripId) return;
        const loadKey = `${tripId}:${versionId || ''}`;
        if (lastLoadRef.current === loadKey) return;
        lastLoadRef.current = loadKey;

        const load = async () => {
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

            if (DB_ENABLED) {
                await ensureDbSession();
                if (versionId && isUuid(versionId)) {
                    const version = await dbGetTripVersion(tripId, versionId);
                    if (version?.trip) {
                        saveTrip(version.trip);
                        const resolvedView = version.view ?? version.trip.defaultView;
                        setViewSettings(resolvedView);
                        onTripLoaded(version.trip, resolvedView);
                        return;
                    }
                }
                if (versionId) {
                    const localEntry = findHistoryEntryByUrl(tripId, buildTripUrl(tripId, versionId));
                    if (localEntry?.snapshot?.trip) {
                        saveTrip(localEntry.snapshot.trip);
                        const resolvedView = localEntry.snapshot.view ?? localEntry.snapshot.trip.defaultView;
                        setViewSettings(resolvedView);
                        onTripLoaded(localEntry.snapshot.trip, resolvedView);
                        return;
                    }
                }
                const dbTrip = await dbGetTrip(tripId);
                if (dbTrip?.trip) {
                    saveTrip(dbTrip.trip);
                    const resolvedView = dbTrip.view ?? dbTrip.trip.defaultView;
                    setTripAccess(dbTrip.access);
                    setViewSettings(resolvedView);
                    onTripLoaded(dbTrip.trip, resolvedView);
                    return;
                }
            }

            if (versionId) {
                const localEntry = findHistoryEntryByUrl(tripId, buildTripUrl(tripId, versionId));
                if (localEntry?.snapshot?.trip) {
                    saveTrip(localEntry.snapshot.trip);
                    const resolvedView = localEntry.snapshot.view ?? localEntry.snapshot.trip.defaultView;
                    setViewSettings(resolvedView);
                    onTripLoaded(localEntry.snapshot.trip, resolvedView);
                    return;
                }
            }
            const localTrip = getTripById(tripId);
            if (localTrip) {
                onTripLoaded(localTrip, localTrip.defaultView);
                return;
            }

            navigate('/create-trip', { replace: true });
        };

        void load();
    }, [tripId, versionId, navigate, onTripLoaded]);

    if (!trip) return null;
    const adminFallbackAccess = tripAccess?.source === 'admin_fallback' ? tripAccess : undefined;

    return (
        <TripView
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

type SharedTripLoaderRouteProps = RouteCommonProps;

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
            await ensureDbSession();
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

type ExampleTripLoaderRouteProps = RouteCommonProps;

export const ExampleTripLoaderRoute: React.FC<ExampleTripLoaderRouteProps> = ({
    trip,
    onTripLoaded,
    onOpenManager,
    onOpenSettings,
    appLanguage,
    onViewSettingsChange,
}) => {
    const { templateId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { access } = useAuth();
    const [viewSettings, setViewSettings] = useState<IViewSettings | undefined>(undefined);
    const trackedTemplateRef = useRef<string | null>(null);
    const hydratedTemplateRef = useRef<string | null>(null);
    const prefetchedState = location.state as ExampleTripPrefetchState | null;
    const prefetchedTrip = useMemo<ITrip | null>(() => {
        if (!templateId) return null;
        const candidate = prefetchedState?.prefetchedExampleTrip;
        if (!candidate) return null;
        if (!candidate.isExample) return null;
        if (candidate.exampleTemplateId !== templateId) return null;
        return candidate;
    }, [prefetchedState, templateId]);
    const prefetchedView = useMemo<IViewSettings | undefined>(() => {
        if (!prefetchedTrip) return undefined;
        return prefetchedState?.prefetchedExampleView ?? prefetchedTrip.defaultView;
    }, [prefetchedState, prefetchedTrip]);
    const prefetchedTemplateCard = useMemo<ExampleTripCardSummary | null>(() => {
        if (!prefetchedTrip) return null;
        const names = prefetchedState?.prefetchedTemplateCountries
            || prefetchedTrip.exampleTemplateCountries
            || [];
        return {
            title: prefetchedState?.prefetchedTemplateTitle || prefetchedTrip.title,
            countries: names.map((name) => ({ name })),
        };
    }, [prefetchedState, prefetchedTrip]);
    const [templateFactory, setTemplateFactory] = useState<ExampleTemplateFactory | null | undefined>(undefined);
    const [templateCard, setTemplateCard] = useState<ExampleTripCardSummary | null>(prefetchedTemplateCard);

    const resolveTripExpiry = (createdAtMs: number, existingTripExpiry?: string | null): string | null => {
        if (typeof existingTripExpiry === 'string' && existingTripExpiry) return existingTripExpiry;
        const expirationDays = access?.entitlements.tripExpirationDays;
        if (expirationDays === null) return null;
        if (typeof expirationDays === 'number' && expirationDays > 0) {
            return buildTripExpiryIso(createdAtMs, expirationDays);
        }
        return buildTripExpiryIso(createdAtMs, ANONYMOUS_TRIP_EXPIRATION_DAYS);
    };

    useEffect(() => {
        if (prefetchedTemplateCard) {
            setTemplateCard(prefetchedTemplateCard);
        }
    }, [prefetchedTemplateCard, templateId]);

    useEffect(() => {
        if (!templateId) {
            setTemplateFactory(null);
            setTemplateCard(prefetchedTemplateCard ?? null);
            return;
        }

        let cancelled = false;
        setTemplateFactory(undefined);

        const loadTemplateResources = async () => {
            try {
                const [{ TRIP_FACTORIES }, { getExampleTripCardByTemplateId }] = await Promise.all([
                    import('../data/exampleTripTemplates'),
                    import('../data/exampleTripCards'),
                ]);
                if (cancelled) return;
                const nextFactory = (TRIP_FACTORIES[templateId] as ExampleTemplateFactory | undefined) ?? null;
                setTemplateFactory(() => nextFactory);
                setTemplateCard((getExampleTripCardByTemplateId(templateId) as ExampleTripCardSummary | undefined) ?? prefetchedTemplateCard ?? null);
            } catch {
                if (cancelled) return;
                setTemplateFactory(null);
                setTemplateCard(prefetchedTemplateCard ?? null);
            }
        };

        void loadTemplateResources();

        return () => {
            cancelled = true;
        };
    }, [prefetchedTemplateCard, templateId]);

    const templateCountries = useMemo(
        () => templateCard?.countries?.map((country) => country.name).filter(Boolean)
            || prefetchedTrip?.exampleTemplateCountries
            || [],
        [templateCard, prefetchedTrip]
    );

    useEffect(() => {
        if (!templateId) {
            navigate('/', { replace: true });
            return;
        }

        const hasActiveExampleTrip =
            !!trip &&
            trip.isExample === true &&
            trip.exampleTemplateId === templateId;
        const hasHydratedTemplate = hydratedTemplateRef.current === templateId;
        const shouldHydrateTrip = !hasHydratedTemplate || !hasActiveExampleTrip;

        if (shouldHydrateTrip && prefetchedTrip) {
            const resolvedView = prefetchedView ?? prefetchedTrip.defaultView;
            setViewSettings(resolvedView);
            onTripLoaded(prefetchedTrip, resolvedView);
            hydratedTemplateRef.current = templateId;
        } else if (shouldHydrateTrip) {
            if (templateFactory === undefined) return;
            if (typeof templateFactory !== 'function') {
                navigate('/', { replace: true });
                return;
            }

            const nowMs = Date.now();
            const generated = templateFactory(new Date(nowMs).toISOString());
            const resolvedView: IViewSettings = {
                layoutMode: generated.defaultView?.layoutMode ?? 'horizontal',
                timelineView: generated.defaultView?.timelineView ?? 'horizontal',
                mapStyle: generated.defaultView?.mapStyle ?? 'standard',
                zoomLevel: generated.defaultView?.zoomLevel ?? 1,
                routeMode: generated.defaultView?.routeMode,
                showCityNames: generated.defaultView?.showCityNames,
                sidebarWidth: generated.defaultView?.sidebarWidth,
                timelineHeight: generated.defaultView?.timelineHeight,
            };
            const prepared: ITrip = {
                ...generated,
                createdAt: nowMs,
                updatedAt: nowMs,
                isFavorite: false,
                isExample: true,
                exampleTemplateId: templateId,
                exampleTemplateCountries: templateCountries,
                sourceKind: 'example',
                defaultView: resolvedView,
            };

            setViewSettings(resolvedView);
            onTripLoaded(prepared, resolvedView);
            hydratedTemplateRef.current = templateId;
        }

        if (trackedTemplateRef.current !== templateId) {
            trackedTemplateRef.current = templateId;
            trackEvent('example_trip__open', {
                template: templateId,
                country_count: templateCountries.length,
            });
        }
    }, [templateCountries, templateFactory, templateId, trip, prefetchedTrip, prefetchedView, navigate, onTripLoaded]);

    const activeTrip = useMemo(() => {
        if (trip?.isExample && trip.exampleTemplateId === templateId) {
            return trip;
        }
        return prefetchedTrip;
    }, [templateId, trip, prefetchedTrip]);

    const handleCopyExampleTrip = async () => {
        if (!activeTrip || !templateId) return;
        if (DB_ENABLED) {
            const limit = await dbCanCreateTrip();
            if (!limit.allowCreate) {
                window.alert(`Trip limit reached (${limit.activeTripCount}/${limit.maxTripCount}). Archive a trip or upgrade to continue.`);
                navigate('/pricing');
                return;
            }
        }
        const now = Date.now();
        const cloned: ITrip = {
            ...activeTrip,
            id: generateTripId(),
            createdAt: now,
            updatedAt: now,
            isFavorite: false,
            isExample: false,
            status: 'active',
            tripExpiresAt: resolveTripExpiry(now),
            sourceKind: 'duplicate_trip',
            sourceTemplateId: templateId,
            exampleTemplateId: undefined,
            exampleTemplateCountries: undefined,
            forkedFromExampleTemplateId: templateId,
        };

        if (typeof window !== 'undefined') {
            try {
                window.sessionStorage.setItem('tf_trip_copy_notice', JSON.stringify({
                    tripId: cloned.id,
                    sourceTripId: activeTrip.id,
                    sourceTitle: activeTrip.title,
                    sourceShareToken: null,
                    sourceShareVersionId: null,
                    createdAt: Date.now(),
                }));
            } catch {
                // ignore storage issues
            }
        }

        saveTrip(cloned);
        trackEvent('example_trip__banner--copy_trip', {
            template: templateId,
            country_count: templateCountries.length,
        });

        if (DB_ENABLED) {
            await ensureDbSession();
            await dbUpsertTrip(cloned, viewSettings);
            await dbCreateTripVersion(cloned, viewSettings, 'Data: Copied trip');
        }

        navigate(buildTripUrl(cloned.id));
    };

    const handleCreateSimilarTrip = () => {
        if (!templateId) return;
        const url = buildCreateTripUrl({
            countries: templateCountries,
            meta: {
                source: 'example_trip',
                label: templateCard?.title || 'Example trip',
                templateId,
            },
        });
        trackEvent('example_trip__banner--create_similar', {
            template: templateId,
            country_count: templateCountries.length,
        });
        navigate(url);
    };

    if (!activeTrip || !activeTrip.isExample) return null;

    return (
        <TripView
            trip={activeTrip}
            initialViewSettings={viewSettings ?? activeTrip.defaultView}
            onUpdateTrip={(updatedTrip) => onTripLoaded(updatedTrip, viewSettings ?? updatedTrip.defaultView)}
            onViewSettingsChange={(settings) => {
                setViewSettings(settings);
                onViewSettingsChange(settings);
            }}
            onOpenManager={onOpenManager}
            onOpenSettings={onOpenSettings}
            appLanguage={appLanguage}
            canShare={false}
            onCopyTrip={handleCopyExampleTrip}
            isExamplePreview
            suppressToasts
            suppressReleaseNotice
            exampleTripBanner={{
                title: templateCard?.title || activeTrip.title,
                countries: templateCountries,
                onCreateSimilarTrip: handleCreateSimilarTrip,
            }}
        />
    );
};
