import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toAdminErrorMessage } from '../../../services/adminErrorMessages';
import type { AiTelemetryApiResponse, AiTelemetrySummary, FetchBenchmarkApi } from './aiBenchmarkApi';
import {
    EMPTY_TELEMETRY_LEADERS,
    buildTelemetrySnapshotCards,
    pickTelemetryLeaders,
    type TelemetryLeaders,
} from './aiBenchmarkModel';

interface TelemetrySnapshot {
    summary: AiTelemetrySummary | null;
    leaders: TelemetryLeaders;
}

const EMPTY_SNAPSHOT: TelemetrySnapshot = { summary: null, leaders: EMPTY_TELEMETRY_LEADERS };

/**
 * The 7-day telemetry snapshot of all AI calls: loaded with the token, and
 * reloaded when the session's last pending run finishes.
 */
export const useAiBenchmarkTelemetry = (params: {
    accessToken: string | null;
    fetchBenchmarkApi: FetchBenchmarkApi;
    hasPendingRuns: boolean;
}) => {
    const { accessToken, fetchBenchmarkApi, hasPendingRuns } = params;
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [snapshot, setSnapshot] = useState<TelemetrySnapshot>(EMPTY_SNAPSHOT);
    const hasPendingRunsRef = useRef(false);

    const refreshTelemetry = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const query = new URLSearchParams();
            query.set('windowHours', String(24 * 7));
            query.set('source', 'all');

            const payload = await fetchBenchmarkApi(`/api/internal/ai/benchmark/telemetry?${query.toString()}`, {
                method: 'GET',
            }) as unknown as AiTelemetryApiResponse;

            setSnapshot({
                summary: payload.summary || null,
                leaders: pickTelemetryLeaders(payload),
            });
        } catch (snapshotError) {
            setError(toAdminErrorMessage(snapshotError, 'Failed to load 7-day telemetry snapshot', 'admin-ai-benchmark'));
            setSnapshot(EMPTY_SNAPSHOT);
        } finally {
            setLoading(false);
        }
    }, [fetchBenchmarkApi]);

    useEffect(() => {
        if (!accessToken) return;
        void refreshTelemetry();
    }, [accessToken, refreshTelemetry]);

    // Reloads once the last queued or running benchmark run settles.
    useEffect(() => {
        if (!accessToken) return;
        if (hasPendingRunsRef.current && !hasPendingRuns) {
            void refreshTelemetry();
        }
        hasPendingRunsRef.current = hasPendingRuns;
    }, [accessToken, hasPendingRuns, refreshTelemetry]);

    const cards = useMemo(() => buildTelemetrySnapshotCards(snapshot.leaders), [snapshot.leaders]);

    return {
        loading,
        error,
        summary: snapshot.summary,
        cards,
        refreshTelemetry,
    };
};

export type AiBenchmarkTelemetry = ReturnType<typeof useAiBenchmarkTelemetry>;
