import React from 'react';

const ADMIN_SURFACE_CARD_BASE_CLASS = 'rounded-2xl border border-slate-200 bg-white p-4 shadow-sm';

interface AdminSurfaceCardProps extends React.HTMLAttributes<HTMLDivElement> {
    className?: string;
}

export const AdminSurfaceCard: React.FC<AdminSurfaceCardProps> = ({ className, ...props }) => {
    const mergedClassName = className
        ? `${ADMIN_SURFACE_CARD_BASE_CLASS} ${className}`
        : ADMIN_SURFACE_CARD_BASE_CLASS;

    return <div {...props} className={mergedClassName} />;
};
