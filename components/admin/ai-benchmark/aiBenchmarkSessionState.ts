import { summarizeRunsLocal, type BenchmarkRun, type BenchmarkSummary } from '../aiBenchmarkRuns';
import type { BenchmarkSession } from './aiBenchmarkApi';
import { markOptimisticRunsFailed, syncRunCommentDrafts } from './aiBenchmarkModel';

/**
 * The loaded session and its runs, the request flags, and judging: which run's
 * rating or note is saving, and the unsaved note of every run. Every change to
 * the runs also re-derives the summary and keeps the note drafts in step.
 */
export interface AiBenchmarkSessionState {
    session: BenchmarkSession | null;
    runs: BenchmarkRun[];
    summary: BenchmarkSummary | null;
    loading: boolean;
    cancelling: boolean;
    ratingSavingRunId: string | null;
    commentSavingRunId: string | null;
    commentDrafts: Record<string, string>;
}

export type AiBenchmarkSessionAction =
    | { type: 'setLoading'; loading: boolean }
    | { type: 'setCancelling'; cancelling: boolean }
    | { type: 'sessionLoaded'; session: BenchmarkSession | null; runs: BenchmarkRun[]; summary?: BenchmarkSummary }
    | { type: 'setSession'; session: BenchmarkSession }
    | { type: 'runsReceived'; runs: BenchmarkRun[]; summary?: BenchmarkSummary }
    | { type: 'optimisticRunsAdded'; runs: BenchmarkRun[] }
    | { type: 'optimisticRunsFailed'; finishedAtIso: string }
    | { type: 'runUpdated'; run: BenchmarkRun }
    | { type: 'sessionCleared' }
    | { type: 'setRatingSaving'; runId: string | null }
    | { type: 'setCommentSaving'; runId: string | null }
    | { type: 'editCommentDraft'; runId: string; value: string };

export const INITIAL_AI_BENCHMARK_SESSION_STATE: AiBenchmarkSessionState = {
    session: null,
    runs: [],
    summary: null,
    loading: false,
    cancelling: false,
    ratingSavingRunId: null,
    commentSavingRunId: null,
    commentDrafts: {},
};

const withRuns = (
    state: AiBenchmarkSessionState,
    runs: BenchmarkRun[],
    summary: BenchmarkSummary | null,
): AiBenchmarkSessionState => ({
    ...state,
    runs,
    summary,
    commentDrafts: syncRunCommentDrafts(state.commentDrafts, runs),
});

export const aiBenchmarkSessionReducer = (
    state: AiBenchmarkSessionState,
    action: AiBenchmarkSessionAction,
): AiBenchmarkSessionState => {
    switch (action.type) {
        case 'setLoading':
            return { ...state, loading: action.loading };
        case 'setCancelling':
            return { ...state, cancelling: action.cancelling };
        case 'sessionLoaded':
            return withRuns({ ...state, session: action.session }, action.runs, action.summary || summarizeRunsLocal(action.runs));
        case 'setSession':
            return { ...state, session: action.session };
        case 'runsReceived':
            return withRuns(state, action.runs, action.summary || summarizeRunsLocal(action.runs));
        case 'optimisticRunsAdded': {
            const runs = [...action.runs, ...state.runs];
            return withRuns(state, runs, summarizeRunsLocal(runs));
        }
        case 'optimisticRunsFailed': {
            const runs = markOptimisticRunsFailed(state.runs, action.finishedAtIso);
            return withRuns(state, runs, summarizeRunsLocal(runs));
        }
        case 'runUpdated': {
            const updated = action.run;
            const runs = state.runs.map((entry) => (entry.id === updated.id ? { ...entry, ...updated } : entry));
            const synced = withRuns(state, runs, summarizeRunsLocal(runs));
            return {
                ...synced,
                commentDrafts: { ...synced.commentDrafts, [updated.id]: updated.run_comment || '' },
            };
        }
        case 'sessionCleared':
            return withRuns({ ...state, session: null }, [], null);
        case 'setRatingSaving':
            return { ...state, ratingSavingRunId: action.runId };
        case 'setCommentSaving':
            return { ...state, commentSavingRunId: action.runId };
        case 'editCommentDraft':
            return { ...state, commentDrafts: { ...state.commentDrafts, [action.runId]: action.value } };
        default:
            return state;
    }
};
