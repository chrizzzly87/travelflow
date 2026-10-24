import React, { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { Navigate, useNavigate, useSearchParams } from '@/app/navigation';
import { useTranslation } from 'react-i18next';
import { SiteHeader } from '../components/navigation/SiteHeader';
import { SiteFooter } from '../components/marketing/SiteFooter';
import { ProfileHomeActions } from '../components/profile/ProfileHomeActions';
import { ProfileHero } from '../components/profile/ProfileHero';
import { ProfileTripTabs } from '../components/profile/ProfileTripTabs';
import { ProfileTripCard } from '../components/profile/ProfileTripCard';
import { ProfileTripCardSkeleton } from '../components/profile/ProfileTripCardSkeleton';
import { ProfilePassportDialog } from '../components/profile/ProfilePassportDialog';
import { PASSPORT_FEATURE_ENABLED } from '../services/passportService';
import { useAppDialog } from '../components/AppDialogProvider';
import { Button } from '../components/ui/button';
import { Switch } from '../components/ui/switch';
import {
    getPinnedTrips,
    getRecentTrips,
    isExampleDerivedTrip,
    getTripSourceLabelKey,
    getTripsForProfileTab,
    normalizeProfileRecentSort,
    normalizeProfileTripTab,
    toggleTripFavorite,
    toggleTripPinned,
} from '../components/profile/profileTripState';
import {
    buildProfileStampProgress,
    computeProfileStampMetrics,
} from '../components/profile/profileStamps';
import { useAuth } from '../hooks/useAuth';
import { deleteTrip, getAllTrips, saveTrip } from '../services/storageService';
import { DB_ENABLED, dbArchiveTrip, dbUpsertTrip, syncTripsFromDb } from '../services/dbService';
import { getAnalyticsDebugAttributes, trackEvent } from '../services/analyticsService';
import {
    formatDisplayNameForGreeting,
    pickRandomInternationalGreeting,
} from '../data/internationalGreetingsCatalog';
import { normalizeLocale } from '../config/locales';
import { buildLocalizedMarketingPath, buildPath } from '../config/routes';
import type { ITrip } from '../types';
import { cn } from '../lib/utils';
import { useInfiniteScrollSentinel } from '../hooks/useInfiniteScrollSentinel';
import { showAppToast } from '../components/ui/appToast';
import { isTripExpiredByTimestamp } from '../config/productLimits';

const PROFILE_TRIPS_PAGE_SIZE = 6;
// Selection toolbar actions: the shared small `Button`, kept at the toolbar's
// compact text size. Tinted ones layer their status colour on `outline`.
const profileSelectionActionClassName = 'rounded-lg text-xs font-semibold';
const profileSelectionAmberClassName = 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 hover:text-amber-800 dark:border-amber-400/30 dark:bg-amber-400/12 dark:text-amber-200 dark:hover:bg-amber-400/20 dark:hover:text-amber-200';
const PROFILE_PASSPORT_QUERY_KEY = 'passport';
const PROFILE_PASSPORT_QUERY_VALUE = 'open';

const isEditableEventTarget = (target: EventTarget | null): boolean => {
    if (!(target instanceof HTMLElement)) return false;
    if (target.isContentEditable) return true;
    const tagName = target.tagName.toLowerCase();
    return tagName === 'input' || tagName === 'textarea' || tagName === 'select';
};

export const ProfilePage: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { t, i18n } = useTranslation(['profile', 'common']);
    const { confirm: confirmDialog } = useAppDialog();
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
    const [selectedTripIds, setSelectedTripIds] = useState<string[]>([]);
    const [showOnlyPublicTrips, setShowOnlyPublicTrips] = useState(false);
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
    const resolvedProfileName = [profile?.firstName || '', profile?.lastName || ''].filter(Boolean).join(' ');
    const displayName = resolvedProfileName
        || profile?.displayName
        || fallbackDisplayName;
    const greetingDisplayName = formatDisplayNameForGreeting(
        profile?.firstName || '',
        profile?.lastName || '',
        displayName,
        greeting.nameOrder,
        { primaryNameOnly: true }
    );
    const greetingContext = t(`hero.greetingFacts.${greeting.id}`, {
        defaultValue: greeting.context,
    });

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
        if (!DB_ENABLED) return;
        if (!isAuthenticated) return;
        let active = true;
        void syncTripsFromDb()
            .then(() => {
                if (!active) return;
                setTrips(getAllTrips());
            })
            .catch(() => {
                // Keep existing local snapshot when DB sync fails.
            });
        return () => {
            active = false;
        };
    }, [isAuthenticated]);

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

    const favoriteTripsCount = useMemo(
        () => trips.filter((trip) => Boolean(trip.isFavorite)).length,
        [trips]
    );
    const tripsForVisibilityPreview = useMemo(
        () => (showOnlyPublicTrips
            ? trips.filter((trip) => trip.showOnPublicProfile === true)
            : trips),
        [showOnlyPublicTrips, trips]
    );
    const pinnedTrips = useMemo(
        () => getPinnedTrips(tripsForVisibilityPreview),
        [tripsForVisibilityPreview]
    );
    const tripsForTab = useMemo(
        () => getTripsForProfileTab(tripsForVisibilityPreview, tab, recentSort),
        [tripsForVisibilityPreview, tab, recentSort]
    );
    const visibleTripsForTab = useMemo(
        () => tripsForTab.slice(0, visibleTripCount),
        [tripsForTab, visibleTripCount]
    );
    const hasMoreTripsForTab = visibleTripCount < tripsForTab.length;
    const skeletonTripCount = Math.max(0, Math.min(PROFILE_TRIPS_PAGE_SIZE, tripsForTab.length - visibleTripCount));

    const tabCounts = useMemo(() => ({
        recent: getRecentTrips(tripsForVisibilityPreview, recentSort).length,
        favorites: tripsForVisibilityPreview.filter((trip) => Boolean(trip.isFavorite)).length,
        all: tripsForVisibilityPreview.length,
        liked: 0,
    }), [tripsForVisibilityPreview, recentSort]);
    const selectedTripIdSet = useMemo(() => new Set(selectedTripIds), [selectedTripIds]);
    const selectedTripCount = selectedTripIds.length;
    const stampMetrics = useMemo(
        () => computeProfileStampMetrics(trips, {
            likesGiven: favoriteTripsCount,
            likesEarned: 0,
        }),
        [favoriteTripsCount, trips]
    );
    const stampProgress = useMemo(
        () => buildProfileStampProgress(stampMetrics),
        [stampMetrics]
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
    const [passportTriggerRect, setPassportTriggerRect] = useState<DOMRect | null>(null);

    const handleOpenPassportDialog = useCallback((rect?: DOMRect) => {
        trackEvent('profile__summary--open_stamps');
        if (rect) setPassportTriggerRect(rect);
        handlePassportDialogOpenChange(true);
    }, [handlePassportDialogOpenChange, trackEvent]);

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

    const clearSelectedTrips = useCallback(() => {
        setSelectedTripIds([]);
    }, []);

    useEffect(() => {
        clearSelectedTrips();
    }, [clearSelectedTrips, tab, recentSort, showOnlyPublicTrips]);

    useEffect(() => {
        const availableTripIds = new Set(tripsForVisibilityPreview.map((trip) => trip.id));
        setSelectedTripIds((current) => current.filter((tripId) => availableTripIds.has(tripId)));
    }, [tripsForVisibilityPreview]);

    const handleTripSelectionChange = useCallback((trip: ITrip, selected: boolean) => {
        setSelectedTripIds((current) => {
            if (selected) {
                if (current.includes(trip.id)) return current;
                return [...current, trip.id];
            }
            return current.filter((tripId) => tripId !== trip.id);
        });
    }, []);

    const replaceSelection = useCallback((
        tripIds: string[],
        eventName: 'profile__trip_select--visible' | 'profile__trip_select--expired' | 'profile__trip_select--examples'
    ) => {
        const nextIds = Array.from(new Set(tripIds));
        setSelectedTripIds(nextIds);
        trackEvent(eventName, {
            tab,
            selected_count: nextIds.length,
        });
    }, [tab]);

    const handleSelectVisibleTrips = useCallback(() => {
        replaceSelection(visibleTripsForTab.map((trip) => trip.id), 'profile__trip_select--visible');
    }, [replaceSelection, visibleTripsForTab]);

    const handleSelectExpiredTrips = useCallback(() => {
        replaceSelection(
            tripsForTab
                .filter((trip) => trip.status === 'expired' || isTripExpiredByTimestamp(trip.tripExpiresAt))
                .map((trip) => trip.id),
            'profile__trip_select--expired'
        );
    }, [replaceSelection, tripsForTab]);

    const handleSelectExampleTrips = useCallback(() => {
        replaceSelection(
            tripsForTab
                .filter((trip) => isExampleDerivedTrip(trip))
                .map((trip) => trip.id),
            'profile__trip_select--examples'
        );
    }, [replaceSelection, tripsForTab]);

    const handleEndSelection = useCallback(() => {
        if (selectedTripIds.length === 0) return;
        clearSelectedTrips();
        trackEvent('profile__trip_select--end', {
            tab,
        });
    }, [clearSelectedTrips, selectedTripIds.length, tab]);

    const archiveTripsByIds = useCallback(async (
        tripIds: string[],
        source: 'profile_single' | 'profile_batch'
    ): Promise<ITrip[]> => {
        const tripById = new Map(trips.map((trip) => [trip.id, trip]));
        const uniqueIds = Array.from(new Set(tripIds))
            .filter((tripId) => tripById.has(tripId));
        if (uniqueIds.length === 0) return [];

        let archivedIds = uniqueIds;
        if (DB_ENABLED) {
            const results = await Promise.all(uniqueIds.map(async (tripId) => ({
                tripId,
                archived: await dbArchiveTrip(tripId, {
                    source,
                    metadata: {
                        tab,
                        batch: source === 'profile_batch',
                    },
                }),
            })));
            archivedIds = results.filter((result) => result.archived).map((result) => result.tripId);
            if (archivedIds.length === 0) {
                await syncTripsFromDb();
                setTrips(getAllTrips());
            }
        }

        if (archivedIds.length === 0) return [];
        const archivedTrips = archivedIds
            .map((tripId) => tripById.get(tripId))
            .filter((trip): trip is ITrip => Boolean(trip));

        const archivedSet = new Set(archivedIds);
        setTrips((current) => current.filter((trip) => !archivedSet.has(trip.id)));
        archivedIds.forEach((tripId) => {
            deleteTrip(tripId);
            trackEvent(
                source === 'profile_batch' ? 'profile__trip_archive--batch' : 'profile__trip_archive--single',
                { trip_id: tripId, tab }
            );
        });

        return archivedTrips;
    }, [tab, trips]);

    const restoreArchivedTrips = useCallback(async (
        archivedTrips: ITrip[],
        source: 'profile_single' | 'profile_batch'
    ): Promise<number> => {
        if (archivedTrips.length === 0) return 0;

        const restoredAt = Date.now();
        const restoredTrips = archivedTrips.map((trip) => ({
            ...trip,
            status: 'active' as const,
            updatedAt: restoredAt,
        }));

        restoredTrips.forEach((trip) => saveTrip(trip, { preserveUpdatedAt: true }));
        if (DB_ENABLED) {
            await Promise.all(restoredTrips.map((trip) => dbUpsertTrip(trip)));
        }

        setTrips((current) => {
            const byId = new Map(current.map((trip) => [trip.id, trip]));
            restoredTrips.forEach((trip) => byId.set(trip.id, trip));
            return Array.from(byId.values()).sort((a, b) => b.updatedAt - a.updatedAt);
        });

        restoredTrips.forEach((trip) => {
            trackEvent('profile__trip_archive--undo', {
                trip_id: trip.id,
                tab,
                source,
            });
        });

        return restoredTrips.length;
    }, [tab]);

    const handleArchiveTrip = useCallback(async (trip: ITrip) => {
        const confirmed = await confirmDialog({
            title: t('archive.confirmSingleTitle'),
            message: (
                <p>{t('archive.confirmSingleMessage', { title: trip.title })}</p>
            ),
            confirmLabel: t('archive.confirmSingleButton'),
            cancelLabel: t('archive.cancel'),
            tone: 'danger',
        });
        if (!confirmed) return;

        const toastId = showAppToast({
            tone: 'loading',
            title: t('archive.inProgressSingleTitle'),
            description: t('archive.inProgressSingleMessage', { title: trip.title }),
            dismissible: false,
        });

        let archivedTrips: ITrip[] = [];
        try {
            archivedTrips = await archiveTripsByIds([trip.id], 'profile_single');
        } catch {
            archivedTrips = [];
        }

        if (archivedTrips.length === 0) {
            showAppToast({
                id: toastId,
                tone: 'error',
                title: t('archive.errorTitle'),
                description: t('archive.errorSingle'),
            });
            return;
        }
        clearSelectedTrips();
        showAppToast({
            id: toastId,
            tone: 'remove',
            title: t('archive.successSingle'),
            description: t('archive.successSingleMessage', { title: trip.title }),
            action: {
                label: t('archive.undoLabel'),
                onClick: () => {
                    void restoreArchivedTrips(archivedTrips, 'profile_single')
                        .then((restoredCount) => {
                            if (restoredCount === 0) {
                                showAppToast({
                                    tone: 'error',
                                    title: t('archive.undoErrorTitle'),
                                    description: t('archive.undoErrorSingle'),
                                });
                                return;
                            }
                            showAppToast({
                                tone: 'add',
                                title: t('archive.undoSuccessTitle'),
                                description: t('archive.undoSuccessSingleMessage', { title: trip.title }),
                            });
                        })
                        .catch(() => {
                            showAppToast({
                                tone: 'error',
                                title: t('archive.undoErrorTitle'),
                                description: t('archive.undoErrorSingle'),
                            });
                        });
                },
            },
        });
    }, [archiveTripsByIds, clearSelectedTrips, confirmDialog, restoreArchivedTrips, t]);

    const handleArchiveSelectedTrips = useCallback(async () => {
        if (selectedTripIds.length === 0) return;
        const confirmed = await confirmDialog({
            title: t('archive.confirmBatchTitle'),
            message: (
                <p>{t('archive.confirmBatchMessage', { count: selectedTripIds.length })}</p>
            ),
            confirmLabel: t('archive.confirmBatchButton', { count: selectedTripIds.length }),
            cancelLabel: t('archive.cancel'),
            tone: 'danger',
        });
        if (!confirmed) return;

        const toastId = showAppToast({
            tone: 'loading',
            title: t('archive.inProgressBatchTitle'),
            description: t('archive.inProgressBatchMessage', { count: selectedTripIds.length }),
            dismissible: false,
        });

        let archivedTrips: ITrip[] = [];
        try {
            archivedTrips = await archiveTripsByIds(selectedTripIds, 'profile_batch');
        } catch {
            archivedTrips = [];
        }

        if (archivedTrips.length === 0) {
            showAppToast({
                id: toastId,
                tone: 'error',
                title: t('archive.errorTitle'),
                description: t('archive.errorBatch'),
            });
            return;
        }
        clearSelectedTrips();
        const archivedTitles = archivedTrips
            .map((candidate) => candidate.title)
            .filter((candidate) => Boolean(candidate))
            .slice(0, 3)
            .map((title) => `“${title}”`)
            .join(', ');
        const hiddenCount = Math.max(0, archivedTrips.length - 3);
        const summarySuffix = hiddenCount > 0 ? ` +${hiddenCount}` : '';
        showAppToast({
            id: toastId,
            tone: 'remove',
            title: t('archive.successBatch', { count: archivedTrips.length }),
            description: `${archivedTitles}${summarySuffix}`,
            action: {
                label: t('archive.undoLabel'),
                onClick: () => {
                    void restoreArchivedTrips(archivedTrips, 'profile_batch')
                        .then((restoredCount) => {
                            if (restoredCount === 0) {
                                showAppToast({
                                    tone: 'error',
                                    title: t('archive.undoErrorTitle'),
                                    description: t('archive.undoErrorBatch'),
                                });
                                return;
                            }
                            showAppToast({
                                tone: 'add',
                                title: t('archive.undoSuccessTitle'),
                                description: t('archive.undoSuccessBatchMessage', { count: restoredCount }),
                            });
                        })
                        .catch(() => {
                            showAppToast({
                                tone: 'error',
                                title: t('archive.undoErrorTitle'),
                                description: t('archive.undoErrorBatch'),
                            });
                        });
                },
            },
        });
    }, [archiveTripsByIds, clearSelectedTrips, confirmDialog, restoreArchivedTrips, selectedTripIds, t]);

    useEffect(() => {
        if (selectedTripIds.length === 0) return;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Delete' && event.key !== 'Backspace') return;
            if (isEditableEventTarget(event.target)) return;
            event.preventDefault();
            void handleArchiveSelectedTrips();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [handleArchiveSelectedTrips, selectedTripIds.length]);

    useEffect(() => {
        if (selectedTripIds.length === 0) return;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            if (isEditableEventTarget(event.target)) return;
            event.preventDefault();
            clearSelectedTrips();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [clearSelectedTrips, selectedTripIds.length]);

    const handleToggleFavoriteSelectedTrips = useCallback(() => {
        if (selectedTripIds.length === 0) return;
        const selectedSet = new Set(selectedTripIds);
        const now = Date.now();
        const selectedTrips = trips.filter((trip) => selectedSet.has(trip.id));
        if (selectedTrips.length === 0) return;

        const updatedTrips = selectedTrips.map((trip) => ({
            ...trip,
            isFavorite: !Boolean(trip.isFavorite),
            updatedAt: now,
        }));
        const updatedById = new Map(updatedTrips.map((trip) => [trip.id, trip]));
        setTrips((current) => current.map((trip) => updatedById.get(trip.id) ?? trip));
        updatedTrips.forEach((trip) => persistTrip(trip));

        trackEvent('profile__trip_favorite--batch_toggle', {
            tab,
            selected_count: updatedTrips.length,
        });

        showAppToast({
            tone: 'update',
            title: t('selection.favoriteBatchUpdatedTitle'),
            description: t('selection.favoriteBatchUpdatedMessage', {
                count: updatedTrips.length,
            }),
        });
    }, [persistTrip, selectedTripIds, t, tab, trips]);

    const handleToggleVisibilitySelectedTrips = useCallback(() => {
        if (selectedTripIds.length === 0) return;
        const selectedSet = new Set(selectedTripIds);
        const now = Date.now();
        const selectedTrips = trips.filter((trip) => selectedSet.has(trip.id));
        if (selectedTrips.length === 0) return;

        const updatedTrips = selectedTrips.map((trip) => ({
            ...trip,
            showOnPublicProfile: trip.showOnPublicProfile === false,
            updatedAt: now,
        }));
        const updatedById = new Map(updatedTrips.map((trip) => [trip.id, trip]));
        setTrips((current) => current.map((trip) => updatedById.get(trip.id) ?? trip));
        updatedTrips.forEach((trip) => persistTrip(trip));

        trackEvent('profile__trip_visibility--batch_toggle', {
            tab,
            selected_count: updatedTrips.length,
        });

        showAppToast({
            tone: 'update',
            title: t('selection.visibilityBatchUpdatedTitle'),
            description: t('selection.visibilityBatchUpdatedMessage', {
                count: updatedTrips.length,
            }),
        });
    }, [persistTrip, selectedTripIds, t, tab, trips]);

    const handleOpenTrip = useCallback((trip: ITrip) => {
        trackEvent('profile__trip--open', { trip_id: trip.id, tab });
    }, [tab]);

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

    const inspirationPath = buildLocalizedMarketingPath('inspirationsCountryDetail', appLocale, {
        countryName: greeting.inspirationCountry,
    });

    if (!isLoading && !isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    return (
        <div className="flex min-h-screen flex-col bg-secondary">
            <SiteHeader />
            <main aria-busy={isProfileLoading || undefined} data-testid="profile-page-container" className="mx-auto w-full max-w-7xl flex-1 space-y-8 px-5 pb-14 pt-12 md:px-8 md:pt-14">
                {(!isProfileLoading || profile) && <ProfileHero
                    greeting={greeting.greeting}
                    name={greetingDisplayName}
                    transliteration={greeting.transliteration}
                    ipa={greeting.ipa}
                    context={greetingContext}
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
                />}

                {pinNotice && (
                    <section className="rounded-xl border border-accent-200 bg-accent-50 px-4 py-3 text-sm text-accent-900 dark:bg-accent-400/12 dark:text-accent-200 dark:border-accent-400/30">
                        {pinNotice}
                    </section>
                )}

                <ProfileHomeActions username={profile?.username} isAdmin={isAdmin} onOpenPassport={handleOpenPassportDialog} />

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
                                        archive: t('cards.actions.archive'),
                                        selectTrip: t('cards.actions.selectTrip'),
                                        makePublic: t('cards.actions.makePublic'),
                                        makePrivate: t('cards.actions.makePrivate'),
                                        pinnedTag: t('cards.pinnedTag'),
                                        expiredTag: t('cards.expiredTag'),
                                        expiredFallbackTitle: t('cards.expiredFallbackTitle'),
                                        generationFailedTag: t('cards.generationFailedTag'),
                                        mapUnavailable: t('cards.mapUnavailable'),
                                        mapLoading: t('cards.mapLoading'),
                                        creatorPrefix: t('cards.creatorPrefix'),
                                        hiddenTag: t('cards.hiddenTag'),
                                    }}
                                    onOpen={handleOpenTrip}
                                    onToggleFavorite={handleToggleFavorite}
                                    onTogglePin={handleTogglePin}
                                    onToggleVisibility={handleToggleVisibility}
                                    onArchive={handleArchiveTrip}
                                    onSelectionChange={handleTripSelectionChange}
                                    isSelectable
                                    isSelected={selectedTripIdSet.has(trip.id)}
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

                        {tab !== 'liked' && (
                            <label className="ms-auto inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground">
                                <span>{t('filters.showOnlyPublic')}</span>
                                <Switch
                                    checked={showOnlyPublicTrips}
                                    onCheckedChange={(checked) => setShowOnlyPublicTrips(Boolean(checked))}
                                    aria-label={t('filters.showOnlyPublic')}
                                />
                            </label>
                        )}

                        {tab === 'recent' && (
                            <div className="inline-flex items-center rounded-xl border border-border bg-card p-1">
                                <button
                                    type="button"
                                    onClick={() => handleRecentSortChange('created')}
                                    className={[
                                        'rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors',
                                        recentSort === 'created'
                                            ? 'bg-secondary text-accent-700 dark:text-accent-200'
                                            : 'text-muted-foreground hover:text-foreground',
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
                                            ? 'bg-secondary text-accent-700 dark:text-accent-200'
                                            : 'text-muted-foreground hover:text-foreground',
                                    ].join(' ')}
                                    {...getAnalyticsDebugAttributes('profile__recent_sort--updated')}
                                >
                                    {t('recentSort.updated')}
                                </button>
                            </div>
                        )}

                        {tab !== 'liked' && selectedTripCount > 0 && (
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-full border border-border bg-card px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                                    {t('selection.selectedCount', {
                                        count: selectedTripCount,
                                        total: tabCounts[tab] ?? tripsForTab.length,
                                    })}
                                </span>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={handleSelectVisibleTrips}
                                    className={profileSelectionActionClassName}
                                    {...getAnalyticsDebugAttributes('profile__trip_select--visible', { tab })}
                                >
                                    {t('selection.selectVisible')}
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={handleSelectExpiredTrips}
                                    className={cn(profileSelectionActionClassName, profileSelectionAmberClassName)}
                                    {...getAnalyticsDebugAttributes('profile__trip_select--expired', { tab })}
                                >
                                    {t('selection.selectExpired')}
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={handleSelectExampleTrips}
                                    className={cn(profileSelectionActionClassName, 'border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100 hover:text-sky-800 dark:border-sky-400/30 dark:bg-sky-400/12 dark:text-sky-200 dark:hover:bg-sky-400/20 dark:hover:text-sky-200')}
                                    {...getAnalyticsDebugAttributes('profile__trip_select--examples', { tab })}
                                >
                                    {t('selection.selectExamples')}
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={handleToggleFavoriteSelectedTrips}
                                    className={cn(profileSelectionActionClassName, profileSelectionAmberClassName)}
                                    {...getAnalyticsDebugAttributes('profile__trip_favorite--batch_toggle', {
                                        tab,
                                        selected_count: selectedTripCount,
                                    })}
                                >
                                    {t('selection.toggleFavorites')}
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="secondary"
                                    onClick={handleToggleVisibilitySelectedTrips}
                                    className={cn(profileSelectionActionClassName, 'border border-border')}
                                    {...getAnalyticsDebugAttributes('profile__trip_visibility--batch_toggle', {
                                        tab,
                                        selected_count: selectedTripCount,
                                    })}
                                >
                                    {t('selection.toggleVisibility')}
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => void handleArchiveSelectedTrips()}
                                    className={cn(profileSelectionActionClassName, 'border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100 hover:text-rose-800 dark:border-rose-400/30 dark:bg-rose-400/12 dark:text-rose-200 dark:hover:bg-rose-400/20 dark:hover:text-rose-200')}
                                    {...getAnalyticsDebugAttributes('profile__trip_archive--batch', {
                                        tab,
                                        selected_count: selectedTripCount,
                                    })}
                                >
                                    {t('selection.archiveSelected')}
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={handleEndSelection}
                                    className={profileSelectionActionClassName}
                                    {...getAnalyticsDebugAttributes('profile__trip_select--end', { tab })}
                                >
                                    {t('selection.end')}
                                </Button>
                                <span className="text-[11px] text-muted-foreground">{t('selection.hotkeyHint')}</span>
                            </div>
                        )}
                    </div>

                    {tab === 'liked' ? (
                        <div className="rounded-xl border border-dashed border-border bg-secondary px-4 py-8 text-center">
                            <p className="text-sm font-semibold text-foreground">{t('likedPlaceholder.title')}</p>
                            <p className="mt-1 text-sm text-muted-foreground">{t('likedPlaceholder.description')}</p>
                        </div>
                    ) : tripsForTab.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-border bg-secondary px-4 py-8 text-center">
                            <p className="text-sm font-semibold text-foreground">{t('empty.title')}</p>
                            <p className="mt-1 text-sm text-muted-foreground">{t('empty.description')}</p>
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
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
                                            archive: t('cards.actions.archive'),
                                            selectTrip: t('cards.actions.selectTrip'),
                                            makePublic: t('cards.actions.makePublic'),
                                            makePrivate: t('cards.actions.makePrivate'),
                                            pinnedTag: t('cards.pinnedTag'),
                                            expiredTag: t('cards.expiredTag'),
                                            expiredFallbackTitle: t('cards.expiredFallbackTitle'),
                                            generationFailedTag: t('cards.generationFailedTag'),
                                            mapUnavailable: t('cards.mapUnavailable'),
                                            mapLoading: t('cards.mapLoading'),
                                            creatorPrefix: t('cards.creatorPrefix'),
                                            hiddenTag: t('cards.hiddenTag'),
                                        }}
                                        onOpen={handleOpenTrip}
                                        onToggleFavorite={handleToggleFavorite}
                                        onTogglePin={handleTogglePin}
                                        onToggleVisibility={handleToggleVisibility}
                                        onArchive={handleArchiveTrip}
                                        onSelectionChange={handleTripSelectionChange}
                                        isSelectable
                                        isSelected={selectedTripIdSet.has(trip.id)}
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
                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
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

                {PASSPORT_FEATURE_ENABLED ? (
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
                        countryCode={profile?.country}
                        triggerRect={passportTriggerRect}
                    />
                ) : null}
            </main>
            <SiteFooter />
        </div>
    );
};
