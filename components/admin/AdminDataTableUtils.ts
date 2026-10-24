import { cn } from '../../lib/utils';

export type AdminTableSortDirection = 'asc' | 'desc';

// Selected rows paint every cell, sticky ones included, so the tint is mixed
// into the card colour rather than layered over it: a translucent fill let the
// scrolled columns show through the frozen ones.
export const ADMIN_TABLE_ROW_SURFACE_CLASS = [
    'group transition-colors',
    'hover:[&>td]:bg-secondary',
    'data-[state=selected]:[&>td]:bg-[color-mix(in_oklab,var(--tf-accent-50)_50%,var(--card))]',
    'data-[state=selected]:hover:[&>td]:bg-[color-mix(in_oklab,var(--tf-accent-50)_50%,var(--card))]',
    'dark:data-[state=selected]:[&>td]:bg-[color-mix(in_oklab,var(--tf-accent-400)_12%,var(--card))]',
    'dark:data-[state=selected]:hover:[&>td]:bg-[color-mix(in_oklab,var(--tf-accent-400)_12%,var(--card))]',
].join(' ');
const ADMIN_TABLE_STICKY_BASE_CLASS = '';
const ADMIN_TABLE_STICKY_TRAILING_EDGE_CLASS = [
    'border-e border-border',
    'before:pointer-events-none before:absolute before:inset-y-0 before:end-0 before:w-px before:bg-border',
].join(' ');
// Sticky cells sit over scrolling content, so their tint must be opaque: the
// translucent `accent-400/12` let the scrolled columns show through in dark mode.
const ADMIN_TABLE_STICKY_TINT_CLASS = 'bg-accent-50 group-hover:bg-accent-50 dark:bg-[color-mix(in_oklab,var(--tf-accent-400)_12%,var(--card))] dark:group-hover:bg-[color-mix(in_oklab,var(--tf-accent-400)_12%,var(--card))]';
// Opaque in dark too: sorted headers can be sticky, and a translucent tint let
// the scrolled header cells show through.
export const ADMIN_TABLE_SORTED_HEADER_CLASS = 'bg-accent-50 text-accent-900 dark:bg-[color-mix(in_oklab,var(--tf-accent-400)_12%,var(--secondary))] dark:text-accent-200';
export const ADMIN_TABLE_SORTED_CELL_CLASS = 'bg-accent-50/50 group-hover:bg-accent-50/50 group-data-[state=selected]:bg-accent-50/50 dark:bg-accent-400/12 dark:group-hover:bg-accent-400/12';

const ADMIN_TABLE_STICKY_TRAILING_SHADOW_CLASS = [
    'shadow-[8px_0_14px_-10px_rgba(15,23,42,0.45)] rtl:shadow-[-8px_0_14px_-10px_rgba(15,23,42,0.45)]',
    'dark:shadow-[8px_0_14px_-10px_rgba(0,0,0,0.7)] dark:rtl:shadow-[-8px_0_14px_-10px_rgba(0,0,0,0.7)]',
    'after:pointer-events-none after:absolute after:inset-y-0 after:-end-3 after:w-3',
    'after:bg-gradient-to-r rtl:after:bg-gradient-to-l after:from-slate-900/12 after:to-transparent dark:after:from-black/40',
].join(' ');

export const getAdminStickyHeaderCellClass = (params: {
    isScrolled: boolean;
    isFirst: boolean;
    isSorted?: boolean;
}) => cn(
    params.isFirst ? ADMIN_TABLE_STICKY_BASE_CLASS : ADMIN_TABLE_STICKY_TRAILING_EDGE_CLASS,
    'bg-secondary',
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
    params.isSelected ? ADMIN_TABLE_STICKY_TINT_CLASS : 'bg-card group-hover:bg-secondary',
    params.isSorted ? ADMIN_TABLE_STICKY_TINT_CLASS : '',
    params.isScrolled
        ? (params.isFirst ? '' : ADMIN_TABLE_STICKY_TRAILING_SHADOW_CLASS)
        : '',
);
