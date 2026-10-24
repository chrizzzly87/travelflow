import { describe, expect, it } from 'vitest';

import {
    DEFAULT_BENCHMARK_RUN_FILTERS,
    buildModelComparisonRows,
    buildRunErrorJson,
    buildRunValidationJson,
    countUnratedCompletedRuns,
    filterAndSortBenchmarkRuns,
    formatRelativeTime,
    getRunStatusMeta,
    getRunValidationVerdict,
    hasActiveBenchmarkRunFilter,
    hasRunValidationDetails,
    parseRunError,
    resolveAiBenchmarkWorkspaceTab,
    summarizeRunsLocal,
    type BenchmarkRun,
} from '../../components/admin/aiBenchmarkRuns';

const makeRun = (overrides: Partial<BenchmarkRun> = {}): BenchmarkRun => ({
    id: overrides.id ?? 'run-1',
    session_id: 'session-1',
    provider: 'openai',
    model: 'gpt-5',
    label: null,
    run_index: 1,
    status: 'completed',
    latency_ms: 1000,
    schema_valid: true,
    usage: null,
    cost_usd: null,
    trip_id: null,
    error_message: null,
    created_at: '2026-10-24T10:00:00.000Z',
    ...overrides,
});

describe('resolveAiBenchmarkWorkspaceTab', () => {
    it('opens on results when a session is loaded and setup otherwise', () => {
        expect(resolveAiBenchmarkWorkspaceTab(null, true)).toBe('results');
        expect(resolveAiBenchmarkWorkspaceTab(null, false)).toBe('setup');
    });

    it('keeps the tab the admin picked', () => {
        expect(resolveAiBenchmarkWorkspaceTab('compare', false)).toBe('compare');
        expect(resolveAiBenchmarkWorkspaceTab('setup', true)).toBe('setup');
    });
});

describe('getRunStatusMeta', () => {
    it('labels a user cancellation apart from a failure', () => {
        expect(getRunStatusMeta(makeRun({ status: 'failed', error_message: 'Cancelled by user.' })).label).toBe('Cancelled');
        expect(getRunStatusMeta(makeRun({ status: 'failed', error_message: 'Timeout' })).label).toBe('Failed');
        expect(getRunStatusMeta(makeRun({ status: 'running' })).tone).toBe('info');
    });
});

describe('parseRunError and buildRunErrorJson', () => {
    it('splits a prefix from a JSON provider payload and unwraps nested JSON strings', () => {
        const message = 'Provider request failed: {"error":{"message":"{\\"code\\":429}"}}';
        const parsed = parseRunError(message);
        expect(parsed.shortMessage).toBe('Provider request failed');
        expect(parsed.details).toEqual({ error: { message: { code: 429 } } });
        expect(JSON.parse(buildRunErrorJson(makeRun({ error_message: message })))).toEqual({ error: { message: { code: 429 } } });
    });

    it('keeps a plain message and wraps it for the JSON view', () => {
        expect(parseRunError('Timeout after 60s')).toEqual({ shortMessage: 'Timeout after 60s', details: null });
        expect(JSON.parse(buildRunErrorJson(makeRun({ error_message: 'Timeout after 60s' })))).toEqual({ error: 'Timeout after 60s' });
    });
});

describe('validation helpers', () => {
    it('names the verdict in words, including warnings', () => {
        expect(getRunValidationVerdict(makeRun({ schema_valid: null })).label).toBe('Not checked');
        expect(getRunValidationVerdict(makeRun({ schema_valid: false })).tone).toBe('danger');
        expect(getRunValidationVerdict(makeRun({ validation_checks: { warnings: ['a', 'b'] } })).label).toBe('Passed with 2 warnings');
        expect(getRunValidationVerdict(makeRun()).label).toBe('Validation passed');
    });

    it('reports details only when there is something to show', () => {
        expect(hasRunValidationDetails(makeRun({ schema_valid: null }))).toBe(false);
        expect(hasRunValidationDetails(makeRun({ schema_valid: null, validation_errors: ['missing days'] }))).toBe(true);
        expect(JSON.parse(buildRunValidationJson(makeRun({ validation_checks: { a: true, warnings: ['w'] } })))).toEqual({
            schemaValid: true,
            checks: { a: true, warnings: ['w'] },
            errors: [],
            warnings: ['w'],
        });
    });
});

describe('filterAndSortBenchmarkRuns', () => {
    const runs = [
        makeRun({ id: 'old', created_at: '2026-10-20T10:00:00.000Z', satisfaction_rating: 'good' }),
        makeRun({ id: 'failed', status: 'failed', provider: 'anthropic', created_at: '2026-10-22T10:00:00.000Z' }),
        makeRun({ id: 'warned', created_at: '2026-10-23T10:00:00.000Z', validation_checks: { warnings: ['short day'] } }),
    ];

    it('sorts newest first by default and oldest first on request', () => {
        expect(filterAndSortBenchmarkRuns(runs, DEFAULT_BENCHMARK_RUN_FILTERS, 'desc').map((run) => run.id)).toEqual(['warned', 'failed', 'old']);
        expect(filterAndSortBenchmarkRuns(runs, DEFAULT_BENCHMARK_RUN_FILTERS, 'asc').map((run) => run.id)).toEqual(['old', 'failed', 'warned']);
    });

    it('applies every filter and knows when one is active', () => {
        const filters = { ...DEFAULT_BENCHMARK_RUN_FILTERS, hideFailed: true, onlyUnrated: true };
        expect(hasActiveBenchmarkRunFilter(DEFAULT_BENCHMARK_RUN_FILTERS)).toBe(false);
        expect(hasActiveBenchmarkRunFilter(filters)).toBe(true);
        expect(filterAndSortBenchmarkRuns(runs, filters, 'desc').map((run) => run.id)).toEqual(['warned']);
        expect(filterAndSortBenchmarkRuns(runs, { ...DEFAULT_BENCHMARK_RUN_FILTERS, provider: 'anthropic' }, 'desc').map((run) => run.id)).toEqual(['failed']);
        expect(filterAndSortBenchmarkRuns(runs, { ...DEFAULT_BENCHMARK_RUN_FILTERS, onlyWarnings: true }, 'desc').map((run) => run.id)).toEqual(['warned']);
    });

    it('does not reorder the array it was given', () => {
        const input = [...runs];
        filterAndSortBenchmarkRuns(input, DEFAULT_BENCHMARK_RUN_FILTERS, 'desc');
        expect(input.map((run) => run.id)).toEqual(['old', 'failed', 'warned']);
    });
});

describe('summaries', () => {
    it('counts only completed runs as waiting for a rating', () => {
        expect(countUnratedCompletedRuns([
            makeRun({ id: 'a' }),
            makeRun({ id: 'b', satisfaction_rating: 'bad' }),
            makeRun({ id: 'c', status: 'failed' }),
            makeRun({ id: 'd', status: 'running' }),
        ])).toBe(1);
    });

    it('summarizes status, latency of completed runs and exact cost', () => {
        expect(summarizeRunsLocal([
            makeRun({ id: 'a', latency_ms: 1000, cost_usd: 0.01 }),
            makeRun({ id: 'b', latency_ms: 3000, cost_usd: 0.02 }),
            makeRun({ id: 'c', status: 'failed', latency_ms: 9000 }),
            makeRun({ id: 'd', status: 'queued', latency_ms: null }),
        ])).toEqual({ total: 4, completed: 2, failed: 1, running: 0, queued: 1, averageLatencyMs: 2000, totalCostUsd: 0.03 });
    });
});

describe('buildModelComparisonRows', () => {
    it('averages per model and ranks the best rated first', () => {
        const rows = buildModelComparisonRows([
            makeRun({ id: 'a1', model: 'a', satisfaction_rating: 'medium', latency_ms: 2000, usage: { totalTokens: 100 } }),
            makeRun({ id: 'a2', model: 'a', status: 'failed', latency_ms: null, validation_checks: { semanticRepairAttempted: true } }),
            makeRun({ id: 'b1', model: 'b', satisfaction_rating: 'good', latency_ms: 4000, cost_usd: 0.5, usage: { total_tokens: 300 } }),
            makeRun({ id: 'c1', model: 'c', latency_ms: 500 }),
        ]);

        expect(rows.map((row) => row.model)).toEqual(['b', 'a', 'c']);
        expect(rows[0]).toMatchObject({ averageRatingScore: 3, ratingCount: 1, averageCostUsd: 0.5, averageTotalTokens: 300, successRate: 1 });
        expect(rows[1]).toMatchObject({ averageRatingScore: 2, totalRuns: 2, successRate: 0.5, repairRate: 0.5, averageLatencyMs: 2000, averageTotalTokens: 100 });
        expect(rows[2]).toMatchObject({ averageRatingScore: null, averageCostUsd: null });
    });
});

describe('formatRelativeTime', () => {
    const now = Date.parse('2026-10-24T12:00:00.000Z');

    it('reads as plain English and falls back to a dash', () => {
        expect(formatRelativeTime('2026-10-24T11:55:00.000Z', now)).toBe('5 minutes ago');
        expect(formatRelativeTime('2026-10-23T12:00:00.000Z', now)).toBe('yesterday');
        expect(formatRelativeTime(null, now)).toBe('—');
        expect(formatRelativeTime('not a date', now)).toBe('—');
    });
});
