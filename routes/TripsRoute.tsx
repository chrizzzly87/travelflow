import React, { useCallback, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CloudArrowUp, WifiSlash } from '@phosphor-icons/react';

import { SiteHeader } from '../components/navigation/SiteHeader';
import { TripManager } from '../components/TripManager';
import { useConnectivityStatus } from '../hooks/useConnectivityStatus';
import { useSyncStatus } from '../hooks/useSyncStatus';
import { useDbSync } from '../hooks/useDbSync';
import { getAnalyticsDebugAttributes, trackEvent } from '../services/analyticsService';
import { buildTripUrl } from '../utils';
import type { AppLanguage, ITrip } from '../types';

export interface TripsRouteProps {
    appLanguage: AppLanguage;
    onAppLanguageLoaded: (lang: AppLanguage) => void;
    onTripLoaded: (trip: ITrip) => void;
    currentTripId?: string;
}

/**
 * The saved-trips list as a route.
 *
 * This is the installed app's `start_url` (`/trips?source=pwa`), so it is the
 * first thing a home-screen launch renders — including offline, where the
 * service worker serves the cached shell and `TripManager` reads trips straight
 * out of local storage. It renders the same component as the header's slide-in
 * panel, in its `page` variant.
 */
export const TripsRoute: React.FC<TripsRouteProps> = ({
    appLanguage,
    onAppLanguageLoaded,
    onTripLoaded,
    currentTripId,
}) => {
    const { t } = useTranslation('common');
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { snapshot: connectivity } = useConnectivityStatus();
    const { snapshot: syncSnapshot } = useSyncStatus();

    useDbSync(onAppLanguageLoaded);

    const launchSource = searchParams.get('source');

    useEffect(() => {
        trackEvent('trips__start_page--view', {
            source: launchSource || 'direct',
        });
    }, [launchSource]);

    const handleSelectTrip = useCallback((trip: ITrip) => {
        onTripLoaded(trip);
        navigate(buildTripUrl(trip.id));
    }, [navigate, onTripLoaded]);

    const isOffline = connectivity.state === 'offline';
    const pendingCount = syncSnapshot.pendingCount;

    const statusNote = useMemo(() => {
        if (isOffline) {
            return {
                key: 'offline',
                icon: <WifiSlash size={16} weight="bold" />,
                text: t('trips.status.offline'),
                className: 'border-amber-200 bg-amber-50 text-amber-800',
            };
        }
        if (pendingCount > 0) {
            return {
                key: 'pending',
                icon: <CloudArrowUp size={16} weight="bold" />,
                // i18next-icu is installed but never registered in i18n.ts, so
                // ICU plural blocks would render as raw text. The codebase picks
                // the singular/plural key explicitly instead.
                text: t(
                    pendingCount === 1 ? 'trips.status.pendingSyncOne' : 'trips.status.pendingSyncMany',
                    { count: pendingCount }
                ),
                className: 'border-sky-200 bg-sky-50 text-sky-800',
            };
        }
        return null;
    }, [isOffline, pendingCount, t]);

    return (
        <div className="min-h-screen bg-slate-50" data-tf-handoff-ready="true">
            <SiteHeader variant="solid" />

            <main className="mx-auto w-full max-w-xl px-4 pb-16 pt-6">
                <header className="mb-4">
                    <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
                        {t('trips.pageTitle')}
                    </h1>
                    <p className="mt-1 text-sm text-slate-500">
                        {t('trips.pageSubtitle')}
                    </p>
                </header>

                {statusNote && (
                    <div
                        key={statusNote.key}
                        role="status"
                        className={`mb-4 flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium ${statusNote.className}`}
                        {...getAnalyticsDebugAttributes('trips__status_note', {
                            status: statusNote.key,
                        })}
                    >
                        {statusNote.icon}
                        <span>{statusNote.text}</span>
                    </div>
                )}

                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <TripManager
                        variant="page"
                        isOpen
                        onClose={() => undefined}
                        onSelectTrip={handleSelectTrip}
                        currentTripId={currentTripId}
                        appLanguage={appLanguage}
                    />
                </div>
            </main>
        </div>
    );
};
