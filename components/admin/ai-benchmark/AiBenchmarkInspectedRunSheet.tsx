import React from 'react';
import { AiBenchmarkRunSheet } from '../AiBenchmarkRunSheet';
import type { BenchmarkRun } from '../aiBenchmarkRuns';
import { getModelCostEstimateLabel } from './aiBenchmarkModel';
import type { AiBenchmarkRunActions } from './useAiBenchmarkRunActions';

/** The run sheet for the inspected run, wired to its note draft and the run actions. */
export const AiBenchmarkInspectedRunSheet: React.FC<{
    run: BenchmarkRun | null;
    commentDrafts: Record<string, string>;
    ratingSavingRunId: string | null;
    commentSavingRunId: string | null;
    busy: boolean;
    cancelling: boolean;
    actions: AiBenchmarkRunActions;
    onClose: () => void;
    onCommentDraftChange: (runId: string, value: string) => void;
}> = ({ run, commentDrafts, ratingSavingRunId, commentSavingRunId, busy, cancelling, actions, onClose, onCommentDraftChange }) => {
    const withRun = (action: (current: BenchmarkRun) => void) => () => {
        if (run) action(run);
    };
    return (
        <AiBenchmarkRunSheet
            run={run}
            onOpenChange={(open) => { if (!open) onClose(); }}
            costEstimateLabel={run ? getModelCostEstimateLabel(run.provider, run.model) : null}
            commentDraft={run ? (commentDrafts[run.id] ?? run.run_comment ?? '') : ''}
            onCommentDraftChange={(value) => {
                if (!run) return;
                onCommentDraftChange(run.id, value);
            }}
            onSaveComment={withRun((current) => void actions.saveRunComment(current))}
            commentSaving={Boolean(run && commentSavingRunId === run.id)}
            onRate={(rating) => { if (run) void actions.updateRunRating(run, rating); }}
            ratingSaving={Boolean(run && ratingSavingRunId === run.id)}
            busy={busy}
            cancelling={cancelling}
            onRerun={withRun((current) => void actions.rerunTarget(current))}
            onAbort={withRun(actions.cancelRun)}
            onDownload={withRun(actions.downloadRun)}
        />
    );
};
