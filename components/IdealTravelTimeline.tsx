import React from 'react';

const MONTH_INITIALS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'] as const;

interface IdealTravelTimelineProps {
    idealMonths: number[];
    shoulderMonths?: number[];
}

const hasMonth = (months: number[] | undefined, month: number): boolean => {
    if (!months || months.length === 0) return false;
    return months.includes(month);
};

export const IdealTravelTimeline: React.FC<IdealTravelTimelineProps> = ({
    idealMonths,
    shoulderMonths = [],
}) => {
    return (
        <div className="mt-2">
            <div className="grid grid-cols-12 gap-1 mb-1.5">
                {MONTH_INITIALS.map((_, index) => {
                    const month = index + 1;
                    const isIdeal = hasMonth(idealMonths, month);
                    const isShoulder = hasMonth(shoulderMonths, month);
                    return (
                        <div
                            key={`stripe-${month}`}
                            className={[
                                'h-1.5 rounded-full',
                                isIdeal ? 'bg-emerald-400' : isShoulder ? 'bg-amber-300' : 'bg-transparent',
                            ].join(' ')}
                        />
                    );
                })}
            </div>

            <div className="relative">
                <div className="absolute left-0 right-0 top-[3px] h-px bg-slate-300" />
                <div className="grid grid-cols-12 gap-1 relative">
                    {MONTH_INITIALS.map((initial, index) => (
                        <div key={`tick-${index}`} className="flex flex-col items-center">
                            <span className="block h-2 w-px bg-slate-400" />
                            <span className="mt-1 text-[10px] font-medium text-slate-600">{initial}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
