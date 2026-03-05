import React from 'react';
import { CaretDown, CaretUp } from '@phosphor-icons/react';
import { cn } from '../../lib/utils';

export type AdminTableSortDirection = 'asc' | 'desc';

export const ADMIN_TABLE_ROW_SURFACE_CLASS = [
    'group transition-colors',
    'hover:[&>td]:bg-slate-100',
    'data-[state=selected]:[&>td]:bg-accent-50/50',
    'data-[state=selected]:hover:[&>td]:bg-accent-50/50',
].join(' ');
const ADMIN_TABLE_STICKY_BASE_CLASS = '';
const ADMIN_TABLE_STICKY_TRAILING_EDGE_CLASS = [
    'border-r border-slate-300',
    'before:pointer-events-none before:absolute before:inset-y-0 before:right-0 before:w-px before:bg-slate-300',
].join(' ');
export const ADMIN_TABLE_SORTED_HEADER_CLASS = 'bg-accent-50 text-accent-900';
export const ADMIN_TABLE_SORTED_CELL_CLASS = 'bg-accent-50/50 group-hover:bg-accent-50/50 group-data-[state=selected]:bg-accent-50/50';

const ADMIN_TABLE_STICKY_TRAILING_SHADOW_CLASS = [
    'shadow-[8px_0_14px_-10px_rgba(15,23,42,0.45)]',
    'after:pointer-events-none after:absolute after:inset-y-0 after:-right-3 after:w-3',
    'after:bg-gradient-to-r after:from-slate-900/12 after:to-transparent',
].join(' ');

export const getAdminStickyHeaderCellClass = (params: {
    isScrolled: boolean;
    isFirst: boolean;
    isSorted?: boolean;
}) => cn(
    params.isFirst ? ADMIN_TABLE_STICKY_BASE_CLASS : ADMIN_TABLE_STICKY_TRAILING_EDGE_CLASS,
    'bg-slate-50',
    params.isSorted ? ADMIN_TABLE_SORTED_HEADER_CLASS : '',
    params.isScrolled
        ? (params.isFirst ? '' : ADMIN_TABLE_STICKY_TRAILING_SHADOW_CLASS)
        : '',
);

export const getAdminStickyBodyCellClass = (params: {
    isSelected: boolean;
    isScrolled: boolean;
    isFirst: boolean;
    isSorted?: boolean;
}) => cn(
    params.isFirst ? ADMIN_TABLE_STICKY_BASE_CLASS : ADMIN_TABLE_STICKY_TRAILING_EDGE_CLASS,
    params.isSelected ? 'bg-accent-50 group-hover:bg-accent-50' : 'bg-white group-hover:bg-slate-100',
    params.isSorted ? 'bg-accent-50 group-hover:bg-accent-50' : '',
    params.isScrolled
        ? (params.isFirst ? '' : ADMIN_TABLE_STICKY_TRAILING_SHADOW_CLASS)
        : '',
);

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
