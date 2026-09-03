import { AlertTriangle, ArrowLeft, Check, RotateCcw, Sparkles } from 'lucide-react';
import React, { useMemo, useState } from 'react';
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
import { Checkbox } from '../ui/checkbox';

type Operation = TripAgentChangeSetV1['operations'][number];

const OPERATION_GROUPS = ['itinerary', 'stays', 'trip'] as const;
type OperationGroup = typeof OPERATION_GROUPS[number];

const groupOf = (operation: Operation): OperationGroup => {
    if (operation.kind === 'update_trip') return 'trip';
    if (operation.kind === 'add_stay' || operation.kind === 'update_stay' || operation.kind === 'remove_stay') return 'stays';
    return 'itinerary';
};

export const formatOperationValue = (operation: Operation): string => {
    if (operation.kind === 'update_trip' || operation.kind === 'update_item' || operation.kind === 'update_stay') {
        return Object.entries(operation.changes)
            .map(([key, value]) => `${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`)
            .join(' · ');
    }
    if (operation.kind === 'add_item') return `Add ${operation.item.title}`;
    if (operation.kind === 'remove_item') return `Remove ${operation.targetLabel}`;
    if (operation.kind === 'move_item') return `Move to day ${operation.startDateOffset + 1}`;
    if (operation.kind === 'add_stay') return `Add ${operation.stay.name}`;
    if (operation.kind === 'remove_stay') return `Remove ${operation.targetLabel}`;
    if (operation.kind === 'replace_itinerary') return `Replace itinerary with ${operation.items.length} items`;
    return `Replace days ${operation.startOffset + 1}–${operation.endOffset}`;
};

const formatComparisonValue = (value: unknown): string => {
    if (value === undefined || value === null || value === '') return '—';
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
    return JSON.stringify(value);
};

export const describeOperationComparison = (
    trip: ITrip,
    operation: Operation,
    t: TFunction,
): { before: string; after: string } => {
    if (operation.kind === 'update_trip') {
        const before = Object.fromEntries(Object.keys(operation.changes).map((key) => [key, trip[key as keyof ITrip]]));
        return { before: formatComparisonValue(before), after: formatComparisonValue(operation.changes) };
    }
    if (operation.kind === 'update_item') {
        const item = trip.items.find((candidate) => candidate.id === operation.itemId);
        const before = Object.fromEntries(Object.keys(operation.changes).map((key) => [key, item?.[key as keyof typeof item]]));
        return { before: formatComparisonValue(before), after: formatComparisonValue(operation.changes) };
    }
    if (operation.kind === 'update_stay') {
        const stay = trip.items.find((candidate) => candidate.id === operation.cityId)?.hotels?.find((candidate) => candidate.id === operation.stayId);
        const before = Object.fromEntries(Object.keys(operation.changes).map((key) => [key, stay?.[key as keyof typeof stay]]));
        return { before: formatComparisonValue(before), after: formatComparisonValue(operation.changes) };
    }
    if (operation.kind === 'move_item') {
        const item = trip.items.find((candidate) => candidate.id === operation.itemId);
        return {
            before: t('tripAgent.dayValue', { day: (item?.startDateOffset ?? 0) + 1 }),
            after: t('tripAgent.dayValue', { day: operation.startDateOffset + 1 }),
        };
    }
    if (operation.kind === 'remove_item' || operation.kind === 'remove_stay') {
        return { before: operation.targetLabel, after: t('tripAgent.removed') };
    }
    if (operation.kind === 'add_item') return { before: '—', after: operation.item.title };
    if (operation.kind === 'add_stay') return { before: '—', after: operation.stay.name };
    if (operation.kind === 'replace_itinerary') {
        return {
            before: t('tripAgent.itemCount', { count: trip.items.length }),
            after: t('tripAgent.itemCount', { count: operation.items.length }),
        };
    }
    const currentCount = trip.items.filter((item) => (
        item.startDateOffset < operation.endOffset
        && item.startDateOffset + item.duration > operation.startOffset
    )).length;
    return {
        before: t('tripAgent.itemCount', { count: currentCount }),
        after: t('tripAgent.itemCount', { count: operation.items.length }),
    };
};

const tripDayCount = (trip: ITrip): number => trip.items.reduce(
    (total, item) => Math.max(total, Math.ceil(item.startDateOffset + item.duration)),
    0,
);

/**
 * Review flow for one proposal: pick the operations, look at the resulting trip
 * before anything is written, and only then apply.
 */
export const TripAgentProposalCard: React.FC<{
    trip: ITrip;
    changeSet: TripAgentChangeSetV1;
    onApplied: (trip: ITrip, versionId: string, label: string) => void;
}> = ({ trip, changeSet, onApplied }) => {
    const { t } = useTranslation('common');
    const [selected, setSelected] = useState(() => new Set(changeSet.operations.map((operation) => operation.id)));
    const [stage, setStage] = useState<'select' | 'preview'>('select');
    const [state, setState] = useState<'pending' | 'applying' | 'applied' | 'rejected' | 'error'>('pending');
    const [error, setError] = useState<{ code: string; message: string } | null>(null);

    const selectedIds = useMemo(
        () => changeSet.operations.filter((operation) => selected.has(operation.id)).map((operation) => operation.id),
        [changeSet.operations, selected],
    );

    const preview = useMemo(() => {
        if (stage !== 'preview' || selectedIds.length === 0) return null;
        try {
            const result = applyTripAgentOperations(trip, changeSet.operations, selectedIds);
            return {
                items: result.trip.items.length,
                days: tripDayCount(result.trip),
                noOpCount: result.noOpOperationIds.length,
                error: null as string | null,
            };
        } catch (previewError) {
            return {
                items: trip.items.length,
                days: tripDayCount(trip),
                noOpCount: 0,
                error: previewError instanceof Error ? previewError.message : 'Preview failed.',
            };
        }
    }, [changeSet.operations, selectedIds, stage, trip]);

    const groups = useMemo(() => OPERATION_GROUPS
        .map((group) => ({ group, operations: changeSet.operations.filter((operation) => groupOf(operation) === group) }))
        .filter((entry) => entry.operations.length > 0), [changeSet.operations]);

    const toggleOperation = (operationId: string) => {
        setSelected((current) => {
            const next = new Set(current);
            if (next.has(operationId)) next.delete(operationId);
            else next.add(operationId);
            return next;
        });
    };

    const apply = async () => {
        if (selectedIds.length === 0 || (state !== 'pending' && state !== 'error')) return;
        setState('applying');
        setError(null);
        try {
            const result = await applyTripAgentProposal(changeSet.tripId, changeSet.id, selectedIds);
            onApplied(result.trip, result.versionId, changeSet.summary);
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

    const reject = async () => {
        if (state !== 'pending') return;
        try {
            await rejectTripAgentProposal(changeSet.tripId, changeSet.id);
            setState('rejected');
            trackEvent('trip_agent__proposal--reject', { trip_id: changeSet.tripId, change_set_id: changeSet.id });
        } catch (nextError) {
            const info = readTripAgentError(nextError);
            setState('error');
            setError({ code: info.code, message: info.detail || info.message });
        }
    };

    const isLocked = state === 'applying' || state === 'applied' || state === 'rejected';

    return (
        <section
            className={`overflow-hidden rounded-2xl border bg-white shadow-sm ${state === 'error' ? 'border-rose-200' : 'border-accent-200'}`}
            aria-label={t('tripAgent.review')}
        >
            <div className="border-b border-accent-100 bg-accent-50/70 p-4">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-accent-700">
                    <Sparkles className="size-3.5" />
                    {stage === 'preview' ? t('tripAgent.previewTitle') : t('tripAgent.review')}
                </div>
                <h3 className="mt-2 text-sm font-semibold text-slate-950">{changeSet.summary}</h3>
                <p className="mt-1 text-xs text-slate-600">
                    {stage === 'preview'
                        ? t('tripAgent.previewHint')
                        : t('tripAgent.selectHint', { count: changeSet.operations.length })}
                </p>
            </div>

            {stage === 'select' ? (
                <div className="divide-y divide-slate-100">
                    {groups.map(({ group, operations }) => (
                        <fieldset key={group} className="p-4">
                            <legend className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                                {t(`tripAgent.operationGroups.${group}`)}
                            </legend>
                            <div className="space-y-2">
                                {operations.map((operation) => (
                                    <div
                                        key={operation.id}
                                        className={`flex gap-3 rounded-xl border p-3 transition-colors ${
                                            selected.has(operation.id)
                                                ? 'border-accent-300 bg-accent-50/60'
                                                : 'border-slate-200 hover:bg-slate-50'
                                        }`}
                                    >
                                        <Checkbox
                                            id={`trip-agent-operation-${operation.id}`}
                                            checked={selected.has(operation.id)}
                                            disabled={isLocked}
                                            onCheckedChange={() => toggleOperation(operation.id)}
                                            className="mt-0.5"
                                        />
                                        <label htmlFor={`trip-agent-operation-${operation.id}`} className="min-w-0 cursor-pointer">
                                            <span className="block text-sm font-medium text-slate-900">{operation.targetLabel}</span>
                                            <span className="mt-0.5 block text-xs text-slate-600">{formatOperationValue(operation)}</span>
                                            <span className="mt-1 block text-xs text-slate-500">{operation.rationale}</span>
                                        </label>
                                    </div>
                                ))}
                            </div>
                        </fieldset>
                    ))}
                </div>
            ) : (
                <div className="space-y-3 p-4">
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
                                {t('tripAgent.itemCount', { count: preview?.items ?? trip.items.length })} · {t('tripAgent.dayCount', { count: preview?.days ?? tripDayCount(trip) })}
                            </dd>
                        </div>
                    </dl>
                    <ul className="space-y-2">
                        {changeSet.operations.filter((operation) => selected.has(operation.id)).map((operation) => {
                            const comparison = describeOperationComparison(trip, operation, t);
                            return (
                                <li key={operation.id} className="rounded-xl border border-slate-200 p-3">
                                    <p className="text-sm font-medium text-slate-900">{operation.targetLabel}</p>
                                    <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                                        <span className="rounded-lg bg-slate-100 p-2 text-slate-600">
                                            <strong className="block font-semibold text-slate-800">{t('tripAgent.before')}</strong>{comparison.before}
                                        </span>
                                        <span className="rounded-lg bg-emerald-50 p-2 text-emerald-800">
                                            <strong className="block font-semibold text-emerald-900">{t('tripAgent.after')}</strong>{comparison.after}
                                        </span>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                    {preview?.error && (
                        <p className="rounded-xl bg-rose-50 p-2.5 text-xs text-rose-800" role="alert">{preview.error}</p>
                    )}
                    {!preview?.error && preview?.noOpCount ? (
                        <p className="rounded-xl bg-amber-50 p-2.5 text-xs text-amber-800" role="status">
                            {t('tripAgent.previewNoOp', { count: preview.noOpCount })}
                        </p>
                    ) : null}
                </div>
            )}

            {changeSet.sources.length > 0 && (
                <Sources className="mx-4 mt-1">
                    <SourcesTrigger count={changeSet.sources.length} />
                    <SourcesContent>
                        {changeSet.sources.map((source) => (
                            <Source key={source.id} href={source.url} title={source.title} />
                        ))}
                    </SourcesContent>
                </Sources>
            )}

            {state === 'error' && error && (
                <div className="mx-4 mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3" role="alert">
                    <p className="flex items-center gap-1.5 text-sm font-semibold text-rose-900">
                        <AlertTriangle className="size-4" />
                        {t([`tripAgent.errors.${error.code}`, 'tripAgent.errors.TRIP_AGENT_REQUEST_FAILED'])}
                    </p>
                    <p className="mt-1 break-words text-xs leading-5 text-rose-800">{error.message}</p>
                    <p className="mt-1 font-mono text-[10px] uppercase tracking-wide text-rose-600">{error.code}</p>
                </div>
            )}

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 p-3">
                {state === 'applied' ? (
                    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700">
                        <Check className="size-4" />{t('tripAgent.applied')}
                    </span>
                ) : state === 'rejected' ? (
                    <span className="text-sm text-slate-500">{t('tripAgent.keep')}</span>
                ) : stage === 'select' ? (
                    <>
                        <Button type="button" variant="ghost" size="sm" onClick={() => void reject()} disabled={isLocked}>
                            {t('tripAgent.keep')}
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            onClick={() => setStage('preview')}
                            disabled={selectedIds.length === 0 || isLocked}
                        >
                            {t('tripAgent.previewChanges', { count: selectedIds.length })}
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
                            disabled={selectedIds.length === 0 || state === 'applying' || Boolean(preview?.error)}
                        >
                            {state === 'error' ? <RotateCcw className="size-3.5" /> : null}
                            {state === 'error'
                                ? t('tripAgent.retryApply')
                                : t('tripAgent.apply', { count: selectedIds.length })}
                        </Button>
                    </>
                )}
            </div>
        </section>
    );
};
