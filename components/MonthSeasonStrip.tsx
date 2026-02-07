import React from 'react';
import { MONTH_LABELS } from '../data/countryTravelData';

interface MonthSeasonStripProps {
    idealMonths: number[];
    shoulderMonths?: number[];
    highlightedMonths?: number[];
    compact?: boolean;
}

const hasMonth = (months: number[] | undefined, month: number): boolean => {
    if (!months || months.length === 0) return false;
    return months.includes(month);
};

export const MonthSeasonStrip: React.FC<MonthSeasonStripProps> = ({
    idealMonths,
    shoulderMonths = [],
    highlightedMonths = [],
    compact = false,
}) => {
    return (
        <div className={`grid grid-cols-12 gap-1 ${compact ? 'text-[10px]' : 'text-xs'}`}>
            {MONTH_LABELS.map((label, index) => {
                const month = index + 1;
                const isIdeal = hasMonth(idealMonths, month);
                const isShoulder = hasMonth(shoulderMonths, month);
                const isHighlighted = hasMonth(highlightedMonths, month);

                let colorClass = 'bg-gray-100 text-gray-500 border-gray-200';
                if (isIdeal) colorClass = 'bg-emerald-100 text-emerald-800 border-emerald-300';
                else if (isShoulder) colorClass = 'bg-amber-100 text-amber-800 border-amber-300';

                return (
                    <div
                        key={label}
                        className={[
                            'rounded-md border px-1 py-1 text-center font-medium leading-none select-none',
                            colorClass,
                            isHighlighted ? 'ring-1 ring-indigo-400' : '',
                        ].join(' ').trim()}
                        title={`${label}${isIdeal ? ' • ideal' : isShoulder ? ' • shoulder' : ''}`}
                    >
                        {label}
                    </div>
                );
            })}
        </div>
    );
};
