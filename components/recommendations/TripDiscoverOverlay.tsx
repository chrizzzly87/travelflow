import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarPlus, RotateCcw, Sparkles, Trash2, X } from 'lucide-react';

import { Dialog, DialogContent, DialogTitle } from '../ui/dialog';
import { RecommendationSwipeDeck, type SwipeDecision } from './RecommendationSwipeDeck';
import { RecommendationMiniCard } from './RecommendationMiniCard';
import { RecommendationDetailDialog } from './RecommendationDetailDialog';
import { buildRecommendationDeck, loadRecommendationDataset } from '../../services/recommendationsService';
import {
    mergeRecommendationState,
    readStoredRecommendationState,
    writeStoredRecommendationState,
} from '../../services/recommendationReactionsStore';
import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';
import {
    buildActivityFromSavedRecommendation,
    savedToRecommendation,
    toSavedRecommendation,
    type Recommendation,
    type SavedRecommendation,
} from '../../shared/recommendations';
import type { ITimelineItem, ITrip, ITripRecommendationState } from '../../types';
import type { MobileDayPlanDay } from '../tripview/mobileDayPlanModel';

interface TripDiscoverOverlayProps {
    open: boolean;
    onClose: () => void;
    trip: ITrip;
    countryCodes: string[];
    days: MobileDayPlanDay[];
    canEdit: boolean;
    onRecommendationStateChange: (next: ITripRecommendationState) => void;
    onAddActivity: (item: Partial<ITimelineItem>) => void;
}

type DiscoverTab = 'discover' | 'saved' | 'skipped';

const EMPTY_STATE: ITripRecommendationState = { saved: [], dismissedIds: [] };

/**
 * The starting state is what the trip carries merged with what this device
 * remembers. Neither alone is enough: a shared or example trip can never be
 * written back, and a trip opened on a second device knows nothing local.
 */
const readInitialState = (trip: ITrip): ITripRecommendationState => mergeRecommendationState(
    trip.recommendationState,
    readStoredRecommendationState(trip.id),
);

export const TripDiscoverOverlay: React.FC<TripDiscoverOverlayProps> = ({
    open,
    onClose,
    trip,
    countryCodes,
    days,
    canEdit,
    onRecommendationStateChange,
    onAddActivity,
}) => {
    const [tab, setTab] = useState<DiscoverTab>('discover');
    const [pool, setPool] = useState<Recommendation[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [assigningId, setAssigningId] = useState<string | null>(null);
    const [openDetailId, setOpenDetailId] = useState<string | null>(null);
    const [lastDecision, setLastDecision] = useState<{ recommendation: Recommendation; decision: SwipeDecision } | null>(null);
    const [state, setState] = useState<ITripRecommendationState>(() => readInitialState(trip));

    /**
     * Every decision is written to both homes at once. The trip is the copy
     * other devices see; the device store is the one that always succeeds, and
     * without it a reload on a shared link lost everything.
     */
    const commitState = useCallback((next: ITripRecommendationState) => {
        setState(next);
        writeStoredRecommendationState(trip.id, next);
        onRecommendationStateChange(next);
    }, [onRecommendationStateChange, trip.id]);

    const savedIds = useMemo(() => new Set(state.saved.map((entry) => entry.recommendationId)), [state.saved]);
    const dismissedIds = useMemo(() => new Set(state.dismissedIds), [state.dismissedIds]);

    const cityNames = useMemo(
        () => trip.items
            .filter((item) => item.type === 'city')
            .map((item) => (item.title || item.location || '').trim())
            .filter(Boolean),
        [trip.items],
    );

    // Loading the dataset is a network/module fetch, which is exactly what an
    // effect is for; everything derived from it is computed during render.
    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        setIsLoading(true);

        Promise.all(countryCodes.map((code) => loadRecommendationDataset(code)))
            .then((datasets) => {
                if (cancelled) return;
                setPool(datasets.flatMap((dataset) => dataset?.recommendations ?? []));
            })
            .finally(() => {
                if (!cancelled) setIsLoading(false);
            });

        return () => { cancelled = true; };
    }, [countryCodes, open]);

    const byId = useMemo(
        () => new Map(pool.map((recommendation) => [recommendation.id, recommendation])),
        [pool],
    );

    const deck = useMemo(() => buildRecommendationDeck(
        pool.length > 0
            ? { countryCode: '', countryName: '', generatedAt: '', sourceName: null, recommendations: pool }
            : null,
        {
            cityNames,
            excludeIds: [...savedIds, ...dismissedIds],
        },
    ), [cityNames, dismissedIds, pool, savedIds]);

    /** A kept idea always has a card: the library row when it is loaded, the copy otherwise. */
    const savedCards = useMemo(
        () => state.saved.map((saved) => byId.get(saved.recommendationId) ?? savedToRecommendation(saved)),
        [byId, state.saved],
    );
    /** A skipped idea was never copied onto the trip, so it only exists while the library is loaded. */
    const skippedCards = useMemo(
        () => state.dismissedIds
            .map((id) => byId.get(id))
            .filter((entry): entry is Recommendation => Boolean(entry)),
        [byId, state.dismissedIds],
    );

    const applyDecision = useCallback((recommendation: Recommendation, decision: SwipeDecision) => {
        const next: ITripRecommendationState = decision === 'save'
            ? {
                saved: [...state.saved, toSavedRecommendation(recommendation, new Date().toISOString())],
                dismissedIds: state.dismissedIds,
            }
            : {
                saved: state.saved,
                dismissedIds: [...state.dismissedIds, recommendation.id],
            };
        setLastDecision({ recommendation, decision });
        commitState(next);
    }, [commitState, state]);

    const forget = useCallback((recommendationId: string) => {
        commitState({
            saved: state.saved.filter((entry) => entry.recommendationId !== recommendationId),
            dismissedIds: state.dismissedIds.filter((id) => id !== recommendationId),
        });
    }, [commitState, state]);

    const undoLastDecision = useCallback(() => {
        if (!lastDecision) return;
        trackEvent('trip_view__recommendation--undo', {
            trip_id: trip.id,
            recommendation_id: lastDecision.recommendation.id,
        });
        forget(lastDecision.recommendation.id);
        setLastDecision(null);
    }, [forget, lastDecision, trip.id]);

    const restoreSkipped = useCallback((recommendationId: string) => {
        trackEvent('trip_view__recommendation--restore', {
            trip_id: trip.id,
            recommendation_id: recommendationId,
        });
        forget(recommendationId);
        setOpenDetailId(null);
    }, [forget, trip.id]);

    const removeSaved = useCallback((recommendationId: string) => {
        forget(recommendationId);
        setOpenDetailId(null);
    }, [forget]);

    const assignToDay = useCallback((saved: SavedRecommendation, day: MobileDayPlanDay) => {
        trackEvent('trip_view__recommendation--assign', {
            trip_id: trip.id,
            recommendation_id: saved.recommendationId,
            day_offset: day.dayOffset,
        });
        onAddActivity(buildActivityFromSavedRecommendation(saved, day.dayOffset));
        removeSaved(saved.recommendationId);
        setAssigningId(null);
    }, [onAddActivity, removeSaved, trip.id]);

    const savedCount = state.saved.length;
    const skippedCount = state.dismissedIds.length;
    const openDetail = useMemo(() => {
        if (!openDetailId) return null;
        return [...savedCards, ...skippedCards].find((entry) => entry.id === openDetailId) ?? null;
    }, [openDetailId, savedCards, skippedCards]);
    const openDetailSaved = useMemo(
        () => state.saved.find((entry) => entry.recommendationId === openDetailId) ?? null,
        [openDetailId, state.saved],
    );

    const tabButtonClass = (value: DiscoverTab): string => (
        `inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-sm font-semibold transition-colors ${
            tab === value ? 'bg-white text-accent-600 shadow-sm' : 'text-slate-500'
        }`
    );

    return (
        <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
            {/*
              * A full surface rather than a bottom drawer: the deck already
              * lives inside the planner's own sheet, and a sheet inside a sheet
              * reads as redundant furniture. Radix still provides the dialog
              * semantics — focus trap, Escape, scroll lock, restored focus.
              */}
            <DialogContent
                size="lg"
                className="inset-0 left-0 top-0 h-dvh max-h-none w-full max-w-none translate-x-0 translate-y-0 rounded-none border-0"
            >
                <DialogTitle className="sr-only">Discover things to do</DialogTitle>
                <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
                    <div className="inline-flex items-center rounded-full bg-slate-100 p-0.5">
                        <button
                            type="button"
                            onClick={() => setTab('discover')}
                            aria-pressed={tab === 'discover'}
                            className={tabButtonClass('discover')}
                            {...getAnalyticsDebugAttributes('trip_view__recommendation_tab--discover', { trip_id: trip.id })}
                        >
                            <Sparkles size={15} />
                            Discover
                        </button>
                        <button
                            type="button"
                            onClick={() => setTab('saved')}
                            aria-pressed={tab === 'saved'}
                            data-testid="recommendation-saved-tab"
                            className={tabButtonClass('saved')}
                            {...getAnalyticsDebugAttributes('trip_view__recommendation_tab--saved', { trip_id: trip.id })}
                        >
                            Kept
                            {savedCount > 0 && (
                                <span className="rounded-full bg-accent-600 px-1.5 text-[11px] font-bold text-white">{savedCount}</span>
                            )}
                        </button>
                        <button
                            type="button"
                            onClick={() => setTab('skipped')}
                            aria-pressed={tab === 'skipped'}
                            data-testid="recommendation-skipped-tab"
                            className={tabButtonClass('skipped')}
                            {...getAnalyticsDebugAttributes('trip_view__recommendation_tab--skipped', { trip_id: trip.id })}
                        >
                            Skipped
                            {skippedCount > 0 && (
                                <span className="rounded-full bg-slate-400 px-1.5 text-[11px] font-bold text-white">{skippedCount}</span>
                            )}
                        </button>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex size-9 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100"
                        aria-label="Close discover"
                    >
                        <X size={18} />
                    </button>
                </header>

                {tab === 'discover' && (
                    isLoading ? (
                        <div className="flex flex-1 items-center justify-center text-sm text-slate-500">
                            Loading ideas…
                        </div>
                    ) : (
                        <RecommendationSwipeDeck
                            tripId={trip.id}
                            recommendations={deck}
                            onDecide={applyDecision}
                            onUndo={undoLastDecision}
                            canUndo={Boolean(lastDecision)}
                            emptyState={pool.length === 0 ? (
                                <>
                                    <p className="text-base font-semibold text-slate-900">No ideas for this trip yet</p>
                                    <p className="mt-1 text-sm text-slate-500">
                                        Recommendations are available for Taiwan so far.
                                    </p>
                                </>
                            ) : undefined}
                        />
                    )
                )}

                {tab === 'saved' && (
                    <div data-testid="recommendation-saved-list" className="min-h-0 flex-1 overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
                        {savedCount === 0 ? (
                            <p className="py-10 text-center text-sm text-slate-500">
                                Nothing kept yet. Swipe right on an idea to park it here.
                            </p>
                        ) : (
                            <ul className="flex flex-col gap-2">
                                {savedCards.map((recommendation) => (
                                    <li key={recommendation.id}>
                                        <RecommendationMiniCard
                                            recommendation={recommendation}
                                            onOpen={() => setOpenDetailId(recommendation.id)}
                                            action={(
                                                <button
                                                    type="button"
                                                    onClick={() => removeSaved(recommendation.id)}
                                                    className="inline-flex size-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-rose-600"
                                                    aria-label={`Remove ${recommendation.title}`}
                                                >
                                                    <Trash2 size={15} />
                                                </button>
                                            )}
                                        />
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}

                {tab === 'skipped' && (
                    <div data-testid="recommendation-skipped-list" className="min-h-0 flex-1 overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
                        {skippedCards.length === 0 ? (
                            <p className="py-10 text-center text-sm text-slate-500">
                                {skippedCount === 0
                                    ? 'Nothing skipped yet. Swipe left on an idea to move it here.'
                                    : 'These ideas are no longer in the library.'}
                            </p>
                        ) : (
                            <ul className="flex flex-col gap-2">
                                {skippedCards.map((recommendation) => (
                                    <li key={recommendation.id}>
                                        <RecommendationMiniCard
                                            recommendation={recommendation}
                                            onOpen={() => setOpenDetailId(recommendation.id)}
                                            action={(
                                                <button
                                                    type="button"
                                                    onClick={() => restoreSkipped(recommendation.id)}
                                                    data-testid="recommendation-restore"
                                                    className="inline-flex size-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-accent-600"
                                                    aria-label={`Put ${recommendation.title} back in the deck`}
                                                >
                                                    <RotateCcw size={15} />
                                                </button>
                                            )}
                                        />
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}

                <RecommendationDetailDialog
                    recommendation={openDetail}
                    tripId={trip.id}
                    onClose={() => { setOpenDetailId(null); setAssigningId(null); }}
                    actions={openDetail && openDetailSaved ? (
                        canEdit && (
                            assigningId === openDetailSaved.recommendationId ? (
                                <div className="flex flex-wrap gap-1.5">
                                    {days.map((day) => (
                                        <button
                                            key={day.dayOffset}
                                            type="button"
                                            onClick={() => assignToDay(openDetailSaved, day)}
                                            className="inline-flex min-h-9 items-center rounded-lg border border-slate-200 px-2.5 text-xs font-semibold text-slate-700 transition-colors hover:border-accent-300 hover:text-accent-700"
                                        >
                                            {day.weekdayLabel} {day.dayOfMonthLabel}
                                        </button>
                                    ))}
                                    <button
                                        type="button"
                                        onClick={() => setAssigningId(null)}
                                        className="inline-flex min-h-9 items-center rounded-lg px-2.5 text-xs font-semibold text-slate-500"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => setAssigningId(openDetailSaved.recommendationId)}
                                    data-testid="recommendation-assign"
                                    className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-accent-200 bg-accent-50 px-3 text-sm font-semibold text-accent-700 transition-colors hover:bg-accent-100"
                                >
                                    <CalendarPlus size={15} />
                                    Add to a day
                                </button>
                            )
                        )
                    ) : openDetail ? (
                        <button
                            type="button"
                            onClick={() => restoreSkipped(openDetail.id)}
                            className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                        >
                            <RotateCcw size={15} />
                            Put back in the deck
                        </button>
                    ) : undefined}
                />
            </DialogContent>
        </Dialog>
    );
};

export const EMPTY_RECOMMENDATION_STATE = EMPTY_STATE;
