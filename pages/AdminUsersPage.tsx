import React from 'react';
import { UserPlus, WarningCircle } from '@phosphor-icons/react';
import { useAuth } from '../hooks/useAuth';
import { AdminShell } from '../components/admin/AdminShell';
import { AdminReloadButton } from '../components/admin/AdminReloadButton';
import { AdminErrorAlert } from '../components/admin/AdminErrorAlert';
import { AdminSurfaceCard } from '../components/admin/AdminSurfaceCard';
import { AdminPagination } from '../components/admin/AdminPagination';
import { AdminJsonDiffModal } from '../components/admin/AdminJsonDiffModal';
import { USERS_PAGE_SIZE } from '../components/admin/adminUsersModel';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Button } from '../components/ui/button';
import { cn } from '../lib/utils';
import { getAnalyticsDebugAttributes, trackEvent } from '../services/analyticsService';
import { CreateUserDialog } from '../components/admin/users/CreateUserDialog';
import { UserDetailSheet } from '../components/admin/users/UserDetailSheet';
import { UsersFilterBar } from '../components/admin/users/UsersFilterBar';
import { UsersQueueTiles } from '../components/admin/users/UsersQueueTiles';
import { UsersSelectionBar } from '../components/admin/users/UsersSelectionBar';
import { UsersSavingOverlay, UsersTable } from '../components/admin/users/UsersTable';
import type { UsersTableRowHandlers } from '../components/admin/users/UsersTableRow';
import { useAdminUserDetail } from '../components/admin/users/useAdminUserDetail';
import { useAdminUsersActions } from '../components/admin/users/useAdminUsersActions';
import { useAdminUsersData, useDeepLinkedUserProfile } from '../components/admin/users/useAdminUsersData';
import { useAdminUsersState } from '../components/admin/users/useAdminUsersState';

export const AdminUsersPage: React.FC = () => {
    const { access } = useAuth();
    const currentTermsVersion = access?.termsCurrentVersion ?? null;
    const data = useAdminUsersData();
    const table = useAdminUsersState(data.users, { adminUserId: access?.userId, currentTermsVersion });
    useDeepLinkedUserProfile(data, table.deepLinkedUserId);
    const detail = useAdminUserDetail(table.selectedUser, data.setErrorMessage);
    const actions = useAdminUsersActions({ data, table, detail });
    const { state, actions: tableActions } = table;

    const rowHandlers: UsersTableRowHandlers = {
        onOpen: (user) => tableActions.openUser(user.user_id),
        onSelectedChange: (user, selected) => tableActions.setUserSelected(user.user_id, selected),
        onCopyId: (user) => void actions.copyUserId(user),
        onToggleSoftDelete: (user) => void actions.toggleSoftDelete(user),
    };

    return (
        <AdminShell
            title="Users"
            description="Find an account, check its state and fix its profile, plan or access."
            searchValue={state.search}
            onSearchValueChange={tableActions.setSearch}
            dateRange={state.dateRange}
            onDateRangeChange={tableActions.setDateRange}
            actions={(
                <>
                    <AdminReloadButton onClick={() => void data.loadUsers()} isLoading={data.isLoadingUsers} label="Reload" />
                    <Button
                        type="button"
                        onClick={() => {
                            trackEvent('admin__users--create_user');
                            tableActions.setCreateDialogOpen(true);
                        }}
                        {...getAnalyticsDebugAttributes('admin__users--create_user')}
                    >
                        <UserPlus />
                        Create user
                    </Button>
                </>
            )}
        >
            <div className="flex flex-col gap-4">
                {data.errorMessage && <AdminErrorAlert message={data.errorMessage} />}
                {data.dataSourceNotice && (
                    <Alert variant="warning">
                        <WarningCircle weight="fill" />
                        <AlertDescription>{data.dataSourceNotice}</AlertDescription>
                    </Alert>
                )}

                <UsersQueueTiles table={table} isLoading={data.isLoadingUsers} />

                <AdminSurfaceCard
                    className={cn('relative flex flex-col gap-3', actions.isSaving && 'pointer-events-none')}
                    aria-busy={actions.isSaving}
                >
                    <UsersFilterBar table={table} onExportCsv={actions.exportUsersCsv} />
                    <UsersTable
                        table={table}
                        hasAnyUsers={data.users.length > 0}
                        isLoading={data.isLoadingUsers}
                        isSaving={actions.isSaving}
                        currentTermsVersion={currentTermsVersion}
                        handlers={rowHandlers}
                    />
                    <AdminPagination
                        page={table.currentPage}
                        pageSize={USERS_PAGE_SIZE}
                        totalItems={table.filteredUsers.length}
                        onPageChange={tableActions.setPage}
                        noun="users"
                    />
                    {actions.isSaving && <UsersSavingOverlay />}
                </AdminSurfaceCard>

                <UsersSelectionBar
                    count={table.selectedVisibleUsers.length}
                    isSaving={actions.isSaving}
                    onClear={tableActions.clearSelection}
                    onSoftDelete={() => void actions.bulkSoftDelete()}
                    onHardDelete={() => void actions.bulkHardDelete()}
                />
            </div>

            <CreateUserDialog
                open={state.isCreateDialogOpen}
                onOpenChange={tableActions.setCreateDialogOpen}
                isSaving={actions.isSaving}
                onCreate={actions.createUser}
            />

            <AdminJsonDiffModal
                isOpen={actions.fullDiff.isOpen}
                onClose={actions.closeFullDiff}
                title={actions.fullDiff.title}
                description={actions.fullDiff.description}
                beforeLabel={actions.fullDiff.beforeLabel}
                afterLabel={actions.fullDiff.afterLabel}
                beforeValue={actions.fullDiff.beforeValue}
                afterValue={actions.fullDiff.afterValue}
                isLoading={actions.fullDiff.isLoading}
                errorMessage={actions.fullDiff.errorMessage}
            />

            <UserDetailSheet
                user={table.selectedUser}
                table={table}
                detail={detail}
                actions={actions}
                errorMessage={data.errorMessage}
                isMissing={Boolean(data.missingLinkedUserId) && data.missingLinkedUserId === state.detail.userId}
                currentTermsVersion={currentTermsVersion}
            />
        </AdminShell>
    );
};
