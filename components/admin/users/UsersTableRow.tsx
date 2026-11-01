import React from 'react';
import { Copy, DotsThreeVertical } from '@phosphor-icons/react';
import { Link } from '@/app/navigation';
import { Button } from '../../ui/button';
import { Checkbox } from '../../ui/checkbox';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '../../ui/dropdown-menu';
import { TableCell, TableRow } from '../../ui/table';
import { AdminStatusBadge } from '../AdminStatusBadge';
import { AdminRelativeTimestamp } from '../AdminRelativeTimestamp';
import {
    ADMIN_TABLE_ROW_SURFACE_CLASS,
    ADMIN_TABLE_SORTED_CELL_CLASS,
    getAdminStickyBodyCellClass,
} from '../AdminDataTableUtils';
import { cn } from '../../../lib/utils';
import { getAnalyticsDebugAttributes, trackEvent } from '../../../services/analyticsService';
import type { AdminUserRecord } from '../../../services/adminService';
import {
    activationStatusTone,
    buildAdminTripsLinkForUser,
    getActivationStatusLabel,
    getPlanName,
    getUserAccountStatus,
    getUserActiveTrips,
    getUserDisplayName,
    getUserSubscriptionStatusLabel,
    getUserTermsStateLabel,
    getUserTermsStateTone,
    getUserTotalTrips,
    hasNotableSubscription,
    isUserHardDeleteEligible,
    isUserTriplessAndNoData,
    resolveActivationStatus,
    resolveUserLifecycleStatus,
    resolveUserSubscriptionStatus,
    resolveUserTermsState,
    subscriptionStatusTone,
    tierTone,
    type UserSortKey,
    type UserVisibleColumnId,
} from '../adminUsersModel';
import { UserLoginPills } from './UserLoginPills';

const UserRowActionsMenu: React.FC<{
    disabled: boolean;
    isDeleted: boolean;
    userName: string;
    tripsLink: string;
    onOpenDetails: () => void;
    onCopyId: () => void;
    onSoftDelete: () => void;
}> = ({ disabled, isDeleted, userName, tripsLink, onOpenDetails, onCopyId, onSoftDelete }) => (
    <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild disabled={disabled}>
            <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={disabled}
                aria-label={`Open actions for ${userName}`}
                data-tooltip="User actions"
            >
                <DotsThreeVertical weight="bold" />
            </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[180px]">
            <DropdownMenuItem onSelect={onOpenDetails}>
                Open details
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onCopyId}>
                <Copy />
                Copy user ID
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
                <Link
                    to={tripsLink}
                    onClick={() => trackEvent('admin__users_row--view_trips')}
                    {...getAnalyticsDebugAttributes('admin__users_row--view_trips')}
                >
                    View trips
                </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant={isDeleted ? 'default' : 'destructive'} onSelect={onSoftDelete}>
                {isDeleted ? 'Restore user' : 'Soft-delete user'}
            </DropdownMenuItem>
        </DropdownMenuContent>
    </DropdownMenu>
);

export interface UsersTableRowHandlers {
    onOpen: (user: AdminUserRecord) => void;
    onSelectedChange: (user: AdminUserRecord, selected: boolean) => void;
    onCopyId: (user: AdminUserRecord) => void;
    onToggleSoftDelete: (user: AdminUserRecord) => void;
}

export interface UsersTableRowProps {
    user: AdminUserRecord;
    isSelected: boolean;
    isSaving: boolean;
    isScrolled: boolean;
    visibleColumns: ReadonlySet<UserVisibleColumnId>;
    sortKey: UserSortKey;
    currentTermsVersion: string | null;
    handlers: UsersTableRowHandlers;
}

/** One account row. The checkbox is disabled for soft-deleted accounts, which bulk actions skip. */
export const UsersTableRow: React.FC<UsersTableRowProps> = ({
    user,
    isSelected,
    isSaving,
    isScrolled,
    visibleColumns,
    sortKey,
    currentTermsVersion,
    handlers,
}) => {
    const userName = getUserDisplayName(user);
    const accountStatus = getUserAccountStatus(user);
    const activationStatus = resolveActivationStatus(user);
    const lifecycle = resolveUserLifecycleStatus(user);
    const subscriptionStatus = resolveUserSubscriptionStatus(user);
    const isHardDeleteEligible = isUserHardDeleteEligible(user);
    const termsState = resolveUserTermsState(user, currentTermsVersion);
    const totalTrips = getUserTotalTrips(user);
    const isVisible = (columnId: UserVisibleColumnId): boolean => visibleColumns.has(columnId);
    const sortedCell = (key: UserSortKey) => cn('px-3 py-2.5', sortKey === key && ADMIN_TABLE_SORTED_CELL_CLASS);

    return (
        <TableRow
            className={ADMIN_TABLE_ROW_SURFACE_CLASS}
            data-state={isSelected ? 'selected' : undefined}
        >
            <TableCell
                className={`sticky start-0 z-40 w-[44px] min-w-[44px] max-w-[44px] px-3 py-2.5 ${getAdminStickyBodyCellClass({
                    isSelected,
                    isScrolled,
                    isFirst: isVisible('user'),
                })}`}
                style={{ width: 44, minWidth: 44, maxWidth: 44 }}
            >
                <Checkbox
                    checked={isSelected && isHardDeleteEligible}
                    disabled={!isHardDeleteEligible}
                    onCheckedChange={(checked) => handlers.onSelectedChange(user, Boolean(checked))}
                    aria-label={isHardDeleteEligible ? `Select ${userName}` : `Cannot select ${userName} (soft-deleted)`}
                />
            </TableCell>
            {isVisible('user') && (
                <TableCell
                    className={`sticky start-[44px] z-30 w-[280px] min-w-[240px] max-w-[280px] overflow-hidden px-3 py-2.5 ${getAdminStickyBodyCellClass({
                        isSelected,
                        isScrolled,
                        isFirst: false,
                        isSorted: sortKey === 'name',
                    })}`}
                >
                    <button
                        type="button"
                        onClick={() => handlers.onOpen(user)}
                        className="group/user block w-full min-w-0 cursor-pointer rounded-sm text-start outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    >
                        <span className="flex min-w-0 items-center gap-1.5">
                            <span className="truncate text-sm font-medium text-foreground group-hover/user:underline group-hover/user:decoration-muted-foreground">{userName}</span>
                            {user.system_role === 'admin' && (
                                <AdminStatusBadge tone="accent" dot={false} className="h-4 px-1.5 text-[11px]">Admin</AdminStatusBadge>
                            )}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">{user.email || 'No email address'}</span>
                    </button>
                </TableCell>
            )}
            {isVisible('status') && (
                <TableCell className={sortedCell('account_status')}>
                    <AdminStatusBadge tone={lifecycle.tone}>{lifecycle.label}</AdminStatusBadge>
                </TableCell>
            )}
            {isVisible('login') && (
                <TableCell className={sortedCell('email')}>
                    <UserLoginPills user={user} />
                </TableCell>
            )}
            {isVisible('tier') && (
                <TableCell className={sortedCell('tier_key')}>
                    <div className="flex flex-col items-start gap-0.5">
                        <AdminStatusBadge tone={tierTone(user.tier_key)} dot={false}>
                            {getPlanName(user.tier_key)}
                        </AdminStatusBadge>
                        {hasNotableSubscription(subscriptionStatus) && (
                            <span
                                className={cn(
                                    'text-xs',
                                    subscriptionStatus === 'past_due' || subscriptionStatus === 'canceled_grace'
                                        ? 'text-amber-700 dark:text-amber-300'
                                        : 'text-muted-foreground'
                                )}
                            >
                                {getUserSubscriptionStatusLabel(subscriptionStatus)}
                            </span>
                        )}
                    </div>
                </TableCell>
            )}
            {isVisible('subscription') && (
                <TableCell className={sortedCell('subscription_status')}>
                    <div className="flex min-w-[132px] flex-col gap-1">
                        <AdminStatusBadge tone={subscriptionStatusTone(subscriptionStatus)}>
                            {getUserSubscriptionStatusLabel(subscriptionStatus)}
                        </AdminStatusBadge>
                        {user.provider_subscription_id ? (
                            <span className="max-w-[180px] truncate font-mono text-[11px] text-muted-foreground" data-tooltip={user.provider_subscription_id}>
                                {user.provider_subscription_id}
                            </span>
                        ) : null}
                    </div>
                </TableCell>
            )}
            {isVisible('trips') && (
                <TableCell className={sortedCell('total_trips')}>
                    <div className="text-sm font-medium tabular-nums text-foreground">{totalTrips}</div>
                    {totalTrips > 0 ? (
                        <div className="text-xs tabular-nums text-muted-foreground">{getUserActiveTrips(user)} active</div>
                    ) : isUserTriplessAndNoData(user) ? (
                        <div className="text-xs text-muted-foreground">Empty account</div>
                    ) : null}
                </TableCell>
            )}
            {isVisible('activation') && (
                <TableCell className={sortedCell('activation_status')}>
                    <AdminStatusBadge tone={activationStatusTone(activationStatus)}>
                        {getActivationStatusLabel(activationStatus)}
                    </AdminStatusBadge>
                </TableCell>
            )}
            {isVisible('role') && (
                <TableCell className={sortedCell('system_role')}>
                    <AdminStatusBadge tone={user.system_role === 'admin' ? 'accent' : 'neutral'} dot={false}>
                        {user.system_role === 'admin' ? 'Admin' : 'User'}
                    </AdminStatusBadge>
                </TableCell>
            )}
            {isVisible('toc') && (
                <TableCell className={sortedCell('terms_accepted_version')}>
                    <AdminStatusBadge tone={getUserTermsStateTone(termsState)}>
                        {getUserTermsStateLabel(termsState)}
                    </AdminStatusBadge>
                    <div className="mt-1 text-xs text-muted-foreground">
                        {user.terms_accepted_version || 'No accepted version'}
                    </div>
                </TableCell>
            )}
            {isVisible('last_visit') && (
                <TableCell className={cn(sortedCell('last_sign_in_at'), 'text-sm text-muted-foreground')}>
                    <AdminRelativeTimestamp value={user.last_sign_in_at} fallback="Never" />
                </TableCell>
            )}
            {isVisible('last_log') && (
                <TableCell className={cn(sortedCell('updated_at'), 'text-sm text-muted-foreground')}>
                    <AdminRelativeTimestamp value={user.updated_at} fallback="Never" />
                </TableCell>
            )}
            {isVisible('created') && (
                <TableCell className={cn(sortedCell('created_at'), 'text-sm text-muted-foreground')}>
                    <AdminRelativeTimestamp value={user.created_at} fallback="Unknown" />
                </TableCell>
            )}
            <TableCell className="px-3 py-2.5 text-end">
                <UserRowActionsMenu
                    disabled={isSaving}
                    isDeleted={accountStatus === 'deleted'}
                    userName={userName}
                    tripsLink={buildAdminTripsLinkForUser(user)}
                    onOpenDetails={() => handlers.onOpen(user)}
                    onCopyId={() => handlers.onCopyId(user)}
                    onSoftDelete={() => handlers.onToggleSoftDelete(user)}
                />
            </TableCell>
        </TableRow>
    );
};
