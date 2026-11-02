import React, { lazy, Suspense, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from '../navigation';
import { TripManagerProvider, type ActiveTripSession } from '../../contexts/TripManagerContext';
import { shouldOpenTripsAsRoute } from '../../services/installPromptService';
import { buildTripUrl } from '../../services/appRuntimeUtils';
import { normalizeLocale } from '../../config/locales';
import type { ITrip } from '../../types';
let libraryModule: Promise<typeof import('../../components/TripManager')> | undefined;
const loadLibrary = () => libraryModule ??= import('../../components/TripManager');
const TripManager = lazy(() => loadLibrary().then(module => ({ default: module.TripManager })));
export function TripLibraryProvider({ children }: { children: React.ReactNode }) {
    const [open, setOpen] = useState(false);
    const [activeSession, setActiveSession] = useState<ActiveTripSession | null>(null);
    const registerTripSession = useCallback((session: ActiveTripSession) => {
        setActiveSession(session);
        return () => setActiveSession(current => current === session ? null : current);
    }, []);
    const navigate = useNavigate();
    const { i18n } = useTranslation('common');
    const prewarm = useCallback(() => { void loadLibrary(); }, []);
    const show = useCallback(() => {
        if (shouldOpenTripsAsRoute()) navigate('/trips');
        else { prewarm(); setOpen(true); }
    }, [navigate, prewarm]);
    const select = useCallback((trip: ITrip) => { setOpen(false); navigate(buildTripUrl(trip.id)); }, [navigate]);
    return <TripManagerProvider openTripManager={show} prewarmTripManager={prewarm} registerTripSession={registerTripSession}>
        {children}
        {open && <Suspense fallback={null}><TripManager currentTripId={activeSession?.tripId} onUpdateTrip={activeSession?.onUpdateTrip} isOpen onClose={() => setOpen(false)} onSelectTrip={select} appLanguage={normalizeLocale(i18n.resolvedLanguage ?? i18n.language)} /></Suspense>}
    </TripManagerProvider>;
}
