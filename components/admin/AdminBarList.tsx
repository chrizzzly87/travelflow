import React from 'react';

import { cn } from '../../lib/utils';
import { ADMIN_CHART_COLORS } from './AdminBarChart';

export interface AdminBarListItem {
    key: string;
    label: React.ReactNode;
    value: number;
    /** Shown at the inline end; defaults to `valueFormatter(value)`. */
    valueLabel?: React.ReactNode;
    /** Per-row fill; otherwise `color`, otherwise the chart palette in order. */
    color?: string;
    /** Plain-text hover detail (global `data-tooltip` layer). */
    tooltip?: string;
}

interface AdminBarListProps {
    items: AdminBarListItem[];
    ariaLabel: string;
    /** One fill for every row. Omit to cycle the chart palette and show a swatch per row. */
    color?: string;
    valueFormatter?: (value: number) => string;
    sortOrder?: 'none' | 'ascending' | 'descending';
    /** `max`: the largest row fills the track. `total`: each row shows its share of the sum. */
    scale?: 'max' | 'total';
    className?: string;
}

const defaultFormatter = (value: number) => value.toLocaleString();

/**
 * Ranked rows with a label, a tabular value and a thin share track — the list
 * counterpart of `AdminBarChart`, for breakdowns and leaderboards.
 */
export const AdminBarList: React.FC<AdminBarListProps> = ({
    items,
    ariaLabel,
    color,
    valueFormatter = defaultFormatter,
    sortOrder = 'none',
    scale = 'max',
    className,
}) => {
    const rows = sortOrder === 'none'
        ? items
        : [...items].sort((left, right) => (sortOrder === 'ascending' ? left.value - right.value : right.value - left.value));
    const denominator = scale === 'total'
        ? rows.reduce((sum, item) => sum + item.value, 0)
        : rows.reduce((highest, item) => Math.max(highest, item.value), 0);
    const showSwatch = !color;

    return (
        <ul className={cn('flex flex-col gap-3.5', className)} aria-label={ariaLabel}>
            {rows.map((item, position) => {
                const fill = item.color ?? color ?? ADMIN_CHART_COLORS[position % ADMIN_CHART_COLORS.length];
                const width = denominator > 0 ? Math.min(100, (item.value / denominator) * 100) : 0;
                return (
                    <li key={item.key} className="flex flex-col gap-1.5" data-tooltip={item.tooltip}>
                        <div className="flex items-center justify-between gap-2 text-sm">
                            <span className="flex min-w-0 items-center gap-2 font-medium text-foreground">
                                {showSwatch && (
                                    <span className="size-2 shrink-0 rounded-[2px]" style={{ backgroundColor: fill }} aria-hidden="true" />
                                )}
                                <span className="min-w-0 truncate">{item.label}</span>
                            </span>
                            <span className="shrink-0 tabular-nums text-muted-foreground">
                                {item.valueLabel ?? valueFormatter(item.value)}
                            </span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-secondary" aria-hidden="true">
                            <div className="h-full rounded-full transition-[width]" style={{ width: `${width}%`, backgroundColor: fill }} />
                        </div>
                    </li>
                );
            })}
        </ul>
    );
};
