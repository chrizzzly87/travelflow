import React from 'react';
import { cn } from '../../../lib/utils';
import {
    adminChartColorVar,
    type AdminChartColor,
    type AdminChartValueFormatter,
    toChartNumber,
} from './chartPalette';

export type AdminChartRow = Record<string, unknown>;

export interface AdminChartTooltipEntry {
    name: string;
    value: unknown;
    color?: string;
    dataKey?: string | number;
    /** The full data row the entry belongs to. */
    payload?: AdminChartRow;
}

/** Props a `customTooltip` component receives. */
export interface AdminChartTooltipProps {
    active: boolean;
    payload: AdminChartTooltipEntry[];
    label?: string | number;
}

interface RechartsTooltipEntryLike {
    name?: unknown;
    value?: unknown;
    color?: unknown;
    fill?: unknown;
    stroke?: unknown;
    dataKey?: unknown;
    payload?: unknown;
}

/** Normalises recharts' tooltip payload into the narrow, documented shape. */
export const toAdminChartTooltipEntries = (payload: unknown): AdminChartTooltipEntry[] => {
    if (!Array.isArray(payload)) return [];
    return payload.map((raw: RechartsTooltipEntryLike) => {
        const colorCandidate = [raw.color, raw.fill, raw.stroke].find((value) => typeof value === 'string' && value && !value.startsWith('url('));
        return {
            name: String(raw.name ?? raw.dataKey ?? 'Value'),
            value: raw.value,
            color: typeof colorCandidate === 'string' ? colorCandidate : undefined,
            dataKey: typeof raw.dataKey === 'string' || typeof raw.dataKey === 'number' ? raw.dataKey : undefined,
            payload: raw.payload && typeof raw.payload === 'object' ? raw.payload as AdminChartRow : undefined,
        };
    });
};

export const AdminChartColorDot: React.FC<{ color?: string; className?: string }> = ({ color, className }) => (
    <span
        aria-hidden="true"
        className={cn('inline-block size-2.5 shrink-0 rounded-full', className)}
        style={color ? { backgroundColor: color } : undefined}
    />
);

export const AdminChartTooltipContent: React.FC<AdminChartTooltipProps & {
    valueFormatter: AdminChartValueFormatter;
}> = ({ active, payload, label, valueFormatter }) => {
    if (!active || payload.length === 0) return null;
    return (
        <div className="min-w-36 rounded-md border border-border bg-popover text-sm text-popover-foreground shadow-lg dark:shadow-none" data-admin-chart-tooltip="">
            {label !== undefined && label !== '' ? (
                <p className="border-b border-border px-3 py-1.5 font-medium text-foreground">{label}</p>
            ) : null}
            <div className="space-y-1 px-3 py-1.5">
                {payload.map((entry) => {
                    const value = toChartNumber(entry.value);
                    return (
                        <div key={`${entry.dataKey ?? entry.name}`} className="flex items-center justify-between gap-6">
                            <span className="inline-flex min-w-0 items-center gap-2 text-muted-foreground">
                                <AdminChartColorDot color={entry.color} />
                                <span className="truncate">{entry.name}</span>
                            </span>
                            <span className="font-medium tabular-nums text-foreground">
                                {value === null ? '—' : valueFormatter(value)}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export const AdminChartLegend: React.FC<{
    items: Array<{ name: string; color: AdminChartColor }>;
    className?: string;
}> = ({ items, className }) => (
    <ul className={cn('flex flex-wrap items-center justify-end gap-x-4 gap-y-1 text-xs text-muted-foreground', className)} data-admin-chart-legend="">
        {items.map((item) => (
            <li key={item.name} className="inline-flex items-center gap-1.5">
                <AdminChartColorDot color={adminChartColorVar(item.color)} />
                <span>{item.name}</span>
            </li>
        ))}
    </ul>
);

/**
 * Text alternative for a chart: a visually hidden table with every plotted value,
 * so screen readers get the numbers rather than an unlabelled drawing.
 */
export const AdminChartDataTable: React.FC<{
    caption: string;
    index: string;
    categories: readonly string[];
    data: readonly AdminChartRow[];
    valueFormatter: AdminChartValueFormatter;
}> = ({ caption, index, categories, data, valueFormatter }) => (
    <table className="sr-only">
        <caption>{caption}</caption>
        <thead>
            <tr>
                <th scope="col">{index}</th>
                {categories.map((category) => <th key={category} scope="col">{category}</th>)}
            </tr>
        </thead>
        <tbody>
            {data.map((row, rowIndex) => (
                <tr key={`${String(row[index])}-${rowIndex}`}>
                    <th scope="row">{String(row[index] ?? '')}</th>
                    {categories.map((category) => {
                        const value = toChartNumber(row[category]);
                        return <td key={category}>{value === null ? '—' : valueFormatter(value)}</td>;
                    })}
                </tr>
            ))}
        </tbody>
    </table>
);

export const ADMIN_CHART_AXIS_TICK = {
    fill: 'var(--muted-foreground)',
    fontSize: 12,
} as const;
