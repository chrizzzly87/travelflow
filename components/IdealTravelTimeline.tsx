import React, { useMemo } from 'react';

const MONTH_INITIALS_FALLBACK = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'] as const;

interface IdealTravelTimelineProps {
    idealMonths: number[];
    shoulderMonths?: number[];
    locale?: string;
}

const hasMonth = (months: number[] | undefined, month: number): boolean => {
    if (!months || months.length === 0) return false;
    return months.includes(month);
};

export const IdealTravelTimeline: React.FC<IdealTravelTimelineProps> = ({
    idealMonths,
    shoulderMonths = [],
    locale,
}) => {
    const monthInitials = useMemo(() => {
        const resolvedLocale =
            locale
            || (typeof document !== 'undefined' ? document.documentElement.lang : '')
            || (typeof navigator !== 'undefined' ? navigator.language : '')
            || 'en';

        try {
            const formatter = new Intl.DateTimeFormat(resolvedLocale, { month: 'long', timeZone: 'UTC' });
            return Array.from({ length: 12 }, (_, index) => {
                const monthLabel = formatter.format(new Date(Date.UTC(2024, index, 1))).trim();
                const firstLetter = Array.from(monthLabel).find((char) => /\p{L}|\p{N}/u.test(char));
                return (firstLetter || MONTH_INITIALS_FALLBACK[index]).toLocaleUpperCase(resolvedLocale);
            });
        } catch {
            return [...MONTH_INITIALS_FALLBACK];
        }
    }, [locale]);

    return (
        <div className="mt-2">
            <div className="grid grid-cols-12 gap-1 mb-1.5">
                {monthInitials.map((_, index) => {
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
                    {monthInitials.map((initial, index) => (
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
