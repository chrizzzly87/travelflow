import React from 'react';

import { cn } from '../../lib/utils';
import { AdminSurfaceCard } from './AdminSurfaceCard';

export type AdminStatTone = 'neutral' | 'positive' | 'warning' | 'negative';

const TONE_CLASS: Record<AdminStatTone, string> = {
    neutral: 'text-muted-foreground',
    positive: 'text-emerald-700 dark:text-emerald-300',
    warning: 'text-amber-700 dark:text-amber-300',
    negative: 'text-red-700 dark:text-red-300',
};

interface AdminStatCardProps {
    label: React.ReactNode;
    value: React.ReactNode;
    /** A 16px Phosphor icon, shown muted at the inline end of the label. */
    icon?: React.ReactNode;
    /** One short line under the value: a ratio, a delta, the scope. */
    hint?: React.ReactNode;
    hintTone?: AdminStatTone;
    /** Anything richer than a hint: a breakdown list, a progress bar. */
    children?: React.ReactNode;
    className?: string;
    isLoading?: boolean;
}

/** A KPI tile: label, a large tabular value, and one line of context. */
export const AdminStatCard: React.FC<AdminStatCardProps> = ({
    label,
    value,
    icon,
    hint,
    hintTone = 'neutral',
    children,
    className,
    isLoading = false,
}) => (
    <AdminSurfaceCard className={cn('flex flex-col gap-1', className)} aria-busy={isLoading || undefined}>
        <div className="flex items-center justify-between gap-2 text-sm font-medium text-muted-foreground">
            <span className="truncate">{label}</span>
            {icon && <span className="shrink-0 [&_svg]:size-4" aria-hidden="true">{icon}</span>}
        </div>
        <div className={cn('text-2xl font-semibold tracking-tight tabular-nums text-foreground', isLoading && 'opacity-50')}>
            {value}
        </div>
        {hint && <div className={cn('text-xs', TONE_CLASS[hintTone])}>{hint}</div>}
        {children && <div className="mt-3">{children}</div>}
    </AdminSurfaceCard>
);
