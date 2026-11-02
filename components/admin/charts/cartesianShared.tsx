import React from 'react';
import { cn } from '../../../lib/utils';
import {
    type AdminChartColor,
    type AdminChartValueFormatter,
    defaultAdminChartValueFormatter,
    resolveAdminChartColor,
} from './chartPalette';
import {
    ADMIN_CHART_AXIS_TICK,
    AdminChartDataTable,
    AdminChartLegend,
    type AdminChartRow,
    AdminChartTooltipContent,
    type AdminChartTooltipProps,
    toAdminChartTooltipEntries,
} from './chartPrimitives';

/** Props shared by the bar and area charts; mirrors the contract the admin pages already use. */
export interface AdminCartesianChartProps {
    data: readonly AdminChartRow[];
    /** Key of the x-axis label in each row. */
    index: string;
    /** Keys of the plotted series; also their legend and tooltip names. */
    categories: readonly string[];
    colors?: readonly AdminChartColor[];
    valueFormatter?: AdminChartValueFormatter;
    yAxisWidth?: number;
    minValue?: number;
    maxValue?: number;
    /** Only label the first and last x-axis ticks. */
    startEndOnly?: boolean;
    showLegend?: boolean;
    showTooltip?: boolean;
    customTooltip?: React.ComponentType<AdminChartTooltipProps>;
    /** Accessible name of the chart; also the caption of its hidden data table. */
    ariaLabel: string;
    className?: string;
}

export const resolveCartesianSeries = (categories: readonly string[], colors?: readonly AdminChartColor[]) => (
    categories.map((name, position) => ({ name, color: resolveAdminChartColor(position, colors) }))
);

export const buildXAxisProps = (data: readonly AdminChartRow[], index: string, startEndOnly?: boolean) => ({
    dataKey: index,
    tick: ADMIN_CHART_AXIS_TICK,
    tickLine: false,
    axisLine: false,
    tickMargin: 8,
    minTickGap: 5,
    interval: 'preserveStartEnd' as const,
    ticks: startEndOnly && data.length > 0
        ? [data[0][index], data[data.length - 1][index]] as Array<string | number>
        : undefined,
});

export const buildYAxisProps = ({
    yAxisWidth = 56,
    minValue,
    maxValue,
    valueFormatter = defaultAdminChartValueFormatter,
}: Pick<AdminCartesianChartProps, 'yAxisWidth' | 'minValue' | 'maxValue' | 'valueFormatter'>) => ({
    width: yAxisWidth,
    tick: ADMIN_CHART_AXIS_TICK,
    tickLine: false,
    axisLine: false,
    type: 'number' as const,
    domain: [minValue ?? 0, maxValue ?? 'auto'] as [number, number | 'auto'],
    tickFormatter: (value: number) => valueFormatter(value),
});

export const ADMIN_CHART_GRID_PROPS = {
    vertical: false,
    stroke: 'var(--border)',
    strokeDasharray: '',
} as const;

/** Renders the custom tooltip (when given) or the shared default for recharts' `content`. */
export const createTooltipRenderer = (
    valueFormatter: AdminChartValueFormatter,
    CustomTooltip?: React.ComponentType<AdminChartTooltipProps>,
) => {
    const TooltipRenderer = (props: { active?: boolean; payload?: unknown; label?: string | number }) => {
        const payload = toAdminChartTooltipEntries(props.payload);
        const active = Boolean(props.active) && payload.length > 0;
        if (CustomTooltip) return <CustomTooltip active={active} payload={payload} label={props.label} />;
        return <AdminChartTooltipContent active={active} payload={payload} label={props.label} valueFormatter={valueFormatter} />;
    };
    return TooltipRenderer;
};

/** Legend, accessible frame and hidden data table around a recharts surface. */
export const AdminCartesianChartFrame: React.FC<{
    kind: 'bar' | 'area';
    ariaLabel: string;
    className?: string;
    showLegend: boolean;
    series: Array<{ name: string; color: AdminChartColor }>;
    data: readonly AdminChartRow[];
    index: string;
    valueFormatter: AdminChartValueFormatter;
    children: React.ReactNode;
}> = ({ kind, ariaLabel, className, showLegend, series, data, index, valueFormatter, children }) => (
    <figure
        role="figure"
        aria-label={ariaLabel}
        data-admin-chart={kind}
        className={cn('m-0 flex h-72 w-full min-w-0 flex-col gap-2', className)}
    >
        {showLegend ? <AdminChartLegend items={series} /> : null}
        <div className="min-h-0 w-full flex-1">{children}</div>
        <AdminChartDataTable
            caption={ariaLabel}
            index={index}
            categories={series.map((entry) => entry.name)}
            data={data}
            valueFormatter={valueFormatter}
        />
    </figure>
);
