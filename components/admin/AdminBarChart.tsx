import React, { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';

import {
    ChartContainer,
    ChartLegend,
    ChartLegendContent,
    ChartTooltip,
    ChartTooltipContent,
    chartColor,
    type ChartConfig,
} from '../ui/chart';
import { cn } from '../../lib/utils';

/** The series palette, in the order series are assigned (index.css `--chart-*`). */
export const ADMIN_CHART_COLORS = [
    'var(--chart-1)',
    'var(--chart-2)',
    'var(--chart-3)',
    'var(--chart-4)',
    'var(--chart-5)',
] as const;

export interface AdminBarChartProps<TDatum extends Record<string, unknown>> {
    data: TDatum[];
    /** The key on each datum used for the x axis (or y axis when `layout="vertical"`). */
    index: keyof TDatum & string;
    /** The numeric series to draw; each becomes a bar or a stacked segment. */
    categories: readonly string[];
    /** Optional per-series colour overrides; defaults cycle `ADMIN_CHART_COLORS`. */
    colors?: Partial<Record<string, string>>;
    stacked?: boolean;
    layout?: 'horizontal' | 'vertical';
    showLegend?: boolean;
    valueFormatter?: (value: number) => string;
    /** Applied to the chart container; set the height here (default h-64). */
    className?: string;
    /** Accessible summary of what the chart shows. */
    ariaLabel?: string;
}

const formatTick = (value: unknown): string => {
    if (typeof value !== 'string') return String(value ?? '');
    // ISO dates read better as "Oct 12" on a dense axis.
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
        const date = new Date(`${value.slice(0, 10)}T00:00:00`);
        if (!Number.isNaN(date.getTime())) {
            return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        }
    }
    return value.length > 14 ? `${value.slice(0, 13)}…` : value;
};

/**
 * A themed bar chart for admin screens (shadcn chart on Recharts). Replaces the
 * Tremor charts: colours come from `--chart-*` tokens, so light and dark match.
 */
export const AdminBarChart = <TDatum extends Record<string, unknown>>({
    data,
    index,
    categories,
    colors,
    stacked = false,
    layout = 'horizontal',
    showLegend = true,
    valueFormatter,
    className,
    ariaLabel,
}: AdminBarChartProps<TDatum>) => {
    const config = useMemo<ChartConfig>(() => (
        Object.fromEntries(categories.map((category, position) => [
            category,
            {
                label: category,
                color: colors?.[category] ?? ADMIN_CHART_COLORS[position % ADMIN_CHART_COLORS.length],
            },
        ]))
    ), [categories, colors]);

    const isVertical = layout === 'vertical';
    const lastCategory = categories[categories.length - 1];

    return (
        <ChartContainer
            config={config}
            className={cn('aspect-auto h-64 w-full', className)}
            role="img"
            aria-label={ariaLabel}
        >
            <BarChart
                data={data}
                layout={isVertical ? 'vertical' : 'horizontal'}
                margin={{ top: 4, right: 4, bottom: 0, left: isVertical ? 4 : -12 }}
                barCategoryGap={isVertical ? 6 : '20%'}
            >
                <CartesianGrid vertical={isVertical} horizontal={!isVertical} strokeDasharray="3 3" />
                {/* Recharts finds axes among its direct children, so no fragments here. */}
                {isVertical
                    ? <XAxis type="number" tickLine={false} axisLine={false} tickMargin={6} allowDecimals={false} tickFormatter={valueFormatter} />
                    : <XAxis dataKey={index} tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} tickFormatter={formatTick} />}
                {isVertical
                    ? <YAxis type="category" dataKey={index} tickLine={false} axisLine={false} width={120} tickFormatter={formatTick} />
                    : <YAxis tickLine={false} axisLine={false} tickMargin={6} width={40} allowDecimals={false} tickFormatter={valueFormatter} />}
                <ChartTooltip
                    cursor={{ fillOpacity: 0.6 }}
                    content={(
                        <ChartTooltipContent
                            labelFormatter={(label) => formatTick(label)}
                            valueFormatter={valueFormatter ? (value) => valueFormatter(Number(value)) : undefined}
                        />
                    )}
                />
                {showLegend && categories.length > 1 && <ChartLegend content={<ChartLegendContent />} />}
                {categories.map((category) => {
                    const isTop = !stacked || category === lastCategory;
                    const radius: [number, number, number, number] = isVertical
                        ? (isTop ? [0, 3, 3, 0] : [0, 0, 0, 0])
                        : (isTop ? [3, 3, 0, 0] : [0, 0, 0, 0]);
                    return (
                        <Bar
                            key={category}
                            dataKey={category}
                            stackId={stacked ? 'stack' : undefined}
                            fill={chartColor(category)}
                            radius={radius}
                            maxBarSize={isVertical ? 18 : 32}
                            isAnimationActive={false}
                        />
                    );
                })}
            </BarChart>
        </ChartContainer>
    );
};
