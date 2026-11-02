import React, { useId, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Compass } from 'lucide-react';

import type { ActivityKind, AppLanguage, ITimelineItem } from '../../types';
import { listStayDayOffsets } from '../../shared/activityStay';
import { addDays, formatDate } from '../../utils';
import { SegmentedControl } from '../ui/segmented-control';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

/**
 * The "where and when" of an activity: which stay it belongs to, which day of
 * that stay, and — for a day trip — where the day goes and where it ends.
 *
 * Shared by the add dialog and the details panel so both speak the same
 * language. Ending the day at another stay is an edge case, so it lives behind
 * a disclosure and only opens by itself when it is already in use.
 */
export interface ActivityPlanFieldsProps {
    stays: ITimelineItem[];
    tripStartDate?: string;
    kind: ActivityKind;
    stayId: string | null;
    dayOffset: number;
    destination: string;
    returnStayId: string | null;
    onKindChange?: (kind: ActivityKind) => void;
    onStayChange: (stayId: string) => void;
    onDayChange: (dayOffset: number) => void;
    onDestinationChange: (destination: string) => void;
    /** `null` means "back to the same stay". */
    onReturnStayChange: (stayId: string | null) => void;
    disabled?: boolean;
    showKindSwitch?: boolean;
    /** Commit-on-blur for the destination (details panel); the dialog commits on submit. */
    onDestinationCommit?: () => void;
    /** The details panel edits the destination through its own location row. */
    showDestinationInput?: boolean;
}

const SAME_STAY_VALUE = '__same__';

const parseTripStart = (value?: string): Date | null => {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const ActivityPlanFields: React.FC<ActivityPlanFieldsProps> = ({
    stays,
    tripStartDate,
    kind,
    stayId,
    dayOffset,
    destination,
    returnStayId,
    onKindChange,
    onStayChange,
    onDayChange,
    onDestinationChange,
    onReturnStayChange,
    disabled = false,
    showKindSwitch = true,
    onDestinationCommit,
    showDestinationInput = true,
}) => {
    const { t, i18n } = useTranslation('common');
    const idPrefix = useId();
    const stay = stays.find((entry) => entry.id === stayId) ?? null;
    const tripStart = parseTripStart(tripStartDate);
    const dayOptions = useMemo(() => (stay ? listStayDayOffsets(stay) : [Math.max(0, Math.floor(dayOffset))]), [stay, dayOffset]);
    const selectedDay = String(Math.max(0, Math.floor(dayOffset)));
    const isDayTrip = kind === 'day-trip';
    const returnStay = returnStayId ? stays.find((entry) => entry.id === returnStayId) ?? null : null;
    const stayTitle = stay?.title || '';

    const formatDayOption = (offset: number): string => {
        const day = offset + 1;
        if (!tripStart) return t('tripView.activityPlan.dayOptionShort', { day });
        return t('tripView.activityPlan.dayOption', {
            day,
            date: formatDate(addDays(tripStart, offset), i18n.language as AppLanguage),
        });
    };

    return (
        <div className="space-y-4">
            {showKindSwitch && onKindChange && (
                <SegmentedControl<ActivityKind>
                    name={`${idPrefix}-kind`}
                    label={t('tripView.activityPlan.kindLabel')}
                    value={kind}
                    onChange={onKindChange}
                    disabled={disabled}
                    options={[
                        { value: 'activity', label: t('tripView.activityPlan.kindActivity') },
                        {
                            value: 'day-trip',
                            label: (
                                <span className="inline-flex items-center gap-1.5">
                                    <Compass size={13} aria-hidden="true" />
                                    {t('tripView.activityPlan.kindDayTrip')}
                                </span>
                            ),
                            srLabel: t('tripView.activityPlan.kindDayTrip'),
                        },
                    ]}
                />
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="min-w-0">
                    <span id={`${idPrefix}-stay`} className="mb-1 block text-xs font-bold uppercase text-muted-foreground">
                        {t('tripView.activityPlan.stayLabel')}
                    </span>
                    <Select value={stayId ?? undefined} onValueChange={onStayChange} disabled={disabled || stays.length === 0}>
                        <SelectTrigger className="w-full" aria-labelledby={`${idPrefix}-stay`}>
                            <SelectValue placeholder={t('tripView.activityPlan.stayPlaceholder')} />
                        </SelectTrigger>
                        <SelectContent>
                            {stays.map((entry) => (
                                <SelectItem key={entry.id} value={entry.id}>{entry.title}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="min-w-0">
                    <span id={`${idPrefix}-day`} className="mb-1 block text-xs font-bold uppercase text-muted-foreground">
                        {t('tripView.activityPlan.dayLabel')}
                    </span>
                    <Select
                        value={selectedDay}
                        onValueChange={(value) => onDayChange(Number(value))}
                        disabled={disabled || dayOptions.length < 2}
                    >
                        <SelectTrigger className="w-full" aria-labelledby={`${idPrefix}-day`}>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {dayOptions.map((offset) => (
                                <SelectItem key={offset} value={String(offset)}>{formatDayOption(offset)}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {isDayTrip && (
                <div className="space-y-3 rounded-xl border border-border bg-secondary/40 p-3">
                    <div>
                        {showDestinationInput && (
                        <>
                        <label htmlFor={`${idPrefix}-destination`} className="mb-1 block text-xs font-bold uppercase text-muted-foreground">
                            {t('tripView.activityPlan.destinationLabel')}
                        </label>
                        <input
                            id={`${idPrefix}-destination`}
                            type="text"
                            value={destination}
                            disabled={disabled}
                            onChange={(event) => onDestinationChange(event.target.value)}
                            onBlur={onDestinationCommit}
                            placeholder={t('tripView.activityPlan.destinationPlaceholder')}
                            className="w-full rounded-lg border border-border bg-card p-2 text-foreground outline-none focus:ring-2 focus:ring-accent-500 disabled:opacity-60"
                        />
                        </>
                        )}
                        {stayTitle && (
                            <p className={`${showDestinationInput ? 'mt-1.5 ' : ''}text-xs text-muted-foreground`}>
                                {returnStay && returnStay.id !== stayId
                                    ? t('tripView.activityPlan.routeHintOther', { stay: stayTitle, returnStay: returnStay.title })
                                    : t('tripView.activityPlan.routeHint', { stay: stayTitle })}
                            </p>
                        )}
                    </div>

                    {stays.length > 1 && (
                        <details className="group/more" open={Boolean(returnStay && returnStay.id !== stayId) || undefined}>
                            <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
                                <ChevronDown size={14} aria-hidden="true" className="transition-transform group-open/more:rotate-180" />
                                {t('tripView.activityPlan.moreOptions')}
                            </summary>
                            <div className="mt-2">
                                <span id={`${idPrefix}-return`} className="mb-1 block text-xs font-bold uppercase text-muted-foreground">
                                    {t('tripView.activityPlan.returnLabel')}
                                </span>
                                <Select
                                    value={returnStay && returnStay.id !== stayId ? returnStay.id : SAME_STAY_VALUE}
                                    onValueChange={(value) => onReturnStayChange(value === SAME_STAY_VALUE ? null : value)}
                                    disabled={disabled}
                                >
                                    <SelectTrigger className="w-full" aria-labelledby={`${idPrefix}-return`}>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value={SAME_STAY_VALUE}>
                                            {t('tripView.activityPlan.returnSame', { stay: stayTitle })}
                                        </SelectItem>
                                        {stays.filter((entry) => entry.id !== stayId).map((entry) => (
                                            <SelectItem key={entry.id} value={entry.id}>{entry.title}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </details>
                    )}
                </div>
            )}
        </div>
    );
};
