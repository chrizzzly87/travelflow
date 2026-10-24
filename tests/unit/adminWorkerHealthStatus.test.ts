import { describe, expect, it } from 'vitest';
import { formatAdminRelativeTime } from '../../components/admin/adminRelativeTime';
import {
    WORKER_HEALTH_VERDICT,
    buildWorkerHealthSignals,
    formatWorkerDuration,
} from '../../components/admin/adminWorkerHealthStatus';
import type { AdminAsyncWorkerHealthSummary } from '../../services/adminService';

const NOW = Date.parse('2026-10-24T12:00:00.000Z');

const healthySummary: AdminAsyncWorkerHealthSummary = {
    overallStatus: 'ok',
    statusReason: 'Worker heartbeat and canary are healthy.',
    heartbeatFresh: true,
    canaryFresh: true,
    canaryDue: false,
    staleQueuedCount: 0,
    oldestQueuedAgeMs: null,
    lastHeartbeatAt: '2026-10-24T11:59:00.000Z',
    lastHeartbeatStatus: 'ok',
    lastSelfHealAt: null,
    lastSelfHealStatus: null,
    lastCanaryAt: '2026-10-24T11:50:00.000Z',
    lastCanaryStatus: 'ok',
    lastCanaryLatencyMs: 3950,
};

describe('components/admin/adminRelativeTime', () => {
    it('formats past and future times relative to now', () => {
        expect(formatAdminRelativeTime('2026-10-24T11:59:40.000Z', NOW)).toBe('just now');
        expect(formatAdminRelativeTime('2026-10-24T11:56:00.000Z', NOW)).toBe('4 minutes ago');
        expect(formatAdminRelativeTime('2026-10-24T09:00:00.000Z', NOW)).toBe('3 hours ago');
        expect(formatAdminRelativeTime('2026-10-22T12:00:00.000Z', NOW)).toBe('2 days ago');
        expect(formatAdminRelativeTime('2026-10-24T12:10:00.000Z', NOW)).toBe('in 10 minutes');
        expect(formatAdminRelativeTime(null, NOW)).toBe('—');
        expect(formatAdminRelativeTime('not a date', NOW)).toBe('—');
    });
});

describe('components/admin/adminWorkerHealthStatus', () => {
    it('maps the overall status to one verdict scale', () => {
        expect(WORKER_HEALTH_VERDICT.ok.label).toBe('Healthy');
        expect(WORKER_HEALTH_VERDICT.warning.label).toBe('Degraded');
        expect(WORKER_HEALTH_VERDICT.failed.label).toBe('Failing');
    });

    it('reports every signal as healthy when nothing is wrong', () => {
        const signals = buildWorkerHealthSignals(healthySummary, NOW);
        expect(signals.map((signal) => [signal.key, signal.tone, signal.state])).toEqual([
            ['heartbeat', 'success', 'Fresh'],
            ['queue', 'success', 'Clear'],
            ['canary', 'success', 'Healthy'],
            ['selfHeal', 'neutral', 'None'],
        ]);
        expect(signals[0]?.detail).toBe('Last cron run 1 minute ago.');
        expect(signals[2]?.detail).toBe('Took 4.0 s, 10 minutes ago.');
    });

    it('names the failing signal when the heartbeat is stale and jobs are stuck', () => {
        const signals = buildWorkerHealthSignals({
            ...healthySummary,
            overallStatus: 'failed',
            heartbeatFresh: false,
            staleQueuedCount: 3,
            oldestQueuedAgeMs: 360_000,
            lastSelfHealAt: '2026-10-24T11:40:00.000Z',
            lastSelfHealStatus: 'warning',
        }, NOW);
        const byKey = Object.fromEntries(signals.map((signal) => [signal.key, signal]));
        expect(byKey.heartbeat).toMatchObject({ tone: 'danger', state: 'Stale' });
        expect(byKey.queue).toMatchObject({ tone: 'warning', state: '3 stuck', detail: 'Oldest job has waited 6.0 min.' });
        expect(byKey.selfHeal).toMatchObject({ tone: 'warning', state: 'Degraded' });
    });

    it('flags a missing or overdue canary', () => {
        const missing = buildWorkerHealthSignals({ ...healthySummary, lastCanaryAt: null, lastCanaryStatus: null, canaryFresh: false }, NOW);
        expect(missing[2]).toMatchObject({ tone: 'warning', state: 'Not run' });
        const overdue = buildWorkerHealthSignals({ ...healthySummary, canaryFresh: false }, NOW);
        expect(overdue[2]).toMatchObject({ tone: 'warning', state: 'Overdue' });
        const failed = buildWorkerHealthSignals({ ...healthySummary, lastCanaryStatus: 'failed' }, NOW);
        expect(failed[2]).toMatchObject({ tone: 'danger', state: 'Failing' });
    });

    it('formats worker durations', () => {
        expect(formatWorkerDuration(450)).toBe('450 ms');
        expect(formatWorkerDuration(3950)).toBe('4.0 s');
        expect(formatWorkerDuration(360_000)).toBe('6.0 min');
        expect(formatWorkerDuration(null)).toBe('—');
    });
});
