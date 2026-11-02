import {
    DEFAULT_BENCHMARK_RUN_FILTERS,
    type AiBenchmarkWorkspaceTab,
    type BenchmarkRunFilters,
    type RunSortDirection,
} from '../aiBenchmarkRuns';

export interface PromptPreview {
    prompt: string;
    generatedAt: string;
}

/**
 * What the screen shows: the tab, the runs table's filters and order, the run
 * open in the sheet, the prompt preview, and the page-level error and notice.
 */
export interface AiBenchmarkWorkspaceState {
    /** null until the admin picks a tab: then a loaded session opens on its results. */
    tab: AiBenchmarkWorkspaceTab | null;
    runFilters: BenchmarkRunFilters;
    runSortDirection: RunSortDirection;
    inspectedRunId: string | null;
    promptPreview: PromptPreview | null;
    error: string | null;
    message: string | null;
}

export type AiBenchmarkWorkspaceAction =
    | { type: 'setTab'; tab: AiBenchmarkWorkspaceTab }
    | { type: 'patchRunFilters'; patch: Partial<BenchmarkRunFilters> }
    | { type: 'resetRunFilters' }
    | { type: 'toggleRunSort' }
    | { type: 'inspectRun'; runId: string | null }
    | { type: 'setPromptPreview'; preview: PromptPreview | null }
    | { type: 'setError'; error: string | null }
    | { type: 'setMessage'; message: string | null }
    | { type: 'queuedRunsFinished' }
    | { type: 'newSessionStarted' };

export const INITIAL_AI_BENCHMARK_WORKSPACE_STATE: AiBenchmarkWorkspaceState = {
    tab: null,
    runFilters: DEFAULT_BENCHMARK_RUN_FILTERS,
    runSortDirection: 'desc',
    inspectedRunId: null,
    promptPreview: null,
    error: null,
    message: null,
};

export const aiBenchmarkWorkspaceReducer = (
    state: AiBenchmarkWorkspaceState,
    action: AiBenchmarkWorkspaceAction,
): AiBenchmarkWorkspaceState => {
    switch (action.type) {
        case 'setTab':
            return { ...state, tab: action.tab };
        case 'patchRunFilters':
            return { ...state, runFilters: { ...state.runFilters, ...action.patch } };
        case 'resetRunFilters':
            return { ...state, runFilters: DEFAULT_BENCHMARK_RUN_FILTERS };
        case 'toggleRunSort':
            return { ...state, runSortDirection: state.runSortDirection === 'desc' ? 'asc' : 'desc' };
        case 'inspectRun':
            return { ...state, inspectedRunId: action.runId };
        case 'setPromptPreview':
            return { ...state, promptPreview: action.preview };
        case 'setError':
            return { ...state, error: action.error };
        case 'setMessage':
            return { ...state, message: action.message };
        case 'queuedRunsFinished':
            // Only replaces the "Queued …" notice of the run that just finished.
            return state.message && state.message.startsWith('Queued')
                ? { ...state, message: 'All queued runs finished.' }
                : state;
        case 'newSessionStarted':
            return { ...state, inspectedRunId: null, message: null, error: null, tab: 'setup' };
        default:
            return state;
    }
};
