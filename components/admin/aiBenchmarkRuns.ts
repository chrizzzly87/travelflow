/**
 * Pure helpers for the AI benchmark run list (`/admin/ai-benchmark`): the run
 * record shape, status and validation readers, the run filters, the per-model
 * comparison rows and the formatters the table and the run inspector share.
 *
 * Nothing here changes what a model produced. Error and validation payloads are
 * only re-shaped for display; the stored run is never rewritten.
 */
import type { AdminStatusTone } from './AdminStatusBadge';

export interface BenchmarkRun {
    id: string;
    session_id: string;
    provider: string;
    model: string;
    label: string | null;
    run_index: number;
    status: 'queued' | 'running' | 'completed' | 'failed';
    latency_ms: number | null;
    schema_valid: boolean | null;
    usage: Record<string, unknown> | null;
    cost_usd: number | null;
    trip_id: string | null;
    error_message: string | null;
    satisfaction_rating?: 'good' | 'medium' | 'bad' | null;
    satisfaction_updated_at?: string | null;
    run_comment?: string | null;
    run_comment_updated_at?: string | null;
    started_at?: string | null;
    finished_at?: string | null;
    created_at: string;
    updated_at?: string;
    normalized_trip?: Record<string, unknown> | null;
    validation_errors?: string[] | null;
    validation_checks?: Record<string, unknown> | null;
}

export interface BenchmarkSummary {
    total: number;
    completed: number;
    failed: number;
    running: number;
    queued: number;
    averageLatencyMs: number | null;
    totalCostUsd: number;
}

export type SatisfactionRating = 'good' | 'medium' | 'bad';
export type RunSortDirection = 'asc' | 'desc';

export const SATISFACTION_SCORE: Record<SatisfactionRating, number> = {
    good: 3,
    medium: 2,
    bad: 1,
};

export const BENCHMARK_RUN_COMMENT_MAX_LENGTH = 2000;

export const isRunActive = (run: BenchmarkRun): boolean => run.status === 'queued' || run.status === 'running';

/** An optimistic row exists only until the server answers; it cannot be rated, noted or opened. */
export const isOptimisticRun = (run: BenchmarkRun): boolean => run.id.startsWith('optimistic-');

export const isRunCancelledByUser = (run: BenchmarkRun): boolean => {
    if (run.status !== 'failed') return false;
    if (!run.error_message) return false;
    return run.error_message.startsWith('Cancelled by user.');
};

export const RUN_STATUS_META: Record<BenchmarkRun['status'] | 'cancelled', { label: string; tone: AdminStatusTone }> = {
    queued: { label: 'Queued', tone: 'neutral' },
    running: { label: 'Running', tone: 'info' },
    completed: { label: 'Completed', tone: 'success' },
    failed: { label: 'Failed', tone: 'danger' },
    cancelled: { label: 'Cancelled', tone: 'warning' },
};

export const getRunStatusMeta = (run: BenchmarkRun): { label: string; tone: AdminStatusTone } => (
    RUN_STATUS_META[isRunCancelledByUser(run) ? 'cancelled' : run.status] || RUN_STATUS_META.queued
);

export const getRunTimestampIso = (run: BenchmarkRun): string | null => run.started_at || run.created_at || null;

export const normalizeRunCommentDraft = (value?: string | null): string => {
    if (!value) return '';
    return value.trim();
};

// ── Formatting ──────────────────────────────────────────────────────────────

export const formatDuration = (ms: number | null | undefined): string => {
    if (!Number.isFinite(ms)) return '—';
    const value = Number(ms);
    if (value < 1000) return `${value} ms`;
    return `${(value / 1000).toFixed(2)} s`;
};

export const formatUsd = (value: number | null | undefined): string => {
    if (!Number.isFinite(value)) return '—';
    return `$${Number(value).toFixed(6)}`;
};

export const formatTimestamp = (value?: string | null): string => {
    if (!value) return '—';
    const parsed = Date.parse(value);
    if (!Number.isFinite(parsed)) return '—';
    return new Date(parsed).toLocaleString();
};

/** Total tokens from either usage spelling the providers return, or null. */
export const getRunTotalTokens = (run: BenchmarkRun): number | null => {
    const totalTokens = Number(run.usage?.totalTokens ?? run.usage?.total_tokens);
    return Number.isFinite(totalTokens) && totalTokens >= 0 ? totalTokens : null;
};

// ── Provider errors ─────────────────────────────────────────────────────────

export interface ParsedRunError {
    shortMessage: string;
    details: unknown | null;
}

const truncate = (value: string, max: number): string => {
    if (value.length <= max) return value;
    return `${value.slice(0, Math.max(1, max - 1))}…`;
};

const looksLikeJsonPayload = (value: string): boolean => {
    const trimmed = value.trim();
    return (
        (trimmed.startsWith('{') && trimmed.endsWith('}'))
        || (trimmed.startsWith('[') && trimmed.endsWith(']'))
        || (trimmed.startsWith('"') && trimmed.endsWith('"'))
    );
};

const tryParseJsonString = (value: string): unknown | null => {
    if (!looksLikeJsonPayload(value)) return null;
    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
};

const tryParsePossiblyTruncatedJson = (value: string): unknown | null => {
    const trimmed = value.trim();
    if (!trimmed || (!trimmed.startsWith('{') && !trimmed.startsWith('['))) return null;

    const direct = tryParseJsonString(trimmed);
    if (direct !== null) return direct;

    for (let index = trimmed.length - 1; index >= 0; index -= 1) {
        const char = trimmed[index];
        if (char !== '}' && char !== ']') continue;
        const candidate = trimmed.slice(0, index + 1);
        try {
            return JSON.parse(candidate);
        } catch {
            // continue scanning backwards
        }
    }

    return null;
};

/** Provider errors often nest JSON inside JSON strings; unwrap them for reading. */
export const hydrateStringifiedJson = (value: unknown, depth = 0): unknown => {
    if (depth > 6) return value;

    if (typeof value === 'string') {
        const parsed = tryParseJsonString(value) ?? tryParsePossiblyTruncatedJson(value);
        if (parsed === null) return value;
        return hydrateStringifiedJson(parsed, depth + 1);
    }

    if (Array.isArray(value)) {
        return value.map((entry) => hydrateStringifiedJson(entry, depth + 1));
    }

    if (value && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
                key,
                hydrateStringifiedJson(entry, depth + 1),
            ])
        );
    }

    return value;
};

export const parseRunError = (errorMessage: string | null | undefined): ParsedRunError => {
    if (!errorMessage || !errorMessage.trim()) {
        return {
            shortMessage: 'Unknown error',
            details: null,
        };
    }

    const trimmed = errorMessage.trim();
    const firstBrace = trimmed.indexOf('{');
    if (firstBrace < 0) {
        return {
            shortMessage: truncate(trimmed, 180),
            details: null,
        };
    }

    const prefix = trimmed.slice(0, firstBrace).replace(/[:\s-]+$/, '').trim();
    const jsonCandidate = trimmed.slice(firstBrace).trim();

    try {
        const parsed = JSON.parse(jsonCandidate);
        return {
            shortMessage: truncate(prefix || 'Detailed provider error', 180),
            details: hydrateStringifiedJson(parsed),
        };
    } catch {
        return {
            shortMessage: truncate(prefix || trimmed, 180),
            details: {
                raw: jsonCandidate,
            },
        };
    }
};

/** The pretty-printed error payload the run inspector shows. */
export const buildRunErrorJson = (run: BenchmarkRun): string => {
    const parsed = parseRunError(run.error_message);
    const payload = hydrateStringifiedJson(parsed.details ?? { error: run.error_message || 'Unknown error' });
    return JSON.stringify(payload, null, 2);
};

// ── Validation ──────────────────────────────────────────────────────────────

export interface ValidationCheckStats {
    total: number;
    passed: number;
}

export const getValidationCheckStats = (checks: Record<string, unknown> | null | undefined): ValidationCheckStats => {
    if (!checks) return { total: 0, passed: 0 };
    const boolEntries = Object.values(checks).filter((value) => typeof value === 'boolean') as boolean[];
    if (boolEntries.length === 0) return { total: 0, passed: 0 };
    return {
        total: boolEntries.length,
        passed: boolEntries.filter(Boolean).length,
    };
};

export const getValidationWarnings = (checks: Record<string, unknown> | null | undefined): string[] => {
    if (!checks) return [];
    const raw = checks.validationWarnings ?? checks.warnings;
    if (!Array.isArray(raw)) return [];
    return raw.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);
};

export const hasRunValidationDetails = (run: BenchmarkRun): boolean => (
    getValidationCheckStats(run.validation_checks).total > 0
    || (run.validation_errors?.length || 0) > 0
    || getValidationWarnings(run.validation_checks).length > 0
    || run.schema_valid !== null
);

export const buildRunValidationJson = (run: BenchmarkRun): string => JSON.stringify({
    schemaValid: run.schema_valid,
    checks: run.validation_checks || {},
    errors: run.validation_errors || [],
    warnings: getValidationWarnings(run.validation_checks),
}, null, 2);

/** One plain label for the validation outcome; colour is only a supporting signal. */
export const getRunValidationVerdict = (run: BenchmarkRun): { label: string; tone: AdminStatusTone } => {
    const warnings = getValidationWarnings(run.validation_checks).length;
    if (run.schema_valid === null) return { label: 'Not checked', tone: 'neutral' };
    if (!run.schema_valid) return { label: 'Validation failed', tone: 'danger' };
    if (warnings > 0) {
        return { label: `Passed with ${warnings} warning${warnings === 1 ? '' : 's'}`, tone: 'warning' };
    }
    return { label: 'Validation passed', tone: 'success' };
};

// ── Summary and filters ─────────────────────────────────────────────────────

export const summarizeRunsLocal = (rows: BenchmarkRun[]): BenchmarkSummary => {
    const total = rows.length;
    const completed = rows.filter((run) => run.status === 'completed').length;
    const failed = rows.filter((run) => run.status === 'failed').length;
    const running = rows.filter((run) => run.status === 'running').length;
    const queued = rows.filter((run) => run.status === 'queued').length;
    const completedLatencies = rows.flatMap((run) => (
        run.status === 'completed' && typeof run.latency_ms === 'number'
            ? [Number(run.latency_ms)]
            : []
    ));
    const averageLatencyMs = completedLatencies.length > 0
        ? Math.round(completedLatencies.reduce((sum, value) => sum + value, 0) / completedLatencies.length)
        : null;
    const totalCostUsd = rows.reduce((sum, run) => sum + (typeof run.cost_usd === 'number' ? run.cost_usd : 0), 0);

    return {
        total,
        completed,
        failed,
        running,
        queued,
        averageLatencyMs,
        totalCostUsd: Number(totalCostUsd.toFixed(6)),
    };
};

/** Completed runs nobody has rated yet: the work left in a review pass. */
export const countUnratedCompletedRuns = (rows: BenchmarkRun[]): number => (
    rows.filter((run) => run.status === 'completed' && !run.satisfaction_rating).length
);

export interface BenchmarkRunFilters {
    provider: 'all' | string;
    hideFailed: boolean;
    onlyWarnings: boolean;
    onlyUnrated: boolean;
}

export const DEFAULT_BENCHMARK_RUN_FILTERS: BenchmarkRunFilters = {
    provider: 'all',
    hideFailed: false,
    onlyWarnings: false,
    onlyUnrated: false,
};

export const hasActiveBenchmarkRunFilter = (filters: BenchmarkRunFilters): boolean => (
    filters.provider !== 'all' || filters.hideFailed || filters.onlyWarnings || filters.onlyUnrated
);

export const filterAndSortBenchmarkRuns = (
    rows: BenchmarkRun[],
    filters: BenchmarkRunFilters,
    direction: RunSortDirection,
): BenchmarkRun[] => {
    const filtered = rows.filter((run) => {
        if (filters.hideFailed && run.status === 'failed') return false;
        if (filters.onlyWarnings && getValidationWarnings(run.validation_checks).length === 0) return false;
        if (filters.onlyUnrated && run.satisfaction_rating) return false;
        if (filters.provider !== 'all' && run.provider !== filters.provider) return false;
        return true;
    });

    return filtered.sort((left, right) => {
        const leftTs = Date.parse(getRunTimestampIso(left) || '');
        const rightTs = Date.parse(getRunTimestampIso(right) || '');
        const leftSafe = Number.isFinite(leftTs) ? leftTs : 0;
        const rightSafe = Number.isFinite(rightTs) ? rightTs : 0;
        if (direction === 'asc') return leftSafe - rightSafe;
        return rightSafe - leftSafe;
    });
};

// ── Per-model comparison ────────────────────────────────────────────────────

export interface BenchmarkModelComparisonRow {
    provider: string;
    model: string;
    totalRuns: number;
    completedRuns: number;
    ratingCount: number;
    averageLatencyMs: number | null;
    averageCostUsd: number | null;
    averageRatingScore: number | null;
    averageTotalTokens: number | null;
    successRate: number;
    repairRate: number;
}

/**
 * Averages per provider/model across the loaded session, best-rated first,
 * then most-rated, then fastest.
 */
export const buildModelComparisonRows = (rows: BenchmarkRun[]): BenchmarkModelComparisonRow[] => {
    const bucket = new Map<string, {
        provider: string;
        model: string;
        totalRuns: number;
        completedRuns: number;
        latencySum: number;
        latencyCount: number;
        costSum: number;
        costCount: number;
        ratingSum: number;
        ratingCount: number;
        totalTokensSum: number;
        totalTokensCount: number;
        repairAttemptedRuns: number;
    }>();

    rows.forEach((run) => {
        const key = `${run.provider}::${run.model}`;
        let entry = bucket.get(key);
        if (!entry) {
            entry = {
                provider: run.provider,
                model: run.model,
                totalRuns: 0,
                completedRuns: 0,
                latencySum: 0,
                latencyCount: 0,
                costSum: 0,
                costCount: 0,
                ratingSum: 0,
                ratingCount: 0,
                totalTokensSum: 0,
                totalTokensCount: 0,
                repairAttemptedRuns: 0,
            };
            bucket.set(key, entry);
        }

        entry.totalRuns += 1;
        if (run.status === 'completed') entry.completedRuns += 1;

        if (typeof run.latency_ms === 'number' && Number.isFinite(run.latency_ms)) {
            entry.latencySum += run.latency_ms;
            entry.latencyCount += 1;
        }

        if (typeof run.cost_usd === 'number' && Number.isFinite(run.cost_usd)) {
            entry.costSum += run.cost_usd;
            entry.costCount += 1;
        }

        if (run.satisfaction_rating && SATISFACTION_SCORE[run.satisfaction_rating]) {
            entry.ratingSum += SATISFACTION_SCORE[run.satisfaction_rating];
            entry.ratingCount += 1;
        }

        const totalTokens = getRunTotalTokens(run);
        if (totalTokens !== null) {
            entry.totalTokensSum += totalTokens;
            entry.totalTokensCount += 1;
        }

        if (run.validation_checks?.semanticRepairAttempted === true) {
            entry.repairAttemptedRuns += 1;
        }
    });

    return Array.from(bucket.values())
        .map((entry) => ({
            provider: entry.provider,
            model: entry.model,
            totalRuns: entry.totalRuns,
            completedRuns: entry.completedRuns,
            ratingCount: entry.ratingCount,
            averageLatencyMs: entry.latencyCount > 0 ? Math.round(entry.latencySum / entry.latencyCount) : null,
            averageCostUsd: entry.costCount > 0 ? Number((entry.costSum / entry.costCount).toFixed(6)) : null,
            averageRatingScore: entry.ratingCount > 0 ? Number((entry.ratingSum / entry.ratingCount).toFixed(2)) : null,
            averageTotalTokens: entry.totalTokensCount > 0 ? Math.round(entry.totalTokensSum / entry.totalTokensCount) : null,
            successRate: entry.totalRuns > 0 ? entry.completedRuns / entry.totalRuns : 0,
            repairRate: entry.totalRuns > 0 ? entry.repairAttemptedRuns / entry.totalRuns : 0,
        }))
        .sort((left, right) => {
            const rightScore = right.averageRatingScore ?? -1;
            const leftScore = left.averageRatingScore ?? -1;
            if (rightScore !== leftScore) return rightScore - leftScore;
            if (right.ratingCount !== left.ratingCount) return right.ratingCount - left.ratingCount;
            const leftLatency = left.averageLatencyMs ?? Number.MAX_SAFE_INTEGER;
            const rightLatency = right.averageLatencyMs ?? Number.MAX_SAFE_INTEGER;
            return leftLatency - rightLatency;
        });
};

/** Which tab to open when the admin has not picked one: results if a session is loaded. */
export type AiBenchmarkWorkspaceTab = 'results' | 'compare' | 'setup';

export const resolveAiBenchmarkWorkspaceTab = (
    chosen: AiBenchmarkWorkspaceTab | null,
    hasSession: boolean,
): AiBenchmarkWorkspaceTab => chosen ?? (hasSession ? 'results' : 'setup');
