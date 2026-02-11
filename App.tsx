import React, { useState, useEffect, useRef, useMemo, useLayoutEffect } from 'react';
import { flushSync } from 'react-dom';
import { BrowserRouter as Router, Routes, Route, useNavigate, Navigate, useLocation, useParams } from 'react-router-dom';
import { CreateTripForm } from './components/CreateTripForm';
import { TripView } from './components/TripView';
import { AppLanguage, ITrip, IViewSettings } from './types';
import { TripManager } from './components/TripManager';
import { SettingsModal } from './components/SettingsModal';
import { MarketingHomePage } from './pages/MarketingHomePage';
import { FeaturesPage } from './pages/FeaturesPage';
import { UpdatesPage } from './pages/UpdatesPage';
import { BlogPage } from './pages/BlogPage';
import { BlogPostPage } from './pages/BlogPostPage';
import { InspirationsPage } from './pages/InspirationsPage';
import { ThemesPage } from './pages/inspirations/ThemesPage';
import { BestTimeToTravelPage } from './pages/inspirations/BestTimeToTravelPage';
import { CountriesPage } from './pages/inspirations/CountriesPage';
import { FestivalsPage } from './pages/inspirations/FestivalsPage';
import { WeekendGetawaysPage } from './pages/inspirations/WeekendGetawaysPage';
import { CountryDetailPage } from './pages/inspirations/CountryDetailPage';
import { LoginPage } from './pages/LoginPage';
import { ImprintPage } from './pages/ImprintPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { TermsPage } from './pages/TermsPage';
import { CookiesPage } from './pages/CookiesPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { PricingPage } from './pages/PricingPage';
import { CreateTripV1Page } from './pages/CreateTripV1Page';
import { CreateTripV2Page } from './pages/CreateTripV2Page';
import { CreateTripV3Page } from './pages/CreateTripV3Page';
import { FaqPage } from './pages/FaqPage';
import { ShareUnavailablePage } from './pages/ShareUnavailablePage';
import { CreateTripClassicLabPage } from './pages/CreateTripClassicLabPage';
import { CreateTripSplitWorkspaceLabPage } from './pages/CreateTripSplitWorkspaceLabPage';
import { CreateTripJourneyArchitectLabPage } from './pages/CreateTripJourneyArchitectLabPage';
import { TripManagerProvider } from './contexts/TripManagerContext';
import { CookieConsentBanner } from './components/marketing/CookieConsentBanner';
import { saveTrip, getTripById } from './services/storageService';
import { appendHistoryEntry, findHistoryEntryByUrl } from './services/historyService';
import { buildCreateTripUrl, buildShareUrl, buildTripUrl, decompressTrip, generateTripId, generateVersionId, getStoredAppLanguage, isUuid, setStoredAppLanguage } from './utils';
import {
    DB_ENABLED,
    dbCanCreateTrip,
    dbCreateTripVersion,
    dbGetSharedTrip,
    dbGetSharedTripVersion,
    dbGetTrip,
    dbGetTripVersion,
    dbUpdateSharedTrip,
    dbUpsertTrip,
    dbUpsertUserSettings,
    ensureDbSession,
    isSimulatedLoggedIn,
    toggleSimulatedLogin,
} from './services/dbService';
import { useDbSync } from './hooks/useDbSync';
import { AppDialogProvider } from './components/AppDialogProvider';
import { GlobalTooltipLayer } from './components/GlobalTooltipLayer';
import { OnPageDebugger } from './components/OnPageDebugger';
import { initializeAnalytics, trackEvent, trackPageView } from './services/analyticsService';
import { buildTripExpiryIso } from './config/productLimits';
import { getTripLifecycleState } from './config/paywall';
import { TRIP_FACTORIES } from './data/exampleTripTemplates';
import { getExampleTripCardByTemplateId } from './data/exampleTripCards';

type AppDebugWindow = Window & typeof globalThis & {
    toggleSimulatedLogin?: (force?: boolean) => boolean;
    getSimulatedLoginState?: () => 'simulated_logged_in' | 'anonymous';
};

/** Scroll to top on route change */
const ScrollToTop: React.FC = () => {
    const { pathname } = useLocation();
    const prevPathRef = useRef(pathname);

    useLayoutEffect(() => {
        if (prevPathRef.current === pathname) return;
        prevPathRef.current = pathname;
        window.scrollTo(0, 0);
    }, [pathname]);

    return null;
};

/** Intercept internal link clicks to wrap in View Transition API.
 *  Uses the capture phase so we run BEFORE React Router's onClick,
 *  preventing a double-navigate that causes duplicated content. */
const ViewTransitionHandler: React.FC = () => {
    const navigate = useNavigate();

    useEffect(() => {
        if (!document.startViewTransition) return;

        const handleClick = (e: MouseEvent) => {
            const anchor = (e.target as HTMLElement).closest('a');
            if (!anchor) return;
            const href = anchor.getAttribute('href');
            if (!href || !href.startsWith('/')) return;
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
            if (href.startsWith('#')) return;
            // Skip same-page navigations
            if (href === window.location.pathname) return;

            e.preventDefault();
            e.stopPropagation();

            document.startViewTransition(() => {
                flushSync(() => {
                    navigate(href);
                });
            });
        };

        document.addEventListener('click', handleClick, true);
        return () => document.removeEventListener('click', handleClick, true);
    }, [navigate]);

    return null;
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

// Legacy compressed URLs still supported in TripLoader.

// Component to handle trip loading from URL
const TripLoader = ({
    trip,
    onTripLoaded,
    handleUpdateTrip,
    handleCommitState,
    setIsManagerOpen,
    setIsSettingsOpen,
    appLanguage,
    onViewSettingsChange,
    onLanguageLoaded,
}: {
    trip: ITrip | null,
    onTripLoaded: (t: ITrip, view?: IViewSettings) => void,
    handleUpdateTrip: (t: ITrip, options?: { persist?: boolean }) => void,
    handleCommitState: (t: ITrip, view: IViewSettings | undefined, options?: { replace?: boolean; label?: string }) => void,
    setIsManagerOpen: (o: boolean) => void,
    setIsSettingsOpen: (o: boolean) => void,
    appLanguage: AppLanguage,
    onViewSettingsChange: (settings: IViewSettings) => void,
    onLanguageLoaded?: (lang: AppLanguage) => void,
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

    useDbSync(onLanguageLoaded);

    useEffect(() => {
        if (!tripId) return;
        const loadKey = `${tripId}:${versionId || ''}`;
        if (lastLoadRef.current === loadKey) return;
        lastLoadRef.current = loadKey;

        const load = async () => {
            setViewSettings(undefined);
            // 1. Legacy compressed URLs
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

            // 2. Supabase-backed load
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
                    setViewSettings(resolvedView);
                    onTripLoaded(dbTrip.trip, resolvedView);
                    return;
                }
            }

            // 3. Local fallback
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

            console.error('Failed to load trip from URL');
            navigate('/create-trip', { replace: true });
        };

        void load();
    }, [tripId, versionId, navigate, onTripLoaded]);

    if (!trip) return null;

    return (
        <TripView
            trip={trip}
            initialViewSettings={viewSettings ?? trip.defaultView}
            onUpdateTrip={handleUpdateTrip}
            onCommitState={handleCommitState}
            onViewSettingsChange={(settings) => {
                setViewSettings(settings);
                onViewSettingsChange(settings);
            }}
            onOpenManager={() => setIsManagerOpen(true)}
            onOpenSettings={() => setIsSettingsOpen(true)}
            appLanguage={appLanguage}
        />
    );
};

const SharedTripLoader = ({
    trip,
    onTripLoaded,
    setIsManagerOpen,
    setIsSettingsOpen,
    appLanguage,
    onViewSettingsChange,
    onLanguageLoaded,
}: {
    trip: ITrip | null,
    onTripLoaded: (t: ITrip, view?: IViewSettings) => void,
    setIsManagerOpen: (o: boolean) => void,
    setIsSettingsOpen: (o: boolean) => void,
    appLanguage: AppLanguage,
    onViewSettingsChange: (settings: IViewSettings) => void,
    onLanguageLoaded?: (lang: AppLanguage) => void,
}) => {
    const { token } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const lastLoadRef = useRef<string | null>(null);
    const [shareMode, setShareMode] = useState<'view' | 'edit'>('view');
    const [allowCopy, setAllowCopy] = useState(true);
    const [viewSettings, setViewSettings] = useState<IViewSettings | undefined>(undefined);
    const [snapshotState, setSnapshotState] = useState<{ hasNewer: boolean; latestUrl: string } | null>(null);
    const [sourceShareVersionId, setSourceShareVersionId] = useState<string | null>(null);

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

    const handleCommitShared = (updatedTrip: ITrip, view: IViewSettings | undefined, options?: { replace?: boolean; label?: string }) => {
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
            tripExpiresAt: buildTripExpiryIso(now),
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
            } catch (e) {
                // ignore storage issues
            }
        }
        saveTrip(cloned);
        if (DB_ENABLED) {
            await ensureDbSession();
            await dbUpsertTrip(cloned, viewSettings);
            const version = await dbCreateTripVersion(cloned, viewSettings, 'Data: Copied trip');
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
            onOpenManager={() => setIsManagerOpen(true)}
            onOpenSettings={() => setIsSettingsOpen(true)}
            appLanguage={appLanguage}
            readOnly={shareMode === 'view'}
            canShare={false}
            shareStatus={shareMode}
            shareSnapshotMeta={snapshotState ?? undefined}
            onCopyTrip={allowCopy ? handleCopyTrip : undefined}
        />
    );
};

const ExampleTripLoader = ({
    trip,
    onTripLoaded,
    setIsManagerOpen,
    setIsSettingsOpen,
    appLanguage,
    onViewSettingsChange,
}: {
    trip: ITrip | null,
    onTripLoaded: (t: ITrip, view?: IViewSettings) => void,
    setIsManagerOpen: (o: boolean) => void,
    setIsSettingsOpen: (o: boolean) => void,
    appLanguage: AppLanguage,
    onViewSettingsChange: (settings: IViewSettings) => void,
}) => {
    const { templateId } = useParams();
    const navigate = useNavigate();
    const [viewSettings, setViewSettings] = useState<IViewSettings | undefined>(undefined);
    const trackedTemplateRef = useRef<string | null>(null);
    const templateCard = useMemo(() => {
        if (!templateId) return null;
        return getExampleTripCardByTemplateId(templateId) || null;
    }, [templateId]);
    const templateCountries = useMemo(
        () => templateCard?.countries?.map((country) => country.name).filter(Boolean) || [],
        [templateCard]
    );

    useEffect(() => {
        if (!templateId) {
            navigate('/', { replace: true });
            return;
        }

        const factory = TRIP_FACTORIES[templateId];
        if (!factory) {
            navigate('/', { replace: true });
            return;
        }

        const nowMs = Date.now();
        const generated = factory(new Date(nowMs).toISOString());
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

        if (trackedTemplateRef.current !== templateId) {
            trackedTemplateRef.current = templateId;
            trackEvent('example_trip__open', {
                template: templateId,
                country_count: templateCountries.length,
            });
        }
    }, [templateCountries, templateId, navigate, onTripLoaded]);

    const handleCopyExampleTrip = async () => {
        if (!trip || !templateId) return;
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
            ...trip,
            id: generateTripId(),
            createdAt: now,
            updatedAt: now,
            isFavorite: false,
            isExample: false,
            status: 'active',
            tripExpiresAt: buildTripExpiryIso(now),
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
                    sourceTripId: trip.id,
                    sourceTitle: trip.title,
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

    if (!trip || !trip.isExample) return null;

    return (
        <TripView
            trip={trip}
            initialViewSettings={viewSettings ?? trip.defaultView}
            onUpdateTrip={(updatedTrip) => onTripLoaded(updatedTrip, viewSettings ?? updatedTrip.defaultView)}
            onViewSettingsChange={(settings) => {
                setViewSettings(settings);
                onViewSettingsChange(settings);
            }}
            onOpenManager={() => setIsManagerOpen(true)}
            onOpenSettings={() => setIsSettingsOpen(true)}
            appLanguage={appLanguage}
            canShare={false}
            onCopyTrip={handleCopyExampleTrip}
            isExamplePreview
            suppressToasts
            suppressReleaseNotice
            exampleTripBanner={{
                title: templateCard?.title || trip.title,
                countries: templateCountries,
                onCreateSimilarTrip: handleCreateSimilarTrip,
            }}
        />
    );
};

/** Thin wrapper that triggers DB sync when the create-trip page mounts. */
const CreateTripRoute: React.FC<{
    onTripGenerated: (t: ITrip) => void;
    onOpenManager: () => void;
    onLanguageLoaded?: (lang: AppLanguage) => void;
}> = ({ onTripGenerated, onOpenManager, onLanguageLoaded }) => {
    useDbSync(onLanguageLoaded);
    return <CreateTripForm onTripGenerated={onTripGenerated} onOpenManager={onOpenManager} />;
};

const CreateTripV1Route: React.FC<{
    onTripGenerated: (t: ITrip) => void;
    onOpenManager: () => void;
}> = ({ onTripGenerated, onOpenManager }) => {
    useDbSync();
    return <CreateTripV1Page onTripGenerated={onTripGenerated} onOpenManager={onOpenManager} />;
};

const CreateTripV2Route: React.FC<{
    onTripGenerated: (t: ITrip) => void;
    onOpenManager: () => void;
}> = ({ onTripGenerated, onOpenManager }) => {
    useDbSync();
    return <CreateTripV2Page onTripGenerated={onTripGenerated} onOpenManager={onOpenManager} />;
};

const CreateTripV3Route: React.FC<{
    onTripGenerated: (t: ITrip) => void;
    onOpenManager: () => void;
}> = ({ onTripGenerated, onOpenManager }) => {
    useDbSync();
    return <CreateTripV3Page onTripGenerated={onTripGenerated} onOpenManager={onOpenManager} />;
};

const AppContent: React.FC = () => {
    const [trip, setTrip] = useState<ITrip | null>(null);
    const [isManagerOpen, setIsManagerOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [appLanguage, setAppLanguage] = useState<AppLanguage>(() => getStoredAppLanguage());
    const navigate = useNavigate();
    const location = useLocation();
    const userSettingsSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // DB sync (session, upload, sync, user settings) is deferred to trip-related
    // routes via useDbSync to avoid unnecessary network calls on marketing pages.

    const isInitialLanguageRef = useRef(true);
    useEffect(() => {
        setStoredAppLanguage(appLanguage);
        // Skip DB write on initial mount — only persist when user changes the language.
        if (isInitialLanguageRef.current) {
            isInitialLanguageRef.current = false;
            return;
        }
        if (DB_ENABLED) {
            void dbUpsertUserSettings({ language: appLanguage });
        }
    }, [appLanguage]);

    useEffect(() => {
        const disposeAnalytics = initializeAnalytics();
        return () => {
            disposeAnalytics();
        };
    }, []);

    useEffect(() => {
        trackPageView(`${location.pathname}${location.search}`);
    }, [location.pathname, location.search]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const host = window as AppDebugWindow;
        host.toggleSimulatedLogin = (force?: boolean) => {
            const next = toggleSimulatedLogin(force);
            console.info(
                `[TravelFlow] toggleSimulatedLogin(${typeof force === 'boolean' ? force : 'toggle'}) -> ${next ? 'SIMULATED LOGGED-IN' : 'ANONYMOUS'}`
            );
            return next;
        };
        host.getSimulatedLoginState = () => (isSimulatedLoggedIn() ? 'simulated_logged_in' : 'anonymous');

        return () => {
            delete host.toggleSimulatedLogin;
            delete host.getSimulatedLoginState;
        };
    }, []);

    const handleViewSettingsChange = (settings: IViewSettings) => {
        if (!DB_ENABLED) return;
        if (userSettingsSaveRef.current) {
            clearTimeout(userSettingsSaveRef.current);
        }
        userSettingsSaveRef.current = setTimeout(() => {
            void dbUpsertUserSettings({
                mapStyle: settings.mapStyle,
                routeMode: settings.routeMode,
                layoutMode: settings.layoutMode,
                timelineView: settings.timelineView,
                showCityNames: settings.showCityNames,
                zoomLevel: settings.zoomLevel,
                sidebarWidth: settings.sidebarWidth,
                timelineHeight: settings.timelineHeight,
            });
        }, 800);
    };

    // Persist trip changes
    const handleUpdateTrip = (updatedTrip: ITrip, options?: { persist?: boolean }) => {
        setTrip(updatedTrip);
        if (options?.persist === false) return;
        saveTrip(updatedTrip);
    };

    const handleCommitState = (updatedTrip: ITrip, view: IViewSettings | undefined, options?: { replace?: boolean; label?: string }) => {
        const label = options?.label || 'Updated trip';
        const commitTs = Date.now();

        if (!DB_ENABLED) {
            createLocalHistoryEntry(navigate, updatedTrip, view, label, options, commitTs);
            return;
        }

        createLocalHistoryEntry(navigate, updatedTrip, view, label, options, commitTs);

        const commit = async () => {
            const sessionId = await ensureDbSession();
            if (!sessionId) return;
            const upserted = await dbUpsertTrip(updatedTrip, view);
            const versionId = await dbCreateTripVersion(updatedTrip, view, label);
            if (!upserted || !versionId) return;
        };

        void commit();
    };

    const handleTripGenerated = (newTrip: ITrip) => {
        const create = async () => {
            if (DB_ENABLED) {
                const limit = await dbCanCreateTrip();
                if (!limit.allowCreate) {
                    window.alert(`Trip limit reached (${limit.activeTripCount}/${limit.maxTripCount}). Archive a trip or upgrade to continue.`);
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
                tripExpiresAt: newTrip.tripExpiresAt || buildTripExpiryIso(now),
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

            setTrip(preparedTrip);
            saveTrip(preparedTrip);
            const createdTs = Date.now();
            if (!DB_ENABLED) {
                createLocalHistoryEntry(navigate, preparedTrip, undefined, 'Data: Created trip', undefined, createdTs);
                return;
            }

            createLocalHistoryEntry(navigate, preparedTrip, undefined, 'Data: Created trip', undefined, createdTs);
            const sessionId = await ensureDbSession();
            if (!sessionId) return;
            const upserted = await dbUpsertTrip(preparedTrip, undefined);
            const versionId = await dbCreateTripVersion(preparedTrip, undefined, 'Data: Created trip');
            if (!upserted || !versionId) return;
        };

        void create();
    };

    const handleLoadTrip = (loadedTrip: ITrip) => {
        setTrip(loadedTrip);
        setIsManagerOpen(false);
        navigate(buildTripUrl(loadedTrip.id));
    };

    return (
        <TripManagerProvider openTripManager={() => setIsManagerOpen(true)}>
            <ScrollToTop />
            <ViewTransitionHandler />
            <Routes>
                <Route 
                    path="/" 
                    element={<MarketingHomePage />}
                />
                <Route
                    path="/create-trip"
                    element={
                        <CreateTripRoute
                            onTripGenerated={handleTripGenerated}
                            onOpenManager={() => setIsManagerOpen(true)}
                            onLanguageLoaded={setAppLanguage}
                        />
                    }
                />
                <Route
                    path="/create-trip/v1"
                    element={
                        <CreateTripV1Route
                            onTripGenerated={handleTripGenerated}
                            onOpenManager={() => setIsManagerOpen(true)}
                        />
                    }
                />
                <Route
                    path="/create-trip/v2"
                    element={
                        <CreateTripV2Route
                            onTripGenerated={handleTripGenerated}
                            onOpenManager={() => setIsManagerOpen(true)}
                        />
                    }
                />
                <Route
                    path="/create-trip/v3"
                    element={
                        <CreateTripV3Route
                            onTripGenerated={handleTripGenerated}
                            onOpenManager={() => setIsManagerOpen(true)}
                        />
                    }
                />
                <Route
                    path="/create-trip/labs/classic-card"
                    element={
                        <CreateTripClassicLabPage
                            onOpenManager={() => setIsManagerOpen(true)}
                            onLanguageLoaded={setAppLanguage}
                        />
                    }
                />
                <Route
                    path="/create-trip/labs/split-workspace"
                    element={
                        <CreateTripSplitWorkspaceLabPage
                            onOpenManager={() => setIsManagerOpen(true)}
                            onLanguageLoaded={setAppLanguage}
                        />
                    }
                />
                <Route
                    path="/create-trip/labs/journey-architect"
                    element={
                        <CreateTripJourneyArchitectLabPage
                            onOpenManager={() => setIsManagerOpen(true)}
                            onLanguageLoaded={setAppLanguage}
                        />
                    }
                />
                <Route path="/features" element={<FeaturesPage />} />
                <Route path="/inspirations" element={<InspirationsPage />} />
                <Route path="/inspirations/themes" element={<ThemesPage />} />
                <Route path="/inspirations/best-time-to-travel" element={<BestTimeToTravelPage />} />
                <Route path="/inspirations/countries" element={<CountriesPage />} />
                <Route path="/inspirations/events-and-festivals" element={<FestivalsPage />} />
                <Route path="/inspirations/weekend-getaways" element={<WeekendGetawaysPage />} />
                <Route path="/inspirations/country/:countryName" element={<CountryDetailPage />} />
                <Route path="/updates" element={<UpdatesPage />} />
                <Route path="/blog" element={<BlogPage />} />
                <Route path="/blog/:slug" element={<BlogPostPage />} />
                <Route path="/pricing" element={<PricingPage />} />
                <Route path="/faq" element={<FaqPage />} />
                <Route path="/share-unavailable" element={<ShareUnavailablePage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/imprint" element={<ImprintPage />} />
                <Route path="/privacy" element={<PrivacyPage />} />
                <Route path="/terms" element={<TermsPage />} />
                <Route path="/cookies" element={<CookiesPage />} />
                <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
                <Route 
                    path="/trip/:tripId" 
                    element={
                        <TripLoader
                            trip={trip}
                            onTripLoaded={setTrip}
                            handleUpdateTrip={handleUpdateTrip}
                            handleCommitState={handleCommitState}
                            setIsManagerOpen={setIsManagerOpen}
                            setIsSettingsOpen={setIsSettingsOpen}
                            appLanguage={appLanguage}
                            onViewSettingsChange={handleViewSettingsChange}
                            onLanguageLoaded={setAppLanguage}
                        />
                    } 
                />
                <Route
                    path="/example/:templateId"
                    element={
                        <ExampleTripLoader
                            trip={trip}
                            onTripLoaded={setTrip}
                            setIsManagerOpen={setIsManagerOpen}
                            setIsSettingsOpen={setIsSettingsOpen}
                            appLanguage={appLanguage}
                            onViewSettingsChange={handleViewSettingsChange}
                        />
                    }
                />
                <Route
                    path="/s/:token"
                    element={
                        <SharedTripLoader
                            trip={trip}
                            onTripLoaded={setTrip}
                            setIsManagerOpen={setIsManagerOpen}
                            setIsSettingsOpen={setIsSettingsOpen}
                            appLanguage={appLanguage}
                            onViewSettingsChange={handleViewSettingsChange}
                            onLanguageLoaded={setAppLanguage}
                        />
                    }
                />
                 {/* Legacy Redirect */}
                 <Route path="/trip" element={<Navigate to="/create-trip" replace />} />
                 <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>

            {/* Global Modals */}
            <TripManager 
                isOpen={isManagerOpen} 
                onClose={() => setIsManagerOpen(false)} 
                onSelectTrip={handleLoadTrip}
                currentTripId={trip?.id}
                onUpdateTrip={(updatedTrip) => {
                    if (!trip || trip.id !== updatedTrip.id) return;
                    handleUpdateTrip(updatedTrip, { persist: false });
                }}
                appLanguage={appLanguage}
            />
            
            <SettingsModal 
                isOpen={isSettingsOpen} 
                onClose={() => setIsSettingsOpen(false)} 
                appLanguage={appLanguage}
                onAppLanguageChange={setAppLanguage}
            />

            <CookieConsentBanner />
            <GlobalTooltipLayer />
            <OnPageDebugger />
        </TripManagerProvider>
    );
};

const App: React.FC = () => {
    return (
        <Router>
            <AppDialogProvider>
                <AppContent />
            </AppDialogProvider>
        </Router>
    );
};

export default App;
