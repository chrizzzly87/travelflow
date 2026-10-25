import React from 'react';

import { cn } from '../../lib/utils';

interface AdminSectionHeaderProps {
    title: React.ReactNode;
    description?: React.ReactNode;
    /** Controls at the inline end: a filter, a secondary action, a count. */
    actions?: React.ReactNode;
    className?: string;
    /** Heading level; sections inside the page default to h2. */
    as?: 'h2' | 'h3';
}

/** The heading row of a panel or page section: title, one-line purpose, actions. */
export const AdminSectionHeader: React.FC<AdminSectionHeaderProps> = ({
    title,
    description,
    actions,
    className,
    as: Heading = 'h2',
}) => (
    <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between', className)}>
        <div className="min-w-0">
            <Heading className="text-base font-semibold leading-6 text-foreground">{title}</Heading>
            {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
);
