import React from 'react';
import { Info } from '@phosphor-icons/react';
import { AdminEmptyState } from '../AdminEmptyState';
import type { BenchmarkRun, RunSortDirection } from '../aiBenchmarkRuns';
import { Button } from '../../ui/button';
import { Spinner } from '../../ui/spinner';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '../../ui/table';
import { AiBenchmarkRunRow, type AiBenchmarkRunRowProps } from './AiBenchmarkRunRow';

type RowHandlers = Pick<AiBenchmarkRunRowProps, 'onOpenDetails' | 'onRate' | 'onRerun' | 'onDownload' | 'onAbort'>;

/** The session's runs, or the loading, empty or "nothing matches" state. */
export const AiBenchmarkRunsTable: React.FC<RowHandlers & {
    runs: BenchmarkRun[];
    displayRuns: BenchmarkRun[];
    hasSession: boolean;
    loading: boolean;
    cancelling: boolean;
    sortDirection: RunSortDirection;
    ratingSavingRunId: string | null;
    commentSavingRunId: string | null;
    onGoToSetup: () => void;
    onResetFilters: () => void;
}> = ({
    runs,
    displayRuns,
    hasSession,
    loading,
    cancelling,
    sortDirection,
    ratingSavingRunId,
    commentSavingRunId,
    onGoToSetup,
    onResetFilters,
    ...rowHandlers
}) => {
    if (displayRuns.length === 0) {
        if (loading && runs.length === 0) {
            return (
                <div role="status" className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-border px-6 py-10 text-sm text-muted-foreground">
                    <Spinner className="size-4" />
                    Loading runs…
                </div>
            );
        }
        if (runs.length === 0) {
            return (
                <AdminEmptyState
                    title={hasSession ? 'No runs in this session yet' : 'No benchmark session yet'}
                    description="Pick a trip template and models in Setup, then run them."
                    action={(
                        <Button type="button" variant="outline" size="sm" onClick={onGoToSetup}>
                            Go to setup
                        </Button>
                    )}
                />
            );
        }
        return (
            <AdminEmptyState
                title="No runs match these filters"
                description="Reset the filters to see every run in this session."
                action={(
                    <Button type="button" variant="outline" size="sm" onClick={onResetFilters}>
                        Reset filters
                    </Button>
                )}
            />
        );
    }

    return (
        <div className="overflow-x-auto rounded-md border border-border">
            <Table>
                <TableHeader className="bg-secondary">
                    <TableRow className="hover:bg-transparent">
                        <TableHead className="ps-3" aria-sort={sortDirection === 'asc' ? 'ascending' : 'descending'}>Model</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Latency</TableHead>
                        <TableHead>Checks</TableHead>
                        <TableHead>
                            <span
                                className="inline-flex items-center gap-1"
                                data-tooltip="Exact provider cost when returned, otherwise the catalog estimate for that model."
                                tabIndex={0}
                            >
                                Cost
                                <Info aria-hidden="true" className="size-3.5" />
                            </span>
                        </TableHead>
                        <TableHead>Rating</TableHead>
                        <TableHead>Note</TableHead>
                        <TableHead className="w-10 pe-3"><span className="sr-only">Actions</span></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {displayRuns.map((run) => (
                        <AiBenchmarkRunRow
                            key={run.id}
                            run={run}
                            busy={loading}
                            cancelling={cancelling}
                            ratingSaving={ratingSavingRunId === run.id}
                            commentSaving={commentSavingRunId === run.id}
                            {...rowHandlers}
                        />
                    ))}
                </TableBody>
            </Table>
        </div>
    );
};
