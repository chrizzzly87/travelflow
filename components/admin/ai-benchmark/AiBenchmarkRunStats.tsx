import React from 'react';
import { getAnalyticsDebugAttributes, trackEvent } from '../../../services/analyticsService';
import { AdminStatCard } from '../AdminStatCard';
import { formatDuration, formatUsd, type BenchmarkSummary } from '../aiBenchmarkRuns';
import { Button } from '../../ui/button';

/** Completed, latency, cost and "to rate" tiles above the runs table. */
export const AiBenchmarkRunStats: React.FC<{
    summary: BenchmarkSummary;
    hasExactCostData: boolean;
    unratedRunCount: number;
    onlyUnrated: boolean;
    onShowUnrated: () => void;
}> = ({ summary, hasExactCostData, unratedRunCount, onlyUnrated, onShowUnrated }) => (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard
            label="Completed"
            value={<span className="tabular-nums">{summary.completed}/{summary.total}</span>}
            hint={summary.failed > 0 ? `${summary.failed} failed · open a run for the error` : 'No failed runs'}
            hintTone={summary.failed > 0 ? 'negative' : 'neutral'}
        />
        <AdminStatCard
            label="Avg latency"
            value={<span className="tabular-nums">{formatDuration(summary.averageLatencyMs)}</span>}
            hint="Completed runs only"
        />
        <AdminStatCard
            label="Total cost"
            value={<span className="tabular-nums">{hasExactCostData ? formatUsd(summary.totalCostUsd) : '—'}</span>}
            hint={hasExactCostData ? 'As reported by the providers' : 'No provider has reported a cost yet'}
        />
        <AdminStatCard
            label="To rate"
            value={<span className="tabular-nums">{unratedRunCount}</span>}
            hint={unratedRunCount > 0 ? 'Completed runs without a rating' : 'Every completed run is rated'}
            hintTone={unratedRunCount > 0 ? 'warning' : 'positive'}
        >
            {unratedRunCount > 0 && !onlyUnrated && (
                <Button
                    type="button"
                    variant="link"
                    size="xs"
                    className="h-auto self-start p-0"
                    onClick={() => {
                        trackEvent('admin__ai_benchmark--show_unrated');
                        onShowUnrated();
                    }}
                    {...getAnalyticsDebugAttributes('admin__ai_benchmark--show_unrated')}
                >
                    Show unrated runs
                </Button>
            )}
        </AdminStatCard>
    </div>
);
