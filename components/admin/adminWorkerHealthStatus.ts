import type {
    AdminAsyncWorkerHealthStatus,
    AdminAsyncWorkerHealthSummary,
} from '../../services/adminService';
import type { AdminStatusTone } from './AdminStatusBadge';
import { formatAdminRelativeTime } from './adminRelativeTime';

/** Overall verdict words: one scale for the header, the badge and the check rows. */
export const WORKER_HEALTH_VERDICT: Record<AdminAsyncWorkerHealthStatus, {
    label: string;
    headline: string;
    tone: AdminStatusTone;
}> = {
    ok: { label: 'Healthy', headline: 'Async trip generation is healthy', tone: 'success' },
    warning: { label: 'Degraded', headline: 'Async trip generation is degraded', tone: 'warning' },
    failed: { label: 'Failing', headline: 'Async trip generation is failing', tone: 'danger' },
};

export const formatWorkerDuration = (value?: number | null): string => {
    if (value === null || value === undefined || !Number.isFinite(value)) return '—';
    const normalized = Number(value);
    if (normalized < 1000) return `${Math.round(normalized)} ms`;
    if (normalized < 60_000) return `${(normalized / 1000).toFixed(1)} s`;
    return `${(normalized / 60_000).toFixed(1)} min`;
};

export type WorkerHealthSignalKey = 'heartbeat' | 'queue' | 'canary' | 'selfHeal';

export interface WorkerHealthSignal {
    key: WorkerHealthSignalKey;
    label: string;
    tone: AdminStatusTone;
    /** Short state word for the badge. */
    state: string;
    /** One line: what was observed, in plain words. */
    detail: string;
    /** ISO time the signal was last observed, for the absolute-time tooltip. */
    observedAt: string | null;
}

const toneForStatus = (status: AdminAsyncWorkerHealthStatus | null): AdminStatusTone => (
    status ? WORKER_HEALTH_VERDICT[status].tone : 'neutral'
);

/**
 * The four signals behind the overall verdict, each with its own state and a reason.
 * They mirror the server's `buildAsyncWorkerHealthSummary` order of precedence:
 * heartbeat, canary, then the stale queue.
 */
export const buildWorkerHealthSignals = (
    summary: AdminAsyncWorkerHealthSummary,
    nowMs = Date.now(),
): WorkerHealthSignal[] => {
    const heartbeatTone: AdminStatusTone = !summary.heartbeatFresh || summary.lastHeartbeatStatus === 'failed'
        ? 'danger'
        : toneForStatus(summary.lastHeartbeatStatus ?? 'ok');
    const heartbeat: WorkerHealthSignal = {
        key: 'heartbeat',
        label: 'Heartbeat',
        tone: heartbeatTone,
        state: !summary.lastHeartbeatAt ? 'Missing' : summary.heartbeatFresh ? 'Fresh' : 'Stale',
        detail: summary.lastHeartbeatAt
            ? `Last cron run ${formatAdminRelativeTime(summary.lastHeartbeatAt, nowMs)}.`
            : 'No cron run recorded yet.',
        observedAt: summary.lastHeartbeatAt,
    };

    const queue: WorkerHealthSignal = {
        key: 'queue',
        label: 'Queue',
        tone: summary.staleQueuedCount > 0 ? 'warning' : 'success',
        state: summary.staleQueuedCount > 0
            ? `${summary.staleQueuedCount.toLocaleString()} stuck`
            : 'Clear',
        detail: summary.staleQueuedCount > 0
            ? `Oldest job has waited ${formatWorkerDuration(summary.oldestQueuedAgeMs)}.`
            : 'No job has waited longer than 5 minutes.',
        observedAt: summary.lastHeartbeatAt,
    };

    let canaryTone = toneForStatus(summary.lastCanaryStatus);
    let canaryState = summary.lastCanaryStatus ? WORKER_HEALTH_VERDICT[summary.lastCanaryStatus].label : 'Not run';
    if (!summary.lastCanaryStatus || !summary.canaryFresh) {
        canaryTone = summary.lastCanaryStatus === 'failed' ? 'danger' : 'warning';
        canaryState = summary.lastCanaryStatus ? 'Overdue' : 'Not run';
    }
    const canary: WorkerHealthSignal = {
        key: 'canary',
        label: 'Canary',
        tone: canaryTone,
        state: canaryState,
        detail: summary.lastCanaryAt
            ? `Took ${formatWorkerDuration(summary.lastCanaryLatencyMs)}, ${formatAdminRelativeTime(summary.lastCanaryAt, nowMs)}.`
            : 'No end-to-end probe recorded yet.',
        observedAt: summary.lastCanaryAt,
    };

    const selfHeal: WorkerHealthSignal = {
        key: 'selfHeal',
        label: 'Self-heal',
        tone: summary.lastSelfHealStatus ? toneForStatus(summary.lastSelfHealStatus) : 'neutral',
        state: summary.lastSelfHealStatus ? WORKER_HEALTH_VERDICT[summary.lastSelfHealStatus].label : 'None',
        detail: summary.lastSelfHealAt
            ? `Last re-kick ${formatAdminRelativeTime(summary.lastSelfHealAt, nowMs)}.`
            : 'The watchdog has not needed to re-kick the worker.',
        observedAt: summary.lastSelfHealAt,
    };

    return [heartbeat, queue, canary, selfHeal];
};
