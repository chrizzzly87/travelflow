import React, { useMemo } from 'react';
import { cn } from '../../../lib/utils';
import {
    adminChartColorVar,
    type AdminChartColor,
    type AdminChartValueFormatter,
    defaultAdminChartValueFormatter,
} from './chartPalette';

export interface AdminBarListItem {
    /** Stable identity; falls back to the name when it is a string. */
    key?: string;
    name: React.ReactNode;
    value: number;
    href?: string;
}

export interface AdminBarListProps<TItem extends AdminBarListItem = AdminBarListItem> {
    data: readonly TItem[];
    valueFormatter?: AdminChartValueFormatter;
    sortOrder?: 'ascending' | 'descending' | 'none';
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

/** Ranked horizontal bars with the value at the inline end, built from plain HTML. */
export const AdminBarList = <TItem extends AdminBarListItem>({
    data,
    valueFormatter = defaultAdminChartValueFormatter,
    sortOrder = 'descending',
    color = 'blue',
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

    const maxValue = useMemo(() => Math.max(0, ...rows.map((row) => row.value)), [rows]);

    return (
        <ul aria-label={ariaLabel} className={cn('flex flex-col gap-1.5', className)} data-admin-chart="bar-list">
            {rows.map((item, position) => {
                const widthPercent = maxValue > 0 ? Math.max((item.value / maxValue) * 100, 1) : 1;
                const formattedValue = valueFormatter(item.value);
                // A link inside a row button would nest interactive content; selectable rows drop it.
                const nameContent = item.href && !onValueChange ? (
                    <a
                        href={item.href}
                        className="truncate hover:underline focus-visible:underline focus-visible:outline-none"
                        onClick={(event) => event.stopPropagation()}
                    >
                        {item.name}
                    </a>
                ) : (
                    <span className="min-w-0 truncate">{item.name}</span>
                );
                const rowBody = (
                    <>
                        <span className="relative flex h-8 min-w-0 flex-1 items-center">
                            <span
                                aria-hidden="true"
                                className="absolute inset-y-0 start-0 rounded-sm opacity-30 dark:opacity-40"
                                style={{ width: `${widthPercent}%`, backgroundColor: adminChartColorVar(color) }}
                                data-admin-bar-list-bar=""
                            />
                            <span className="relative flex min-w-0 items-center px-2 text-sm text-foreground">
                                {nameContent}
                            </span>
                        </span>
                        <span className="shrink-0 ps-3 text-sm font-medium tabular-nums text-foreground">{formattedValue}</span>
                    </>
                );
                return (
                    <li key={itemKey(item, position)}>
                        {onValueChange ? (
                            <button
                                type="button"
                                onClick={() => onValueChange(item)}
                                className="flex w-full items-center rounded-sm text-start transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                {rowBody}
                            </button>
                        ) : (
                            <div className="flex w-full items-center">{rowBody}</div>
                        )}
                    </li>
                );
            })}
        </ul>
    );
};
