import React from 'react';

import { cn } from '../../../lib/utils';

interface TripWorkspaceSectionProps {
    eyebrow?: string;
    title?: string;
    description?: string;
    actions?: React.ReactNode;
    children: React.ReactNode;
    className?: string;
    contentClassName?: string;
}

export const TripWorkspaceSection: React.FC<TripWorkspaceSectionProps> = ({
    eyebrow,
    title,
    description,
    actions,
    children,
    className,
    contentClassName,
}) => (
    <section className={cn('py-2', className)}>
        {(eyebrow || title || description || actions) ? (
            <header className="grid gap-4 border-b border-border/60 pb-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                <div className="min-w-0">
                    {eyebrow ? <p className="text-sm font-medium text-muted-foreground">{eyebrow}</p> : null}
                    {title ? <h3 className="mt-1 text-[clamp(1.65rem,2vw,2.2rem)] font-semibold tracking-tight text-foreground">{title}</h3> : null}
                    {description ? <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p> : null}
                </div>
                {actions ? <div className="min-w-0 justify-self-start lg:justify-self-end">{actions}</div> : null}
            </header>
        ) : null}
        <div className={cn(eyebrow || title || description || actions ? 'pt-6' : undefined, contentClassName)}>
            {children}
        </div>
    </section>
);
