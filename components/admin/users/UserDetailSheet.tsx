import React from 'react';
import { ArrowSquareOut, SpinnerGap, Trash, UsersThree } from '@phosphor-icons/react';
import { Button } from '../../ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import { AdminDetailSheet } from '../AdminDetailSheet';
import { AdminEmptyState } from '../AdminEmptyState';
import { AdminErrorAlert } from '../AdminErrorAlert';
import { AdminStatusBadge } from '../AdminStatusBadge';
import { getAnalyticsDebugAttributes, trackEvent } from '../../../services/analyticsService';
import type { AdminUserRecord } from '../../../services/adminService';
import {
    USER_DETAIL_TAB_LABELS,
    buildAdminTripsLinkForUser,
    getPlanName,
    getUserAccountStatus,
    getUserDisplayName,
    getUserPublicProfilePath,
    resolveUserLifecycleStatus,
    tierTone,
    type UserDetailTab,
} from '../adminUsersModel';
import { UserDetailActivityTab } from './UserDetailActivityTab';
import { UserDetailBillingTab, UserDetailOverviewTab } from './UserDetailOverviewTab';
import { UserDetailProfileTab } from './UserDetailProfileTab';
import { UserDetailTripsTab } from './UserDetailTripsTab';
import type { AdminUserDetailApi } from './useAdminUserDetail';
import type { AdminUsersActionsApi } from './useAdminUsersActions';
import type { AdminUsersStateApi } from './useAdminUsersState';

const DETAIL_TABS = Object.keys(USER_DETAIL_TAB_LABELS) as UserDetailTab[];

interface UserDetailSheetProps {
    user: AdminUserRecord | null;
    table: AdminUsersStateApi;
    detail: AdminUserDetailApi;
    actions: AdminUsersActionsApi;
    errorMessage: string | null;
    /** A deep link pointed at an account that does not exist. */
    isMissing: boolean;
    currentTermsVersion: string | null;
}

const UserDetailFooter: React.FC<{
    user: AdminUserRecord;
    tripTotal: number;
    isLoadingTrips: boolean;
    actions: AdminUsersActionsApi;
}> = ({ user, tripTotal, isLoadingTrips, actions }) => {
    const { isSaving } = actions;
    const isDeleted = getUserAccountStatus(user) === 'deleted';
    return (
        <>
            <Button type="button" size="sm" onClick={() => void actions.saveSelectedUser()} disabled={isSaving}>
                Save changes
            </Button>
            <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void actions.toggleSoftDelete(user)}
                disabled={isSaving}
            >
                {isDeleted ? 'Restore user' : 'Soft delete'}
            </Button>
            <span className="ms-auto flex flex-wrap items-center gap-2">
                {tripTotal > 0 && (
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void actions.transferTripsAndHardDelete(user)}
                        disabled={isSaving || isLoadingTrips || isDeleted}
                    >
                        Transfer trips + hard delete
                    </Button>
                )}
                <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => void actions.hardDeleteUser(user)}
                    disabled={isSaving || isDeleted}
                    data-tooltip={isDeleted ? 'Restore the user before deleting permanently' : undefined}
                >
                    <Trash />
                    Hard delete
                </Button>
            </span>
        </>
    );
};

/** The inspector for one account: overview, profile and access, billing, trips and activity. */
export const UserDetailSheet: React.FC<UserDetailSheetProps> = ({
    user,
    table,
    detail,
    actions,
    errorMessage,
    isMissing,
    currentTermsVersion,
}) => {
    const { state, actions: tableActions } = table;
    const lifecycle = user ? resolveUserLifecycleStatus(user) : null;
    const publicProfilePath = getUserPublicProfilePath(user?.username);

    return (
        <AdminDetailSheet
            open={state.detail.open}
            onOpenChange={(open) => {
                if (open) {
                    tableActions.reopenDetail();
                    return;
                }
                tableActions.closeUserDetail();
            }}
            title={user ? getUserDisplayName(user) : 'User'}
            accessibleTitle={user ? `${getUserDisplayName(user)} details` : 'User details'}
            subtitle={user ? (user.email || 'No email address') : undefined}
            meta={user && lifecycle ? (
                <>
                    <AdminStatusBadge tone={lifecycle.tone}>{lifecycle.label}</AdminStatusBadge>
                    <AdminStatusBadge tone={tierTone(user.tier_key)} dot={false}>{getPlanName(user.tier_key)}</AdminStatusBadge>
                    {user.system_role === 'admin' && (
                        <AdminStatusBadge tone="accent" dot={false}>Admin</AdminStatusBadge>
                    )}
                </>
            ) : undefined}
            headerActions={publicProfilePath ? (
                <Button asChild variant="ghost" size="icon-sm">
                    <a
                        href={publicProfilePath}
                        target="_blank"
                        rel="noreferrer"
                        aria-label="Open public profile in a new tab"
                        data-tooltip="Open public profile"
                    >
                        <ArrowSquareOut className="rtl:-scale-x-100" />
                    </a>
                </Button>
            ) : undefined}
            footer={user ? (
                <UserDetailFooter
                    user={user}
                    tripTotal={detail.tripStats.total}
                    isLoadingTrips={detail.isLoadingTrips}
                    actions={actions}
                />
            ) : undefined}
        >
            {!user ? (
                isMissing ? (
                    <AdminEmptyState
                        icon={<UsersThree />}
                        title="User not found"
                        description="The link points to an account that no longer exists. Close this panel to return to the list."
                    />
                ) : (
                    <div role="status" className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                        <SpinnerGap size={14} className="animate-spin motion-reduce:animate-none" />
                        Loading user…
                    </div>
                )
            ) : (
                <>
                    {errorMessage && <AdminErrorAlert message={errorMessage} />}
                    <Tabs
                        value={state.detail.tab}
                        onValueChange={(value) => {
                            const nextTab = value as UserDetailTab;
                            tableActions.setDetailTab(nextTab);
                            trackEvent('admin__users_detail--tab', { tab: nextTab });
                        }}
                        className="gap-4"
                    >
                        <TabsList variant="line" aria-label="User details" className="w-full justify-start gap-5 overflow-x-auto">
                            {DETAIL_TABS.map((tab) => (
                                <TabsTrigger
                                    key={tab}
                                    value={tab}
                                    className="group-data-[variant=line]/tabs-list:py-2.5"
                                    {...getAnalyticsDebugAttributes('admin__users_detail--tab', { tab })}
                                >
                                    {USER_DETAIL_TAB_LABELS[tab]}
                                    {tab === 'trips' && (
                                        <span className="tabular-nums text-muted-foreground">{detail.tripStats.total}</span>
                                    )}
                                </TabsTrigger>
                            ))}
                        </TabsList>

                        <TabsContent value="overview" className="flex flex-col gap-6">
                            <UserDetailOverviewTab
                                user={user}
                                tripStats={detail.tripStats}
                                publicProfilePath={publicProfilePath}
                                currentTermsVersion={currentTermsVersion}
                                isSaving={actions.isSaving}
                                onResetTerms={() => void actions.resetTermsAcceptance()}
                            />
                        </TabsContent>

                        <TabsContent value="profile" className="flex flex-col gap-6">
                            <UserDetailProfileTab
                                detail={detail}
                                usernameChangedAt={user.username_changed_at}
                                isSaving={actions.isSaving}
                                onRevokeCooldown={() => void actions.resetUsernameCooldown()}
                            />
                        </TabsContent>

                        <TabsContent value="billing" className="flex flex-col gap-3">
                            <UserDetailBillingTab user={user} />
                        </TabsContent>

                        <TabsContent value="trips">
                            <UserDetailTripsTab
                                trips={detail.userTrips}
                                isLoading={detail.isLoadingTrips}
                                page={state.detail.tripsPage}
                                onPageChange={tableActions.setDetailTripsPage}
                                tripsPageLink={buildAdminTripsLinkForUser(user)}
                                onPatchTrip={(trip, patch) => void actions.patchTrip(trip, patch)}
                            />
                        </TabsContent>

                        <TabsContent value="activity">
                            <UserDetailActivityTab
                                userId={user.user_id}
                                entries={detail.changeEntries}
                                isLoading={detail.isLoadingChangeLogs}
                                errorMessage={detail.changeLogsError}
                                page={state.detail.changeLogPage}
                                onPageChange={tableActions.setDetailChangeLogPage}
                                onOpenFullDiff={(log) => void actions.openFullDiff(log)}
                            />
                        </TabsContent>
                    </Tabs>
                </>
            )}
        </AdminDetailSheet>
    );
};
