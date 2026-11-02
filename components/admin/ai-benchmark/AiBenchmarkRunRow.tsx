import React from 'react';
import { ArrowClockwise, ArrowSquareOut, DotsThree, DownloadSimple, NotePencil, StopCircle } from '@phosphor-icons/react';
import { trackEvent } from '../../../services/analyticsService';
import { AdminStatusBadge } from '../AdminStatusBadge';
import { AiProviderLabel as ProviderLabel } from '../AiProviderLogo';
import { RunLatency, RunRatingButtons } from '../AiBenchmarkRunSheet';
import { formatAdminRelativeTime } from '../adminRelativeTime';
import {
    formatTimestamp,
    formatUsd,
    getRunStatusMeta,
    getRunTimestampIso,
    getRunValidationVerdict,
    getValidationCheckStats,
    getValidationWarnings,
    hasRunValidationDetails,
    isOptimisticRun,
    isRunActive,
    normalizeRunCommentDraft,
    parseRunError,
    type BenchmarkRun,
    type SatisfactionRating,
} from '../aiBenchmarkRuns';
import { Button } from '../../ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '../../ui/dropdown-menu';
import { TableCell, TableRow } from '../../ui/table';
import { getModelCostEstimateLabel } from './aiBenchmarkModel';

export type RunDetailsSource = 'model' | 'status' | 'note' | 'menu';

export interface AiBenchmarkRunRowProps {
    run: BenchmarkRun;
    busy: boolean;
    cancelling: boolean;
    ratingSaving: boolean;
    commentSaving: boolean;
    onOpenDetails: (run: BenchmarkRun, source: RunDetailsSource) => void;
    onRate: (run: BenchmarkRun, rating: SatisfactionRating | null) => void;
    onRerun: (run: BenchmarkRun) => void;
    onDownload: (run: BenchmarkRun) => void;
    onAbort: (run: BenchmarkRun) => void;
}

const RunChecksCell: React.FC<{ run: BenchmarkRun }> = ({ run }) => {
    if (!hasRunValidationDetails(run) || run.schema_valid === null) {
        return <span className="text-muted-foreground">—</span>;
    }
    const validationStats = getValidationCheckStats(run.validation_checks);
    const warningCount = getValidationWarnings(run.validation_checks).length;
    const verdict = getRunValidationVerdict(run);
    return (
        <div className="flex flex-col items-start gap-1">
            <AdminStatusBadge tone={verdict.tone}>
                <span className="tabular-nums">
                    {run.schema_valid ? 'Valid' : 'Invalid'}
                    {validationStats.total > 0 && ` ${validationStats.passed}/${validationStats.total}`}
                </span>
            </AdminStatusBadge>
            {warningCount > 0 && (
                <span className="text-xs tabular-nums text-amber-700 dark:text-amber-200">
                    {warningCount} warning{warningCount === 1 ? '' : 's'}
                </span>
            )}
        </div>
    );
};

const RunCostCell: React.FC<{ run: BenchmarkRun }> = ({ run }) => {
    if (typeof run.cost_usd === 'number' && Number.isFinite(run.cost_usd)) return <>{formatUsd(run.cost_usd)}</>;
    const costEstimateLabel = getModelCostEstimateLabel(run.provider, run.model);
    if (!costEstimateLabel) return <span className="text-muted-foreground">—</span>;
    return (
        <span data-tooltip="Catalog estimate; the provider returned no cost.">
            {costEstimateLabel}
            <span className="ms-1 text-xs text-muted-foreground">est.</span>
        </span>
    );
};

const RunActionsMenu: React.FC<Pick<AiBenchmarkRunRowProps, 'run' | 'busy' | 'cancelling' | 'onOpenDetails' | 'onRerun' | 'onDownload' | 'onAbort'>> = ({
    run,
    busy,
    cancelling,
    onOpenDetails,
    onRerun,
    onDownload,
    onAbort,
}) => {
    const isPending = isRunActive(run);
    const isOptimistic = isOptimisticRun(run);
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Actions for run #${run.run_index} of ${run.label || run.model}`}
                    data-tooltip="Run actions"
                >
                    <DotsThree weight="bold" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[190px]">
                <DropdownMenuItem disabled={isOptimistic} onSelect={() => onOpenDetails(run, 'menu')}>
                    Open details
                </DropdownMenuItem>
                {run.trip_id && (
                    <DropdownMenuItem asChild>
                        <a
                            href={`/trip/${encodeURIComponent(run.trip_id)}`}
                            target="_blank"
                            rel="noreferrer"
                            onClick={() => trackEvent('admin__ai_benchmark_run--open_trip')}
                        >
                            <ArrowSquareOut />
                            Open trip
                        </a>
                    </DropdownMenuItem>
                )}
                <DropdownMenuItem
                    disabled={busy || cancelling || isPending}
                    onSelect={() => {
                        trackEvent('admin__ai_benchmark_run--rerun', { source: 'menu' });
                        onRerun(run);
                    }}
                >
                    <ArrowClockwise />
                    Rerun model
                </DropdownMenuItem>
                <DropdownMenuItem
                    disabled={isPending}
                    onSelect={() => {
                        trackEvent('admin__ai_benchmark_run--download', { source: 'menu' });
                        onDownload(run);
                    }}
                >
                    <DownloadSimple />
                    Download JSON
                </DropdownMenuItem>
                {isPending && (
                    <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            variant="destructive"
                            disabled={cancelling || isOptimistic}
                            onSelect={() => {
                                trackEvent('admin__ai_benchmark_run--abort', { source: 'menu' });
                                onAbort(run);
                            }}
                        >
                            <StopCircle />
                            Abort run
                        </DropdownMenuItem>
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
};

/** One run in the runs table: model, status, latency, checks, cost, rating, note and actions. */
export const AiBenchmarkRunRow: React.FC<AiBenchmarkRunRowProps> = ({
    run,
    busy,
    cancelling,
    ratingSaving,
    commentSaving,
    onOpenDetails,
    onRate,
    onRerun,
    onDownload,
    onAbort,
}) => {
    const isPending = isRunActive(run);
    const isOptimistic = isOptimisticRun(run);
    const statusMeta = getRunStatusMeta(run);
    const parsedError = run.error_message ? parseRunError(run.error_message) : null;
    const persistedComment = normalizeRunCommentDraft(run.run_comment || '');
    const canEditComment = !isPending && !isOptimistic;
    const runTimestamp = getRunTimestampIso(run);

    return (
        <TableRow className="[&>td]:align-top">
            <TableCell className="ps-3">
                <Button
                    type="button"
                    variant="link"
                    className="h-auto max-w-[260px] justify-start p-0 font-medium text-foreground"
                    onClick={() => onOpenDetails(run, 'model')}
                    disabled={isOptimistic}
                    aria-label={`Open run #${run.run_index} of ${run.label || run.model}`}
                >
                    <ProviderLabel provider={run.provider} model={run.model} />
                </Button>
                <div className="text-xs tabular-nums text-muted-foreground">
                    Run #{run.run_index}
                    <span aria-hidden="true"> · </span>
                    <span data-tooltip={formatTimestamp(runTimestamp)}>{formatAdminRelativeTime(runTimestamp)}</span>
                </div>
            </TableCell>
            <TableCell>
                <AdminStatusBadge tone={statusMeta.tone}>{statusMeta.label}</AdminStatusBadge>
                {parsedError && (
                    <div className="mt-1.5 flex max-w-[280px] flex-col items-start gap-1 whitespace-normal text-xs text-rose-700 dark:text-rose-200">
                        <div className="line-clamp-2 break-words">{parsedError.shortMessage}</div>
                        <Button
                            type="button"
                            variant="link"
                            size="xs"
                            className="h-auto p-0 text-xs"
                            onClick={() => onOpenDetails(run, 'status')}
                            disabled={isOptimistic}
                            aria-label={`Error details for run #${run.run_index}`}
                        >
                            Details
                        </Button>
                    </div>
                )}
            </TableCell>
            <TableCell className="text-sm text-foreground"><RunLatency run={run} /></TableCell>
            <TableCell className="text-sm"><RunChecksCell run={run} /></TableCell>
            <TableCell className="text-sm tabular-nums text-foreground"><RunCostCell run={run} /></TableCell>
            <TableCell>
                <RunRatingButtons
                    run={run}
                    disabled={busy || isPending || ratingSaving || commentSaving}
                    onRate={(rating) => onRate(run, rating)}
                />
            </TableCell>
            <TableCell>
                <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    className={persistedComment ? 'max-w-[200px] justify-start font-normal text-foreground' : 'text-muted-foreground'}
                    onClick={() => onOpenDetails(run, 'note')}
                    disabled={!canEditComment}
                    data-tooltip={persistedComment || undefined}
                    aria-label={persistedComment ? `Edit note for run #${run.run_index}` : `Add note for run #${run.run_index}`}
                >
                    {persistedComment ? (
                        <span className="truncate">{persistedComment}</span>
                    ) : (
                        <>
                            <NotePencil />
                            Add note
                        </>
                    )}
                </Button>
            </TableCell>
            <TableCell className="pe-3 text-end">
                <RunActionsMenu
                    run={run}
                    busy={busy}
                    cancelling={cancelling}
                    onOpenDetails={onOpenDetails}
                    onRerun={onRerun}
                    onDownload={onDownload}
                    onAbort={onAbort}
                />
            </TableCell>
        </TableRow>
    );
};
