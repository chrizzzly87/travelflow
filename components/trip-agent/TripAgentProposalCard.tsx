import { AlertTriangle, ArrowLeft, Check, Eye, RotateCcw } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

import type { ITrip } from '../../types';
import { applyTripAgentOperations, type TripAgentChangeSetV1 } from '../../shared/tripAgent';
import { trackEvent } from '../../services/analyticsService';
import {
    applyTripAgentProposal,
    readTripAgentError,
    rejectTripAgentProposal,
} from '../../services/tripAgentService';
import { Source, Sources, SourcesContent, SourcesTrigger } from '../ai-elements/sources';
import { Button } from '../ui/button';
import {
    Questionnaire,
    QuestionnaireChoice,
    QuestionnaireChoiceDescription,
    QuestionnaireChoices,
    QuestionnaireItem,
    QuestionnaireTitle,
} from '../ui/questionnaire';
import {
    groupTripAgentChanges,
    selectedOperationIdsForGroups,
    type TripAgentChangeGroup,
} from './tripAgentChangeGroups';

type Operation = TripAgentChangeSetV1['operations'][number];

const dayLabel = (t: TFunction, offset: number): string => t('tripAgent.dayValue', { day: Math.floor(offset) + 1 });

const describeGroup = (trip: ITrip, group: TripAgentChangeGroup, t: TFunction): string => {
    const operation = group.primary;
    const subject = group.subjectId
        ? trip.items.find((item) => item.id === group.subjectId)
        : undefined;
    if (operation.kind === 'remove_item' && subject && operation.itemId === subject.id && group.followUps.length > 0) {
        return t('tripAgent.groupRemoveCity', { label: subject.title, count: group.followUps.length });
    }
    if (operation.kind === 'remove_item') return t('tripAgent.groupRemove', { label: operation.targetLabel });
    if (operation.kind === 'add_item') {
        return t('tripAgent.groupAdd', { label: operation.item.title, day: Math.floor(operation.item.startDateOffset) + 1 });
    }
    if (operation.kind === 'move_item') {
        return t('tripAgent.groupMove', { label: operation.targetLabel, day: Math.floor(operation.startDateOffset) + 1 });
    }
    if (operation.kind === 'update_item') {
        const item = trip.items.find((candidate) => candidate.id === operation.itemId);
        if (operation.changes.duration !== undefined && item) {
            return t('tripAgent.groupDuration', {
                label: operation.targetLabel,
                from: item.duration,
                to: operation.changes.duration,
            });
        }
        return t('tripAgent.groupEdit', { label: operation.targetLabel });
    }
    if (operation.kind === 'add_stay') return t('tripAgent.groupAddStay', { label: operation.stay.name });
    if (operation.kind === 'remove_stay') return t('tripAgent.groupRemoveStay', { label: operation.targetLabel });
    if (operation.kind === 'update_stay') return t('tripAgent.groupEdit', { label: operation.targetLabel });
    if (operation.kind === 'update_trip') return t('tripAgent.groupTrip');
    if (operation.kind === 'replace_itinerary') {
        return t('tripAgent.groupReplace', { count: operation.items.length });
    }
    return t('tripAgent.groupReplaceSegment', {
        from: dayLabel(t, operation.startOffset),
        to: dayLabel(t, operation.endOffset - 1),
    });
};

/** Platform-native chord label for the preview toggle. */
const previewShortcutLabel = (): string => (
    typeof navigator !== 'undefined' && /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent)
        ? '⌘⇧P'
        : 'Ctrl+Shift+P'
);

/** First sentence, clipped: proposal summaries arrive as a paragraph. */
const shortSummary = (summary: string): string => {
    const firstSentence = summary.split(/(?<=[.!?])\s/)[0].trim() || summary.trim();
    return firstSentence.length > 90 ? `${firstSentence.slice(0, 87).trimEnd()}…` : firstSentence;
};

const tripDayCount = (trip: ITrip): number => trip.items.reduce(
    (total, item) => Math.max(total, Math.ceil(item.startDateOffset + item.duration)),
    0,
);

const countTouchedItems = (operations: Operation[]): number => new Set(operations.map((operation) => (
    'itemId' in operation ? operation.itemId : operation.id
))).size;

interface PreviewResult {
    trip: ITrip | null;
    noOpCount: number;
    skippedCount: number;
    error: string | null;
}

const computePreview = (
    trip: ITrip,
    operations: Operation[],
    selectedOperationIds: string[],
): PreviewResult | null => {
    if (selectedOperationIds.length === 0) return null;
    try {
        // The preview keeps the saved timestamp: everything keyed on updatedAt
        // (history, autosave, layout caches) must not treat it as a new version.
        const result = applyTripAgentOperations(trip, operations, selectedOperationIds, trip.updatedAt);
        return {
            trip: result.trip,
            noOpCount: result.noOpOperationIds.length,
            skippedCount: result.skippedOperations.length,
            error: null,
        };
    } catch (previewError) {
        return {
            trip: null,
            noOpCount: 0,
            skippedCount: 0,
            error: previewError instanceof Error ? previewError.message : 'Preview failed.',
        };
    }
};

/**
 * Review flow for one proposal: pick the changes, see them applied in the
 * planner itself, then commit. Nothing is written before the preview is
 * confirmed, and an applied set can be reverted in one click.
 */
export const TripAgentProposalCard: React.FC<{
    trip: ITrip;
    changeSet: TripAgentChangeSetV1;
    onApplied: (trip: ITrip, versionId: string, label: string) => void;
    onPreviewTrip?: (trip: ITrip | null) => void;
    onRevertLastChange?: () => void;
    /** Only the newest pending proposal answers the preview shortcut. */
    shortcutEnabled?: boolean;
    /** A newer proposal exists, so this one can no longer be applied. */
    isSuperseded?: boolean;
    onAskAgain?: () => void;
}> = ({
    trip,
    changeSet,
    onApplied,
    onPreviewTrip,
    onRevertLastChange,
    shortcutEnabled,
    isSuperseded,
    onAskAgain,
}) => {
    const { t } = useTranslation('common');
    const groups = useMemo(() => groupTripAgentChanges(trip, changeSet.operations), [changeSet.operations, trip]);
    const [selectedGroupIds, setSelectedGroupIds] = useState(() => groups.map((group) => group.id));
    const [stage, setStage] = useState<'select' | 'preview'>('select');
    const [state, setState] = useState<'pending' | 'applying' | 'applied' | 'reverted' | 'rejected' | 'error'>('pending');
    const [error, setError] = useState<{ code: string; message: string } | null>(null);
    const [applied, setApplied] = useState<{ count: number; requested: number } | null>(null);

    const selectedOperationIds = useMemo(
        () => selectedOperationIdsForGroups(groups, selectedGroupIds),
        [groups, selectedGroupIds],
    );

    const preview = useMemo(
        () => computePreview(trip, changeSet.operations, selectedOperationIds),
        [changeSet.operations, selectedOperationIds, trip],
    );

    const isPreviewing = stage === 'preview' && state === 'pending';

    // The planner shows the proposed trip while the preview is open. The trip
    // is recomputed here rather than taken from the memo above: publishing a
    // freshly built object on every render fed the preview back into the view
    // that produced it.
    const previewKey = isPreviewing ? selectedOperationIds.join('|') : '';
    const canonicalUpdatedAt = trip.updatedAt;
    useEffect(() => {
        if (!onPreviewTrip) return;
        if (!previewKey) {
            onPreviewTrip(null);
            return;
        }
        onPreviewTrip(computePreview(trip, changeSet.operations, previewKey.split('|'))?.trip || null);
        return () => onPreviewTrip(null);
        // Keyed by the saved trip's timestamp and the immutable change set, so a
        // re-render with an equal-but-new object does not republish the preview.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [canonicalUpdatedAt, changeSet.id, onPreviewTrip, previewKey]);

    // A chord, so it also works while the message box has focus, where a bare
    // letter would simply be typed.
    useEffect(() => {
        if (!shortcutEnabled || state !== 'pending') return;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key.toLowerCase() !== 'p' || !event.shiftKey) return;
            if (!event.metaKey && !event.ctrlKey) return;
            event.preventDefault();
            setStage((current) => (current === 'preview' ? 'select' : 'preview'));
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [shortcutEnabled, state]);

    const apply = async () => {
        if (selectedOperationIds.length === 0 || (state !== 'pending' && state !== 'error')) return;
        setState('applying');
        setError(null);
        try {
            const result = await applyTripAgentProposal(changeSet.tripId, changeSet.id, selectedOperationIds);
            onPreviewTrip?.(null);
            onApplied(result.trip, result.versionId, changeSet.summary);
            setApplied({ count: result.appliedOperationIds.length, requested: selectedOperationIds.length });
            if (result.appliedOperationIds.length < selectedOperationIds.length) {
                // The reviewer saw these changes in the preview, so a change the
                // server could not replay has to be said out loud.
                console.warn('[trip-agent] applied fewer changes than requested', {
                    changeSetId: changeSet.id,
                    requested: selectedOperationIds.length,
                    applied: result.appliedOperationIds.length,
                    noOp: result.noOpOperationIds,
                    skipped: result.skippedOperations,
                });
            }
            setState('applied');
            trackEvent('trip_agent__proposal--apply', {
                trip_id: changeSet.tripId,
                change_set_id: changeSet.id,
                operation_count: result.appliedOperationIds.length,
            });
        } catch (nextError) {
            const info = readTripAgentError(nextError);
            setState('error');
            setError({ code: info.code, message: info.detail || info.message });
        }
    };

    const reject = () => {
        if (state !== 'pending') return;
        onPreviewTrip?.(null);
        setStage('select');
        setState('rejected');
        trackEvent('trip_agent__proposal--reject', { trip_id: changeSet.tripId, change_set_id: changeSet.id });
        // The card closes right away; recording the rejection is bookkeeping.
        void rejectTripAgentProposal(changeSet.tripId, changeSet.id).catch(() => undefined);
    };

    const revert = () => {
        onRevertLastChange?.();
        setState('reverted');
        trackEvent('trip_agent__proposal--revert', { trip_id: changeSet.tripId, change_set_id: changeSet.id });
    };

    if (isSuperseded && state === 'pending') {
        return (
            <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                {t('tripAgent.superseded')}
            </p>
        );
    }

    if (state === 'applied' || state === 'reverted' || state === 'rejected') {
        return (
            <section
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
                aria-label={t('tripAgent.review')}
            >
                {state === 'applied' ? <Check className="size-4 shrink-0 text-emerald-600" /> : null}
                <span className="min-w-0 flex-1 text-xs text-slate-700">
                    {state === 'applied'
                        ? (applied && applied.count < applied.requested
                            ? t('tripAgent.appliedPartial', { count: applied.count, requested: applied.requested })
                            : t('tripAgent.appliedCount', { count: applied?.count ?? selectedOperationIds.length }))
                        : state === 'reverted' ? t('tripAgent.reverted') : t('tripAgent.discarded')}
                </span>
                {state === 'applied' && onRevertLastChange && (
                    <Button type="button" variant="ghost" size="sm" onClick={revert}>
                        <RotateCcw className="size-3.5" />{t('tripAgent.revert')}
                    </Button>
                )}
                {state === 'rejected' && onAskAgain && (
                    <Button type="button" variant="ghost" size="sm" onClick={onAskAgain}>
                        {t('tripAgent.askAgain')}
                    </Button>
                )}
            </section>
        );
    }

    return (
        <section
            className={`overflow-hidden rounded-2xl border bg-white shadow-sm ${state === 'error' ? 'border-rose-200' : 'border-slate-200'}`}
            aria-label={t('tripAgent.review')}
        >
            <header className="border-b border-slate-100 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-accent-700">
                    {stage === 'preview' ? t('tripAgent.eyebrowPreview') : t('tripAgent.eyebrowReview')}
                </p>
                <h3 className="mt-1 text-sm font-semibold leading-5 text-slate-950">{shortSummary(changeSet.summary)}</h3>
                <p className="mt-0.5 text-xs text-slate-500">
                    {stage === 'preview' ? t('tripAgent.previewHint') : t('tripAgent.selectHint')}
                </p>
            </header>

            {stage === 'select' ? (
                <div className="px-4 py-3">
                    <Questionnaire>
                        <QuestionnaireItem>
                            <QuestionnaireTitle className="sr-only">{t('tripAgent.review')}</QuestionnaireTitle>
                            <QuestionnaireChoices
                                type="multiple"
                                value={selectedGroupIds}
                                onValueChange={setSelectedGroupIds}
                                disabled={state !== 'pending'}
                            >
                                {groups.map((group) => (
                                    <QuestionnaireChoice key={group.id} value={group.id} className="min-h-0 gap-2 p-2">
                                        <span className="text-[13px] font-medium leading-5 text-slate-900">
                                            {describeGroup(trip, group, t)}
                                        </span>
                                        <QuestionnaireChoiceDescription className="mt-0 line-clamp-2 text-[11px] leading-4">
                                            {group.followUps.length > 0
                                                ? `${group.primary.rationale} · ${t('tripAgent.groupShifts', { count: countTouchedItems(group.followUps) })}`
                                                : group.primary.rationale}
                                        </QuestionnaireChoiceDescription>
                                    </QuestionnaireChoice>
                                ))}
                            </QuestionnaireChoices>
                        </QuestionnaireItem>
                    </Questionnaire>
                </div>
            ) : (
                <div className="space-y-2 px-4 py-3">
                    <p className="flex items-center gap-1.5 rounded-xl bg-accent-50 px-2.5 py-2 text-xs font-medium text-accent-900">
                        <Eye className="size-3.5 shrink-0" />
                        {t('tripAgent.previewLive')}
                    </p>
                    <dl className="grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-xl bg-slate-100 p-2.5">
                            <dt className="font-semibold text-slate-800">{t('tripAgent.before')}</dt>
                            <dd className="mt-0.5 text-slate-600">
                                {t('tripAgent.itemCount', { count: trip.items.length })} · {t('tripAgent.dayCount', { count: tripDayCount(trip) })}
                            </dd>
                        </div>
                        <div className="rounded-xl bg-emerald-50 p-2.5">
                            <dt className="font-semibold text-emerald-900">{t('tripAgent.after')}</dt>
                            <dd className="mt-0.5 text-emerald-800">
                                {t('tripAgent.itemCount', { count: preview?.trip?.items.length ?? trip.items.length })} · {t('tripAgent.dayCount', { count: preview?.trip ? tripDayCount(preview.trip) : tripDayCount(trip) })}
                            </dd>
                        </div>
                    </dl>
                    <ul className="space-y-1">
                        {groups.filter((group) => selectedGroupIds.includes(group.id)).map((group) => (
                            <li key={group.id} className="flex gap-2 text-xs text-slate-700">
                                <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
                                <span className="min-w-0">{describeGroup(trip, group, t)}</span>
                            </li>
                        ))}
                    </ul>
                    {preview?.error && (
                        <p className="rounded-xl bg-rose-50 p-2.5 text-xs text-rose-800" role="alert">{preview.error}</p>
                    )}
                    {!preview?.error && preview?.skippedCount ? (
                        <p className="rounded-xl bg-amber-50 p-2.5 text-xs text-amber-800" role="status">
                            {t('tripAgent.previewSkipped', { count: preview.skippedCount })}
                        </p>
                    ) : null}
                    {!preview?.error && preview?.noOpCount ? (
                        <p className="rounded-xl bg-amber-50 p-2.5 text-xs text-amber-800" role="status">
                            {t('tripAgent.previewNoOp', { count: preview.noOpCount })}
                        </p>
                    ) : null}
                </div>
            )}

            {changeSet.sources.length > 0 && (
                <Sources className="mx-4">
                    <SourcesTrigger count={changeSet.sources.length} />
                    <SourcesContent>
                        {changeSet.sources.map((source) => (
                            <Source key={source.id} href={source.url} title={source.title} />
                        ))}
                    </SourcesContent>
                </Sources>
            )}

            {state === 'error' && error && (
                <div className="mx-4 mb-1 rounded-xl border border-rose-200 bg-rose-50 p-3" role="alert">
                    <p className="flex items-center gap-1.5 text-sm font-semibold text-rose-900">
                        <AlertTriangle className="size-4" />
                        {t([`tripAgent.errors.${error.code}`, 'tripAgent.errors.TRIP_AGENT_REQUEST_FAILED'])}
                    </p>
                    <p className="mt-1 break-words text-xs leading-5 text-rose-800">{error.message}</p>
                </div>
            )}

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 p-3">
                {stage === 'select' ? (
                    <>
                        <Button type="button" variant="ghost" size="sm" onClick={reject} disabled={state === 'applying'}>
                            {t('tripAgent.discard')}
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            onClick={() => setStage('preview')}
                            disabled={selectedOperationIds.length === 0}
                            title={shortcutEnabled ? previewShortcutLabel() : undefined}
                        >
                            <Eye className="size-3.5" />{t('tripAgent.preview')}
                            {shortcutEnabled && (
                                <kbd className="ms-1 rounded border border-white/30 px-1 text-[10px] font-medium opacity-80">
                                    {previewShortcutLabel()}
                                </kbd>
                            )}
                        </Button>
                    </>
                ) : (
                    <>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setStage('select')} disabled={state === 'applying'}>
                            <ArrowLeft className="size-3.5" />{t('tripAgent.backToSelection')}
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            onClick={() => void apply()}
                            disabled={selectedOperationIds.length === 0 || state === 'applying' || Boolean(preview?.error)}
                        >
                            {state === 'error' ? <RotateCcw className="size-3.5" /> : null}
                            {state === 'error' ? t('tripAgent.retryApply') : t('tripAgent.applyCount', { count: selectedOperationIds.length })}
                        </Button>
                    </>
                )}
            </div>
        </section>
    );
};
