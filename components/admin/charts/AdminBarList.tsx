import React, { useMemo } from 'react';
import { cn } from '../../../lib/utils';
import {
    adminChartColorVar,
    type AdminChartColor,
    type AdminChartValueFormatter,
    defaultAdminChartValueFormatter,
    resolveAdminChartColor,
} from './chartPalette';

export interface AdminBarListItem {
    /** Stable identity; falls back to the name when it is a string. */
    key?: string;
    name: React.ReactNode;
    value: number;
    /** Shown at the inline end instead of `valueFormatter(value)`, e.g. "3 · 30%". */
    valueLabel?: React.ReactNode;
    /** Per-row colour; otherwise `color`, otherwise the palette in order. */
    color?: AdminChartColor;
    /** Plain-text hover detail (global `data-tooltip` layer). */
    tooltip?: string;
    href?: string;
}

export interface AdminBarListProps<TItem extends AdminBarListItem = AdminBarListItem> {
    data: readonly TItem[];
    valueFormatter?: AdminChartValueFormatter;
    sortOrder?: 'ascending' | 'descending' | 'none';
    /** `max`: the largest row fills the track. `total`: each row shows its share of the sum. */
    scale?: 'max' | 'total';
    /** One colour for every row. Omit to cycle the palette and show a swatch per row. */
    color?: AdminChartColor;
    /** Makes each row a button that reports the clicked item. */
    onValueChange?: (item: TItem) => void;
    /** Accessible name of the list. */
    ariaLabel?: string;
    className?: string;
}

const itemKey = (item: AdminBarListItem, position: number): string => (
    item.key ?? (typeof item.name === 'string' ? item.name : `item-${position}`)
);

/**
 * Ranked rows for breakdowns and leaderboards: label and tabular value on one
 * line, a thin track underneath. Plain HTML, so it reads and prints as a list.
 */
export const AdminBarList = <TItem extends AdminBarListItem>({
    data,
    valueFormatter = defaultAdminChartValueFormatter,
    sortOrder = 'descending',
    scale = 'max',
    color,
    onValueChange,
    ariaLabel,
    className,
}: AdminBarListProps<TItem>) => {
    const rows = useMemo(() => {
        if (sortOrder === 'none') return Array.from(data);
        return Array.from(data).sort((left, right) => (
            sortOrder === 'ascending' ? left.value - right.value : right.value - left.value
        ));
    }, [data, sortOrder]);

    const denominator = useMemo(() => (
        scale === 'total'
            ? rows.reduce((sum, row) => sum + row.value, 0)
            : Math.max(0, ...rows.map((row) => row.value))
    ), [rows, scale]);
    const showSwatch = !color;

    return (
        <ul aria-label={ariaLabel} className={cn('flex flex-col gap-3.5', className)} data-admin-chart="bar-list">
            {rows.map((item, position) => {
                const fill = adminChartColorVar(item.color ?? color ?? resolveAdminChartColor(position));
                const widthPercent = denominator > 0 ? Math.min(100, (item.value / denominator) * 100) : 0;
                // A link inside a row button would nest interactive content; selectable rows drop it.
                const nameContent = item.href && !onValueChange ? (
                    <a
                        href={item.href}
                        className="min-w-0 truncate hover:underline focus-visible:underline focus-visible:outline-none"
                        onClick={(event) => event.stopPropagation()}
                    >
                        {item.name}
                    </a>
                ) : (
                    <span className="min-w-0 truncate">{item.name}</span>
                );
                const rowBody = (
                    <span className="flex w-full min-w-0 flex-col gap-1.5">
                        <span className="flex w-full items-center justify-between gap-2 text-sm">
                            <span className="flex min-w-0 items-center gap-2 font-medium text-foreground">
                                {showSwatch && (
                                    <span className="size-2 shrink-0 rounded-[2px]" style={{ backgroundColor: fill }} aria-hidden="true" />
                                )}
                                {nameContent}
                            </span>
                            <span className="shrink-0 tabular-nums text-muted-foreground">
                                {item.valueLabel ?? valueFormatter(item.value)}
                            </span>
                        </span>
                        <span className="h-1.5 w-full overflow-hidden rounded-full bg-secondary" aria-hidden="true">
                            <span
                                className="block h-full rounded-full transition-[width]"
                                style={{ width: `${widthPercent}%`, backgroundColor: fill }}
                                data-admin-bar-list-bar=""
                            />
                        </span>
                    </span>
                );
                return (
                    <li key={itemKey(item, position)} data-tooltip={item.tooltip}>
                        {onValueChange ? (
                            <button
                                type="button"
                                onClick={() => onValueChange(item)}
                                className="flex w-full rounded-md p-1 text-start transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                {rowBody}
                            </button>
                        ) : (
                            rowBody
                        )}
                    </li>
                );
            })}
        </ul>
    );
};
