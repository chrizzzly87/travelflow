import React from 'react';
import { Link } from '@/app/navigation';
import { Button } from '../../ui/button';
import { AdminDetailField } from '../AdminDetailField';
import { AdminSectionHeader } from '../AdminSectionHeader';
import { AdminStatusBadge } from '../AdminStatusBadge';
import { CopyableUuid } from '../CopyableUuid';
import { formatAdminRelativeTime } from '../adminRelativeTime';
import { humanizeAdminBillingStatus } from '../../../services/adminBillingPresentation';
import type { AdminUserRecord } from '../../../services/adminService';
import {
    formatAbsoluteTimestamp,
    formatSubscriptionAmount,
    getUserSubscriptionStatusLabel,
    getUserTermsStateLabel,
    getUserTermsStateTone,
    resolveUserLifecycleStatus,
    resolveUserSubscriptionDowngradeAt,
    resolveUserSubscriptionStatus,
    resolveUserTermsState,
    subscriptionStatusTone,
} from '../adminUsersModel';
import { UserLoginPills } from './UserLoginPills';

/** Account facts and the terms-of-service state, with the terms reset. */
export const UserDetailOverviewTab: React.FC<{
    user: AdminUserRecord;
    tripStats: { total: number; active: number };
    publicProfilePath: string | null;
    currentTermsVersion: string | null;
    isSaving: boolean;
    onResetTerms: () => void;
}> = ({ user, tripStats, publicProfilePath, currentTermsVersion, isSaving, onResetTerms }) => {
    const lifecycle = resolveUserLifecycleStatus(user);
    const termsState = resolveUserTermsState(user, currentTermsVersion);
    return (
        <>
            <section className="flex flex-col gap-3">
                <AdminSectionHeader as="h3" title="Account" />
                <dl className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
                    <AdminDetailField label="User ID" className="sm:col-span-2">
                        <CopyableUuid value={user.user_id} textClassName="break-all text-sm" />
                    </AdminDetailField>
                    <AdminDetailField label="Status">
                        <AdminStatusBadge tone={lifecycle.tone}>{lifecycle.label}</AdminStatusBadge>
                    </AdminDetailField>
                    <AdminDetailField label="Sign-in method">
                        <UserLoginPills user={user} />
                    </AdminDetailField>
                    <AdminDetailField label="Last sign-in">
                        {user.last_sign_in_at
                            ? <>{formatAdminRelativeTime(user.last_sign_in_at, undefined, 'Never')} <span className="text-muted-foreground">· {formatAbsoluteTimestamp(user.last_sign_in_at)}</span></>
                            : 'Never'}
                    </AdminDetailField>
                    <AdminDetailField label="Created">
                        {formatAbsoluteTimestamp(user.created_at)}
                    </AdminDetailField>
                    <AdminDetailField label="Last updated">
                        {formatAbsoluteTimestamp(user.updated_at)}
                    </AdminDetailField>
                    <AdminDetailField label="Trips">
                        <span className="tabular-nums">
                            {tripStats.active} active of {tripStats.total}
                        </span>
                    </AdminDetailField>
                    <AdminDetailField label="Public profile" className="sm:col-span-2">
                        {publicProfilePath ? (
                            <a
                                href={publicProfilePath}
                                target="_blank"
                                rel="noreferrer"
                                className="text-primary underline-offset-4 hover:underline"
                            >
                                {publicProfilePath}
                            </a>
                        ) : (
                            <span className="text-muted-foreground">Not available until the user picks a username.</span>
                        )}
                    </AdminDetailField>
                </dl>
            </section>

            <section className="flex flex-col gap-3" aria-labelledby="admin-user-terms-heading">
                <AdminSectionHeader
                    as="h3"
                    title={<span id="admin-user-terms-heading">Terms of service</span>}
                    actions={(
                        <Button
                            type="button"
                            variant="outline"
                            size="xs"
                            onClick={onResetTerms}
                            disabled={isSaving || !user.terms_accepted_version}
                        >
                            Reset terms acceptance
                        </Button>
                    )}
                />
                <dl className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
                    <AdminDetailField label="State">
                        <AdminStatusBadge tone={getUserTermsStateTone(termsState)}>
                            {getUserTermsStateLabel(termsState)}
                        </AdminStatusBadge>
                    </AdminDetailField>
                    <AdminDetailField label="Accepted version">
                        {user.terms_accepted_version || 'Not accepted yet'}
                    </AdminDetailField>
                    <AdminDetailField label="Accepted at">
                        {formatAbsoluteTimestamp(user.terms_accepted_at)}
                    </AdminDetailField>
                </dl>
            </section>
        </>
    );
};

/** Read-only subscription facts; billing changes happen in Paddle. */
export const UserDetailBillingTab: React.FC<{ user: AdminUserRecord }> = ({ user }) => {
    const subscriptionStatus = resolveUserSubscriptionStatus(user);
    return (
        <>
            <AdminSectionHeader
                as="h3"
                title="Subscription"
                description="Read-only. Billing changes happen in Paddle."
                actions={(
                    <Button asChild variant="outline" size="xs">
                        <Link to={`/admin/billing?q=${encodeURIComponent(user.provider_subscription_id || user.user_id)}`}>
                            Open in Billing
                        </Link>
                    </Button>
                )}
            />
            <dl className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
                <AdminDetailField label="Status">
                    <AdminStatusBadge tone={subscriptionStatusTone(subscriptionStatus)}>
                        {getUserSubscriptionStatusLabel(subscriptionStatus)}
                    </AdminStatusBadge>
                </AdminDetailField>
                <AdminDetailField label="Provider status">
                    {humanizeAdminBillingStatus(user.provider_status || user.subscription_status)}
                </AdminDetailField>
                <AdminDetailField label="Recurring amount">
                    <span className="tabular-nums">{formatSubscriptionAmount(user)}</span>
                </AdminDetailField>
                <AdminDetailField label="Current period ends">
                    {formatAbsoluteTimestamp(user.current_period_end)}
                </AdminDetailField>
                <AdminDetailField label="Cancels at">
                    {formatAbsoluteTimestamp(user.cancel_at)}
                </AdminDetailField>
                <AdminDetailField label="Cancelled at">
                    {formatAbsoluteTimestamp(user.canceled_at)}
                </AdminDetailField>
                <AdminDetailField label="Grace ends">
                    {formatAbsoluteTimestamp(user.grace_ends_at)}
                </AdminDetailField>
                <AdminDetailField label="Downgrades at">
                    {formatAbsoluteTimestamp(resolveUserSubscriptionDowngradeAt(user))}
                </AdminDetailField>
                <AdminDetailField label="Subscription ID">
                    <span className="break-all font-mono text-xs">{user.provider_subscription_id || '—'}</span>
                </AdminDetailField>
                <AdminDetailField label="Paddle price ID">
                    <span className="break-all font-mono text-xs">{user.provider_price_id || '—'}</span>
                </AdminDetailField>
                <AdminDetailField label="Latest billing event" className="sm:col-span-2">
                    <span className="font-medium">{user.subscription_last_event_type || 'No event recorded'}</span>
                    {user.subscription_last_event_at && (
                        <span className="text-muted-foreground"> · {formatAbsoluteTimestamp(user.subscription_last_event_at)}</span>
                    )}
                    {user.subscription_last_event_id && (
                        <span className="block break-all font-mono text-xs text-muted-foreground">{user.subscription_last_event_id}</span>
                    )}
                </AdminDetailField>
            </dl>
        </>
    );
};
