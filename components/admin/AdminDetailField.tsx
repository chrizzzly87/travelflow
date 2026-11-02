import React from 'react';
import { cn } from '../../lib/utils';

export interface AdminDetailFieldProps {
    label: React.ReactNode;
    children: React.ReactNode;
    /** Spans both columns of a two-column description list from `sm` up. */
    wide?: boolean;
    /** Monospaced, breakable value for ids, hashes and request ids. */
    mono?: boolean;
    className?: string;
}

/**
 * One label/value pair inside an admin detail sheet's `<dl>` grid. Render it
 * inside a `<dl>`; the label is a `<dt>` and the value a `<dd>`.
 */
export const AdminDetailField: React.FC<AdminDetailFieldProps> = ({
    label,
    children,
    wide = false,
    mono = false,
    className,
}) => (
    <div className={cn('flex min-w-0 flex-col gap-0.5', wide && 'sm:col-span-2', className)}>
        <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
        <dd
            className={cn(
                'min-w-0 text-foreground',
                mono ? 'break-all font-mono text-xs' : 'break-words text-sm',
            )}
        >
            {children}
        </dd>
    </div>
);
