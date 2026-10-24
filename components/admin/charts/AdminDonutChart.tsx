import React, { useMemo, useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { cn } from '../../../lib/utils';
import {
    adminChartColorVar,
    type AdminChartColor,
    type AdminChartValueFormatter,
    defaultAdminChartValueFormatter,
    resolveAdminChartColor,
    toChartNumber,
} from './chartPalette';
import {
    AdminChartDataTable,
    type AdminChartRow,
    AdminChartTooltipContent,
    toAdminChartTooltipEntries,
} from './chartPrimitives';

export interface AdminDonutChartProps {
    data: readonly AdminChartRow[];
    /** Key of the slice name in each row. */
    index: string;
    /** Key of the slice value in each row. */
    category: string;
    /** One colour per slice, in data order; cycles when shorter. */
    colors?: readonly AdminChartColor[];
    valueFormatter?: AdminChartValueFormatter;
    /** Centre label; defaults to the formatted total. */
    label?: string;
    showLabel?: boolean;
    showTooltip?: boolean;
    /**
     * Makes slices selectable. Receives the clicked row, or `null` when the
     * selected slice is clicked again.
     */
    onValueChange?: (row: AdminChartRow | null) => void;
    /** Accessible name of the chart; also the caption of its hidden data table. */
    ariaLabel: string;
    className?: string;
}

interface DonutSelection {
    data: readonly AdminChartRow[];
    position: number;
}

export const AdminDonutChart: React.FC<AdminDonutChartProps> = ({
    data,
    index,
    category,
    colors,
    valueFormatter = defaultAdminChartValueFormatter,
    label,
    showLabel = true,
    showTooltip = true,
    onValueChange,
    ariaLabel,
    className,
}) => {
    const [selection, setSelection] = useState<DonutSelection | null>(null);
    // A selection only applies to the data it was made on; new data starts unselected.
    const activePosition = selection && selection.data === data ? selection.position : null;

    const total = useMemo(
        () => data.reduce((sum, row) => sum + (toChartNumber(row[category]) ?? 0), 0),
        [category, data],
    );
    const centerLabel = label ?? valueFormatter(total);

    const renderTooltip = useMemo(() => {
        const DonutTooltip = (props: { active?: boolean; payload?: unknown }) => {
            const entries = toAdminChartTooltipEntries(props.payload).map((entry) => ({
                ...entry,
                name: String(entry.payload?.[index] ?? entry.name),
            }));
            return (
                <AdminChartTooltipContent
                    active={Boolean(props.active) && entries.length > 0}
                    payload={entries}
                    valueFormatter={valueFormatter}
                />
            );
        };
        return DonutTooltip;
    }, [index, valueFormatter]);

    const handleSliceClick = (position: number) => {
        if (!onValueChange) return;
        if (activePosition === position) {
            setSelection(null);
            onValueChange(null);
            return;
        }
        setSelection({ data, position });
        onValueChange(data[position] ?? null);
    };

    return (
        <figure
            role="figure"
            aria-label={ariaLabel}
            data-admin-chart="donut"
            className={cn('relative m-0 h-40 w-full min-w-0', className)}
        >
            <ResponsiveContainer width="100%" height="100%">
                <PieChart title={ariaLabel} accessibilityLayer>
                    <Pie
                        data={data as Array<Record<string, unknown>>}
                        dataKey={category}
                        nameKey={index}
                        cx="50%"
                        cy="50%"
                        innerRadius="75%"
                        outerRadius="100%"
                        startAngle={90}
                        endAngle={-270}
                        stroke="var(--card)"
                        strokeWidth={1}
                        isAnimationActive={false}
                        onClick={onValueChange ? (_entry, position) => handleSliceClick(position) : undefined}
                        style={onValueChange ? { cursor: 'pointer' } : undefined}
                    >
                        {data.map((row, position) => (
                            <Cell
                                key={`${String(row[index])}-${position}`}
                                fill={adminChartColorVar(resolveAdminChartColor(position, colors))}
                                fillOpacity={activePosition === null || activePosition === position ? 1 : 0.3}
                            />
                        ))}
                    </Pie>
                    {showTooltip ? (
                        <Tooltip content={renderTooltip} isAnimationActive={false} wrapperStyle={{ outline: 'none', zIndex: 20 }} />
                    ) : null}
                </PieChart>
            </ResponsiveContainer>
            {showLabel ? (
                <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 flex items-center justify-center px-[22%] text-center text-sm font-medium text-foreground"
                    data-admin-chart-center-label=""
                >
                    <span className="truncate">{centerLabel}</span>
                </span>
            ) : null}
            <AdminChartDataTable
                caption={ariaLabel}
                index={index}
                categories={[category]}
                data={data}
                valueFormatter={valueFormatter}
            />
        </figure>
    );
};
