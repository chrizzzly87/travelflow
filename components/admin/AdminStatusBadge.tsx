import React from 'react';

import { cn } from '../../lib/utils';

export type AdminStatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'accent';

// Solid tokens per tone; the dot repeats the tone so state never rests on the
// label colour alone (docs/DESIGN.md: colour is supporting information).
const TONE_CLASS: Record<AdminStatusTone, { badge: string; dot: string }> = {
    neutral: {
        badge: 'border-border bg-secondary text-secondary-foreground',
        dot: 'bg-muted-foreground',
    },
    info: {
        badge: 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-400/30 dark:bg-sky-400/12 dark:text-sky-200',
        dot: 'bg-sky-500',
    },
    success: {
        badge: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-400/12 dark:text-emerald-200',
        dot: 'bg-emerald-500',
    },
    warning: {
        badge: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-400/30 dark:bg-amber-400/12 dark:text-amber-200',
        dot: 'bg-amber-500',
    },
    danger: {
        badge: 'border-red-200 bg-red-50 text-red-800 dark:border-red-400/30 dark:bg-red-400/12 dark:text-red-200',
        dot: 'bg-red-500',
    },
    accent: {
        badge: 'border-accent-200 bg-accent-50 text-accent-800 dark:border-accent-400/30 dark:bg-accent-400/12 dark:text-accent-200',
        dot: 'bg-accent-500',
    },
};

interface AdminStatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
    tone?: AdminStatusTone;
    /** Show the leading status dot. On by default. */
    dot?: boolean;
}

/** A compact status pill for table cells and headers. */
export const AdminStatusBadge: React.FC<AdminStatusBadgeProps> = ({
    tone = 'neutral',
    dot = true,
    className,
    children,
    ...props
}) => (
    <span
        {...props}
        className={cn(
            'inline-flex h-5 w-fit shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2 text-xs font-medium',
            TONE_CLASS[tone].badge,
            className,
        )}
    >
        {dot && <span className={cn('size-1.5 shrink-0 rounded-full', TONE_CLASS[tone].dot)} aria-hidden="true" />}
        {children}
    </span>
);
