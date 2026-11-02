import React from 'react';

import { Badge } from '../ui/badge';
import { cn } from '../../lib/utils';

export type AdminStatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'accent';

const DOT_CLASS: Record<AdminStatusTone, string> = {
    neutral: 'bg-muted-foreground',
    info: 'bg-sky-500',
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    danger: 'bg-red-500',
    accent: 'bg-accent-500',
};

interface AdminStatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
    tone?: AdminStatusTone;
    /** Show the leading status dot. On by default. */
    dot?: boolean;
}

/**
 * A status pill for admin tables and headers: the shared `Badge` tone (same
 * palette as the Alert tones) plus a leading dot that repeats it, so the state
 * never rests on colour alone.
 */
export const AdminStatusBadge: React.FC<AdminStatusBadgeProps> = ({
    tone = 'neutral',
    dot = true,
    className,
    children,
    ...props
}) => (
    <Badge {...props} variant={tone} className={cn('h-5 gap-1.5 border px-2', className)}>
        {dot && <span className={cn('size-1.5 shrink-0 rounded-full', DOT_CLASS[tone])} aria-hidden="true" />}
        {children}
    </Badge>
);
