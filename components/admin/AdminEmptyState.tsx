import React from 'react';

import { cn } from '../../lib/utils';

interface AdminEmptyStateProps {
    title: React.ReactNode;
    /** One sentence naming the next available action. */
    description?: React.ReactNode;
    icon?: React.ReactNode;
    action?: React.ReactNode;
    className?: string;
}

/** The "nothing here" state for a table, list or chart. */
export const AdminEmptyState: React.FC<AdminEmptyStateProps> = ({ title, description, icon, action, className }) => (
    <div className={cn('flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border px-6 py-10 text-center', className)}>
        {icon && (
            <div className="mb-1 flex size-10 items-center justify-center rounded-lg bg-secondary text-muted-foreground [&_svg]:size-5" aria-hidden="true">
                {icon}
            </div>
        )}
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
        {action && <div className="mt-2">{action}</div>}
    </div>
);
