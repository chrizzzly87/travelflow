import React from 'react';
import { CalendarPlus, RotateCcw } from 'lucide-react';

import type { SavedRecommendation } from '../../shared/recommendations';
import type { MobileDayPlanDay } from '../tripview/mobileDayPlanModel';

/**
 * What an open card offers, which depends on which pool it came from.
 *
 * A kept idea can be put on a day; a skipped one can go back in the deck; a
 * read-only trip offers neither. Kept apart from the overlay because the
 * branching reads as noise inside a dialog's props.
 */
export const RecommendationDetailActions: React.FC<{
    saved: SavedRecommendation | null;
    canEdit: boolean;
    days: MobileDayPlanDay[];
    isAssigning: boolean;
    onStartAssigning: () => void;
    onCancelAssigning: () => void;
    onAssignToDay: (saved: SavedRecommendation, day: MobileDayPlanDay) => void;
    onRestore: () => void;
}> = ({
    saved,
    canEdit,
    days,
    isAssigning,
    onStartAssigning,
    onCancelAssigning,
    onAssignToDay,
    onRestore,
}) => {
    if (!saved) {
        return (
            <button
                type="button"
                onClick={onRestore}
                data-testid="recommendation-detail-restore"
                className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
                <RotateCcw size={15} />
                Put back in the deck
            </button>
        );
    }

    if (!canEdit) return null;

    if (isAssigning) {
        return (
            <div className="flex flex-wrap gap-1.5">
                {days.map((day) => (
                    <button
                        key={day.dayOffset}
                        type="button"
                        onClick={() => onAssignToDay(saved, day)}
                        className="inline-flex min-h-9 items-center rounded-lg border border-slate-200 px-2.5 text-xs font-semibold text-slate-700 transition-colors hover:border-accent-300 hover:text-accent-700"
                    >
                        {day.weekdayLabel} {day.dayOfMonthLabel}
                    </button>
                ))}
                <button
                    type="button"
                    onClick={onCancelAssigning}
                    className="inline-flex min-h-9 items-center rounded-lg px-2.5 text-xs font-semibold text-slate-500"
                >
                    Cancel
                </button>
            </div>
        );
    }

    return (
        <button
            type="button"
            onClick={onStartAssigning}
            data-testid="recommendation-assign"
            className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-accent-200 bg-accent-50 px-3 text-sm font-semibold text-accent-700 transition-colors hover:bg-accent-100"
        >
            <CalendarPlus size={15} />
            Add to a day
        </button>
    );
};
