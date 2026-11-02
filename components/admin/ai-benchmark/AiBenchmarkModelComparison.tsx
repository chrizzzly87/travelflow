import React from 'react';
import { AdminEmptyState } from '../AdminEmptyState';
import { AdminSectionHeader } from '../AdminSectionHeader';
import { AdminSurfaceCard } from '../AdminSurfaceCard';
import { AiProviderLabel as ProviderLabel } from '../AiProviderLogo';
import { formatDuration, formatUsd, type BenchmarkModelComparisonRow } from '../aiBenchmarkRuns';
import { Button } from '../../ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';
import { getComparisonRatingClass } from './aiBenchmarkModel';

/** Per-model averages for the session, best rated first. */
export const AiBenchmarkModelComparison: React.FC<{
    rows: BenchmarkModelComparisonRow[];
    onGoToSetup: () => void;
}> = ({ rows, onGoToSetup }) => (
    <AdminSurfaceCard className="flex flex-col gap-4">
        <AdminSectionHeader
            title="Model comparison"
            description="Averages per model in this session, best rated first. Rate runs to rank them."
        />

        {rows.length === 0 ? (
            <AdminEmptyState
                title="Nothing to compare yet"
                description="Run at least one model, then rate its trips in Runs."
                action={(
                    <Button type="button" variant="outline" size="sm" onClick={onGoToSetup}>
                        Go to setup
                    </Button>
                )}
            />
        ) : (
            <div className="overflow-x-auto rounded-md border border-border">
                <Table className="text-xs">
                    <TableHeader className="bg-secondary">
                        <TableRow className="hover:bg-transparent">
                            <TableHead className="ps-3">Model</TableHead>
                            <TableHead>Rating</TableHead>
                            <TableHead>Success</TableHead>
                            <TableHead>Avg time</TableHead>
                            <TableHead>Avg cost</TableHead>
                            <TableHead>Avg tokens</TableHead>
                            <TableHead>
                                <span data-tooltip="Share of runs where the semantic repair pass ran." tabIndex={0}>Repair</span>
                            </TableHead>
                            <TableHead className="pe-3">Runs</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows.map((row) => (
                            <TableRow key={`${row.provider}-${row.model}`}>
                                <TableCell className="ps-3 font-medium text-foreground">
                                    <ProviderLabel provider={row.provider} model={row.model} logoSize={13} />
                                </TableCell>
                                <TableCell className="tabular-nums">
                                    {row.averageRatingScore === null ? (
                                        <span className="text-muted-foreground">No votes</span>
                                    ) : (
                                        <>
                                            <span className={`font-medium ${getComparisonRatingClass(row.averageRatingScore)}`}>{row.averageRatingScore.toFixed(2)} / 3</span>
                                            <span className="ms-1 text-muted-foreground">· {row.ratingCount} vote{row.ratingCount === 1 ? '' : 's'}</span>
                                        </>
                                    )}
                                </TableCell>
                                <TableCell className="tabular-nums text-foreground">{Math.round(row.successRate * 100)}%</TableCell>
                                <TableCell className="tabular-nums text-foreground">{formatDuration(row.averageLatencyMs)}</TableCell>
                                <TableCell className="tabular-nums text-foreground">{formatUsd(row.averageCostUsd)}</TableCell>
                                <TableCell className="tabular-nums text-foreground">{row.averageTotalTokens?.toLocaleString() ?? '—'}</TableCell>
                                <TableCell className="tabular-nums text-foreground">{Math.round(row.repairRate * 100)}%</TableCell>
                                <TableCell className="pe-3 tabular-nums text-foreground">{row.totalRuns}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        )}
    </AdminSurfaceCard>
);
