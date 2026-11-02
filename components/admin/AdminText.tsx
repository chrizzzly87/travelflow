import React from 'react';
import { cn } from '../../lib/utils';

/**
 * Small typographic primitives for admin metric and chart cards. They replace the
 * retired chart library's Title/Subtitle/Text/Metric with semantic theme tokens.
 */

export const AdminTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({ className, ...props }) => (
    <h3 className={cn('text-lg font-medium text-foreground', className)} {...props} />
);

export const AdminSubtitle: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({ className, ...props }) => (
    <p className={cn('text-sm text-muted-foreground', className)} {...props} />
);

export const AdminText: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({ className, ...props }) => (
    <p className={cn('text-sm text-muted-foreground', className)} {...props} />
);

export const AdminMetric: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({ className, ...props }) => (
    <p className={cn('text-3xl font-semibold tabular-nums text-foreground', className)} {...props} />
);

export const AdminProgressBar: React.FC<{
    /** Percentage from 0 to 100. */
    value: number;
    label: string;
    className?: string;
}> = ({ value, label, className }) => {
    const clamped = Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0;
    return (
        <div
            role="progressbar"
            aria-label={label}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(clamped)}
            className={cn('h-2 w-full overflow-hidden rounded-full bg-secondary', className)}
        >
            <div className="h-full rounded-full bg-[var(--admin-chart-blue)]" style={{ width: `${clamped}%` }} />
        </div>
    );
};
