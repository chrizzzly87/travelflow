import React, { useId, useMemo } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { adminChartColorVar, defaultAdminChartValueFormatter } from './chartPalette';
import {
    ADMIN_CHART_GRID_PROPS,
    AdminCartesianChartFrame,
    type AdminCartesianChartProps,
    buildXAxisProps,
    buildYAxisProps,
    createTooltipRenderer,
    resolveCartesianSeries,
} from './cartesianShared';

export interface AdminAreaChartProps extends AdminCartesianChartProps {
    /** Bridge missing values instead of breaking the line. */
    connectNulls?: boolean;
    /** Fade the area fill towards the axis; otherwise a flat translucent fill. */
    showGradient?: boolean;
}

/**
 * Line-and-area trend chart for admin pages. Keyboard users focus the plot and use
 * the arrow keys to move the tooltip between points.
 */
export const AdminAreaChart: React.FC<AdminAreaChartProps> = ({
    data,
    index,
    categories,
    colors,
    valueFormatter = defaultAdminChartValueFormatter,
    yAxisWidth,
    minValue,
    maxValue,
    startEndOnly,
    connectNulls = false,
    showGradient = true,
    showLegend = true,
    showTooltip = true,
    customTooltip,
    ariaLabel,
    className,
}) => {
    const gradientIdBase = useId().replace(/[^a-zA-Z0-9_-]/g, '');
    const series = useMemo(() => resolveCartesianSeries(categories, colors), [categories, colors]);
    const renderTooltip = useMemo(() => createTooltipRenderer(valueFormatter, customTooltip), [customTooltip, valueFormatter]);

    return (
        <AdminCartesianChartFrame
            kind="area"
            ariaLabel={ariaLabel}
            className={className}
            showLegend={showLegend}
            series={series}
            data={data}
            index={index}
            valueFormatter={valueFormatter}
        >
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                    data={data as Array<Record<string, unknown>>}
                    margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
                    title={ariaLabel}
                    accessibilityLayer
                >
                    <defs>
                        {series.map((entry, position) => (
                            <linearGradient key={entry.name} id={`${gradientIdBase}-${position}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={adminChartColorVar(entry.color)} stopOpacity={showGradient ? 0.4 : 0.2} />
                                <stop offset="95%" stopColor={adminChartColorVar(entry.color)} stopOpacity={showGradient ? 0 : 0.2} />
                            </linearGradient>
                        ))}
                    </defs>
                    <CartesianGrid {...ADMIN_CHART_GRID_PROPS} />
                    <XAxis {...buildXAxisProps(data, index, startEndOnly)} />
                    <YAxis {...buildYAxisProps({ yAxisWidth, minValue, maxValue, valueFormatter })} />
                    {showTooltip ? (
                        <Tooltip
                            content={renderTooltip}
                            cursor={{ stroke: 'var(--muted-foreground)', strokeWidth: 1 }}
                            isAnimationActive={false}
                            wrapperStyle={{ outline: 'none', zIndex: 20 }}
                        />
                    ) : null}
                    {series.map((entry, position) => (
                        <Area
                            key={entry.name}
                            type="linear"
                            dataKey={entry.name}
                            name={entry.name}
                            stroke={adminChartColorVar(entry.color)}
                            strokeWidth={2}
                            fill={`url(#${gradientIdBase}-${position})`}
                            dot={false}
                            activeDot={{ r: 5, stroke: 'var(--card)', strokeWidth: 2, fill: adminChartColorVar(entry.color) }}
                            connectNulls={connectNulls}
                            isAnimationActive={false}
                        />
                    ))}
                </AreaChart>
            </ResponsiveContainer>
        </AdminCartesianChartFrame>
    );
};
