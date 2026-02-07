import React, { useState, useEffect, useRef, useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, Navigate, useLocation, useParams } from 'react-router-dom';
import { CreateTripForm } from './components/CreateTripForm';
import { TripView } from './components/TripView';
import { AppLanguage, ITrip, IViewSettings } from './types';
import { TripManager } from './components/TripManager';
import { SettingsModal } from './components/SettingsModal';
import { saveTrip, getTripById } from './services/storageService';
import { appendHistoryEntry, findHistoryEntryByUrl } from './services/historyService';
import { buildShareUrl, buildTripUrl, decompressTrip, generateTripId, generateVersionId, getStoredAppLanguage, isUuid, setStoredAppLanguage } from './utils';
import { DB_ENABLED, applyUserSettingsToLocalStorage, dbCreateTripVersion, dbGetSharedTrip, dbGetTrip, dbGetTripVersion, dbUpdateSharedTrip, dbUpsertTrip, dbGetUserSettings, dbUpsertUserSettings, ensureDbSession, syncTripsFromDb, uploadLocalTripsToDb } from './services/dbService';
import { AppDialogProvider } from './components/AppDialogProvider';

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
}: {
    trip: ITrip | null,
    onTripLoaded: (t: ITrip, view?: IViewSettings) => void,
    handleUpdateTrip: (t: ITrip, options?: { persist?: boolean }) => void,
    handleCommitState: (t: ITrip, view: IViewSettings | undefined, options?: { replace?: boolean; label?: string }) => void,
    setIsManagerOpen: (o: boolean) => void,
    setIsSettingsOpen: (o: boolean) => void,
    appLanguage: AppLanguage,
    onViewSettingsChange: (settings: IViewSettings) => void,
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
                setViewSettings(view);
                onTripLoaded(mergedTrip, view);
                return;
            }

            // 2. Supabase-backed load
            if (DB_ENABLED) {
                await ensureDbSession();
                if (versionId && isUuid(versionId)) {
                    const version = await dbGetTripVersion(tripId, versionId);
                    if (version?.trip) {
                        saveTrip(version.trip);
                        setViewSettings(version.view ?? undefined);
                        onTripLoaded(version.trip, version.view ?? undefined);
                        return;
                    }
                }
                if (versionId) {
                    const localEntry = findHistoryEntryByUrl(tripId, buildTripUrl(tripId, versionId));
                    if (localEntry?.snapshot?.trip) {
                        saveTrip(localEntry.snapshot.trip);
                        setViewSettings(localEntry.snapshot.view ?? undefined);
                        onTripLoaded(localEntry.snapshot.trip, localEntry.snapshot.view ?? undefined);
                        return;
                    }
                }
                const dbTrip = await dbGetTrip(tripId);
                if (dbTrip?.trip) {
                    saveTrip(dbTrip.trip);
                    setViewSettings(dbTrip.view ?? undefined);
                    onTripLoaded(dbTrip.trip, dbTrip.view ?? undefined);
                    return;
                }
            }

            // 3. Local fallback
            if (versionId) {
                const localEntry = findHistoryEntryByUrl(tripId, buildTripUrl(tripId, versionId));
                if (localEntry?.snapshot?.trip) {
                    saveTrip(localEntry.snapshot.trip);
                    setViewSettings(localEntry.snapshot.view ?? undefined);
                    onTripLoaded(localEntry.snapshot.trip, localEntry.snapshot.view ?? undefined);
                    return;
                }
            }
            const localTrip = getTripById(tripId);
            if (localTrip) {
                onTripLoaded(localTrip);
                return;
            }

            console.error('Failed to load trip from URL');
            navigate('/', { replace: true });
        };

        void load();
    }, [tripId, versionId, navigate, onTripLoaded]);

    if (!trip) return null;

    return (
        <TripView
            trip={trip}
            initialViewSettings={viewSettings}
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
}: {
    trip: ITrip | null,
    onTripLoaded: (t: ITrip, view?: IViewSettings) => void,
    setIsManagerOpen: (o: boolean) => void,
    setIsSettingsOpen: (o: boolean) => void,
    appLanguage: AppLanguage,
    onViewSettingsChange: (settings: IViewSettings) => void,
}) => {
    const { token } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const lastLoadRef = useRef<string | null>(null);
    const [shareMode, setShareMode] = useState<'view' | 'edit'>('view');
    const [allowCopy, setAllowCopy] = useState(true);
    const [viewSettings, setViewSettings] = useState<IViewSettings | undefined>(undefined);

    const versionId = useMemo(() => {
        const params = new URLSearchParams(location.search);
        return params.get('v');
    }, [location.search]);

    useEffect(() => {
        if (!token) return;
        const loadKey = `${token}:${versionId || ''}`;
        if (lastLoadRef.current === loadKey) return;
        lastLoadRef.current = loadKey;

        const load = async () => {
            if (!DB_ENABLED) {
                navigate('/', { replace: true });
                return;
            }

            setViewSettings(undefined);
            await ensureDbSession();
            const shared = await dbGetSharedTrip(token);
            if (!shared) {
                navigate('/', { replace: true });
                return;
            }

            setShareMode(shared.mode);
            setAllowCopy(shared.allowCopy ?? true);

            if (versionId && isUuid(versionId)) {
                const version = await dbGetTripVersion(shared.trip.id, versionId);
                if (version?.trip) {
                    setViewSettings(version.view ?? undefined);
                    onTripLoaded(version.trip, version.view ?? undefined);
                    return;
                }
                const localEntry = findHistoryEntryByUrl(shared.trip.id, `${buildShareUrl(token)}?v=${versionId}`);
                if (localEntry?.snapshot?.trip) {
                    setViewSettings(localEntry.snapshot.view ?? undefined);
                    onTripLoaded(localEntry.snapshot.trip, localEntry.snapshot.view ?? undefined);
                    return;
                }
            }

            setViewSettings(shared.view ?? undefined);
            onTripLoaded(shared.trip, shared.view ?? undefined);
        };

        void load();
    }, [token, versionId, navigate, onTripLoaded]);

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
        const cloned: ITrip = {
            ...trip,
            id: generateTripId(),
            createdAt: Date.now(),
            updatedAt: Date.now(),
            isFavorite: false,
            forkedFromTripId: trip.id,
            forkedFromShareToken: token || undefined,
        };
        if (typeof window !== 'undefined') {
            try {
                window.sessionStorage.setItem('tf_trip_copy_notice', JSON.stringify({
                    tripId: cloned.id,
                    sourceTripId: trip.id,
                    sourceTitle: trip.title,
                    sourceShareToken: token || null,
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
            initialViewSettings={viewSettings}
            onUpdateTrip={(updatedTrip) => onTripLoaded(updatedTrip, viewSettings)}
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
            onCopyTrip={allowCopy ? handleCopyTrip : undefined}
        />
    );
};

const AppContent: React.FC = () => {
    const [trip, setTrip] = useState<ITrip | null>(null);
    const [isManagerOpen, setIsManagerOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [appLanguage, setAppLanguage] = useState<AppLanguage>(() => getStoredAppLanguage());
    const navigate = useNavigate();
    const userSettingsSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (!DB_ENABLED) return;
        let cancelled = false;
        const init = async () => {
            await ensureDbSession();
            await uploadLocalTripsToDb();
            await syncTripsFromDb();
            const settings = await dbGetUserSettings();
            if (!cancelled && settings) {
                applyUserSettingsToLocalStorage(settings);
                if (settings.language) {
                    setAppLanguage(settings.language);
                }
            }
        };
        void init();
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        setStoredAppLanguage(appLanguage);
        if (DB_ENABLED) {
            void dbUpsertUserSettings({ language: appLanguage });
        }
    }, [appLanguage]);

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
        setTrip(newTrip);
        saveTrip(newTrip);
        const createdTs = Date.now();
        if (!DB_ENABLED) {
            createLocalHistoryEntry(navigate, newTrip, undefined, 'Data: Created trip', undefined, createdTs);
            return;
        }

        createLocalHistoryEntry(navigate, newTrip, undefined, 'Data: Created trip', undefined, createdTs);

        const create = async () => {
            const sessionId = await ensureDbSession();
            if (!sessionId) return;
            const upserted = await dbUpsertTrip(newTrip, undefined);
            const versionId = await dbCreateTripVersion(newTrip, undefined, 'Data: Created trip');
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
        <>
            <Routes>
                <Route 
                    path="/" 
                    element={
                        <CreateTripForm 
                            onTripGenerated={handleTripGenerated} 
                            onOpenManager={() => setIsManagerOpen(true)}
                        />
                    } 
                />
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
                        />
                    }
                />
                 {/* Legacy Redirect */}
                 <Route path="/trip" element={<Navigate to="/" replace />} />
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
                mapLanguage={appLanguage}
            />
            
            <SettingsModal 
                isOpen={isSettingsOpen} 
                onClose={() => setIsSettingsOpen(false)} 
                appLanguage={appLanguage}
                onAppLanguageChange={setAppLanguage}
            />
        </>
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
