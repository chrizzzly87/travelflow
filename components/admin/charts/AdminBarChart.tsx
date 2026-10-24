import React, { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
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

export interface AdminBarChartProps extends AdminCartesianChartProps {
    /** Stack every category into one column per x value. */
    stack?: boolean;
}

/**
 * Vertical-column bar chart for admin pages. Keyboard users focus the plot and use
 * the arrow keys to move the tooltip between columns (recharts' accessibility layer).
 */
export const AdminBarChart: React.FC<AdminBarChartProps> = ({
    data,
    index,
    categories,
    colors,
    valueFormatter = defaultAdminChartValueFormatter,
    yAxisWidth,
    minValue,
    maxValue,
    startEndOnly,
    stack = false,
    showLegend = true,
    showTooltip = true,
    customTooltip,
    ariaLabel,
    className,
}) => {
    const series = useMemo(() => resolveCartesianSeries(categories, colors), [categories, colors]);
    const renderTooltip = useMemo(() => createTooltipRenderer(valueFormatter, customTooltip), [customTooltip, valueFormatter]);

    return (
        <AdminCartesianChartFrame
            kind="bar"
            ariaLabel={ariaLabel}
            className={className}
            showLegend={showLegend}
            series={series}
            data={data}
            index={index}
            valueFormatter={valueFormatter}
        >
            <ResponsiveContainer width="100%" height="100%">
                <BarChart
                    data={data as Array<Record<string, unknown>>}
                    barCategoryGap="10%"
                    margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
                    title={ariaLabel}
                    accessibilityLayer
                >
                    <CartesianGrid {...ADMIN_CHART_GRID_PROPS} />
                    <XAxis {...buildXAxisProps(data, index, startEndOnly)} />
                    <YAxis {...buildYAxisProps({ yAxisWidth, minValue, maxValue, valueFormatter })} />
                    {showTooltip ? (
                        <Tooltip
                            content={renderTooltip}
                            cursor={{ fill: 'var(--muted-foreground)', fillOpacity: 0.12 }}
                            isAnimationActive={false}
                            wrapperStyle={{ outline: 'none', zIndex: 20 }}
                        />
                    ) : null}
                    {series.map((entry) => (
                        <Bar
                            key={entry.name}
                            dataKey={entry.name}
                            name={entry.name}
                            fill={adminChartColorVar(entry.color)}
                            stackId={stack ? 'stack' : undefined}
                            isAnimationActive={false}
                        />
                    ))}
                </BarChart>
            </ResponsiveContainer>
        </AdminCartesianChartFrame>
    );
};
