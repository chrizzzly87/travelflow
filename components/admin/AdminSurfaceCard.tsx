import React from 'react';

import { cn } from '../../lib/utils';

// One flat panel per workflow (docs/DESIGN.md): rounded-lg, a one-pixel border,
// no shadow. `tailwind-merge` lets callers override padding or radius.
const ADMIN_SURFACE_CARD_BASE_CLASS = 'rounded-lg border border-border bg-card p-4 text-card-foreground';

interface AdminSurfaceCardProps extends React.HTMLAttributes<HTMLDivElement> {
    className?: string;
}

export const AdminSurfaceCard = React.forwardRef<HTMLDivElement, AdminSurfaceCardProps>(
    ({ className, ...props }, ref) => (
        <div ref={ref} {...props} className={cn(ADMIN_SURFACE_CARD_BASE_CLASS, className)} />
    ),
);
AdminSurfaceCard.displayName = 'AdminSurfaceCard';
