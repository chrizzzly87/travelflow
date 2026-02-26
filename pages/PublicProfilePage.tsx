import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { NavLink, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SiteHeader } from '../components/navigation/SiteHeader';
import { ProfileVisitorSummary } from '../components/profile/ProfileVisitorSummary';
import { ProfileTripCard } from '../components/profile/ProfileTripCard';
import { ProfileTripCardSkeleton } from '../components/profile/ProfileTripCardSkeleton';
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

const PUBLIC_PROFILE_TRIPS_PAGE_SIZE = 9;

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

export const PublicProfilePage: React.FC = () => {
    const { username = '' } = useParams();
    const navigate = useNavigate();
    const { t, i18n } = useTranslation('profile');

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

    useEffect(() => {
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
                    setState({ status: 'private', profile: null });
                    return;
                }

                if (result.status === 'not_found' || !result.profile) {
                    setState({ status: 'not_found', profile: null });
                    return;
                }

                setState({ status: 'found', profile: result.profile });
                trackEvent('public_profile__view', {
                    username: result.profile.username || handle,
                });

                setIsTripsLoading(true);
                const firstPage = await getPublicTripsPageByUserId(result.profile.id, {
                    offset: 0,
                    limit: PUBLIC_PROFILE_TRIPS_PAGE_SIZE,
                });
                if (!active) return;
                setTrips(firstPage.trips);
                setNextTripsOffset(firstPage.nextOffset);
                setHasMoreTrips(firstPage.hasMore);
                setIsTripsLoading(false);
            })
            .catch((error) => {
                if (!active) return;
                setErrorMessage(error instanceof Error ? error.message : t('errors.profileLoad'));
                setState({ status: 'not_found', profile: null });
                setIsTripsLoading(false);
            });

        return () => {
            active = false;
        };
    }, [navigate, t, username]);

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
            .catch(() => undefined)
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

    const displayName = state.profile?.displayName
        || [state.profile?.firstName || '', state.profile?.lastName || ''].filter(Boolean).join(' ')
        || state.profile?.username
        || t('fallback.displayName');

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

    return (
        <div className="min-h-screen bg-slate-50">
            <SiteHeader hideCreateTrip />
            <main className="mx-auto w-full max-w-7xl space-y-8 px-5 pb-14 pt-8 md:px-8 md:pt-10">
                {state.status === 'loading' && (
                    <>
                        <section className="rounded-2xl border border-slate-200 bg-white px-5 py-8">
                            <div className="animate-pulse space-y-4">
                                <div className="h-8 w-1/3 rounded bg-slate-200" />
                                <div className="h-4 w-2/3 rounded bg-slate-100" />
                                <div className="h-4 w-1/2 rounded bg-slate-100" />
                            </div>
                        </section>
                        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-hidden="true">
                            {Array.from({ length: 3 }).map((_, index) => (
                                <ProfileTripCardSkeleton key={`public-profile-loading-skeleton-${index}`} />
                            ))}
                        </section>
                    </>
                )}

                {state.status === 'private' && (
                    <section className="rounded-2xl border border-slate-200 bg-white px-5 py-8 text-center">
                        <h1 className="text-2xl font-black tracking-tight text-slate-900">{t('publicProfile.privateTitle')}</h1>
                        <p className="mt-2 text-sm text-slate-600">{t('publicProfile.privateDescription')}</p>
                        <NavLink
                            to={buildPath('inspirations')}
                            className="mt-4 inline-flex rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
                        >
                            {t('publicProfile.ctaExploreInspirations')}
                        </NavLink>
                    </section>
                )}

                {state.status === 'not_found' && (
                    <section className="rounded-2xl border border-slate-200 bg-white px-5 py-8 text-center">
                        <h1 className="text-2xl font-black tracking-tight text-slate-900">{t('publicProfile.notFoundTitle')}</h1>
                        <p className="mt-2 text-sm text-slate-600">{t('publicProfile.notFoundDescription')}</p>
                        <NavLink
                            to={buildPath('profile')}
                            className="mt-4 inline-flex rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
                        >
                            {t('publicProfile.ctaBackProfile')}
                        </NavLink>
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
                            allStamps={allStampProgress}
                            passportCountryCode={state.profile.country}
                            passportStickerPositions={state.profile.passportStickerPositions}
                            stats={[
                                { id: 'total_trips', label: t('stats.totalTrips'), value: trips.length },
                                { id: 'likes_saved', label: t('stats.likesSaved'), value: 0 },
                                { id: 'followers', label: t('stats.followers'), value: 0 },
                                { id: 'likes_earned', label: t('stats.likesEarned'), value: 0, accent: true },
                            ]}
                            labels={{
                                follow: t('summary.follow'),
                                message: t('summary.message'),
                                comingSoon: t('publicProfile.followHint'),
                                usernamePrefix: t('summary.usernamePrefix'),
                                bio: t('summary.bioLabel'),
                                bioFallback: t('summary.bioFallback'),
                                location: t('summary.locationLabel'),
                                distance: t('summary.distanceLabel'),
                                countries: t('summary.countriesLabel'),
                                countriesEmpty: t('summary.countriesEmpty'),
                                stampsTitle: t('summary.stampsTitle'),
                                stampsDescription: '',
                                stampsOpen: t('summary.stampsOpen'),
                                stampsEmpty: t('summary.stampsEmpty'),
                                stampsUnlockedOn: t('stamps.cardUnlockedOn'),
                            }}
                            onOpenPassport={() => {
                                trackEvent('public_profile__summary--open_passport');
                            }}
                            locale={appLocale}
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
                                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                                    {pinnedTrips.map((trip) => (
                                        <ProfileTripCard
                                            key={`public-pinned-${trip.id}`}
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
                                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-hidden="true">
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
                                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                                        {trips.map((trip) => (
                                            <ProfileTripCard
                                                key={`public-trip-${trip.id}`}
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
                                            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-hidden="true">
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
            </main>
        </div>
    );
};
