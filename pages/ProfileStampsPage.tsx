import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Passport, SealCheck } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { SiteHeader } from '../components/navigation/SiteHeader';
import { ProfileStampCard } from '../components/profile/ProfileStampCard';
import type { ProfileStampGroup, ProfileStampProgress, ProfileStampSort } from '../components/profile/profileStamps';
import {
    buildProfileStampProgress,
    computeProfileStampMetrics,
    getLastAchievedStamps,
    sortProfileStamps,
} from '../components/profile/profileStamps';
import { useAuth } from '../hooks/useAuth';
import { getCurrentUserProfile } from '../services/profileService';
import { getAllTrips } from '../services/storageService';
import { getAnalyticsDebugAttributes, trackEvent } from '../services/analyticsService';
import { Select, SelectContent, SelectItem, SelectTrigger } from '../components/ui/select';
import { buildPath } from '../config/routes';

type StampGroupFilter = 'all' | ProfileStampGroup;

const STAMP_GROUP_FILTERS: StampGroupFilter[] = ['all', 'trips', 'curation', 'exploration', 'social', 'momentum'];
const STAMP_SORTS: ProfileStampSort[] = ['date', 'rarity', 'group'];

const normalizeStampSort = (value: string | null): ProfileStampSort => (
    value === 'rarity' || value === 'group' ? value : 'date'
);

const normalizeStampGroup = (value: string | null): StampGroupFilter => (
    value && STAMP_GROUP_FILTERS.includes(value as StampGroupFilter)
        ? value as StampGroupFilter
        : 'all'
);

const formatAchievementDate = (timestamp: number | null, locale: string): string | null => {
    if (!timestamp || !Number.isFinite(timestamp)) return null;
    return new Date(timestamp).toLocaleDateString(locale, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
};

const defaultStickerPosition = (index: number): { x: number; y: number } => {
    if (index === 0) return { x: 20, y: 36 };
    if (index === 1) return { x: 128, y: 84 };
    return { x: 74, y: 176 };
};

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

export const ProfileStampsPage: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { t, i18n } = useTranslation('profile');
    const { isLoading, isAuthenticated } = useAuth();

    const [displayName, setDisplayName] = useState<string>(t('fallback.displayName'));
    const [trips, setTrips] = useState(() => getAllTrips());
    const [selectedStampId, setSelectedStampId] = useState<string | null>(null);
    const [stickerPositions, setStickerPositions] = useState<Record<string, { x: number; y: number }>>({});

    const dragStateRef = useRef<{
        stampId: string;
        offsetX: number;
        offsetY: number;
    } | null>(null);
    const passportCanvasRef = useRef<HTMLDivElement | null>(null);

    const sortBy = normalizeStampSort(searchParams.get('sort'));
    const groupBy = normalizeStampGroup(searchParams.get('group'));
    const appLocale = i18n.resolvedLanguage ?? i18n.language ?? 'en';

    const refreshTrips = useCallback(() => {
        setTrips(getAllTrips());
    }, []);

    useEffect(() => {
        if (!isAuthenticated) return;
        let active = true;

        void getCurrentUserProfile()
            .then((profile) => {
                if (!active || !profile) return;
                const name = profile.displayName
                    || [profile.firstName, profile.lastName].filter(Boolean).join(' ')
                    || profile.username
                    || t('fallback.displayName');
                setDisplayName(name);
            })
            .catch(() => {
                if (!active) return;
                setDisplayName(t('fallback.displayName'));
            });

        return () => {
            active = false;
        };
    }, [isAuthenticated, t]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const sync = () => refreshTrips();
        window.addEventListener('storage', sync);
        window.addEventListener('tf:trips-updated', sync);
        return () => {
            window.removeEventListener('storage', sync);
            window.removeEventListener('tf:trips-updated', sync);
        };
    }, [refreshTrips]);

    useEffect(() => {
        const next = new URLSearchParams(searchParams);
        let changed = false;

        if (next.get('sort') !== sortBy) {
            next.set('sort', sortBy);
            changed = true;
        }
        if (next.get('group') !== groupBy) {
            next.set('group', groupBy);
            changed = true;
        }

        if (changed) {
            setSearchParams(next, { replace: true });
        }
    }, [groupBy, searchParams, setSearchParams, sortBy]);

    useEffect(() => {
        if (!isAuthenticated) return;
        trackEvent('profile__stamps--view');
    }, [isAuthenticated]);

    const stampMetrics = useMemo(() => computeProfileStampMetrics(trips, {
        likesGiven: trips.filter((trip) => Boolean(trip.isFavorite)).length,
        likesEarned: 0,
    }), [trips]);
    const allStampProgress = useMemo(
        () => buildProfileStampProgress(stampMetrics),
        [stampMetrics]
    );
    const recentStamps = useMemo(
        () => getLastAchievedStamps(allStampProgress, 3),
        [allStampProgress]
    );

    useEffect(() => {
        setStickerPositions((current) => {
            const next: Record<string, { x: number; y: number }> = {};
            recentStamps.forEach((stamp, index) => {
                next[stamp.definition.id] = current[stamp.definition.id] || defaultStickerPosition(index);
            });
            return next;
        });
    }, [recentStamps]);

    const visibleStamps = useMemo(() => {
        const filtered = groupBy === 'all'
            ? allStampProgress
            : allStampProgress.filter((stamp) => stamp.definition.group === groupBy);
        return sortProfileStamps(filtered, sortBy);
    }, [allStampProgress, groupBy, sortBy]);

    useEffect(() => {
        if (visibleStamps.length === 0) {
            setSelectedStampId(null);
            return;
        }
        if (!selectedStampId || !visibleStamps.some((stamp) => stamp.definition.id === selectedStampId)) {
            setSelectedStampId(visibleStamps[0].definition.id);
        }
    }, [selectedStampId, visibleStamps]);

    const selectedStamp = useMemo(
        () => visibleStamps.find((stamp) => stamp.definition.id === selectedStampId) || visibleStamps[0] || null,
        [selectedStampId, visibleStamps]
    );

    const handleSortChange = (nextSort: ProfileStampSort) => {
        const next = new URLSearchParams(searchParams);
        next.set('sort', nextSort);
        next.set('group', groupBy);
        setSearchParams(next);
        trackEvent(`profile__stamps_sort--${nextSort}`);
    };

    const handleGroupChange = (nextGroup: StampGroupFilter) => {
        const next = new URLSearchParams(searchParams);
        next.set('sort', sortBy);
        next.set('group', nextGroup);
        setSearchParams(next);
        trackEvent(`profile__stamps_group--${nextGroup}`);
    };

    const handleSelectStamp = (stamp: ProfileStampProgress) => {
        setSelectedStampId(stamp.definition.id);
        trackEvent('profile__stamp--select', { stamp_id: stamp.definition.id });
    };

    const handleHoverStamp = (stamp: ProfileStampProgress) => {
        setSelectedStampId(stamp.definition.id);
    };

    const handleStickerPointerDown = (
        event: React.PointerEvent<HTMLButtonElement>,
        stamp: ProfileStampProgress
    ) => {
        if (!passportCanvasRef.current) return;
        const stickerRect = event.currentTarget.getBoundingClientRect();
        dragStateRef.current = {
            stampId: stamp.definition.id,
            offsetX: event.clientX - stickerRect.left,
            offsetY: event.clientY - stickerRect.top,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
        setSelectedStampId(stamp.definition.id);
    };

    const handlePassportPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
        const dragState = dragStateRef.current;
        if (!dragState || !passportCanvasRef.current) return;
        const canvasRect = passportCanvasRef.current.getBoundingClientRect();
        const nextX = clamp(event.clientX - canvasRect.left - dragState.offsetX, 8, canvasRect.width - 108);
        const nextY = clamp(event.clientY - canvasRect.top - dragState.offsetY, 8, canvasRect.height - 116);

        setStickerPositions((current) => ({
            ...current,
            [dragState.stampId]: { x: nextX, y: nextY },
        }));
    };

    const handlePassportPointerUp = () => {
        const dragState = dragStateRef.current;
        if (!dragState) return;
        trackEvent('profile__passport_sticker--move', { stamp_id: dragState.stampId });
        dragStateRef.current = null;
    };

    if (!isLoading && !isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    const unlockedCount = allStampProgress.filter((stamp) => stamp.achieved).length;

    return (
        <div className="min-h-screen bg-slate-50">
            <SiteHeader hideCreateTrip />
            <main className="mx-auto w-full max-w-7xl space-y-8 px-5 pb-14 pt-8 md:px-8 md:pt-10">
                <section className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent-700">{t('stamps.eyebrow')}</p>
                    <h1 className="text-4xl font-black tracking-tight text-slate-900 md:text-5xl">{t('stamps.title')}</h1>
                    <p className="max-w-3xl text-sm leading-6 text-slate-600">
                        {t('stamps.description', { name: displayName })}
                    </p>
                </section>

                <section className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                    <article className="profile-passport-cover relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 px-6 py-6 text-slate-100">
                        <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">
                            <Passport size={15} weight="duotone" />
                            {t('stamps.passportTitle')}
                        </p>
                        <p className="mt-1 text-sm text-slate-300">{t('stamps.passportDescription')}</p>
                        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-300">
                            <span>{t('stamps.unlockedCount', { count: unlockedCount, total: allStampProgress.length })}</span>
                            <span>{t('stamps.lastUpdated', { count: recentStamps.length })}</span>
                        </div>

                        <div
                            ref={passportCanvasRef}
                            className="relative mt-5 h-[300px] overflow-hidden rounded-xl border border-slate-700 bg-slate-950/60"
                            onPointerMove={handlePassportPointerMove}
                            onPointerUp={handlePassportPointerUp}
                            onPointerLeave={handlePassportPointerUp}
                        >
                            {recentStamps.length === 0 ? (
                                <div className="absolute inset-0 flex items-center justify-center px-5 text-center text-sm text-slate-400">
                                    {t('stamps.passportEmpty')}
                                </div>
                            ) : (
                                recentStamps.map((stamp, index) => {
                                    const position = stickerPositions[stamp.definition.id] || defaultStickerPosition(index);
                                    return (
                                        <button
                                            key={`passport-sticker-${stamp.definition.id}`}
                                            type="button"
                                            onPointerDown={(event) => handleStickerPointerDown(event, stamp)}
                                            onClick={() => handleSelectStamp(stamp)}
                                            className="group absolute w-[98px] cursor-grab rounded-lg border border-white/25 bg-slate-100/95 p-1.5 text-left text-[10px] shadow-lg transition-transform active:cursor-grabbing"
                                            style={{
                                                left: `${position.x}px`,
                                                top: `${position.y}px`,
                                                transform: `rotate(${index % 2 === 0 ? '-6deg' : '5deg'})`,
                                            }}
                                        >
                                            <img
                                                src={stamp.definition.assetPath}
                                                alt={stamp.definition.title}
                                                className="h-[72px] w-full rounded object-cover"
                                                loading="lazy"
                                            />
                                            <span className="mt-1 block truncate font-semibold text-slate-700">{stamp.definition.title}</span>
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </article>

                    <article className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
                                <SealCheck size={16} weight="duotone" className="text-accent-600" />
                                {t('stamps.detailTitle')}
                            </p>
                            <button
                                type="button"
                                onClick={() => {
                                    trackEvent('profile__stamps_back--profile');
                                    navigate(buildPath('profile'));
                                }}
                                className="text-xs font-semibold text-slate-500 transition-colors hover:text-slate-700"
                                {...getAnalyticsDebugAttributes('profile__stamps_back--profile')}
                            >
                                {t('stamps.backToProfile')}
                            </button>
                        </div>

                        {selectedStamp ? (
                            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                                <p className="text-lg font-black tracking-tight text-slate-900">{selectedStamp.definition.title}</p>
                                <p className="text-sm text-slate-600">{selectedStamp.definition.description}</p>
                                <div className="grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
                                    <p>
                                        <span className="font-semibold text-slate-800">{t('stamps.detailRarity')}:</span>{' '}
                                        {selectedStamp.definition.rarityPercent}%
                                    </p>
                                    <p>
                                        <span className="font-semibold text-slate-800">{t('stamps.detailProgress')}:</span>{' '}
                                        {Math.floor(selectedStamp.currentValue)}/{selectedStamp.targetValue}
                                    </p>
                                    <p className="sm:col-span-2">
                                        <span className="font-semibold text-slate-800">{t('stamps.detailUnlocked')}:</span>{' '}
                                        {selectedStamp.achieved
                                            ? (formatAchievementDate(selectedStamp.achievedAt, appLocale) || t('stamps.detailUnlockedNow'))
                                            : t('stamps.detailLocked')}
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <p className="text-sm text-slate-500">{t('stamps.selectHint')}</p>
                        )}
                    </article>
                </section>

                <section className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="inline-flex items-center gap-2">
                            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{t('stamps.sortLabel')}</span>
                            <Select
                                value={sortBy}
                                onValueChange={(value) => handleSortChange(value as ProfileStampSort)}
                            >
                                <SelectTrigger className="h-9 min-w-[150px] rounded-md border-slate-300 text-sm">
                                    <span>{t(`stamps.sort.${sortBy}`)}</span>
                                </SelectTrigger>
                                <SelectContent>
                                    {STAMP_SORTS.map((sortOption) => (
                                        <SelectItem key={`stamp-sort-${sortOption}`} value={sortOption}>
                                            {t(`stamps.sort.${sortOption}`)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="inline-flex items-center gap-2">
                            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{t('stamps.groupLabel')}</span>
                            <Select
                                value={groupBy}
                                onValueChange={(value) => handleGroupChange(value as StampGroupFilter)}
                            >
                                <SelectTrigger className="h-9 min-w-[150px] rounded-md border-slate-300 text-sm">
                                    <span>{t(`stamps.group.${groupBy}`)}</span>
                                </SelectTrigger>
                                <SelectContent>
                                    {STAMP_GROUP_FILTERS.map((groupOption) => (
                                        <SelectItem key={`stamp-group-${groupOption}`} value={groupOption}>
                                            {t(`stamps.group.${groupOption}`)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {visibleStamps.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-600">
                            {t('stamps.empty')}
                        </div>
                    ) : (
                        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                            {visibleStamps.map((stamp) => (
                                <ProfileStampCard
                                    key={stamp.definition.id}
                                    stamp={stamp}
                                    selected={selectedStamp?.definition.id === stamp.definition.id}
                                    onSelect={handleSelectStamp}
                                    onHover={handleHoverStamp}
                                />
                            ))}
                        </div>
                    )}
                </section>
            </main>
        </div>
    );
};
