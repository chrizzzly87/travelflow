import React, { createContext, lazy, Suspense, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Outlet, useMatches, useParams, useRouter } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useTripManager } from '../../contexts/TripManagerContext';
import { useNavigate, useLocation } from '../../app/navigation';
import { saveTrip } from '../../services/storageService';
import { normalizeLocale } from '../../config/locales';
import type { ITrip } from '../../types';
import type { TripRouteData } from './routeData';
import { useConnectivityStatus } from '../../hooks/useConnectivityStatus';
import { setCanonicalDocumentTitle } from '../../services/tripGenerationTabFeedbackService';
import { APP_NAME } from '../../config/appGlobals';
import type { TripLoaderRouteProps } from '../../routes/tripRouteTypes';
import { useTripPersistence } from './useTripPersistence';
import { useViewPreferences } from './useViewPreferences';
import { createLocalHistoryEntry, normalizeTripForRuntimeLoad } from './tripSessionModel';
const SettingsModal = lazy(() => import('../../components/SettingsModal').then(module => ({ default: module.SettingsModal })));
const TripSessionContext = createContext<TripLoaderRouteProps | null>(null);
export function useTripSession() {
    const context = useContext(TripSessionContext);
    if (!context) throw new Error('A trip session is only available inside the trip workspace');
    return context;
}
function TripSession({ data }: { data?: TripRouteData }) {
    const [state, setState] = useState<{ data?: TripRouteData; trip: ITrip | null }>(() => ({ data, trip: data?.trip ?? null }));
    // A native loader result is the external source of the session snapshot.
    // Reconcile before committing children, preserving local edits between loads.
    if (data && state.data !== data) setState({ data, trip: normalizeTripForRuntimeLoad(data.trip) });
    const trip = state.trip;
    const location = useLocation();
    const hasVersion = new URLSearchParams(location.search).has('v');
    useEffect(() => {
        if (data?.access?.source === 'owner' && !hasVersion) saveTrip(data.trip, { preserveUpdatedAt: true });
    }, [data, hasVersion]);
    const setTrip = useCallback((next: ITrip | null | ((previous: ITrip | null) => ITrip | null)) => {
        setState(current => ({ ...current, trip: typeof next === 'function' ? next(current.trip) : next }));
    }, []);
    const router = useRouter();
    const { snapshot } = useConnectivityStatus();
    const previousConnectivity = React.useRef(snapshot.state);
    useEffect(() => {
        if (previousConnectivity.current === snapshot.state) return;
        previousConnectivity.current = snapshot.state;
        void router.invalidate();
    }, [router, snapshot.state]);
    useEffect(() => {
        if (trip?.title) setCanonicalDocumentTitle(`${trip.title} · ${APP_NAME}`);
    }, [trip?.title]);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const navigate = useNavigate();
    const { i18n } = useTranslation(['common', 'profile']);
    const { openTripManager, registerTripSession } = useTripManager();
    const appLanguage = normalizeLocale(i18n.resolvedLanguage ?? i18n.language);
    const onViewSettingsChange = useViewPreferences();
    const { handleCommitState } = useTripPersistence(trip?.id);
    const onTripLoaded = useCallback((loaded: ITrip) => setTrip(normalizeTripForRuntimeLoad(loaded)), []);
    const onUpdateTrip = useCallback((updated: ITrip, options?: { persist?: boolean; preserveUpdatedAt?: boolean }) => {
        setTrip(updated);
        if (options?.persist !== false) saveTrip(updated, { preserveUpdatedAt: options?.preserveUpdatedAt === true });
    }, []);
    const onManagerUpdate = useCallback((updated: ITrip) => {
        setTrip(current => current?.id === updated.id ? updated : current);
    }, []);
    const tripId = trip?.id;
    useEffect(() => {
        if (!tripId || !registerTripSession) return;
        return registerTripSession({ tripId, onUpdateTrip: onManagerUpdate });
    }, [tripId, registerTripSession, onManagerUpdate]);
    const onAdoptAgentTripVersion = useCallback((input: { trip: ITrip; versionId: string; label: string; changeSetId?: string }) => {
        setTrip(input.trip);
        saveTrip(input.trip, { preserveUpdatedAt: true });
        createLocalHistoryEntry(navigate, input.trip, input.trip.defaultView, input.label, undefined, Date.now(), undefined, input.versionId, input.changeSetId);
    }, [navigate]);
    const onLanguageLoaded = useCallback((language: typeof appLanguage) => { void i18n.changeLanguage(language); }, [i18n]);
    const onOpenSettings = useCallback(() => setSettingsOpen(true), []);
    const props = useMemo(() => ({ trip, appLanguage, onTripLoaded, onUpdateTrip, onCommitState: handleCommitState, onAdoptAgentTripVersion, onViewSettingsChange, onLanguageLoaded, onOpenManager: openTripManager, onOpenSettings }), [trip, appLanguage, onTripLoaded, onUpdateTrip, handleCommitState, onAdoptAgentTripVersion, onViewSettingsChange, onLanguageLoaded, openTripManager, onOpenSettings]);
    return <TripSessionContext.Provider value={props}>
        <Outlet />
        {settingsOpen && <Suspense fallback={null}><SettingsModal isOpen onClose={() => setSettingsOpen(false)} appLanguage={appLanguage} onAppLanguageChange={onLanguageLoaded} /></Suspense>}
    </TripSessionContext.Provider>;
}
/** Reset trip-owned state on identity changes; public/admin routes never import this runtime. */
export default function TripWorkspaceLayout() {
    const params = useParams({ strict: false }) as Record<string, string>;
    const key = params.tripId ? `owned:${params.tripId}`
        : params.templateId ? `example:${params.templateId}`
            : params.token ? `shared:${params.token}`
                : 'trip';
    const data = useMatches({ select: matches => matches.at(-1)?.loaderData }) as TripRouteData | undefined;
    return <TripSession key={key} data={data} />;
}
