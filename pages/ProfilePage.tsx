import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, NavLink, useNavigate, useSearchParams } from 'react-router-dom';
import { IdentificationCard, GearSix, ShieldCheck } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { SiteHeader } from '../components/navigation/SiteHeader';
import { ProfileHero } from '../components/profile/ProfileHero';
import { ProfileTripTabs } from '../components/profile/ProfileTripTabs';
import { ProfileTripCard } from '../components/profile/ProfileTripCard';
import {
    getPinnedTrips,
    getRecentTrips,
    getTripSourceLabelKey,
    getTripsForProfileTab,
    normalizeProfileRecentSort,
    normalizeProfileTripTab,
    toggleTripFavorite,
    toggleTripPinned,
} from '../components/profile/profileTripState';
import { useAuth } from '../hooks/useAuth';
import { getCurrentUserProfile, type UserProfileRecord } from '../services/profileService';
import { getAllTrips, saveTrip } from '../services/storageService';
import { DB_ENABLED, dbUpsertTrip } from '../services/dbService';
import { getAnalyticsDebugAttributes, trackEvent } from '../services/analyticsService';
import { pickRandomInternationalGreeting } from '../data/internationalGreetings';
import { normalizeLocale } from '../config/locales';
import { buildPath } from '../config/routes';
import type { ITrip } from '../types';

const initialsFrom = (profile: UserProfileRecord | null, fallbackEmail: string | null): string => {
    const first = profile?.firstName?.trim() || '';
    const last = profile?.lastName?.trim() || '';
    if (first || last) {
        return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase() || 'U';
    }
    return (fallbackEmail || 'user').charAt(0).toUpperCase();
};

export const ProfilePage: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { t, i18n } = useTranslation('profile');
    const { isLoading, isAuthenticated, access, isAdmin } = useAuth();

    const [profile, setProfile] = useState<UserProfileRecord | null>(null);
    const [loadingProfile, setLoadingProfile] = useState(true);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [trips, setTrips] = useState<ITrip[]>(() => getAllTrips());
    const [pinNotice, setPinNotice] = useState<string | null>(null);

    const greeting = useMemo(() => pickRandomInternationalGreeting(), []);
    const appLocale = useMemo(
        () => normalizeLocale(i18n.resolvedLanguage ?? i18n.language ?? 'en'),
        [i18n.language, i18n.resolvedLanguage]
    );

    const tab = normalizeProfileTripTab(searchParams.get('tab'));
    const recentSort = normalizeProfileRecentSort(searchParams.get('recentSort'));

    const displayName = profile?.displayName
        || [profile?.firstName || '', profile?.lastName || ''].filter(Boolean).join(' ')
        || access?.email
        || t('fallback.displayName');

    const refreshTrips = useCallback(() => {
        setTrips(getAllTrips());
    }, []);

    useEffect(() => {
        if (!isAuthenticated) return;
        let active = true;
        setLoadingProfile(true);
        setErrorMessage(null);

        void getCurrentUserProfile()
            .then((nextProfile) => {
                if (!active) return;
                setProfile(nextProfile);
            })
            .catch((error) => {
                if (!active) return;
                setErrorMessage(error instanceof Error ? error.message : t('errors.profileLoad'));
            })
            .finally(() => {
                if (!active) return;
                setLoadingProfile(false);
            });

        return () => {
            active = false;
        };
    }, [isAuthenticated, t]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const refreshFromStorage = () => refreshTrips();
        window.addEventListener('storage', refreshFromStorage);
        window.addEventListener('tf:trips-updated', refreshFromStorage);
        return () => {
            window.removeEventListener('storage', refreshFromStorage);
            window.removeEventListener('tf:trips-updated', refreshFromStorage);
        };
    }, [refreshTrips]);

    useEffect(() => {
        const next = new URLSearchParams(searchParams);
        let changed = false;

        if (next.get('tab') !== tab) {
            next.set('tab', tab);
            changed = true;
        }

        if (next.get('recentSort') !== recentSort) {
            next.set('recentSort', recentSort);
            changed = true;
        }

        if (changed) {
            setSearchParams(next, { replace: true });
        }
    }, [searchParams, setSearchParams, tab, recentSort]);

    const persistTrip = useCallback((trip: ITrip) => {
        saveTrip(trip, { preserveUpdatedAt: true });
        if (DB_ENABLED) {
            void dbUpsertTrip(trip);
        }
    }, []);

    const pinnedTrips = useMemo(() => getPinnedTrips(trips), [trips]);
    const tripsForTab = useMemo(
        () => getTripsForProfileTab(trips, tab, recentSort),
        [trips, tab, recentSort]
    );

    const tabCounts = useMemo(() => ({
        recent: getRecentTrips(trips, recentSort).length,
        favorites: trips.filter((trip) => Boolean(trip.isFavorite)).length,
        all: trips.length,
        liked: 0,
    }), [trips, recentSort]);

    const handleTabChange = useCallback((nextTab: 'recent' | 'favorites' | 'all' | 'liked') => {
        const next = new URLSearchParams(searchParams);
        next.set('tab', nextTab);
        next.set('recentSort', recentSort);
        setSearchParams(next);
        trackEvent(`profile__tab--${nextTab}`);
    }, [recentSort, searchParams, setSearchParams]);

    const handleRecentSortChange = useCallback((nextSort: 'created' | 'updated') => {
        const next = new URLSearchParams(searchParams);
        next.set('tab', tab);
        next.set('recentSort', nextSort);
        setSearchParams(next);
        trackEvent(`profile__recent_sort--${nextSort}`);
    }, [searchParams, setSearchParams, tab]);

    const handleOpenTrip = useCallback((trip: ITrip) => {
        trackEvent('profile__trip--open', { trip_id: trip.id, tab });
        navigate(buildPath('tripDetail', { tripId: trip.id }));
    }, [navigate, tab]);

    const handleToggleFavorite = useCallback((trip: ITrip) => {
        const now = Date.now();
        const result = toggleTripFavorite(trips, trip.id, now);
        setTrips(result.trips);

        const updatedTrip = result.trips.find((candidate) => candidate.id === trip.id);
        if (updatedTrip) {
            persistTrip(updatedTrip);
        }

        trackEvent(result.nextFavoriteState ? 'profile__trip--favorite' : 'profile__trip--unfavorite', {
            trip_id: trip.id,
            tab,
        });
    }, [persistTrip, tab, trips]);

    const handleTogglePin = useCallback((trip: ITrip) => {
        const now = Date.now();
        const result = toggleTripPinned(trips, trip.id, now);
        setTrips(result.trips);

        const affectedIds = new Set([trip.id, ...result.evictedTripIds]);
        result.trips.forEach((candidate) => {
            if (!affectedIds.has(candidate.id)) return;
            persistTrip(candidate);
        });

        if (result.evictedTripIds.length > 0) {
            setPinNotice(t('messages.pinEvicted'));
        } else {
            setPinNotice(null);
        }

        trackEvent(result.nextPinnedState ? 'profile__trip--pin' : 'profile__trip--unpin', {
            trip_id: trip.id,
            tab,
        });
    }, [persistTrip, t, tab, trips]);

    if (!isLoading && !isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    return (
        <div className="min-h-screen bg-slate-50">
            <SiteHeader hideCreateTrip />
            <div className="w-full space-y-6 px-4 py-6 sm:px-6 md:py-8 lg:px-8 xl:px-10 2xl:px-14">
                <ProfileHero
                    isLoading={loadingProfile}
                    displayName={displayName}
                    email={access?.email || t('fallback.email')}
                    initials={initialsFrom(profile, access?.email || null)}
                    tier={access?.tierKey || 'tier_free'}
                    role={access?.role || 'user'}
                    preferredLanguage={profile?.preferredLanguage || null}
                    greetingText={greeting.greeting}
                    greetingLanguage={greeting.language}
                    greetingContext={greeting.context}
                    title={t('hero.title')}
                    subtitle={t('hero.subtitle')}
                    accountLabel={t('hero.accountLabel')}
                    loadingLabel={t('hero.loading')}
                    labels={{
                        tier: t('hero.labels.tier'),
                        role: t('hero.labels.role'),
                        language: t('hero.labels.language'),
                    }}
                />

                {errorMessage && (
                    <section className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                        {errorMessage}
                    </section>
                )}

                {pinNotice && (
                    <section className="rounded-xl border border-accent-200 bg-accent-50 px-4 py-3 text-sm text-accent-900">
                        {pinNotice}
                    </section>
                )}

                <section className="space-y-2">
                    <h2 className="text-sm font-black tracking-tight text-slate-900">{t('actions.title')}</h2>
                    <div className="flex flex-wrap items-center gap-2">
                        <NavLink
                            to="/profile/settings"
                            onClick={() => trackEvent('profile__shortcut--settings')}
                            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-100 hover:text-slate-900"
                            {...getAnalyticsDebugAttributes('profile__shortcut--settings')}
                        >
                            <GearSix size={16} />
                            {t('actions.settings')}
                        </NavLink>
                        <NavLink
                            to="/create-trip"
                            onClick={() => trackEvent('profile__shortcut--planner')}
                            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-100 hover:text-slate-900"
                            {...getAnalyticsDebugAttributes('profile__shortcut--planner')}
                        >
                            <IdentificationCard size={16} />
                            {t('actions.planner')}
                        </NavLink>
                        {isAdmin && (
                            <NavLink
                                to="/admin/dashboard"
                                onClick={() => trackEvent('profile__shortcut--admin_workspace')}
                                className="inline-flex items-center gap-2 rounded-full border border-accent-200 bg-accent-50 px-3 py-2 text-sm font-semibold text-accent-900 transition-colors hover:bg-accent-100"
                                {...getAnalyticsDebugAttributes('profile__shortcut--admin_workspace')}
                            >
                                <ShieldCheck size={16} />
                                {t('actions.adminWorkspace')}
                            </NavLink>
                        )}
                    </div>
                </section>

                {pinnedTrips.length > 0 && (
                    <section className="space-y-3">
                        <div className="flex items-center justify-between gap-3">
                            <h2 className="text-lg font-black tracking-tight text-slate-900">{t('sections.highlights')}</h2>
                            <span className="text-xs font-semibold text-slate-500">
                                {t('sections.highlightsCount', { count: pinnedTrips.length })}
                            </span>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                            {pinnedTrips.map((trip) => (
                                <ProfileTripCard
                                    key={`pinned-${trip.id}`}
                                    trip={trip}
                                    locale={appLocale}
                                    sourceLabel={t(`cards.source.${getTripSourceLabelKey(trip)}`)}
                                    labels={{
                                        open: t('cards.actions.open'),
                                        favorite: t('cards.actions.favorite'),
                                        unfavorite: t('cards.actions.unfavorite'),
                                        pin: t('cards.actions.pin'),
                                        unpin: t('cards.actions.unpin'),
                                        pinnedTag: t('cards.pinnedTag'),
                                        mapUnavailable: t('cards.mapUnavailable'),
                                        mapLoading: t('cards.mapLoading'),
                                    }}
                                    onOpen={handleOpenTrip}
                                    onToggleFavorite={handleToggleFavorite}
                                    onTogglePin={handleTogglePin}
                                    analyticsAttrs={(action) =>
                                        getAnalyticsDebugAttributes(`profile__trip_card--${action}`, {
                                            trip_id: trip.id,
                                            tab,
                                        })}
                                />
                            ))}
                        </div>
                    </section>
                )}

                <section className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <ProfileTripTabs
                            activeTab={tab}
                            tabs={[
                                { id: 'recent', label: t('tabs.recent'), count: tabCounts.recent },
                                { id: 'favorites', label: t('tabs.favorites'), count: tabCounts.favorites },
                                { id: 'all', label: t('tabs.all'), count: tabCounts.all },
                                {
                                    id: 'liked',
                                    label: t('tabs.liked'),
                                    count: tabCounts.liked,
                                    badge: t('tabs.comingSoon'),
                                },
                            ]}
                            onTabChange={handleTabChange}
                            analyticsAttrs={(nextTab) =>
                                getAnalyticsDebugAttributes(`profile__tab--${nextTab}`)}
                        />

                        {tab === 'recent' && (
                            <div className="inline-flex items-center rounded-xl border border-slate-200 bg-white p-1">
                                <button
                                    type="button"
                                    onClick={() => handleRecentSortChange('created')}
                                    className={[
                                        'rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors',
                                        recentSort === 'created'
                                            ? 'bg-slate-100 text-accent-700'
                                            : 'text-slate-600 hover:text-slate-900',
                                    ].join(' ')}
                                    {...getAnalyticsDebugAttributes('profile__recent_sort--created')}
                                >
                                    {t('recentSort.created')}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleRecentSortChange('updated')}
                                    className={[
                                        'rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors',
                                        recentSort === 'updated'
                                            ? 'bg-slate-100 text-accent-700'
                                            : 'text-slate-600 hover:text-slate-900',
                                    ].join(' ')}
                                    {...getAnalyticsDebugAttributes('profile__recent_sort--updated')}
                                >
                                    {t('recentSort.updated')}
                                </button>
                            </div>
                        )}
                    </div>

                    {tab === 'liked' ? (
                        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center">
                            <p className="text-sm font-semibold text-slate-800">{t('likedPlaceholder.title')}</p>
                            <p className="mt-1 text-sm text-slate-600">{t('likedPlaceholder.description')}</p>
                        </div>
                    ) : tripsForTab.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center">
                            <p className="text-sm font-semibold text-slate-800">{t('empty.title')}</p>
                            <p className="mt-1 text-sm text-slate-600">{t('empty.description')}</p>
                        </div>
                    ) : (
                        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                            {tripsForTab.map((trip) => (
                                <ProfileTripCard
                                    key={trip.id}
                                    trip={trip}
                                    locale={appLocale}
                                    sourceLabel={t(`cards.source.${getTripSourceLabelKey(trip)}`)}
                                    labels={{
                                        open: t('cards.actions.open'),
                                        favorite: t('cards.actions.favorite'),
                                        unfavorite: t('cards.actions.unfavorite'),
                                        pin: t('cards.actions.pin'),
                                        unpin: t('cards.actions.unpin'),
                                        pinnedTag: t('cards.pinnedTag'),
                                        mapUnavailable: t('cards.mapUnavailable'),
                                        mapLoading: t('cards.mapLoading'),
                                    }}
                                    onOpen={handleOpenTrip}
                                    onToggleFavorite={handleToggleFavorite}
                                    onTogglePin={handleTogglePin}
                                    analyticsAttrs={(action) =>
                                        getAnalyticsDebugAttributes(`profile__trip_card--${action}`, {
                                            trip_id: trip.id,
                                            tab,
                                        })}
                                />
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
};
