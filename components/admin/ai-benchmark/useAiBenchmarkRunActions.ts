import { useCallback, type RefObject } from 'react';
import { useAppDialog } from '../../AppDialogProvider';
import { toAdminErrorMessage } from '../../../services/adminErrorMessages';
import { buildDangerConfirmDialog } from '../../../services/appDialogPresets';
import { trackEvent } from '../../../services/analyticsService';
import type { AiBenchmarkRunTarget } from '../../../utils/aiBenchmarkTargets';
import {
    BENCHMARK_RUN_COMMENT_MAX_LENGTH,
    isOptimisticRun,
    isRunActive,
    normalizeRunCommentDraft,
    type BenchmarkRun,
    type SatisfactionRating,
} from '../aiBenchmarkRuns';
import { downloadBlob } from './aiBenchmarkApi';
import {
    DEFAULT_SESSION_NAME,
    buildBenchmarkRequestTargets,
    buildOptimisticRuns,
    buildRunJsonFileName,
    buildSessionExportFileName,
    buildSessionExportUrl,
    describeCancelledRuns,
    describeRunRequest,
    hasPendingBenchmarkRuns,
    resolveRunTimeoutSeconds,
    runToTarget,
    withSessionParam,
} from './aiBenchmarkModel';
import type { AiBenchmarkApi } from './useAiBenchmarkApi';
import type { AiBenchmarkModelCatalog } from './useAiBenchmarkModelCatalog';
import type { AiBenchmarkSession } from './useAiBenchmarkSession';
import type { AiBenchmarkSetup } from './useAiBenchmarkSetup';
import type { AiBenchmarkTelemetry } from './useAiBenchmarkTelemetry';
import type { AiBenchmarkWorkspaceDispatch } from './useAiBenchmarkWorkspace';

type RunDetailsSource = 'model' | 'status' | 'note' | 'menu';

/**
 * Starting, re-running and stopping runs, judging them (rating and note),
 * exporting, deleting the session and starting a new one.
 */
export const useAiBenchmarkRunActions = (params: {
    api: AiBenchmarkApi;
    session: AiBenchmarkSession;
    catalog: AiBenchmarkModelCatalog;
    setup: AiBenchmarkSetup;
    telemetry: AiBenchmarkTelemetry;
    workspace: AiBenchmarkWorkspaceDispatch;
    resultsSectionRef: RefObject<HTMLDivElement | null>;
}) => {
    const { api, session, catalog, setup, telemetry, workspace, resultsSectionRef } = params;
    const { accessToken, fetchBenchmarkApi } = api;
    const { confirm: confirmDialog } = useAppDialog();
    const { searchParams, setSearchParams } = session;
    const sessionDispatch = session.dispatch;
    const { session: currentSession, runs, commentDrafts } = session.state;
    const { runnableTargets, sortedModels } = catalog;
    const { execution } = setup.state;
    const { buildScenario } = setup;
    const { refreshTelemetry } = telemetry;

    const runBenchmark = useCallback(async (targetsOverride?: AiBenchmarkRunTarget[]) => {
        if (!accessToken) {
            workspace({ type: 'setError', error: 'Supabase access token missing. Refresh this page and try again.' });
            return;
        }

        const selected = targetsOverride || runnableTargets;
        const timeoutSeconds = resolveRunTimeoutSeconds(execution.timeoutSeconds);
        const timeoutMs = timeoutSeconds * 1000;

        if (selected.length === 0) {
            workspace({ type: 'setError', error: 'Enable at least one model target before running benchmark.' });
            return;
        }

        const optimisticRuns = buildOptimisticRuns(selected, runs, {
            sessionId: currentSession?.id,
            startedAtIso: new Date().toISOString(),
            nowMs: Date.now(),
            createId: () => crypto.randomUUID(),
        });

        workspace({ type: 'setError', error: null });
        workspace({ type: 'setMessage', message: null });
        sessionDispatch({ type: 'optimisticRunsAdded', runs: optimisticRuns });
        sessionDispatch({ type: 'setLoading', loading: true });

        try {
            const payload = await fetchBenchmarkApi('/api/internal/ai/benchmark', {
                method: 'POST',
                body: JSON.stringify({
                    sessionId: currentSession?.id,
                    sessionName: execution.sessionName.trim() || DEFAULT_SESSION_NAME,
                    flow: 'classic',
                    scenario: buildScenario(),
                    targets: buildBenchmarkRequestTargets(selected, sortedModels, execution.modelReasoningModes, execution.reasoningMode),
                    runCount: 1,
                    concurrency: execution.concurrency,
                    timeoutMs,
                }),
            });

            if (payload.session) {
                sessionDispatch({ type: 'setSession', session: payload.session });
                setSearchParams(withSessionParam(searchParams, payload.session.share_token || payload.session.id), { replace: true });
            }
            const nextRuns = payload.runs || [];
            sessionDispatch({ type: 'runsReceived', runs: nextRuns, summary: payload.summary });

            const hasPending = hasPendingBenchmarkRuns(nextRuns);
            workspace({
                type: 'setMessage',
                message: describeRunRequest({
                    targetCount: selected.length,
                    concurrency: execution.concurrency,
                    timeoutSeconds,
                    compactOutput: execution.compactOutput,
                    hasPending,
                }),
            });
            if (!hasPending) {
                void refreshTelemetry();
            }
        } catch (runError) {
            workspace({ type: 'setError', error: toAdminErrorMessage(runError, 'Benchmark run failed', 'admin-ai-benchmark') });
            sessionDispatch({ type: 'optimisticRunsFailed', finishedAtIso: new Date().toISOString() });
        } finally {
            sessionDispatch({ type: 'setLoading', loading: false });
        }
    }, [
        accessToken,
        buildScenario,
        currentSession,
        execution,
        fetchBenchmarkApi,
        refreshTelemetry,
        runnableTargets,
        runs,
        searchParams,
        sessionDispatch,
        setSearchParams,
        sortedModels,
        workspace,
    ]);

    const rerunTarget = useCallback(async (run: BenchmarkRun) => {
        await runBenchmark([runToTarget(run)]);
    }, [runBenchmark]);

    const cancelRuns = useCallback(async (target: { runId?: string; sessionId?: string }) => {
        if (!target.runId && !target.sessionId) return;
        workspace({ type: 'setError', error: null });
        sessionDispatch({ type: 'setCancelling', cancelling: true });

        try {
            const payload = await fetchBenchmarkApi('/api/internal/ai/benchmark/cancel', {
                method: 'POST',
                body: JSON.stringify(target),
            });

            if (payload.session) {
                sessionDispatch({ type: 'setSession', session: payload.session });
            }
            sessionDispatch({ type: 'runsReceived', runs: payload.runs || runs, summary: payload.summary });

            const cancelledCount = typeof payload.cancelled === 'number' ? payload.cancelled : 0;
            workspace({ type: 'setMessage', message: describeCancelledRuns(cancelledCount) });
        } catch (cancelError) {
            workspace({ type: 'setError', error: toAdminErrorMessage(cancelError, 'Failed to cancel benchmark run(s)', 'admin-ai-benchmark') });
        } finally {
            sessionDispatch({ type: 'setCancelling', cancelling: false });
        }
    }, [fetchBenchmarkApi, runs, sessionDispatch, workspace]);

    const cancelRun = useCallback((run: BenchmarkRun) => {
        if (!run.id || run.id.startsWith('optimistic-')) return;
        void cancelRuns({ runId: run.id });
    }, [cancelRuns]);

    const stopActiveRuns = useCallback(() => {
        trackEvent('admin__ai_benchmark--stop');
        if (!currentSession?.id) return;
        void cancelRuns({ sessionId: currentSession.id });
    }, [cancelRuns, currentSession?.id]);

    const updateRunFeedback = useCallback(async (
        run: BenchmarkRun,
        payload: { rating?: SatisfactionRating | null; comment?: string | null },
    ): Promise<BenchmarkRun> => {
        const response = await fetchBenchmarkApi('/api/internal/ai/benchmark/rating', {
            method: 'POST',
            body: JSON.stringify({
                runId: run.id,
                ...(Object.prototype.hasOwnProperty.call(payload, 'rating') ? { rating: payload.rating } : {}),
                ...(Object.prototype.hasOwnProperty.call(payload, 'comment') ? { comment: payload.comment } : {}),
            }),
        });

        const updatedRun = response?.run as BenchmarkRun | undefined;
        if (!updatedRun) {
            throw new Error('Run feedback saved but no updated row returned.');
        }

        sessionDispatch({ type: 'runUpdated', run: updatedRun });
        return updatedRun;
    }, [fetchBenchmarkApi, sessionDispatch]);

    const updateRunRating = useCallback(async (run: BenchmarkRun, nextRating: SatisfactionRating | null) => {
        if (!run.id || run.id.startsWith('optimistic-') || isRunActive(run)) return;
        workspace({ type: 'setError', error: null });
        sessionDispatch({ type: 'setRatingSaving', runId: run.id });

        try {
            await updateRunFeedback(run, { rating: nextRating });
        } catch (ratingError) {
            workspace({ type: 'setError', error: toAdminErrorMessage(ratingError, 'Failed to save run rating', 'admin-ai-benchmark') });
        } finally {
            sessionDispatch({ type: 'setRatingSaving', runId: null });
        }
    }, [sessionDispatch, updateRunFeedback, workspace]);

    const saveRunComment = useCallback(async (run: BenchmarkRun) => {
        if (!run.id || run.id.startsWith('optimistic-') || isRunActive(run)) return;
        const draft = normalizeRunCommentDraft(commentDrafts[run.id] || '');
        if (draft.length > BENCHMARK_RUN_COMMENT_MAX_LENGTH) {
            workspace({ type: 'setError', error: `Comment too long (max ${BENCHMARK_RUN_COMMENT_MAX_LENGTH} characters).` });
            return;
        }

        const persisted = normalizeRunCommentDraft(run.run_comment || '');
        if (draft === persisted) return;

        workspace({ type: 'setError', error: null });
        sessionDispatch({ type: 'setCommentSaving', runId: run.id });
        try {
            await updateRunFeedback(run, { comment: draft || null });
        } catch (commentError) {
            workspace({ type: 'setError', error: toAdminErrorMessage(commentError, 'Failed to save run comment', 'admin-ai-benchmark') });
        } finally {
            sessionDispatch({ type: 'setCommentSaving', runId: null });
        }
    }, [commentDrafts, sessionDispatch, updateRunFeedback, workspace]);

    const downloadRun = useCallback((run: BenchmarkRun) => {
        const payload = {
            run,
            exportedAt: new Date().toISOString(),
        };

        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
        downloadBlob(blob, buildRunJsonFileName(run));
    }, []);

    const exportSessionZip = useCallback(async (includeLogs: boolean) => {
        if (!currentSession) {
            workspace({ type: 'setError', error: 'No benchmark session selected. Run at least one benchmark first.' });
            return;
        }

        sessionDispatch({ type: 'setLoading', loading: true });
        workspace({ type: 'setError', error: null });

        try {
            if (!accessToken) {
                throw new Error('Supabase access token missing.');
            }

            const headers = new Headers();
            headers.set('Authorization', `Bearer ${accessToken}`);

            const response = await fetch(buildSessionExportUrl(currentSession.id, includeLogs), {
                method: 'GET',
                headers,
            });

            if (!response.ok) {
                const payload = await response.json().catch(() => null);
                throw new Error(payload?.error || `Export failed (${response.status})`);
            }

            const blob = await response.blob();
            downloadBlob(blob, buildSessionExportFileName(currentSession.name));
        } catch (downloadError) {
            workspace({ type: 'setError', error: toAdminErrorMessage(downloadError, 'Failed to export benchmark ZIP', 'admin-ai-benchmark') });
        } finally {
            sessionDispatch({ type: 'setLoading', loading: false });
        }
    }, [accessToken, currentSession, sessionDispatch, workspace]);

    const deleteSession = useCallback(async () => {
        trackEvent('admin__ai_benchmark--delete_session');
        if (!currentSession) {
            workspace({ type: 'setError', error: 'No benchmark session loaded.' });
            return;
        }

        const confirmed = await confirmDialog(buildDangerConfirmDialog({
            title: 'Delete benchmark session data',
            message: 'Delete benchmark trips and benchmark rows for this session? This cannot be undone.',
            confirmLabel: 'Delete',
        }));
        if (!confirmed) return;

        sessionDispatch({ type: 'setLoading', loading: true });
        workspace({ type: 'setError', error: null });

        try {
            const payload = await fetchBenchmarkApi('/api/internal/ai/benchmark/cleanup', {
                method: 'POST',
                body: JSON.stringify({
                    sessionId: currentSession.id,
                    mode: 'both',
                }),
            });

            workspace({ type: 'setMessage', message: `Cleanup complete for session ${currentSession.id}.` });
            sessionDispatch({ type: 'sessionCleared' });
            setSearchParams(withSessionParam(searchParams, null), { replace: true });

            if (!payload.ok) {
                workspace({ type: 'setError', error: payload.error || 'Cleanup may be incomplete.' });
            }
        } catch (cleanupError) {
            workspace({ type: 'setError', error: toAdminErrorMessage(cleanupError, 'Failed to clean benchmark session', 'admin-ai-benchmark') });
        } finally {
            sessionDispatch({ type: 'setLoading', loading: false });
        }
    }, [confirmDialog, currentSession, fetchBenchmarkApi, searchParams, sessionDispatch, setSearchParams, workspace]);

    const scrollToResults = useCallback(() => {
        workspace({ type: 'setTab', tab: 'results' });
        window.requestAnimationFrame(() => {
            resultsSectionRef.current?.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
            });
        });
    }, [resultsSectionRef, workspace]);

    const startBenchmark = (source: 'header' | 'empty_state') => {
        trackEvent('admin__ai_benchmark--run', { source, models: runnableTargets.length });
        scrollToResults();
        void runBenchmark();
    };

    const runSingleTarget = (target: AiBenchmarkRunTarget) => {
        trackEvent('admin__ai_benchmark--run_single');
        scrollToResults();
        void runBenchmark([
            {
                provider: target.provider,
                model: target.model,
                label: target.label,
            },
        ]);
    };

    const startNewSession = () => {
        trackEvent('admin__ai_benchmark--new_session');
        sessionDispatch({ type: 'sessionCleared' });
        workspace({ type: 'newSessionStarted' });
        setSearchParams(withSessionParam(searchParams, null), { replace: true });
    };

    const openRunDetails = (run: BenchmarkRun, source: RunDetailsSource) => {
        if (isOptimisticRun(run)) return;
        trackEvent('admin__ai_benchmark--open_run', { source });
        workspace({ type: 'inspectRun', runId: run.id });
    };

    return {
        startBenchmark,
        runSingleTarget,
        rerunTarget,
        cancelRun,
        stopActiveRuns,
        updateRunRating,
        saveRunComment,
        downloadRun,
        exportSessionZip,
        deleteSession,
        startNewSession,
        openRunDetails,
    };
};

export type AiBenchmarkRunActions = ReturnType<typeof useAiBenchmarkRunActions>;
