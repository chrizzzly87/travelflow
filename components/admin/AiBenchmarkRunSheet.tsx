import React, { useEffect, useState } from 'react';
import {
    ArrowClockwise,
    ArrowSquareOut,
    DownloadSimple,
    Smiley,
    SmileyMeh,
    SmileySad,
    StopCircle,
} from '@phosphor-icons/react';

import { AdminDetailSheet } from './AdminDetailSheet';
import { AdminSectionHeader } from './AdminSectionHeader';
import { AdminStatusBadge } from './AdminStatusBadge';
import { AiProviderLabel } from './AiProviderLogo';
import {
    BENCHMARK_RUN_COMMENT_MAX_LENGTH,
    buildRunErrorJson,
    buildRunValidationJson,
    formatDuration,
    formatTimestamp,
    formatUsd,
    getRunStatusMeta,
    getRunTimestampIso,
    getRunTotalTokens,
    getRunValidationVerdict,
    getValidationCheckStats,
    hasRunValidationDetails,
    isOptimisticRun,
    isRunActive,
    normalizeRunCommentDraft,
    parseRunError,
    type BenchmarkRun,
    type SatisfactionRating,
} from './aiBenchmarkRuns';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';
import { cn } from '../../lib/utils';

const SATISFACTION_META: Record<SatisfactionRating, { label: string; icon: React.ReactNode; activeClass: string }> = {
    good: {
        label: 'Good',
        icon: <Smiley size={14} weight="fill" />,
        activeClass: 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-400/12 dark:text-emerald-200 dark:hover:bg-emerald-400/20 dark:hover:text-emerald-100',
    },
    medium: {
        label: 'Medium',
        icon: <SmileyMeh size={14} weight="fill" />,
        activeClass: 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:text-amber-800 dark:border-amber-400/30 dark:bg-amber-400/12 dark:text-amber-200 dark:hover:bg-amber-400/20 dark:hover:text-amber-100',
    },
    bad: {
        label: 'Bad',
        icon: <SmileySad size={14} weight="fill" />,
        activeClass: 'border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100 hover:text-rose-800 dark:border-rose-400/30 dark:bg-rose-400/12 dark:text-rose-200 dark:hover:bg-rose-400/20 dark:hover:text-rose-100',
    },
};

const RATINGS = Object.keys(SATISFACTION_META) as SatisfactionRating[];

/** Final latency, or a once-per-second elapsed counter while the run is going. */
export const RunLatency: React.FC<{ run: BenchmarkRun }> = React.memo(({ run }) => {
    const startedMs = run.started_at ? Date.parse(run.started_at) : Number.NaN;
    const [elapsedMs, setElapsedMs] = useState(() => (
        Number.isFinite(startedMs) ? Math.max(0, Date.now() - startedMs) : 0
    ));

    // A wall-clock timer is an external system; it only runs while the row is running.
    useEffect(() => {
        if (run.status !== 'running' || !Number.isFinite(startedMs)) return;
        const updateElapsed = () => setElapsedMs(Math.max(0, Date.now() - startedMs));
        updateElapsed();
        const timer = window.setInterval(updateElapsed, 1000);
        return () => window.clearInterval(timer);
    }, [run.status, startedMs]);

    if (typeof run.latency_ms === 'number') {
        return <span className="tabular-nums">{formatDuration(run.latency_ms)}</span>;
    }
    if (run.status !== 'running' || !Number.isFinite(startedMs)) {
        return <span>—</span>;
    }
    return <span className="tabular-nums">{Math.floor(elapsedMs / 1000)} s</span>;
});

RunLatency.displayName = 'RunLatency';

/** Good / medium / bad toggles. Clicking the active rating clears it. */
export const RunRatingButtons: React.FC<{
    run: BenchmarkRun;
    disabled: boolean;
    onRate: (rating: SatisfactionRating | null) => void;
}> = ({ run, disabled, onRate }) => (
    <div className="flex items-center gap-1" role="group" aria-label={`Rating for run #${run.run_index}`}>
        {RATINGS.map((rating) => {
            const isActive = run.satisfaction_rating === rating;
            const meta = SATISFACTION_META[rating];
            return (
                <Button
                    key={rating}
                    type="button"
                    variant="outline"
                    size="icon-xs"
                    aria-label={`Mark run ${run.id} as ${meta.label}`}
                    aria-pressed={isActive}
                    data-tooltip={meta.label}
                    onClick={() => {
                        trackEvent('admin__ai_benchmark_run--rate', { rating: isActive ? 'cleared' : rating });
                        onRate(isActive ? null : rating);
                    }}
                    disabled={disabled}
                    className={isActive ? meta.activeClass : 'text-muted-foreground'}
                    {...getAnalyticsDebugAttributes('admin__ai_benchmark_run--rate', { rating })}
                >
                    {meta.icon}
                </Button>
            );
        })}
    </div>
);

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <div className="flex min-w-0 flex-col gap-0.5">
        <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
        <dd className="min-w-0 text-sm text-foreground">{children}</dd>
    </div>
);

const JsonBlock: React.FC<{ label: string; children: string }> = ({ label, children }) => (
    <pre
        aria-label={label}
        className="max-h-[40vh] overflow-auto rounded-md border border-slate-800 bg-slate-950 p-3 text-xs leading-relaxed text-slate-100"
    >
        <code className="language-json">{children}</code>
    </pre>
);

export interface AiBenchmarkRunSheetProps {
    /** The run to inspect; `null` closes the sheet. */
    run: BenchmarkRun | null;
    onOpenChange: (open: boolean) => void;
    /** Catalog estimate shown when the provider returned no exact cost. */
    costEstimateLabel: string | null;
    commentDraft: string;
    onCommentDraftChange: (value: string) => void;
    onSaveComment: () => void;
    commentSaving: boolean;
    onRate: (rating: SatisfactionRating | null) => void;
    ratingSaving: boolean;
    /** A page-level request is in flight (run, export, cleanup). */
    busy: boolean;
    cancelling: boolean;
    onRerun: () => void;
    onAbort: () => void;
    onDownload: () => void;
}

/**
 * The inspector for one benchmark run: what happened, the provider error and
 * validation payloads, and the admin's rating and note. Replaces the separate
 * error and validation modals so a run is reviewed in one place.
 *
 * Output is shown as stored; nothing here rewrites a run.
 */
export const AiBenchmarkRunSheet: React.FC<AiBenchmarkRunSheetProps> = ({
    run,
    onOpenChange,
    costEstimateLabel,
    commentDraft,
    onCommentDraftChange,
    onSaveComment,
    commentSaving,
    onRate,
    ratingSaving,
    busy,
    cancelling,
    onRerun,
    onAbort,
    onDownload,
}) => {
    if (!run) {
        return (
            <AdminDetailSheet open={false} onOpenChange={onOpenChange} title="Run details">
                {null}
            </AdminDetailSheet>
        );
    }

    const isPending = isRunActive(run);
    const statusMeta = getRunStatusMeta(run);
    const parsedError = run.error_message ? parseRunError(run.error_message) : null;
    const checkStats = getValidationCheckStats(run.validation_checks);
    const verdict = getRunValidationVerdict(run);
    const totalTokens = getRunTotalTokens(run);
    const canEditComment = !isPending && !isOptimisticRun(run);
    const normalizedDraft = normalizeRunCommentDraft(commentDraft);
    const isDirty = normalizedDraft !== normalizeRunCommentDraft(run.run_comment || '');
    const isTooLong = normalizedDraft.length > BENCHMARK_RUN_COMMENT_MAX_LENGTH;
    const canSaveComment = canEditComment && isDirty && !isTooLong && !commentSaving && !busy;

    return (
        <AdminDetailSheet
            open
            onOpenChange={onOpenChange}
            size="md"
            title={<AiProviderLabel provider={run.provider} model={run.model} logoSize={18} />}
            accessibleTitle={`${run.label || `${run.provider}:${run.model}`}, run #${run.run_index}`}
            subtitle={<span className="tabular-nums">Run #{run.run_index} · {formatTimestamp(getRunTimestampIso(run))}</span>}
            meta={<AdminStatusBadge tone={statusMeta.tone}>{statusMeta.label}</AdminStatusBadge>}
            headerActions={run.trip_id ? (
                <Button asChild variant="ghost" size="icon-sm">
                    <a
                        href={`/trip/${encodeURIComponent(run.trip_id)}`}
                        target="_blank"
                        rel="noreferrer"
                        aria-label="Open generated trip in a new tab"
                        data-tooltip="Open generated trip"
                        onClick={() => trackEvent('admin__ai_benchmark_run--open_trip')}
                        {...getAnalyticsDebugAttributes('admin__ai_benchmark_run--open_trip')}
                    >
                        <ArrowSquareOut />
                    </a>
                </Button>
            ) : null}
            footer={(
                <>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            trackEvent('admin__ai_benchmark_run--rerun', { source: 'sheet' });
                            onRerun();
                        }}
                        disabled={busy || cancelling || isPending}
                        {...getAnalyticsDebugAttributes('admin__ai_benchmark_run--rerun', { source: 'sheet' })}
                    >
                        <ArrowClockwise />
                        Rerun model
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                            trackEvent('admin__ai_benchmark_run--download', { source: 'sheet' });
                            onDownload();
                        }}
                        disabled={isPending}
                        {...getAnalyticsDebugAttributes('admin__ai_benchmark_run--download', { source: 'sheet' })}
                    >
                        <DownloadSimple />
                        Download JSON
                    </Button>
                    {isPending && (
                        <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            className="ms-auto"
                            onClick={() => {
                                trackEvent('admin__ai_benchmark_run--abort', { source: 'sheet' });
                                onAbort();
                            }}
                            disabled={cancelling || isOptimisticRun(run)}
                            {...getAnalyticsDebugAttributes('admin__ai_benchmark_run--abort', { source: 'sheet' })}
                        >
                            <StopCircle />
                            Abort run
                        </Button>
                    )}
                </>
            )}
        >
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
                <Field label="Latency"><RunLatency run={run} /></Field>
                <Field label="Cost">
                    {typeof run.cost_usd === 'number' && Number.isFinite(run.cost_usd) ? (
                        <span className="tabular-nums">{formatUsd(run.cost_usd)}</span>
                    ) : costEstimateLabel ? (
                        <span className="tabular-nums">{costEstimateLabel} <span className="text-xs text-muted-foreground">catalog est.</span></span>
                    ) : '—'}
                </Field>
                <Field label="Tokens">
                    <span className="tabular-nums">{totalTokens === null ? '—' : totalTokens.toLocaleString()}</span>
                </Field>
                <Field label="Validation">
                    {run.schema_valid === null ? '—' : (
                        <span className="tabular-nums">
                            {run.schema_valid ? 'Valid' : 'Invalid'}
                            {checkStats.total > 0 && ` · ${checkStats.passed}/${checkStats.total} checks`}
                        </span>
                    )}
                </Field>
                <Field label="Finished">
                    <span className="tabular-nums">{formatTimestamp(run.finished_at)}</span>
                </Field>
                <Field label="Trip">
                    {run.trip_id ? (
                        <a
                            href={`/trip/${encodeURIComponent(run.trip_id)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="font-medium text-accent-700 underline-offset-4 hover:underline dark:text-accent-200"
                        >
                            Open trip
                        </a>
                    ) : '—'}
                </Field>
            </dl>

            {parsedError && (
                <section className="flex flex-col gap-2 border-t border-border pt-4">
                    <AdminSectionHeader as="h3" title="Provider error" description="As the provider returned it, with nested JSON unwrapped." />
                    <p className="text-sm font-medium text-rose-700 dark:text-rose-300">{parsedError.shortMessage}</p>
                    <JsonBlock label="Provider error JSON">{buildRunErrorJson(run)}</JsonBlock>
                </section>
            )}

            <section className="flex flex-col gap-3 border-t border-border pt-4">
                <AdminSectionHeader
                    as="h3"
                    title="Rating and note"
                    description={canEditComment ? 'How good was this trip? Ratings feed the model comparison.' : 'You can rate and add a note once the run finishes.'}
                />
                <RunRatingButtons run={run} disabled={busy || isPending || ratingSaving || commentSaving} onRate={onRate} />
                <div className="flex flex-col gap-1.5">
                    <Textarea
                        aria-label={`Comment for run ${run.id}`}
                        value={commentDraft}
                        onChange={(event) => onCommentDraftChange(event.target.value)}
                        disabled={!canEditComment || commentSaving}
                        maxLength={BENCHMARK_RUN_COMMENT_MAX_LENGTH}
                        rows={4}
                        placeholder={canEditComment ? 'What stood out in this trip?' : 'Notes open when the run completes'}
                        className="resize-y text-sm"
                    />
                    <div className="flex items-center justify-between gap-2">
                        <span className={cn('text-xs tabular-nums', isTooLong ? 'text-rose-600 dark:text-rose-300' : 'text-muted-foreground')}>
                            {normalizedDraft.length}/{BENCHMARK_RUN_COMMENT_MAX_LENGTH}
                            {run.run_comment_updated_at && ` · saved ${formatTimestamp(run.run_comment_updated_at)}`}
                        </span>
                        <Button
                            type="button"
                            size="sm"
                            onClick={() => {
                                trackEvent('admin__ai_benchmark_run--save_note');
                                onSaveComment();
                            }}
                            disabled={!canSaveComment}
                            {...getAnalyticsDebugAttributes('admin__ai_benchmark_run--save_note')}
                        >
                            {commentSaving ? 'Saving…' : 'Save note'}
                        </Button>
                    </div>
                </div>
            </section>

            {hasRunValidationDetails(run) && (
                <section className="flex flex-col gap-2 border-t border-border pt-4">
                    <AdminSectionHeader
                        as="h3"
                        title="Validation"
                        actions={<AdminStatusBadge tone={verdict.tone}>{verdict.label}</AdminStatusBadge>}
                    />
                    <JsonBlock label="Validation JSON">{buildRunValidationJson(run)}</JsonBlock>
                </section>
            )}
        </AdminDetailSheet>
    );
};
