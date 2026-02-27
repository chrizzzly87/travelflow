import React, { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { Navigate, NavLink, useNavigate, useSearchParams } from 'react-router-dom';
import { IdentificationCard, SealCheck, ShieldCheck } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { SiteHeader } from '../components/navigation/SiteHeader';
import { SiteFooter } from '../components/marketing/SiteFooter';
import { ProfileHero } from '../components/profile/ProfileHero';
import { ProfileOwnerSummary } from '../components/profile/ProfileOwnerSummary';
import { ProfileTripTabs } from '../components/profile/ProfileTripTabs';
import { ProfileTripCard } from '../components/profile/ProfileTripCard';
import { ProfileTripCardSkeleton } from '../components/profile/ProfileTripCardSkeleton';
import { ProfilePassportDialog } from '../components/profile/ProfilePassportDialog';
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
import { collectVisitedCountries } from '../components/profile/profileCountryUtils';
import { resolveProfileStatusByTier } from '../components/profile/profileStatus';
import {
    buildProfileStampProgress,
    computeProfileStampMetrics,
    getPassportDisplayStamps,
} from '../components/profile/profileStamps';
import { useAuth } from '../hooks/useAuth';
import { getProfileCountryDisplayName } from '../services/profileCountryService';
import { getAllTrips, saveTrip } from '../services/storageService';
import { DB_ENABLED, dbUpsertTrip } from '../services/dbService';
import { getAnalyticsDebugAttributes, trackEvent } from '../services/analyticsService';
import {
    formatDisplayNameForGreeting,
    pickRandomInternationalGreeting,
} from '../data/internationalGreetingsCatalog';
import { normalizeLocale } from '../config/locales';
import { buildLocalizedMarketingPath, buildPath } from '../config/routes';
import { DEFAULT_DISTANCE_UNIT, formatDistance, getTripDistanceKm } from '../utils';
import type { ITrip } from '../types';
import { useInfiniteScrollSentinel } from '../hooks/useInfiniteScrollSentinel';

const PROFILE_TRIPS_PAGE_SIZE = 6;
const PROFILE_PASSPORT_QUERY_KEY = 'passport';
const PROFILE_PASSPORT_QUERY_VALUE = 'open';

const initialsFrom = (
    profile: {
        firstName?: string | null;
        lastName?: string | null;
    } | null,
    fallbackEmail: string | null
): string => {
    const first = profile?.firstName?.trim() || '';
    const last = profile?.lastName?.trim() || '';
    if (first || last) {
        return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase() || 'U';
    }
    return (fallbackEmail || 'user').charAt(0).toUpperCase();
};

const formatMemberSince = (
    profile: {
        onboardingCompletedAt?: string | null;
        usernameChangedAt?: string | null;
    } | null,
    trips: ITrip[],
    locale: string,
    fallbackLabel: string
): string => {
    const candidateTimestamps: number[] = [];

    if (profile?.onboardingCompletedAt) {
        const parsed = Date.parse(profile.onboardingCompletedAt);
        if (Number.isFinite(parsed)) candidateTimestamps.push(parsed);
    }

    if (profile?.usernameChangedAt) {
        const parsed = Date.parse(profile.usernameChangedAt);
        if (Number.isFinite(parsed)) candidateTimestamps.push(parsed);
    }

    trips.forEach((trip) => {
        if (typeof trip.createdAt === 'number' && Number.isFinite(trip.createdAt)) {
            candidateTimestamps.push(trip.createdAt);
        }
    });

    if (candidateTimestamps.length === 0) return fallbackLabel;
    const earliest = Math.min(...candidateTimestamps);
    return new Date(earliest).toLocaleDateString(locale, {
        month: 'short',
        year: 'numeric',
    });
};

export const ProfilePage: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { t, i18n } = useTranslation('profile');
    const {
        isLoading,
        isAuthenticated,
        access,
        isAdmin,
        session,
        profile,
        isProfileLoading,
        refreshProfile,
    } = useAuth();

    const [trips, setTrips] = useState<ITrip[]>(() => getAllTrips());
    const [pinNotice, setPinNotice] = useState<string | null>(null);
    const [visibleTripCount, setVisibleTripCount] = useState(PROFILE_TRIPS_PAGE_SIZE);
    const [isTripPaginationPending, startTripPaginationTransition] = useTransition();
    const hasRequestedMissingProfileRef = useRef(false);

    const greeting = useMemo(() => pickRandomInternationalGreeting(), []);
    const appLocale = useMemo(
        () => normalizeLocale(i18n.resolvedLanguage ?? i18n.language ?? 'en'),
        [i18n.language, i18n.resolvedLanguage]
    );

    const tab = normalizeProfileTripTab(searchParams.get('tab'));
    const recentSort = normalizeProfileRecentSort(searchParams.get('recentSort'));
    const isPassportDialogOpen = searchParams.get(PROFILE_PASSPORT_QUERY_KEY) === PROFILE_PASSPORT_QUERY_VALUE;

    const profileMetadata = session?.user?.user_metadata as Record<string, unknown> | undefined;
    const metadataDisplayName = [
        typeof profileMetadata?.given_name === 'string' ? profileMetadata.given_name.trim() : '',
        typeof profileMetadata?.family_name === 'string' ? profileMetadata.family_name.trim() : '',
    ].filter(Boolean).join(' ')
        || (typeof profileMetadata?.full_name === 'string' ? profileMetadata.full_name.trim() : '');
    const fallbackDisplayName = metadataDisplayName
        || access?.email?.trim().split('@')[0]
        || t('fallback.displayName');
    const displayName = profile?.displayName
        || [profile?.firstName || '', profile?.lastName || ''].filter(Boolean).join(' ')
        || fallbackDisplayName;
    const greetingDisplayName = formatDisplayNameForGreeting(
        profile?.firstName || '',
        profile?.lastName || '',
        displayName,
        greeting.nameOrder,
        { primaryNameOnly: true }
    );

    const profileCountryLabel = getProfileCountryDisplayName(profile?.country, appLocale);
    const locationLabel = [profile?.city || '', profileCountryLabel]
        .map((part) => part.trim())
        .filter(Boolean)
        .join(', ') || t('summary.locationUnknown');

    const totalDistanceKm = useMemo(
        () => trips.reduce((sum, trip) => sum + getTripDistanceKm(trip.items), 0),
        [trips]
    );
    const distanceLabel = totalDistanceKm > 0
        ? formatDistance(totalDistanceKm, DEFAULT_DISTANCE_UNIT, { maximumFractionDigits: 0 })
        : t('summary.distanceUnknown');

    const visitedCountries = useMemo(() => collectVisitedCountries(trips), [trips]);
    const memberSince = useMemo(
        () => formatMemberSince(profile, trips, appLocale, t('summary.memberSinceUnknown')),
        [appLocale, profile, t, trips]
    );
    const profileStatus = useMemo(
        () => resolveProfileStatusByTier(access?.tierKey),
        [access?.tierKey]
    );

    const refreshTrips = useCallback(() => {
        setTrips(getAllTrips());
    }, []);

    useEffect(() => {
        if (!isAuthenticated) {
            hasRequestedMissingProfileRef.current = false;
            return;
        }
        if (profile) {
            hasRequestedMissingProfileRef.current = false;
            return;
        }
        if (isProfileLoading || hasRequestedMissingProfileRef.current) return;
        hasRequestedMissingProfileRef.current = true;
        void refreshProfile();
    }, [isAuthenticated, isProfileLoading, profile, refreshProfile]);

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
    const visibleTripsForTab = useMemo(
        () => tripsForTab.slice(0, visibleTripCount),
        [tripsForTab, visibleTripCount]
    );
    const hasMoreTripsForTab = visibleTripCount < tripsForTab.length;
    const skeletonTripCount = Math.max(0, Math.min(PROFILE_TRIPS_PAGE_SIZE, tripsForTab.length - visibleTripCount));

    const tabCounts = useMemo(() => ({
        recent: getRecentTrips(trips, recentSort).length,
        favorites: trips.filter((trip) => Boolean(trip.isFavorite)).length,
        all: trips.length,
        liked: 0,
    }), [trips, recentSort]);
    const stampMetrics = useMemo(
        () => computeProfileStampMetrics(trips, {
            likesGiven: tabCounts.favorites,
            likesEarned: 0,
        }),
        [tabCounts.favorites, trips]
    );
    const stampProgress = useMemo(
        () => buildProfileStampProgress(stampMetrics),
        [stampMetrics]
    );
    const passportDisplayStamps = useMemo(
        () => getPassportDisplayStamps(stampProgress, profile?.passportStickerSelection),
        [profile?.passportStickerSelection, stampProgress]
    );

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

    const handlePassportDialogOpenChange = useCallback((nextOpen: boolean) => {
        const next = new URLSearchParams(searchParams);
        if (nextOpen) {
            next.set(PROFILE_PASSPORT_QUERY_KEY, PROFILE_PASSPORT_QUERY_VALUE);
        } else {
            next.delete(PROFILE_PASSPORT_QUERY_KEY);
        }
        setSearchParams(next, { replace: !nextOpen });
    }, [searchParams, setSearchParams]);

    const handleOpenPassportDialog = useCallback(() => {
        trackEvent('profile__summary--open_stamps');
        handlePassportDialogOpenChange(true);
    }, [handlePassportDialogOpenChange]);

    useEffect(() => {
        setVisibleTripCount(PROFILE_TRIPS_PAGE_SIZE);
    }, [tab, recentSort, tripsForTab.length]);

    const handleLoadMoreTrips = useCallback(() => {
        if (!hasMoreTripsForTab || isTripPaginationPending) return;
        startTripPaginationTransition(() => {
            setVisibleTripCount((current) => Math.min(current + PROFILE_TRIPS_PAGE_SIZE, tripsForTab.length));
        });
    }, [hasMoreTripsForTab, isTripPaginationPending, startTripPaginationTransition, tripsForTab.length]);

    const tripsLoadMoreRef = useInfiniteScrollSentinel({
        enabled: tab !== 'liked',
        hasMore: hasMoreTripsForTab,
        isLoading: isTripPaginationPending,
        onLoadMore: handleLoadMoreTrips,
        rootMargin: '520px 0px',
    });

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

    const handleToggleVisibility = useCallback((trip: ITrip) => {
        const nextVisibility = trip.showOnPublicProfile === false;
        const now = Date.now();

        const nextTrips = trips.map((candidate) => {
            if (candidate.id !== trip.id) return candidate;
            return {
                ...candidate,
                showOnPublicProfile: nextVisibility,
                updatedAt: now,
            };
        });

        setTrips(nextTrips);
        const updated = nextTrips.find((candidate) => candidate.id === trip.id);
        if (updated) {
            persistTrip(updated);
        }

        trackEvent(nextVisibility ? 'profile__trip_visibility--public' : 'profile__trip_visibility--private', {
            trip_id: trip.id,
            tab,
        });
    }, [persistTrip, tab, trips]);

    const publicProfilePath = profile?.username
        ? buildPath('publicProfile', { username: profile.username })
        : null;
    const publicProfileUrl = publicProfilePath
        ? `${typeof window !== 'undefined' ? window.location.origin : ''}${publicProfilePath}`
        : null;

    const inspirationPath = buildLocalizedMarketingPath('inspirationsCountryDetail', appLocale, {
        countryName: greeting.inspirationCountry,
    });

    if (!isLoading && !isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    if (isProfileLoading && !profile) {
        return (
            <div className="flex min-h-screen flex-col bg-slate-50">
                <SiteHeader hideCreateTrip />
                <main className="mx-auto w-full max-w-7xl flex-1 px-5 pb-14 pt-12 md:px-8 md:pt-14">
                    <div className="h-24" aria-hidden="true" />
                </main>
                <SiteFooter />
            </div>
        );
    }

    return (
        <div className="flex min-h-screen flex-col bg-slate-50">
            <SiteHeader hideCreateTrip />
            <main data-testid="profile-page-container" className="mx-auto w-full max-w-7xl flex-1 space-y-8 px-5 pb-14 pt-12 md:px-8 md:pt-14">
                <ProfileHero
                    greeting={greeting.greeting}
                    name={greetingDisplayName}
                    transliteration={greeting.transliteration}
                    ipa={greeting.ipa}
                    context={greeting.context}
                    ctaIntroLabel={t('hero.inspirationIntro')}
                    ctaLinkLabel={t('hero.inspirationCta', {
                        country: greeting.inspirationCountry,
                    })}
                    ctaHref={inspirationPath}
                    inspirationCountryCode={greeting.inspirationCountryCode}
                    onCtaClick={() => {
                        trackEvent('profile__hero_cta--inspirations_country', {
                            country: greeting.inspirationCountry,
                        });
                    }}
                    analyticsAttributes={getAnalyticsDebugAttributes('profile__hero_cta--inspirations_country', {
                        country: greeting.inspirationCountry,
                    })}
                />

                {pinNotice && (
                    <section className="rounded-xl border border-accent-200 bg-accent-50 px-4 py-3 text-sm text-accent-900">
                        {pinNotice}
                    </section>
                )}

                <ProfileOwnerSummary
                    displayName={displayName}
                    username={profile?.username || ''}
                    initials={initialsFrom(profile, access?.email || null)}
                    status={profileStatus}
                    memberSince={memberSince}
                    bio={profile?.bio || ''}
                    location={locationLabel}
                    distanceLabel={distanceLabel}
                    countries={visitedCountries}
                    stamps={passportDisplayStamps}
                    passportCountryCode={profile?.country}
                    stats={[
                        { id: 'total_trips', label: t('stats.totalTrips'), value: trips.length },
                        { id: 'likes_saved', label: t('stats.likesSaved'), value: tabCounts.favorites },
                        { id: 'followers', label: t('stats.followers'), value: 0 },
                        { id: 'likes_earned', label: t('stats.likesEarned'), value: 0, accent: true },
                    ]}
                    labels={{
                        editProfile: t('summary.editProfile'),
                        viewPublicProfile: t('summary.viewPublicProfile'),
                        shareProfile: t('summary.shareProfile'),
                        memberSinceLabel: t('summary.memberSinceLabel'),
                        usernamePrefix: t('summary.usernamePrefix'),
                        bio: t('summary.bioLabel'),
                        bioFallback: t('summary.bioFallback'),
                        countries: t('summary.countriesLabel'),
                        countriesEmpty: t('summary.countriesEmpty'),
                        stampsTitle: t('summary.stampsTitle'),
                        stampsDescription: t('summary.stampsDescription'),
                        stampsOpen: t('summary.stampsOpen'),
                    }}
                    onEditProfile={() => {
                        trackEvent('profile__summary--edit_profile');
                        navigate(buildPath('profileSettings'));
                    }}
                    onViewPublicProfile={() => {
                        trackEvent(publicProfilePath ? 'profile__summary--view_public_profile' : 'profile__summary--view_public_profile_setup');
                        navigate(publicProfilePath || buildPath('profileSettings'));
                    }}
                    onShareProfile={() => {
                        if (!publicProfileUrl) {
                            navigate(buildPath('profileSettings'));
                            return;
                        }
                        trackEvent('profile__summary--share_public_profile');
                        if (navigator.clipboard?.writeText) {
                            void navigator.clipboard.writeText(publicProfileUrl)
                                .then(() => {
                                    toast.success(t('summary.shareCopied'));
                                })
                                .catch(() => {
                                    window.open(publicProfileUrl, '_blank', 'noopener,noreferrer');
                                    toast.info(t('summary.shareOpened'));
                                });
                        } else {
                            window.open(publicProfileUrl, '_blank', 'noopener,noreferrer');
                            toast.info(t('summary.shareOpened'));
                        }
                    }}
                    onOpenPassport={() => {
                        handleOpenPassportDialog();
                    }}
                    canViewPublicProfile={Boolean(publicProfilePath)}
                    canShareProfile={Boolean(publicProfileUrl)}
                    locale={appLocale}
                />

                <section className="space-y-2">
                    <h2 className="text-sm font-black tracking-tight text-slate-900">{t('actions.title')}</h2>
                    <div className="flex flex-wrap items-center gap-2">
                        <NavLink
                            to={buildPath('createTrip')}
                            onClick={() => trackEvent('profile__shortcut--planner')}
                            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-100 hover:text-slate-900"
                            {...getAnalyticsDebugAttributes('profile__shortcut--planner')}
                        >
                            <IdentificationCard size={16} />
                            {t('actions.planner')}
                        </NavLink>
                        <button
                            type="button"
                            onClick={() => {
                                trackEvent('profile__shortcut--stamps');
                                handleOpenPassportDialog();
                            }}
                            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-100 hover:text-slate-900"
                            {...getAnalyticsDebugAttributes('profile__shortcut--stamps')}
                        >
                            <SealCheck size={16} weight="duotone" />
                            {t('actions.stamps')}
                        </button>
                        {isAdmin && (
                            <NavLink
                                to={buildPath('adminDashboard')}
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
                        <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
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
                                        makePublic: t('cards.actions.makePublic'),
                                        makePrivate: t('cards.actions.makePrivate'),
                                        pinnedTag: t('cards.pinnedTag'),
                                        expiredTag: t('cards.expiredTag'),
                                        expiredFallbackTitle: t('cards.expiredFallbackTitle'),
                                        mapUnavailable: t('cards.mapUnavailable'),
                                        mapLoading: t('cards.mapLoading'),
                                        creatorPrefix: t('cards.creatorPrefix'),
                                    }}
                                    onOpen={handleOpenTrip}
                                    onToggleFavorite={handleToggleFavorite}
                                    onTogglePin={handleTogglePin}
                                    onToggleVisibility={handleToggleVisibility}
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
                        <>
                            <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
                                {visibleTripsForTab.map((trip) => (
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
                                            makePublic: t('cards.actions.makePublic'),
                                            makePrivate: t('cards.actions.makePrivate'),
                                            pinnedTag: t('cards.pinnedTag'),
                                            expiredTag: t('cards.expiredTag'),
                                            expiredFallbackTitle: t('cards.expiredFallbackTitle'),
                                            mapUnavailable: t('cards.mapUnavailable'),
                                            mapLoading: t('cards.mapLoading'),
                                            creatorPrefix: t('cards.creatorPrefix'),
                                        }}
                                        onOpen={handleOpenTrip}
                                        onToggleFavorite={handleToggleFavorite}
                                        onTogglePin={handleTogglePin}
                                        onToggleVisibility={handleToggleVisibility}
                                        analyticsAttrs={(action) =>
                                            getAnalyticsDebugAttributes(`profile__trip_card--${action}`, {
                                                trip_id: trip.id,
                                                tab,
                                            })}
                                    />
                                ))}
                            </div>

                            {hasMoreTripsForTab && (
                                <>
                                    <div className="grid grid-cols-2 gap-4 xl:grid-cols-3" aria-hidden="true">
                                        {Array.from({ length: skeletonTripCount || PROFILE_TRIPS_PAGE_SIZE }).map((_, index) => (
                                            <ProfileTripCardSkeleton key={`profile-trip-skeleton-${index}`} pulse={isTripPaginationPending} />
                                        ))}
                                    </div>
                                    <div ref={tripsLoadMoreRef} className="h-8 w-full" aria-hidden="true" />
                                </>
                            )}
                        </>
                    )}
                </section>

                <ProfilePassportDialog
                    open={isPassportDialogOpen}
                    onOpenChange={(nextOpen) => handlePassportDialogOpenChange(nextOpen)}
                    title={t('stamps.title')}
                    description={t('stamps.description', { name: displayName })}
                    stamps={stampProgress}
                    locale={appLocale}
                    labels={{
                        pageIndicator: t('stamps.pageIndicator'),
                        previousPage: t('stamps.previousPage'),
                        nextPage: t('stamps.nextPage'),
                        emptySlot: t('stamps.emptySlot'),
                    }}
                    resolveGroupLabel={(group) => t(`stamps.group.${group}`)}
                    onPageChange={(page) => {
                        trackEvent('profile__stamps_page--change', { page });
                    }}
                />
            </main>
            <SiteFooter />
        </div>
    );
};
