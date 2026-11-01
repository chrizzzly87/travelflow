import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { NavLink, useSearchParams } from '@/app/navigation';
import { useTranslation } from 'react-i18next';
import { SiteHeader } from '../components/navigation/SiteHeader';
import { SiteFooter } from '../components/marketing/SiteFooter';
import { ProfileVisitorSummary } from '../components/profile/ProfileVisitorSummary';
import { ProfileTripCard } from '../components/profile/ProfileTripCard';
import { ProfileTripCardSkeleton } from '../components/profile/ProfileTripCardSkeleton';
import { ProfilePassportDialog } from '../components/profile/ProfilePassportDialog';
import { PASSPORT_FEATURE_ENABLED } from '../services/passportService';
import { collectVisitedCountries } from '../components/profile/profileCountryUtils';
import { getPinnedTrips, getTripSourceLabelKey, sortTripsByUpdatedDesc } from '../components/profile/profileTripState';
import { resolveProfileStatusByTripCount } from '../components/profile/profileStatus';
import {
    buildProfileStampProgress,
    computeProfileStampMetrics,
    getPassportDisplayStamps,
} from '../components/profile/profileStamps';
import { getProfileCountryDisplayName } from '../services/profileCountryService';
import { getPublicTripsPageByUserId, resolvePublicProfileByHandle } from '../services/profileService';
import { getAnalyticsDebugAttributes, trackEvent } from '../services/analyticsService';
import { normalizeLocale } from '../config/locales';
import { buildPath } from '../config/routes';
import { DEFAULT_DISTANCE_UNIT, formatDistance, getTripDistanceKm } from '../utils';
import type { ITrip } from '../types';
import { useInfiniteScrollSentinel } from '../hooks/useInfiniteScrollSentinel';
import { useAuth } from '../hooks/useAuth';
import { useHydrated } from '../hooks/useHydrated';
import {
    PUBLIC_PROFILE_TRIPS_PAGE_SIZE,
    resolvePublicProfileDisplayName,
    toPublicProfileView,
    type PublicProfilePageData,
    type PublicProfileTripsPage,
    type PublicProfileView,
} from '../shared/publicProfile';

const PUBLIC_PROFILE_PASSPORT_QUERY_KEY = 'passport';
const PUBLIC_PROFILE_PASSPORT_QUERY_VALUE = 'open';
const EMPTY_TRIPS_PAGE: PublicProfileTripsPage = { trips: [], hasMore: false, nextOffset: 0 };

/** Owner and admin extras only exist in the browser, after hydration. */
type ViewerMode = 'owner' | 'admin' | null;

interface ViewerFetchState {
    key: string;
    adminProfile: PublicProfileView | null;
    tripsPage: PublicProfileTripsPage | null;
    tripsFailed: boolean;
}

interface PagerState {
    base: PublicProfileTripsPage;
    extraTrips: ITrip[];
    nextOffset: number;
    hasMore: boolean;
}

const initialsFrom = (first: string, last: string, username: string): string => {
    if (first || last) return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
    if (username) return username.charAt(0).toUpperCase();
    return 'U';
};

const mergeTripsById = (currentTrips: ITrip[], nextTrips: ITrip[]): ITrip[] => {
    const mergedById = new Map<string, ITrip>();
    currentTrips.forEach((trip) => mergedById.set(trip.id, trip));
    nextTrips.forEach((trip) => mergedById.set(trip.id, trip));
    return sortTripsByUpdatedDesc(Array.from(mergedById.values()));
};

const normalizeUsername = (value: unknown): string => (
    typeof value === 'string' ? value.trim().toLowerCase() : ''
);

/**
 * Loads what only a signed-in owner or an admin may see: the owner's own
 * profile while it is private, or a private profile for an admin. This syncs
 * with the browser's auth session, so it runs in an effect after hydration;
 * the anonymous view comes from the route loader.
 */
function useViewerProfileFetch(mode: ViewerMode, username: string, viewerProfileId: string | null): ViewerFetchState | null {
    const key = mode ? `${mode}:${username}:${viewerProfileId ?? ''}` : '';
    const [state, setState] = useState<ViewerFetchState | null>(null);

    useEffect(() => {
        if (!mode) return;
        let active = true;
        const run = async () => {
            let adminProfile: PublicProfileView | null = null;
            let profileId = mode === 'owner' ? viewerProfileId : null;
            if (mode === 'admin') {
                const result = await resolvePublicProfileByHandle(username);
                if (!active) return;
                if ((result.status === 'found' || result.status === 'redirect') && result.profile?.id) {
                    adminProfile = toPublicProfileView(result.profile as unknown as Record<string, unknown>);
                    profileId = adminProfile.id;
                }
            }
            if (!profileId) {
                setState({ key, adminProfile: null, tripsPage: EMPTY_TRIPS_PAGE, tripsFailed: false });
                return;
            }
            setState({ key, adminProfile, tripsPage: null, tripsFailed: false });
            try {
                const tripsPage = await getPublicTripsPageByUserId(profileId, { offset: 0, limit: PUBLIC_PROFILE_TRIPS_PAGE_SIZE });
                if (active) setState({ key, adminProfile, tripsPage, tripsFailed: false });
            } catch {
                if (active) setState({ key, adminProfile, tripsPage: EMPTY_TRIPS_PAGE, tripsFailed: true });
            }
        };
        run().catch(() => {
            if (active) setState({ key, adminProfile: null, tripsPage: EMPTY_TRIPS_PAGE, tripsFailed: true });
        });
        return () => { active = false; };
    }, [key, mode, username, viewerProfileId]);

    return state?.key === key ? state : null;
}

/** Appends further pages to a first page; a new first page (another profile or a reload) starts over. */
function usePublicTripsPager(profileId: string | null, base: PublicProfileTripsPage | null) {
    const [pager, setPager] = useState<PagerState | null>(null);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const current = base && pager?.base === base ? pager : null;
    const trips = useMemo(
        () => (base ? (current ? mergeTripsById(base.trips, current.extraTrips) : base.trips) : []),
        [base, current]
    );
    const hasMore = current ? current.hasMore : Boolean(base?.hasMore);
    const nextOffset = current ? current.nextOffset : (base?.nextOffset ?? 0);

    const loadMore = useCallback(() => {
        if (!profileId || !base || !hasMore || isLoadingMore) return;
        setIsLoadingMore(true);
        const extraTrips = current?.extraTrips ?? [];
        void getPublicTripsPageByUserId(profileId, { offset: nextOffset, limit: PUBLIC_PROFILE_TRIPS_PAGE_SIZE })
            .then((page) => {
                setPager({ base, extraTrips: [...extraTrips, ...page.trips], nextOffset: page.nextOffset, hasMore: page.hasMore });
            })
            .catch(() => {
                setPager({ base, extraTrips, nextOffset, hasMore: false });
            })
            .finally(() => {
                setIsLoadingMore(false);
            });
    }, [base, current, hasMore, isLoadingMore, nextOffset, profileId]);

    return { trips, hasMore, isLoadingMore, loadMore };
}

interface PublicProfilePageProps {
    /** The canonical (lowercase) handle from the URL. */
    username: string;
    /** The anonymous, server-rendered view from the route loader. */
    data: PublicProfilePageData;
}

export const PublicProfilePage: React.FC<PublicProfilePageProps> = ({ username, data }) => {
    const [searchParams, setSearchParams] = useSearchParams();
    const { t, i18n } = useTranslation('profile');
    const { isLoading: isAuthLoading, isAuthenticated, isAdmin, profile: viewerProfile } = useAuth();
    const hydrated = useHydrated();

    const appLocale = useMemo(
        () => normalizeLocale(i18n.resolvedLanguage ?? i18n.language ?? 'en'),
        [i18n.language, i18n.resolvedLanguage]
    );

    // The server and the hydration render know nothing about the visitor.
    const viewerReady = hydrated && !isAuthLoading;
    const viewerProfileId = viewerReady && isAuthenticated ? viewerProfile?.id || null : null;
    const viewerIsAdmin = viewerReady && isAdmin;
    const viewerIsOwner = Boolean(viewerProfileId && normalizeUsername(viewerProfile?.username) === username);
    const viewerMode: ViewerMode = viewerIsOwner && data.status !== 'found'
        ? 'owner'
        : (viewerIsAdmin && data.status === 'private' ? 'admin' : null);
    const viewerFetch = useViewerProfileFetch(viewerMode, username, viewerProfileId);
    const ownerProfile = useMemo(
        () => (viewerMode === 'owner' && viewerProfile
            ? toPublicProfileView(viewerProfile as unknown as Record<string, unknown>)
            : null),
        [viewerMode, viewerProfile]
    );

    const view = useMemo(() => {
        if (ownerProfile) {
            return {
                profile: ownerProfile,
                tripsPage: viewerFetch ? viewerFetch.tripsPage : null,
                tripsFailed: Boolean(viewerFetch?.tripsFailed),
                isPublic: viewerProfile?.publicProfileEnabled !== false,
            };
        }
        if (viewerMode === 'admin' && viewerFetch?.adminProfile) {
            return {
                profile: viewerFetch.adminProfile,
                tripsPage: viewerFetch.tripsPage,
                tripsFailed: viewerFetch.tripsFailed,
                isPublic: false,
            };
        }
        if (data.status === 'found') {
            return { profile: data.profile, tripsPage: data.tripsPage, tripsFailed: data.tripsFailed, isPublic: true };
        }
        return null;
    }, [data, ownerProfile, viewerFetch, viewerMode, viewerProfile?.publicProfileEnabled]);

    const profile = view?.profile ?? null;
    const isTripsLoading = Boolean(view && !view.tripsPage);
    const { trips, hasMore: hasMoreTrips, isLoadingMore: isTripsLoadingMore, loadMore: loadMoreTrips } = usePublicTripsPager(
        profile?.id ?? null,
        view?.tripsPage ?? null
    );

    const loadMoreTripsRef = useInfiniteScrollSentinel({
        enabled: Boolean(view),
        hasMore: hasMoreTrips,
        isLoading: isTripsLoading || isTripsLoadingMore,
        onLoadMore: loadMoreTrips,
        rootMargin: '640px 0px',
    });

    const viewedUsername = profile?.username || null;
    useEffect(() => {
        if (!viewedUsername) return;
        trackEvent('public_profile__view', { username: viewedUsername });
    }, [viewedUsername]);

    const privatePreview = data.status === 'private' && !view ? data.preview : null;
    const isNotFound = !view && !privatePreview;
    const isOwnPublicProfile = Boolean(profile && viewerProfileId && profile.id === viewerProfileId);

    const displayName = privatePreview
        ? (privatePreview.displayName || t('fallback.displayName'))
        : (profile ? resolvePublicProfileDisplayName(profile, t('fallback.displayName')) : t('fallback.displayName'));

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
        ? (formatDistance(totalDistanceKm, DEFAULT_DISTANCE_UNIT, { maximumFractionDigits: 0 }) ?? t('summary.distanceUnknown'))
        : t('summary.distanceUnknown');

    const visitedCountries = useMemo(() => collectVisitedCountries(trips), [trips]);
    const pinnedTrips = useMemo(() => getPinnedTrips(trips), [trips]);
    const profileStatus = useMemo(
        () => resolveProfileStatusByTripCount(trips.length),
        [trips.length]
    );
    const visibilityBadgeLabel = (() => {
        if (privatePreview) return t('publicProfile.visibilityPrivate');
        if (view && viewerIsAdmin) {
            return view.isPublic ? t('publicProfile.visibilityPublic') : t('publicProfile.visibilityPrivate');
        }
        return null;
    })();
    const allStampProgress = useMemo(() => {
        const metrics = computeProfileStampMetrics(trips, {
            likesGiven: 0,
            likesEarned: 0,
        });
        return buildProfileStampProgress(metrics);
    }, [trips]);
    const passportStickerSelection = ownerProfile ? viewerProfile?.passportStickerSelection : undefined;
    const passportDisplayStamps = useMemo(() => {
        return getPassportDisplayStamps(allStampProgress, passportStickerSelection);
    }, [allStampProgress, passportStickerSelection]);

    const handleOpenTrip = (trip: ITrip) => {
        trackEvent('public_profile__trip--open', {
            username: profile?.username || username,
            trip_id: trip.id,
        });
    };

    const resolveSourceLabel = useCallback((trip: ITrip): string => {
        const sourceKey = getTripSourceLabelKey(trip);
        if (sourceKey === 'createdByYou') {
            return t('publicProfile.sourceCreatedByTraveler');
        }
        return t(`cards.source.${sourceKey}`);
    }, [t]);

    const handlePassportDialogOpenChange = useCallback((nextOpen: boolean) => {
        const next = new URLSearchParams(searchParams);
        if (nextOpen) {
            next.set(PUBLIC_PROFILE_PASSPORT_QUERY_KEY, PUBLIC_PROFILE_PASSPORT_QUERY_VALUE);
        } else {
            next.delete(PUBLIC_PROFILE_PASSPORT_QUERY_KEY);
        }
        setSearchParams(next, { replace: !nextOpen });
    }, [searchParams, setSearchParams]);
    const [passportTriggerRect, setPassportTriggerRect] = useState<DOMRect | null>(null);

    const handleOpenPassportDialog = useCallback((rect?: DOMRect) => {
        trackEvent('public_profile__summary--open_passport');
        if (rect) setPassportTriggerRect(rect);
        handlePassportDialogOpenChange(true);
    }, [handlePassportDialogOpenChange]);

    return (
        <div className="flex min-h-screen flex-col bg-secondary">
            <SiteHeader />
            <main className="mx-auto w-full max-w-7xl flex-1 space-y-8 px-5 pb-14 pt-12 md:px-8 md:pt-14">
                {privatePreview && (
                    <section className="flex justify-center">
                        <ProfileVisitorSummary
                            displayName={displayName}
                            username={privatePreview.usernameDisplay || privatePreview.username}
                            initials={initialsFrom(privatePreview.firstName, privatePreview.lastInitial, privatePreview.username)}
                            status={profileStatus}
                            bio=""
                            location=""
                            distanceLabel=""
                            countries={[]}
                            stamps={[]}
                            passportCountryCode={undefined}
                            stats={[]}
                            labels={{
                                follow: t('summary.follow'),
                                message: t('summary.message'),
                                editProfile: t('summary.editProfile'),
                                usernamePrefix: t('summary.usernamePrefix'),
                                bio: t('summary.bioLabel'),
                                bioFallback: '',
                                countries: t('summary.countriesLabel'),
                                countriesEmpty: t('summary.countriesEmpty'),
                                stampsTitle: t('summary.stampsTitle'),
                                stampsDescription: '',
                                stampsOpen: t('summary.stampsOpen'),
                            }}
                            locale={appLocale}
                            visibilityBadgeLabel={visibilityBadgeLabel}
                            showDetails={false}
                            hideRightPanel
                            compactCard
                            isOwnProfile={isOwnPublicProfile}
                            editProfileHref={buildPath('profileSettings')}
                            onEditProfile={() => trackEvent('public_profile__summary--edit_profile')}
                        />
                    </section>
                )}

                {isNotFound && (
                    <section className="flex min-h-[62vh] flex-col items-center justify-center py-4 text-center">
                        <div className="mx-auto max-w-3xl space-y-4">
                            <img
                                src="/images/passport.png"
                                alt=""
                                className="mx-auto h-auto w-full max-w-[360px] object-contain opacity-95"
                                loading="lazy"
                            />
                            <h1 className="text-3xl font-black tracking-tight text-foreground md:text-4xl">
                                {t('publicProfile.notFoundInvalidPassportTitle')}
                            </h1>
                            <p className="text-sm font-medium text-muted-foreground md:text-base">
                                {t('publicProfile.notFoundFunSubtitle')}
                            </p>
                            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                                <NavLink
                                    to={buildPath('createTrip')}
                                    className="inline-flex items-center rounded-lg bg-accent-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-accent-700 hover:shadow-md active:scale-[0.98]"
                                >
                                    {t('publicProfile.ctaPlanTrip')}
                                </NavLink>
                                <NavLink
                                    to={buildPath('inspirations')}
                                    className="inline-flex items-center rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition-colors hover:border-border hover:bg-secondary dark:shadow-none"
                                >
                                    {t('publicProfile.ctaGetInspired')}
                                </NavLink>
                            </div>
                        </div>
                    </section>
                )}

                {view && profile && (
                    <>
                        <ProfileVisitorSummary
                            displayName={displayName}
                            username={profile.usernameDisplay || profile.username}
                            initials={initialsFrom(profile.firstName, profile.lastName, profile.username)}
                            status={profileStatus}
                            bio={profile.bio}
                            location={locationLabel}
                            distanceLabel={distanceLabel}
                            countries={visitedCountries}
                            stamps={passportDisplayStamps}
                            passportCountryCode={profile.country}
                            stats={[
                                { id: 'total_trips', label: t('stats.totalTrips'), value: trips.length },
                                { id: 'likes_saved', label: t('stats.likesSaved'), value: 0 },
                                { id: 'followers', label: t('stats.followers'), value: 0 },
                                { id: 'likes_earned', label: t('stats.likesEarned'), value: 0, accent: true },
                            ]}
                            labels={{
                                follow: t('summary.follow'),
                                message: t('summary.message'),
                                editProfile: t('summary.editProfile'),
                                usernamePrefix: t('summary.usernamePrefix'),
                                bio: t('summary.bioLabel'),
                                bioFallback: '',
                                countries: t('summary.countriesLabel'),
                                countriesEmpty: t('summary.countriesEmpty'),
                                stampsTitle: t('summary.stampsTitle'),
                                stampsDescription: '',
                                stampsOpen: t('summary.stampsOpen'),
                            }}
                            onOpenPassport={(rect: DOMRect) => {
                                handleOpenPassportDialog(rect);
                            }}
                            locale={appLocale}
                            isOwnProfile={isOwnPublicProfile}
                            editProfileHref={buildPath('profileSettings')}
                            onEditProfile={() => trackEvent('public_profile__summary--edit_profile')}
                            visibilityBadgeLabel={visibilityBadgeLabel}
                        />

                        {view.tripsFailed && (
                            <section className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900 dark:bg-rose-400/12 dark:text-rose-200 dark:border-rose-400/30">
                                {t('errors.profileLoad')}
                            </section>
                        )}

                        {pinnedTrips.length > 0 && (
                            <section className="space-y-3">
                                <div className="flex items-center justify-between gap-3">
                                    <h2 className="text-lg font-black tracking-tight text-foreground">{t('sections.highlights')}</h2>
                                    <span className="text-xs font-semibold text-muted-foreground">
                                        {t('sections.highlightsCount', { count: pinnedTrips.length })}
                                    </span>
                                </div>
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                                    {pinnedTrips.map((trip) => (
                                        <ProfileTripCard
                                                key={`public-pinned-${trip.id}`}
                                                trip={trip}
                                                locale={appLocale}
                                                sourceLabel={resolveSourceLabel(trip)}
                                            labels={{
                                                open: t('cards.actions.open'),
                                                favorite: t('cards.actions.favorite'),
                                                unfavorite: t('cards.actions.unfavorite'),
                                                pin: t('cards.actions.pin'),
                                                unpin: t('cards.actions.unpin'),
                                                pinnedTag: t('cards.pinnedTag'),
                                                expiredTag: t('cards.expiredTag'),
                                                expiredFallbackTitle: t('cards.expiredFallbackTitle'),
                                                generationFailedTag: t('cards.generationFailedTag'),
                                                mapUnavailable: t('cards.mapUnavailable'),
                                                mapLoading: t('cards.mapLoading'),
                                            }}
                                            onOpen={handleOpenTrip}
                                            showFavoriteAction={false}
                                            showPinAction={false}
                                            analyticsAttrs={(action) =>
                                                getAnalyticsDebugAttributes(`public_profile__trip_card--${action}`, {
                                                    trip_id: trip.id,
                                                })}
                                        />
                                    ))}
                                </div>
                            </section>
                        )}

                        <section className="space-y-3">
                            <h2 className="text-lg font-black tracking-tight text-foreground">{t('publicProfile.tripsTitle')}</h2>
                            {isTripsLoading && trips.length === 0 ? (
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
                                    {Array.from({ length: 3 }).map((_, index) => (
                                        <ProfileTripCardSkeleton key={`public-trip-loading-${index}`} />
                                    ))}
                                </div>
                            ) : trips.length === 0 ? (
                                <div className="rounded-xl border border-dashed border-border bg-secondary px-4 py-8 text-center">
                                    <p className="text-sm font-semibold text-foreground">{t('publicProfile.emptyTrips')}</p>
                                </div>
                            ) : (
                                <>
                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                                        {trips.map((trip) => (
                                            <ProfileTripCard
                                                key={`public-trip-${trip.id}`}
                                                trip={trip}
                                                locale={appLocale}
                                                sourceLabel={resolveSourceLabel(trip)}
                                                labels={{
                                                    open: t('cards.actions.open'),
                                                    favorite: t('cards.actions.favorite'),
                                                    unfavorite: t('cards.actions.unfavorite'),
                                                    pin: t('cards.actions.pin'),
                                                    unpin: t('cards.actions.unpin'),
                                                    pinnedTag: t('cards.pinnedTag'),
                                                    expiredTag: t('cards.expiredTag'),
                                                    expiredFallbackTitle: t('cards.expiredFallbackTitle'),
                                                    generationFailedTag: t('cards.generationFailedTag'),
                                                    mapUnavailable: t('cards.mapUnavailable'),
                                                    mapLoading: t('cards.mapLoading'),
                                                }}
                                                onOpen={handleOpenTrip}
                                                showFavoriteAction={false}
                                                showPinAction={false}
                                                analyticsAttrs={(action) =>
                                                    getAnalyticsDebugAttributes(`public_profile__trip_card--${action}`, {
                                                        trip_id: trip.id,
                                                    })}
                                            />
                                        ))}
                                    </div>

                                    {(hasMoreTrips || isTripsLoadingMore) && (
                                        <>
                                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
                                                {Array.from({ length: 3 }).map((_, index) => (
                                                    <ProfileTripCardSkeleton
                                                        key={`public-trip-more-skeleton-${index}`}
                                                        pulse={isTripsLoadingMore}
                                                    />
                                                ))}
                                            </div>
                                            <div ref={loadMoreTripsRef} className="h-8 w-full" aria-hidden="true" />
                                        </>
                                    )}
                                </>
                            )}
                        </section>
                    </>
                )}

                {PASSPORT_FEATURE_ENABLED && view && (
                    <ProfilePassportDialog
                        open={searchParams.get(PUBLIC_PROFILE_PASSPORT_QUERY_KEY) === PUBLIC_PROFILE_PASSPORT_QUERY_VALUE}
                        onOpenChange={(nextOpen) => handlePassportDialogOpenChange(nextOpen)}
                        title={t('stamps.title')}
                        description={t('stamps.description', { name: displayName })}
                        stamps={allStampProgress}
                        locale={appLocale}
                        labels={{
                            pageIndicator: t('stamps.pageIndicator'),
                            previousPage: t('stamps.previousPage'),
                            nextPage: t('stamps.nextPage'),
                            emptySlot: t('stamps.emptySlot'),
                        }}
                        resolveGroupLabel={(group) => t(`stamps.group.${group}`)}
                        onPageChange={(page) => {
                            trackEvent('public_profile__stamps_page--change', { page });
                        }}
                        countryCode={profile?.country}
                        triggerRect={passportTriggerRect}
                    />
                )}
            </main>
            <SiteFooter />
        </div>
    );
};
