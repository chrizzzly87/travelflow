import React from 'react';
import { CaretDown, CaretUp } from '@phosphor-icons/react';
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
            'inline-flex w-full items-center justify-between gap-2 text-left transition-colors',
            isActive ? 'font-semibold text-accent-800' : 'hover:text-slate-900',
            className,
        )}
        title={`Sort by ${label}`}
    >
        <span>{label}</span>
        {isActive
            ? (direction === 'asc' ? <CaretUp size={12} className="text-accent-700" /> : <CaretDown size={12} className="text-accent-700" />)
            : <CaretDown size={12} className="text-slate-400 opacity-70" />}
    </button>
);
