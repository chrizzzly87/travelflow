import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { useSearchParams } from '@/app/navigation';
import { toAdminErrorMessage } from '../../../services/adminErrorMessages';
import type { FetchBenchmarkApi } from './aiBenchmarkApi';
import { hasPendingBenchmarkRuns, withSessionParam } from './aiBenchmarkModel';
import { INITIAL_AI_BENCHMARK_SESSION_STATE, aiBenchmarkSessionReducer } from './aiBenchmarkSessionState';
import type { AiBenchmarkWorkspaceDispatch } from './useAiBenchmarkWorkspace';

const POLL_INTERVAL_MS = 2000;

/**
 * The benchmark session in `?session=` (or the latest one when the URL names
 * none) and its runs. While a run is queued or running, the session is polled
 * every two seconds until all of them finish.
 */
export const useAiBenchmarkSession = (params: {
    accessToken: string | null;
    fetchBenchmarkApi: FetchBenchmarkApi;
    notify: AiBenchmarkWorkspaceDispatch;
}) => {
    const { accessToken, fetchBenchmarkApi, notify } = params;
    const [searchParams, setSearchParams] = useSearchParams();
    const [state, dispatch] = useReducer(aiBenchmarkSessionReducer, INITIAL_AI_BENCHMARK_SESSION_STATE);
    const latestSessionBootstrapRef = useRef(false);

    const hasPendingRuns = useMemo(() => hasPendingBenchmarkRuns(state.runs), [state.runs]);
    const benchmarkSessionParam = (searchParams.get('session') || '').trim();
    const sessionLookup = state.session?.share_token || state.session?.id || '';

    const loadSession = useCallback(async (lookup: string) => {
        if (!lookup) return;
        notify({ type: 'setError', error: null });
        dispatch({ type: 'setLoading', loading: true });

        try {
            const payload = await fetchBenchmarkApi(`/api/internal/ai/benchmark?session=${encodeURIComponent(lookup)}`, {
                method: 'GET',
            });

            dispatch({ type: 'sessionLoaded', session: payload.session || null, runs: payload.runs || [], summary: payload.summary });
            // Loading is visible in the table; a success banner on every visit is noise.
            notify({ type: 'setMessage', message: null });

            if (payload.session?.share_token && payload.session.share_token !== lookup) {
                setSearchParams(withSessionParam(searchParams, payload.session.share_token), { replace: true });
            }
        } catch (loadError) {
            notify({ type: 'setError', error: toAdminErrorMessage(loadError, 'Failed to load benchmark session', 'admin-ai-benchmark') });
            dispatch({ type: 'sessionCleared' });
        } finally {
            dispatch({ type: 'setLoading', loading: false });
        }
    }, [fetchBenchmarkApi, notify, searchParams, setSearchParams]);

    useEffect(() => {
        if (!benchmarkSessionParam || !accessToken) return;
        void loadSession(benchmarkSessionParam);
    }, [benchmarkSessionParam, accessToken, loadSession]);

    // Without `?session=`, opens the admin's latest session once.
    useEffect(() => {
        if (!accessToken) return;
        if (benchmarkSessionParam) return;
        if (latestSessionBootstrapRef.current) return;
        latestSessionBootstrapRef.current = true;

        let cancelled = false;

        const bootstrapLatestSession = async () => {
            try {
                const payload = await fetchBenchmarkApi('/api/internal/ai/benchmark', {
                    method: 'GET',
                });
                const sessions = Array.isArray(payload.sessions) ? payload.sessions : [];
                const latest = sessions.find((entry) => !entry.deleted_at) || sessions[0];
                if (!latest || cancelled) return;

                const lookup = (latest.share_token || latest.id || '').trim();
                if (!lookup) return;
                await loadSession(lookup);
            } catch {
                // Keep first-load bootstrap silent; explicit actions surface detailed errors.
            }
        };

        void bootstrapLatestSession();

        return () => {
            cancelled = true;
        };
    }, [accessToken, benchmarkSessionParam, fetchBenchmarkApi, loadSession]);

    // Polls the session while any run is queued or running.
    useEffect(() => {
        if (!accessToken) return;
        if (!sessionLookup) return;
        if (!hasPendingRuns) return;

        let cancelled = false;
        let timeoutId: number | null = null;

        const pollSession = async () => {
            try {
                const latest = await fetchBenchmarkApi(`/api/internal/ai/benchmark?session=${encodeURIComponent(sessionLookup)}`, {
                    method: 'GET',
                });
                if (cancelled) return;

                const latestRuns = latest.runs || [];
                dispatch({ type: 'runsReceived', runs: latestRuns, summary: latest.summary });

                if (!hasPendingBenchmarkRuns(latestRuns)) {
                    notify({ type: 'queuedRunsFinished' });
                    return;
                }

                timeoutId = window.setTimeout(() => {
                    void pollSession();
                }, POLL_INTERVAL_MS);
            } catch (pollError) {
                if (cancelled) return;
                notify({ type: 'setError', error: toAdminErrorMessage(pollError, 'Failed to refresh running benchmark session', 'admin-ai-benchmark') });
            }
        };

        timeoutId = window.setTimeout(() => {
            void pollSession();
        }, POLL_INTERVAL_MS);

        return () => {
            cancelled = true;
            if (timeoutId !== null) {
                window.clearTimeout(timeoutId);
            }
        };
    }, [accessToken, sessionLookup, hasPendingRuns, fetchBenchmarkApi, notify]);

    return {
        state,
        dispatch,
        searchParams,
        setSearchParams,
        hasPendingRuns,
    };
};

export type AiBenchmarkSession = ReturnType<typeof useAiBenchmarkSession>;
