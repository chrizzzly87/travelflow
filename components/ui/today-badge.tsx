import React from 'react';

/**
 * The "Today" marker.
 *
 * One component for every surface that has to say it — the horizontal timeline,
 * the vertical timeline, the itinerary list, the phone day strip and the day
 * panel. They each had their own version before: some red, some accent-purple,
 * each with its own `dark:` alpha arithmetic. The current day therefore looked
 * like a different thing depending on which view you were in, and in dark mode
 * the purple ones sank into the sheet they sat on.
 *
 * The colours are the `--tf-today-badge-*` tokens, which are solid on both
 * sides: the badge overlaps the day column's own tint and the grid lines behind
 * it, so a translucent fill would stack with whatever it happened to land on.
 *
 * A real `forwardRef`, per `docs/DESIGN_SYSTEM_COMPONENTS.md`: the app renders
 * through `preact/compat`, where a plain function component silently drops the
 * ref that a caller wanting to measure or scroll to the marker would pass.
 */

export type TodayBadgeSize = 'sm' | 'md';

const SIZE_CLASS: Record<TodayBadgeSize, string> = {
    sm: 'px-1.5 py-px text-[9px]',
    md: 'px-2 py-0.5 text-[10px]',
};

export interface TodayBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
    size?: TodayBadgeSize;
    label?: string;
}

export const TodayBadge = React.forwardRef<HTMLSpanElement, TodayBadgeProps>(({
    size = 'md',
    label = 'Today',
    className = '',
    ...props
}, ref) => (
    <span
        ref={ref}
        data-slot="today-badge"
        data-testid="today-badge"
        className={[
            'inline-flex shrink-0 items-center rounded-full border font-bold uppercase tracking-[0.1em]',
            'border-[var(--tf-today-badge-border)] bg-[var(--tf-today-badge-bg)] text-[var(--tf-today-badge-text)]',
            SIZE_CLASS[size],
            className,
        ].filter(Boolean).join(' ')}
        {...props}
    >
        {label}
    </span>
));
TodayBadge.displayName = 'TodayBadge';
