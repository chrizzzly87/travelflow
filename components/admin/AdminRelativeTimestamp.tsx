import React from 'react';
import { cn } from '../../lib/utils';
import { formatAdminAbsoluteTime, formatAdminRelativeTime } from './adminRelativeTime';

export interface AdminRelativeTimestampProps {
    value: string | null | undefined;
    /** Shown instead of a relative time when the value is missing or invalid. */
    fallback?: string;
    className?: string;
    /** Fixed clock for tests and for screens that tick a shared `now`. */
    nowMs?: number;
}

/**
 * The admin relative time ("3 hours ago") with the exact date and time in the
 * shared `data-tooltip`. A missing or invalid value shows the fallback and no
 * tooltip.
 */
export const AdminRelativeTimestamp: React.FC<AdminRelativeTimestampProps> = ({
    value,
    fallback = '—',
    className,
    nowMs,
}) => {
    const absolute = formatAdminAbsoluteTime(value, '');
    return (
        <span className={cn('tabular-nums', className)} data-tooltip={absolute || undefined}>
            {formatAdminRelativeTime(value, nowMs ?? Date.now(), fallback)}
        </span>
    );
};
