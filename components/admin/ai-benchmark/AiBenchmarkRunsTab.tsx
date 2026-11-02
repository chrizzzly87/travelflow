import React from 'react';
import { AdminSectionHeader } from '../AdminSectionHeader';
import { AdminSurfaceCard } from '../AdminSurfaceCard';
import type { BenchmarkRun, BenchmarkRunFilters, BenchmarkSummary, RunSortDirection } from '../aiBenchmarkRuns';
import type { BenchmarkSession } from './aiBenchmarkApi';
import { AiBenchmarkRunFilters } from './AiBenchmarkRunFilters';
import { AiBenchmarkRunStats } from './AiBenchmarkRunStats';
import { AiBenchmarkRunsTable } from './AiBenchmarkRunsTable';
import { AiBenchmarkSessionMenus } from './AiBenchmarkSessionMenus';
import { hasExactRunCost, listRunProviders } from './aiBenchmarkModel';
import type { AiBenchmarkRunActions } from './useAiBenchmarkRunActions';

/** The Runs tab: summary tiles, then the session's runs with filters and menus. */
export const AiBenchmarkRunsTab: React.FC<{
    resultsSectionRef: React.Ref<HTMLDivElement>;
    session: BenchmarkSession | null;
    runs: BenchmarkRun[];
    displayRuns: BenchmarkRun[];
    summary: BenchmarkSummary | null;
    loading: boolean;
    cancelling: boolean;
    hasPendingRuns: boolean;
    ratingSavingRunId: string | null;
    commentSavingRunId: string | null;
    unratedRunCount: number;
    runFilters: BenchmarkRunFilters;
    runFiltersActive: boolean;
    runSortDirection: RunSortDirection;
    actions: AiBenchmarkRunActions;
    onPatchFilters: (patch: Partial<BenchmarkRunFilters>) => void;
    onResetFilters: () => void;
    onToggleSort: () => void;
    onGoToSetup: () => void;
}> = ({
    resultsSectionRef,
    session,
    runs,
    displayRuns,
    summary,
    loading,
    cancelling,
    hasPendingRuns,
    ratingSavingRunId,
    commentSavingRunId,
    unratedRunCount,
    runFilters,
    runFiltersActive,
    runSortDirection,
    actions,
    onPatchFilters,
    onResetFilters,
    onToggleSort,
    onGoToSetup,
}) => {
    const providerOptions = React.useMemo(() => listRunProviders(runs), [runs]);
    const hasExactCostData = React.useMemo(() => hasExactRunCost(runs), [runs]);

    return (
        <>
            {summary && runs.length > 0 && (
                <AiBenchmarkRunStats
                    summary={summary}
                    hasExactCostData={hasExactCostData}
                    unratedRunCount={unratedRunCount}
                    onlyUnrated={runFilters.onlyUnrated}
                    onShowUnrated={() => onPatchFilters({ onlyUnrated: true })}
                />
            )}

            <AdminSurfaceCard ref={resultsSectionRef} className="flex flex-col gap-4">
                <AdminSectionHeader
                    title="Runs"
                    description={session ? (
                        <>
                            {session.name || 'Unnamed session'}
                            <span aria-hidden="true"> · </span>
                            <span className="select-all font-mono text-xs">{session.share_token}</span>
                        </>
                    ) : 'No session loaded. Your next run starts a new one.'}
                    actions={(
                        <AiBenchmarkSessionMenus
                            hasSession={Boolean(session)}
                            exportDisabled={loading || !session || runs.length === 0}
                            sessionActionsDisabled={loading || cancelling || hasPendingRuns}
                            onExport={(includeLogs) => void actions.exportSessionZip(includeLogs)}
                            onStartNewSession={actions.startNewSession}
                            onDeleteSession={() => void actions.deleteSession()}
                        />
                    )}
                />

                <AiBenchmarkRunFilters
                    filters={runFilters}
                    filtersActive={runFiltersActive}
                    providerOptions={providerOptions}
                    sortDirection={runSortDirection}
                    onChange={onPatchFilters}
                    onReset={onResetFilters}
                    onToggleSort={onToggleSort}
                />

                <AiBenchmarkRunsTable
                    runs={runs}
                    displayRuns={displayRuns}
                    hasSession={Boolean(session)}
                    loading={loading}
                    cancelling={cancelling}
                    sortDirection={runSortDirection}
                    ratingSavingRunId={ratingSavingRunId}
                    commentSavingRunId={commentSavingRunId}
                    onGoToSetup={onGoToSetup}
                    onResetFilters={onResetFilters}
                    onOpenDetails={actions.openRunDetails}
                    onRate={(run, rating) => void actions.updateRunRating(run, rating)}
                    onRerun={(run) => void actions.rerunTarget(run)}
                    onDownload={actions.downloadRun}
                    onAbort={actions.cancelRun}
                />
            </AdminSurfaceCard>
        </>
    );
};
