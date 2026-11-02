import React, { useEffect, useMemo, useRef, useState } from 'react';
import { SpinnerGap, UsersThree } from '@phosphor-icons/react';
import { Button } from '../../ui/button';
import { Checkbox } from '../../ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';
import { AdminSortHeaderButton } from '../AdminDataTable';
import { ADMIN_TABLE_SORTED_HEADER_CLASS, getAdminStickyHeaderCellClass } from '../AdminDataTableUtils';
import { AdminEmptyState } from '../AdminEmptyState';
import { cn } from '../../../lib/utils';
import { USER_SORTABLE_COLUMNS, type UserVisibleColumnId } from '../adminUsersModel';
import { UsersTableRow, type UsersTableRowHandlers } from './UsersTableRow';
import type { AdminUsersStateApi } from './useAdminUsersState';

interface UsersTableProps {
    table: AdminUsersStateApi;
    /** Whether any account exists at all, which picks the empty-state copy. */
    hasAnyUsers: boolean;
    isLoading: boolean;
    isSaving: boolean;
    currentTermsVersion: string | null;
    handlers: UsersTableRowHandlers;
}

/**
 * The accounts table: a sticky selection column and User column, then the
 * columns the picker shows, each sortable from its header.
 */
export const UsersTable: React.FC<UsersTableProps> = ({
    table,
    hasAnyUsers,
    isLoading,
    isSaving,
    currentTermsVersion,
    handlers,
}) => {
    const { state, actions, pagedUsers, selectableVisibleUsers } = table;
    const scrollRootRef = useRef<HTMLDivElement | null>(null);
    const [isScrolled, setIsScrolled] = useState(false);
    const visibleColumnSet = useMemo(() => new Set<UserVisibleColumnId>(state.visibleColumns), [state.visibleColumns]);
    const hasStickyUserColumn = visibleColumnSet.has('user');
    const columnCount = state.visibleColumns.length + 2;

    // Tracks horizontal scroll of the table container to show the sticky-column edge.
    useEffect(() => {
        const node = scrollRootRef.current?.querySelector<HTMLElement>('[data-slot="table-container"]');
        if (!node) return undefined;
        const handleScroll = () => {
            setIsScrolled(node.scrollLeft > 4);
        };
        handleScroll();
        node.addEventListener('scroll', handleScroll, { passive: true });
        return () => node.removeEventListener('scroll', handleScroll);
    }, [state.visibleColumns]);

    return (
        <div ref={scrollRootRef} className="overflow-hidden rounded-md border border-border">
            <Table>
                <TableHeader className="bg-secondary">
                    <TableRow>
                        <TableHead
                            className={`sticky start-0 z-40 w-[44px] min-w-[44px] max-w-[44px] px-3 ${getAdminStickyHeaderCellClass({
                                isScrolled,
                                isFirst: hasStickyUserColumn,
                            })}`}
                            style={{ width: 44, minWidth: 44, maxWidth: 44 }}
                        >
                            <Checkbox
                                checked={table.areAllVisibleUsersSelected ? true : (table.isVisibleSelectionPartial ? 'indeterminate' : false)}
                                onCheckedChange={(checked) => actions.setAllVisibleSelected(Boolean(checked))}
                                disabled={selectableVisibleUsers.length === 0}
                                aria-label={`Select all ${selectableVisibleUsers.length} matching users`}
                            />
                        </TableHead>
                        {hasStickyUserColumn && (
                            <TableHead
                                className={`sticky start-[44px] z-30 w-[280px] min-w-[240px] max-w-[280px] overflow-hidden px-3 text-start ${getAdminStickyHeaderCellClass({
                                    isScrolled,
                                    isFirst: false,
                                    isSorted: state.sortKey === 'name',
                                })}`}
                            >
                                <AdminSortHeaderButton
                                    label="User"
                                    isActive={state.sortKey === 'name'}
                                    direction={state.sortDirection}
                                    onClick={() => actions.toggleSort('name')}
                                />
                            </TableHead>
                        )}
                        {USER_SORTABLE_COLUMNS.map(([columnId, label, key]) => (
                            visibleColumnSet.has(columnId) ? (
                                <TableHead
                                    key={columnId}
                                    className={cn('px-3 text-start', state.sortKey === key && ADMIN_TABLE_SORTED_HEADER_CLASS)}
                                >
                                    <AdminSortHeaderButton
                                        label={label}
                                        isActive={state.sortKey === key}
                                        direction={state.sortDirection}
                                        onClick={() => actions.toggleSort(key)}
                                    />
                                </TableHead>
                            ) : null
                        ))}
                        <TableHead className="w-[52px] px-3 text-end">
                            <span className="sr-only">Actions</span>
                        </TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {pagedUsers.map((user) => (
                        <UsersTableRow
                            key={user.user_id}
                            user={user}
                            isSelected={table.selectedUserIdSet.has(user.user_id)}
                            isSaving={isSaving}
                            isScrolled={isScrolled}
                            visibleColumns={visibleColumnSet}
                            sortKey={state.sortKey}
                            currentTermsVersion={currentTermsVersion}
                            handlers={handlers}
                        />
                    ))}
                    {pagedUsers.length === 0 && !isLoading && (
                        <TableRow className="hover:bg-transparent">
                            <TableCell className="p-4" colSpan={columnCount}>
                                <AdminEmptyState
                                    icon={<UsersThree />}
                                    title={hasAnyUsers ? 'No users match' : 'No users yet'}
                                    description={hasAnyUsers
                                        ? 'Clear a filter, widen the date range or change the search.'
                                        : 'Create or invite the first account with "Create user".'}
                                    action={table.hasActiveFilters ? (
                                        <Button type="button" variant="outline" size="sm" onClick={actions.resetFilters}>
                                            Reset filters
                                        </Button>
                                    ) : undefined}
                                />
                            </TableCell>
                        </TableRow>
                    )}
                    {pagedUsers.length === 0 && isLoading && (
                        <TableRow className="hover:bg-transparent">
                            <TableCell className="px-4 py-10 text-center text-sm text-muted-foreground" colSpan={columnCount}>
                                <span role="status" className="inline-flex items-center gap-2 font-medium">
                                    <SpinnerGap size={16} className="animate-spin motion-reduce:animate-none" />
                                    Loading users…
                                </span>
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    );
};

/** Covers the table card while a save or delete runs, so rows cannot be acted on twice. */
export const UsersSavingOverlay: React.FC = () => (
    <div className="absolute inset-0 z-20 flex items-center justify-center rounded-lg bg-card/50">
        <span role="status" className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs font-medium text-foreground shadow-sm">
            <SpinnerGap size={14} className="animate-spin motion-reduce:animate-none" />
            Applying changes…
        </span>
    </div>
);
