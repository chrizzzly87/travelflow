import React from 'react';
import { useTranslation } from 'react-i18next';
import { Compass } from 'lucide-react';

/** "Day trip · Sintra" — marks an activity that leaves its stay for the day. */
export const DayTripBadge: React.FC<{ destination?: string; className?: string }> = ({ destination, className = '' }) => {
    const { t } = useTranslation('common');
    const label = t('tripView.activityPlan.kindDayTrip');
    const trimmedDestination = destination?.trim();
    return (
        <span className={`inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-secondary px-2 py-0.5 text-[11px] font-semibold text-muted-foreground ${className}`}>
            <Compass size={12} aria-hidden="true" className="shrink-0" />
            <span className="truncate">
                {trimmedDestination ? `${label} · ${trimmedDestination}` : label}
            </span>
        </span>
    );
};
