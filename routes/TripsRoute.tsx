import React, { useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SignIn } from '@phosphor-icons/react';

import { SiteHeader } from '../components/navigation/SiteHeader';
import { ConnectivityStatusBanner } from '../components/ConnectivityStatusBanner';
import { TripManager } from '../components/TripManager';
import { useAuth } from '../hooks/useAuth';
import { useLoginModal } from '../hooks/useLoginModal';
import { useConnectivityStatus } from '../hooks/useConnectivityStatus';
import { useSyncStatus } from '../hooks/useSyncStatus';
import { useDbSync } from '../hooks/useDbSync';
import { getAnalyticsDebugAttributes, trackEvent } from '../services/analyticsService';
import { buildTripUrl } from '../utils';
import type { AppLanguage, ITrip } from '../types';

const IS_DEV = import.meta.env.DEV;

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
 * out of local storage.
 *
 * Because it is the first screen, it has to explain itself. An empty list looks
 * identical whether the visitor is signed out, offline, or genuinely has no
 * trips, and on iOS the installed app has its own storage separate from Safari
 * — so someone signed in in Safari arrives here signed out, with none of their
 * account trips. Both states get an explicit notice rather than a blank list.
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
    const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
    const { openLoginModal } = useLoginModal();
    const { snapshot: connectivity } = useConnectivityStatus();
    const { snapshot: syncSnapshot, retrySyncNow } = useSyncStatus();

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

    const handleSignIn = useCallback(() => {
        trackEvent('trips__signed_out_notice--sign_in', {
            source: launchSource || 'direct',
        });
        openLoginModal({ nextPath: '/trips', source: 'trips_start_page' });
    }, [launchSource, openLoginModal]);

    // Wait for the auth check before claiming anything. Flashing "you're signed
    // out" at someone who is in fact signed in would be worse than a brief gap.
    const showSignedOutNotice = !isAuthLoading && !isAuthenticated;

    return (
        <div className="min-h-screen bg-slate-50" data-tf-handoff-ready="true">
            <SiteHeader variant="solid" />

            {/* The same offline/sync banner the planner shows, so the reason the
                list looks thin is stated on the screen that shows it. */}
            <ConnectivityStatusBanner
                isPlannerRoute
                connectivity={connectivity}
                sync={syncSnapshot}
                onRetrySync={() => retrySyncNow()}
                showDeveloperDetails={IS_DEV}
            />

            <main className="mx-auto w-full max-w-xl px-4 pb-16 pt-6">
                <header className="mb-4">
                    <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
                        {t('trips.pageTitle')}
                    </h1>
                    <p className="mt-1 text-sm text-slate-500">
                        {t('trips.pageSubtitle')}
                    </p>
                </header>

                {showSignedOutNotice && (
                    <div
                        role="status"
                        className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3"
                        data-testid="trips-signed-out-notice"
                        {...getAnalyticsDebugAttributes('trips__signed_out_notice', {
                            source: launchSource || 'direct',
                        })}
                    >
                        <p className="text-sm font-semibold text-amber-900">
                            {t('trips.signedOut.title')}
                        </p>
                        <p className="mt-1 text-sm text-amber-800">
                            {t('trips.signedOut.body')}
                        </p>
                        <button
                            type="button"
                            onClick={handleSignIn}
                            data-testid="trips-sign-in-button"
                            className="mt-3 inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-semibold text-amber-900 transition-colors hover:bg-amber-100"
                        >
                            <SignIn size={16} weight="bold" />
                            {t('trips.signedOut.action')}
                        </button>
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
