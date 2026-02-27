import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { NavLink, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SiteHeader } from '../components/navigation/SiteHeader';
import { SiteFooter } from '../components/marketing/SiteFooter';
import { ProfileVisitorSummary } from '../components/profile/ProfileVisitorSummary';
import { ProfileTripCard } from '../components/profile/ProfileTripCard';
import { ProfileTripCardSkeleton } from '../components/profile/ProfileTripCardSkeleton';
import { ProfilePassportDialog } from '../components/profile/ProfilePassportDialog';
import { collectVisitedCountries } from '../components/profile/profileCountryUtils';
import { getPinnedTrips, getTripSourceLabelKey, sortTripsByUpdatedDesc } from '../components/profile/profileTripState';
import { resolveProfileStatusByTripCount } from '../components/profile/profileStatus';
import {
    buildProfileStampProgress,
    computeProfileStampMetrics,
    getPassportDisplayStamps,
} from '../components/profile/profileStamps';
import { getProfileCountryDisplayName } from '../services/profileCountryService';
import {
    getPublicTripsPageByUserId,
    resolvePublicProfileByHandle,
    type UserProfileRecord,
} from '../services/profileService';
import { getAnalyticsDebugAttributes, trackEvent } from '../services/analyticsService';
import { normalizeLocale } from '../config/locales';
import { buildPath } from '../config/routes';
import { DEFAULT_DISTANCE_UNIT, formatDistance, getTripDistanceKm } from '../utils';
import type { ITrip } from '../types';
import { useInfiniteScrollSentinel } from '../hooks/useInfiniteScrollSentinel';
import { useAuth } from '../hooks/useAuth';
import { setCanonicalDocumentTitle } from '../services/tripGenerationTabFeedbackService';
import { APP_NAME } from '../config/appGlobals';

const PUBLIC_PROFILE_TRIPS_PAGE_SIZE = 9;
const PUBLIC_PROFILE_PASSPORT_QUERY_KEY = 'passport';
const PUBLIC_PROFILE_PASSPORT_QUERY_VALUE = 'open';

interface ProfileState {
    status: 'loading' | 'found' | 'private' | 'not_found';
    profile: UserProfileRecord | null;
}

const initialsFromProfile = (profile: UserProfileRecord | null): string => {
    const first = profile?.firstName?.trim() || '';
    const last = profile?.lastName?.trim() || '';
    if (first || last) return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
    if (profile?.username) return profile.username.charAt(0).toUpperCase();
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

const formatPrivateDisplayName = (profile: UserProfileRecord | null, fallback: string): string => {
    const firstName = profile?.firstName?.trim() || '';
    const lastInitial = profile?.lastName?.trim().charAt(0) || '';
    if (firstName) return `${firstName}${lastInitial ? ` ${lastInitial}.` : ''}`;
    return profile?.displayName || profile?.username || fallback;
};

const upsertPublicProfileRobotsMeta = (content: string | null): void => {
    if (typeof document === 'undefined') return;
    const selector = 'meta[name="robots"][data-managed-by="public-profile"]';
    let meta = document.head.querySelector<HTMLMetaElement>(selector);

    if (!content) {
        if (meta) meta.remove();
        return;
    }

    if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('name', 'robots');
        meta.setAttribute('data-managed-by', 'public-profile');
        document.head.appendChild(meta);
    }

    meta.setAttribute('content', content);
};

export const PublicProfilePage: React.FC = () => {
    const { username = '' } = useParams();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { t, i18n } = useTranslation('profile');
    const { isLoading: isAuthLoading, isAuthenticated, isAdmin, profile: viewerProfile } = useAuth();

    const [state, setState] = useState<ProfileState>({
        status: 'loading',
        profile: null,
    });
    const [trips, setTrips] = useState<ITrip[]>([]);
    const [nextTripsOffset, setNextTripsOffset] = useState(0);
    const [hasMoreTrips, setHasMoreTrips] = useState(false);
    const [isTripsLoading, setIsTripsLoading] = useState(false);
    const [isTripsLoadingMore, setIsTripsLoadingMore] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const appLocale = useMemo(
        () => normalizeLocale(i18n.resolvedLanguage ?? i18n.language ?? 'en'),
        [i18n.language, i18n.resolvedLanguage]
    );
    const profileLoadErrorLabel = useMemo(
        () => t('errors.profileLoad'),
        [i18n.language, i18n.resolvedLanguage, t]
    );
    const viewerHandle = useMemo(
        () => normalizeUsername(viewerProfile?.username),
        [viewerProfile?.username]
    );
    const viewerProfileId = viewerProfile?.id || null;
    const isPassportDialogOpen = searchParams.get(PUBLIC_PROFILE_PASSPORT_QUERY_KEY) === PUBLIC_PROFILE_PASSPORT_QUERY_VALUE;

    useEffect(() => {
        if (isAuthLoading) return;

        const handle = (username || '').trim().toLowerCase();
        if (!handle) {
            setState({ status: 'not_found', profile: null });
            return;
        }

        let active = true;
        setErrorMessage(null);
        setState({ status: 'loading', profile: null });
        setTrips([]);
        setNextTripsOffset(0);
        setHasMoreTrips(false);
        setIsTripsLoading(false);
        setIsTripsLoadingMore(false);

        const loadFirstTripsPage = async (profileRecord: UserProfileRecord) => {
            setState({ status: 'found', profile: profileRecord });
            trackEvent('public_profile__view', {
                username: profileRecord.username || handle,
            });

            setIsTripsLoading(true);
            try {
                const firstPage = await getPublicTripsPageByUserId(profileRecord.id, {
                    offset: 0,
                    limit: PUBLIC_PROFILE_TRIPS_PAGE_SIZE,
                });
                if (!active) return;
                setTrips(firstPage.trips);
                setNextTripsOffset(firstPage.nextOffset);
                setHasMoreTrips(firstPage.hasMore);
            } catch (error) {
                if (!active) return;
                setTrips([]);
                setNextTripsOffset(0);
                setHasMoreTrips(false);
                setErrorMessage(error instanceof Error ? error.message : profileLoadErrorLabel);
            } finally {
                if (!active) return;
                setIsTripsLoading(false);
            }
        };

        void resolvePublicProfileByHandle(handle)
            .then(async (result) => {
                if (!active) return;

                if (result.status === 'redirect' && result.canonicalUsername) {
                    const canonicalPath = buildPath('publicProfile', { username: result.canonicalUsername });
                    const normalizedCurrent = buildPath('publicProfile', { username: handle });
                    if (canonicalPath !== normalizedCurrent) {
                        navigate(canonicalPath, { replace: true });
                        return;
                    }
                }

                if (result.status === 'private') {
                    if (isAuthenticated && viewerProfileId && viewerProfile && viewerHandle === handle) {
                        await loadFirstTripsPage(viewerProfile);
                        return;
                    }
                    setState({ status: 'private', profile: result.profile || null });
                    return;
                }

                if (result.status === 'not_found' || !result.profile) {
                    if (isAuthenticated && viewerProfileId && viewerProfile && viewerHandle === handle) {
                        await loadFirstTripsPage(viewerProfile);
                        return;
                    }
                    setState({ status: 'not_found', profile: null });
                    return;
                }

                await loadFirstTripsPage(result.profile);
            })
            .catch((error) => {
                if (!active) return;
                setErrorMessage(error instanceof Error ? error.message : profileLoadErrorLabel);
                setState({ status: 'not_found', profile: null });
                setIsTripsLoading(false);
            });

        return () => {
            active = false;
        };
    }, [isAuthLoading, isAuthenticated, navigate, profileLoadErrorLabel, username, viewerHandle, viewerProfile, viewerProfileId]);

    const loadMoreTrips = useCallback(() => {
        if (state.status !== 'found' || !state.profile || !hasMoreTrips || isTripsLoading || isTripsLoadingMore) return;
        setIsTripsLoadingMore(true);
        void getPublicTripsPageByUserId(state.profile.id, {
            offset: nextTripsOffset,
            limit: PUBLIC_PROFILE_TRIPS_PAGE_SIZE,
        })
            .then((page) => {
                setTrips((current) => mergeTripsById(current, page.trips));
                setNextTripsOffset(page.nextOffset);
                setHasMoreTrips(page.hasMore);
            })
            .catch(() => {
                setHasMoreTrips(false);
            })
            .finally(() => {
                setIsTripsLoadingMore(false);
            });
    }, [hasMoreTrips, isTripsLoading, isTripsLoadingMore, nextTripsOffset, state.profile, state.status]);

    const loadMoreTripsRef = useInfiniteScrollSentinel({
        enabled: state.status === 'found',
        hasMore: hasMoreTrips,
        isLoading: isTripsLoading || isTripsLoadingMore,
        onLoadMore: loadMoreTrips,
        rootMargin: '640px 0px',
    });

    const isOwnPublicProfile = Boolean(
        state.profile
        && viewerProfileId
        && state.profile.id === viewerProfileId
    );
    const isMaskedPrivateView = state.status === 'private' && !isAdmin;

    const displayName = isMaskedPrivateView
        ? formatPrivateDisplayName(state.profile, t('fallback.displayName'))
        : (
            state.profile?.displayName
            || [state.profile?.firstName || '', state.profile?.lastName || ''].filter(Boolean).join(' ')
            || state.profile?.username
            || t('fallback.displayName')
        );

    const profileCountryLabel = getProfileCountryDisplayName(state.profile?.country, appLocale);
    const locationLabel = [state.profile?.city || '', profileCountryLabel]
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
    const pinnedTrips = useMemo(() => getPinnedTrips(trips), [trips]);
    const profileStatus = useMemo(
        () => resolveProfileStatusByTripCount(trips.length),
        [trips.length]
    );
    const visibilityBadgeLabel = useMemo(() => {
        if (!state.profile) return null;
        if (isAdmin) {
            return state.profile.publicProfileEnabled
                ? t('publicProfile.visibilityPublic')
                : t('publicProfile.visibilityPrivate');
        }
        if (state.status === 'private') return t('publicProfile.visibilityPrivate');
        return null;
    }, [isAdmin, state.profile, state.status, t]);
    const allStampProgress = useMemo(() => {
        const metrics = computeProfileStampMetrics(trips, {
            likesGiven: 0,
            likesEarned: 0,
        });
        return buildProfileStampProgress(metrics);
    }, [trips]);
    const passportDisplayStamps = useMemo(() => {
        return getPassportDisplayStamps(
            allStampProgress,
            state.profile?.passportStickerSelection
        );
    }, [allStampProgress, state.profile?.passportStickerSelection]);

    const handleOpenTrip = (trip: ITrip) => {
        trackEvent('public_profile__trip--open', {
            username: state.profile?.username || username,
            trip_id: trip.id,
        });
        navigate(buildPath('tripDetail', { tripId: trip.id }));
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

    const handleOpenPassportDialog = useCallback(() => {
        trackEvent('public_profile__summary--open_passport');
        handlePassportDialogOpenChange(true);
    }, [handlePassportDialogOpenChange]);

    useEffect(() => {
        const titleByState = (() => {
            if (state.status === 'not_found') return `${t('publicProfile.notFoundTitle')} · ${APP_NAME}`;
            if (state.status === 'private') return `${t('publicProfile.privateTitle')} · ${APP_NAME}`;
            if (state.status === 'found') return `${displayName} · ${APP_NAME}`;
            return `${t('publicProfile.title')} · ${APP_NAME}`;
        })();

        setCanonicalDocumentTitle(titleByState);
        const isUnavailable = state.status === 'not_found' || state.status === 'private';
        upsertPublicProfileRobotsMeta(isUnavailable ? 'noindex, nofollow' : null);

        if (typeof document !== 'undefined') {
            if (state.status === 'not_found') {
                document.documentElement.setAttribute('data-public-profile-status', '404');
            } else {
                document.documentElement.removeAttribute('data-public-profile-status');
            }
        }

        return () => {
            if (typeof document !== 'undefined') {
                document.documentElement.removeAttribute('data-public-profile-status');
            }
            upsertPublicProfileRobotsMeta(null);
        };
    }, [displayName, state.status, t]);

    return (
        <div className="flex min-h-screen flex-col bg-slate-50">
            <SiteHeader />
            <main className="mx-auto w-full max-w-7xl flex-1 space-y-8 px-5 pb-14 pt-12 md:px-8 md:pt-14">
                {state.status === 'loading' && (
                    <>
                        <section className="rounded-2xl border border-slate-200 bg-white px-5 py-8">
                            <div className="animate-pulse space-y-4">
                                <div className="h-8 w-1/3 rounded bg-slate-200" />
                                <div className="h-4 w-2/3 rounded bg-slate-100" />
                                <div className="h-4 w-1/2 rounded bg-slate-100" />
                            </div>
                        </section>
                        <section className="grid grid-cols-2 gap-4 xl:grid-cols-3" aria-hidden="true">
                            {Array.from({ length: 3 }).map((_, index) => (
                                <ProfileTripCardSkeleton key={`public-profile-loading-skeleton-${index}`} />
                            ))}
                        </section>
                    </>
                )}

                {state.status === 'private' && (
                    <section className="grid justify-items-center gap-6 text-center md:grid-cols-[minmax(0,320px)_minmax(0,1fr)] md:items-center md:justify-items-start md:text-start">
                        <ProfileVisitorSummary
                            displayName={displayName}
                            username={state.profile?.username || ''}
                            initials={initialsFromProfile(state.profile)}
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
                                bioFallback: t('summary.bioFallback'),
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
                        <div className="w-full max-w-2xl space-y-2">
                            <h1 className="text-2xl font-black tracking-tight text-slate-900 md:text-3xl">{t('publicProfile.privateTitle')}</h1>
                            <p className="text-sm text-slate-600 md:text-base">{t('publicProfile.privateDescription')}</p>
                            <div className="flex flex-wrap items-center justify-center gap-2 pt-1 md:justify-start">
                                {!isAuthenticated ? (
                                    <NavLink
                                        to="/login"
                                        className="inline-flex items-center rounded-lg bg-accent-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-accent-700 hover:shadow-md active:scale-[0.98]"
                                    >
                                        {t('publicProfile.ctaRegisterFree')}
                                    </NavLink>
                                ) : null}
                                <NavLink
                                    to={buildPath('inspirations')}
                                    className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50"
                                >
                                    {t('publicProfile.ctaExploreInspirations')}
                                </NavLink>
                            </div>
                        </div>
                    </section>
                )}

                {state.status === 'not_found' && (
                    <section className="flex min-h-[62vh] flex-col items-center justify-center py-4 text-center">
                        <div className="mx-auto max-w-3xl space-y-4">
                            <img
                                src="/images/passport.png"
                                alt=""
                                className="mx-auto h-auto w-full max-w-[360px] object-contain opacity-95"
                                loading="lazy"
                            />
                            <h1 className="text-3xl font-black tracking-tight text-slate-900 md:text-4xl">
                                {t('publicProfile.notFoundInvalidPassportTitle')}
                            </h1>
                            <p className="text-sm font-medium text-slate-600 md:text-base">
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
                                    className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50"
                                >
                                    {t('publicProfile.ctaGetInspired')}
                                </NavLink>
                            </div>
                        </div>
                    </section>
                )}

                {state.status === 'found' && state.profile && (
                    <>
                        <ProfileVisitorSummary
                            displayName={displayName}
                            username={state.profile.username || ''}
                            initials={initialsFromProfile(state.profile)}
                            status={profileStatus}
                            bio={state.profile.bio || ''}
                            location={locationLabel}
                            distanceLabel={distanceLabel}
                            countries={visitedCountries}
                            stamps={passportDisplayStamps}
                            passportCountryCode={state.profile.country}
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
                                bioFallback: t('summary.bioFallback'),
                                countries: t('summary.countriesLabel'),
                                countriesEmpty: t('summary.countriesEmpty'),
                                stampsTitle: t('summary.stampsTitle'),
                                stampsDescription: '',
                                stampsOpen: t('summary.stampsOpen'),
                            }}
                            onOpenPassport={() => {
                                handleOpenPassportDialog();
                            }}
                            locale={appLocale}
                            isOwnProfile={isOwnPublicProfile}
                            editProfileHref={buildPath('profileSettings')}
                            onEditProfile={() => trackEvent('public_profile__summary--edit_profile')}
                            visibilityBadgeLabel={visibilityBadgeLabel}
                        />

                        {errorMessage && (
                            <section className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                                {errorMessage}
                            </section>
                        )}

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
                            <h2 className="text-lg font-black tracking-tight text-slate-900">{t('publicProfile.tripsTitle')}</h2>
                            {isTripsLoading && trips.length === 0 ? (
                                <div className="grid grid-cols-2 gap-4 xl:grid-cols-3" aria-hidden="true">
                                    {Array.from({ length: 3 }).map((_, index) => (
                                        <ProfileTripCardSkeleton key={`public-trip-loading-${index}`} />
                                    ))}
                                </div>
                            ) : trips.length === 0 ? (
                                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center">
                                    <p className="text-sm font-semibold text-slate-800">{t('publicProfile.emptyTrips')}</p>
                                </div>
                            ) : (
                                <>
                                    <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
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
                                            <div className="grid grid-cols-2 gap-4 xl:grid-cols-3" aria-hidden="true">
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

                {state.status === 'found' && (
                    <ProfilePassportDialog
                        open={isPassportDialogOpen}
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
                    />
                )}
            </main>
            <SiteFooter />
        </div>
    );
};
