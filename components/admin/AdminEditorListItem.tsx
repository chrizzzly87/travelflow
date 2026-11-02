import React from 'react';

import { cn } from '../../lib/utils';

interface AdminEditorListItemProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'title'> {
    /** The record's human name. */
    title: React.ReactNode;
    /** One muted line under the title: kind, place, source. */
    subtitle?: React.ReactNode;
    /** Trailing status badge. */
    badge?: React.ReactNode;
    active?: boolean;
}

/**
 * One row in the list half of a list + editor split (Destinations,
 * Recommendations). Selecting it loads the record into the editor beside it,
 * so it is a pressed-state button, not a link. Selection changes colour only:
 * it happens many times a minute and must not animate.
 */
export const AdminEditorListItem = React.forwardRef<HTMLButtonElement, AdminEditorListItemProps>(
    ({ title, subtitle, badge, active = false, className, ...props }, ref) => (
        <button
            ref={ref}
            type="button"
            aria-pressed={active}
            className={cn(
                'flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2.5 text-start transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                active
                    ? 'border-accent-300 bg-accent-50 dark:border-accent-400/30 dark:bg-accent-400/12'
                    : 'border-transparent hover:bg-muted/50',
                className,
            )}
            {...props}
        >
            <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-foreground">{title}</span>
                {subtitle && <span className="mt-0.5 block truncate text-xs text-muted-foreground">{subtitle}</span>}
            </span>
            {badge && <span className="shrink-0">{badge}</span>}
        </button>
    ),
);
AdminEditorListItem.displayName = 'AdminEditorListItem';
