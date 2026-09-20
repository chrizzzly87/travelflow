import React from 'react';
import { CalendarPlus, RotateCcw } from 'lucide-react';

import type { SavedRecommendation } from '../../shared/recommendations';
import type { MobileDayPlanDay } from '../tripview/mobileDayPlanModel';

interface DayGroup {
    cityName: string;
    days: MobileDayPlanDay[];
}

/**
 * Days under the city they belong to, in travel order.
 *
 * An idea is placed on a day, not on a city — a city stay is a range of days,
 * and an activity has to land on one of them. Grouping is what makes that
 * legible: "Taipei · Thu 12" instead of a wall of twenty undifferentiated
 * dates. A trip that returns to a city later gets a second group, because the
 * grouping follows the itinerary rather than collapsing by name.
 */
export const groupDaysByCity = (days: MobileDayPlanDay[]): DayGroup[] => {
    const groups: DayGroup[] = [];
    days.forEach((day) => {
        const cityName = (day.city?.title || day.city?.location || 'Unassigned').trim() || 'Unassigned';
        const last = groups[groups.length - 1];
        if (last && last.cityName === cityName) {
            last.days.push(day);
            return;
        }
        groups.push({ cityName, days: [day] });
    });
    return groups;
};

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
                className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-border px-3 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
            >
                <RotateCcw size={15} />
                Put back in the deck
            </button>
        );
    }

    if (!canEdit) return null;

    if (isAssigning) {
        const groups = groupDaysByCity(days);
        return (
            <div className="flex max-h-56 flex-col gap-2.5 overflow-y-auto">
                {groups.map((group) => (
                    <div key={`${group.cityName}-${group.days[0]?.dayOffset}`}>
                        <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                            {group.cityName}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                            {group.days.map((day) => (
                                <button
                                    key={day.dayOffset}
                                    type="button"
                                    onClick={() => onAssignToDay(saved, day)}
                                    className="inline-flex min-h-9 items-center rounded-lg border border-border px-2.5 text-xs font-semibold text-foreground transition-colors hover:border-accent-300 hover:text-accent-700 dark:hover:text-accent-200 dark:hover:border-accent-400/30 dark:hover:text-accent-300"
                                >
                                    {day.weekdayLabel} {day.dayOfMonthLabel}
                                </button>
                            ))}
                        </div>
                    </div>
                ))}
                <button
                    type="button"
                    onClick={onCancelAssigning}
                    className="inline-flex min-h-9 shrink-0 items-center self-start rounded-lg px-2.5 text-xs font-semibold text-muted-foreground"
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
            className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-accent-200 bg-accent-50 px-3 text-sm font-semibold text-accent-700 transition-colors hover:bg-accent-100 dark:bg-accent-400/12 dark:hover:bg-accent-400/12 dark:text-accent-200 dark:border-accent-400/30"
        >
            <CalendarPlus size={15} />
            Add to a day
        </button>
    );
};
