import { useMemo, useReducer, type Dispatch } from 'react';
import {
    countUnratedCompletedRuns,
    filterAndSortBenchmarkRuns,
    hasActiveBenchmarkRunFilter,
    resolveAiBenchmarkWorkspaceTab,
    type BenchmarkRun,
} from '../aiBenchmarkRuns';
import {
    INITIAL_AI_BENCHMARK_WORKSPACE_STATE,
    aiBenchmarkWorkspaceReducer,
    type AiBenchmarkWorkspaceAction,
} from './aiBenchmarkWorkspaceState';

export type AiBenchmarkWorkspaceDispatch = Dispatch<AiBenchmarkWorkspaceAction>;

/** Tab, run filters and order, the inspected run, the prompt preview and the notices. */
export const useAiBenchmarkWorkspaceState = () => {
    const [state, dispatch] = useReducer(aiBenchmarkWorkspaceReducer, INITIAL_AI_BENCHMARK_WORKSPACE_STATE);
    return { state, dispatch };
};

/** What the runs table and the sheet show, derived from the runs on render. */
export const useAiBenchmarkRunView = (
    workspace: ReturnType<typeof useAiBenchmarkWorkspaceState>['state'],
    runs: BenchmarkRun[],
    hasSession: boolean,
) => {
    const { runFilters, runSortDirection, inspectedRunId, tab } = workspace;
    const displayRuns = useMemo(
        () => filterAndSortBenchmarkRuns(runs, runFilters, runSortDirection),
        [runs, runFilters, runSortDirection],
    );
    const unratedRunCount = useMemo(() => countUnratedCompletedRuns(runs), [runs]);
    const inspectedRun = useMemo(
        () => (inspectedRunId ? runs.find((run) => run.id === inspectedRunId) ?? null : null),
        [inspectedRunId, runs],
    );
    return {
        activeTab: resolveAiBenchmarkWorkspaceTab(tab, hasSession),
        displayRuns,
        runFiltersActive: hasActiveBenchmarkRunFilter(runFilters),
        unratedRunCount,
        inspectedRun,
    };
};
