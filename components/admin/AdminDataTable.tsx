import React from 'react';
import { CaretDown, CaretUp, CaretUpDown } from '@phosphor-icons/react';
import { cn } from '../../lib/utils';
import type { AdminTableSortDirection } from './AdminDataTableUtils';

interface AdminSortHeaderButtonProps {
    label: string;
    isActive: boolean;
    direction: AdminTableSortDirection;
    onClick: () => void;
    className?: string;
}

export const AdminSortHeaderButton: React.FC<AdminSortHeaderButtonProps> = ({
    label,
    isActive,
    direction,
    onClick,
    className,
}) => (
    <button
        type="button"
        onClick={onClick}
        className={cn(
            'inline-flex w-full items-center justify-between gap-2 rounded-sm text-start font-medium transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
            isActive ? 'text-accent-800 dark:text-accent-200' : 'text-muted-foreground hover:text-foreground',
            className,
        )}
        title={`Sort by ${label}`}
        data-state={isActive ? direction : undefined}
    >
        <span className="truncate">{label}</span>
        {isActive
            ? (direction === 'asc'
                ? <CaretUp size={12} weight="bold" className="shrink-0" aria-hidden="true" />
                : <CaretDown size={12} weight="bold" className="shrink-0" aria-hidden="true" />)
            : <CaretUpDown size={12} className="shrink-0 opacity-60" aria-hidden="true" />}
    </button>
);
