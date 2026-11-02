import React from 'react';
import { ArrowClockwise } from '@phosphor-icons/react';
import { Link } from '@/app/navigation';
import { getAnalyticsDebugAttributes, trackEvent } from '../../../services/analyticsService';
import { AdminErrorAlert } from '../AdminErrorAlert';
import { AdminSectionHeader } from '../AdminSectionHeader';
import { AdminStatCard } from '../AdminStatCard';
import { AdminSurfaceCard } from '../AdminSurfaceCard';
import { AiProviderLabel as ProviderLabel } from '../AiProviderLogo';
import { formatUsd } from '../aiBenchmarkRuns';
import { Button } from '../../ui/button';
import type { AiBenchmarkTelemetry } from './useAiBenchmarkTelemetry';

/** Last 7 days of all AI calls: totals and the fastest, cheapest and best-value models. */
export const AiBenchmarkTelemetrySnapshot: React.FC<{ telemetry: AiBenchmarkTelemetry }> = ({ telemetry }) => {
    const { loading, error, summary, cards, refreshTelemetry } = telemetry;
    return (
        <AdminSurfaceCard className="flex flex-col gap-4">
            <AdminSectionHeader
                title="Last 7 days, all AI calls"
                description={summary ? (
                    <span className="tabular-nums">
                        {summary.total.toLocaleString()} calls · {summary.successRate.toFixed(1)}% success · {formatUsd(summary.totalCostUsd)}
                    </span>
                ) : 'Benchmark and live planner calls together. Leaders across the whole week.'}
                actions={(
                    <>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => void refreshTelemetry()}
                            disabled={loading}
                            aria-busy={loading || undefined}
                        >
                            <ArrowClockwise className={loading ? 'animate-spin' : ''} />
                            Reload
                        </Button>
                        <Button asChild variant="ghost" size="sm">
                            <Link
                                to="/admin/ai-benchmark/telemetry"
                                onClick={() => trackEvent('admin__ai_benchmark--open_telemetry')}
                                {...getAnalyticsDebugAttributes('admin__ai_benchmark--open_telemetry')}
                            >
                                Open AI telemetry
                            </Link>
                        </Button>
                    </>
                )}
            />

            {error && <AdminErrorAlert message={error} />}

            <div className="grid gap-4 xl:grid-cols-3">
                {cards.map((card) => (
                    <AdminStatCard
                        key={card.id}
                        label={card.title}
                        value={<span className="tabular-nums">{card.metric}</span>}
                        hint={card.detail}
                        isLoading={loading}
                    >
                        <div className="text-sm">
                            {card.model ? (
                                <ProviderLabel
                                    provider={card.model.provider}
                                    model={card.model.model}
                                    providerClassName="font-medium text-foreground"
                                    modelClassName="truncate text-muted-foreground"
                                    logoSize={14}
                                />
                            ) : <span className="text-muted-foreground">No model yet</span>}
                        </div>
                    </AdminStatCard>
                ))}
            </div>
        </AdminSurfaceCard>
    );
};
