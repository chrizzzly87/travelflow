import React, { useState } from 'react';
import { Link } from '@/app/navigation';
import { AdminDetailSheet } from '../AdminDetailSheet';
import { AdminSectionHeader } from '../AdminSectionHeader';
import { AdminStatusBadge } from '../AdminStatusBadge';
import { CopyableUuid } from '../CopyableUuid';
import { useAppDialog } from '../../AppDialogProvider';
import { Button } from '../../ui/button';
import { showAppToast } from '../../ui/appToast';
import {
    adminGetUserProfile,
    adminUpdateUserProfile,
    type AdminAuditRecord,
    type AdminUserRecord,
} from '../../../services/adminService';
import { getAnalyticsDebugAttributes, trackEvent } from '../../../services/analyticsService';
import { buildDecisionConfirmDialog } from '../../../services/appDialogPresets';
import {
    getSnapshotForTarget,
    resolveAuditUserAccountStatus,
    resolveAuditUserIdentity,
} from './adminAuditModel';
import { formatAccountStatusLabel } from './adminAuditPresentation';
import { AuditDetailRow, AuditLoadingStatus, AuditSnapshotDisclosure, AuditWarningAlert } from './AuditDetailParts';
import { toAuditErrorMessage } from './useAdminAuditData';
import { useAuditLiveRecord } from './useAuditLiveRecord';

const USER_MESSAGES = {
    notFound: 'Live profile not found. Showing audit snapshot only.',
    failed: 'Could not load the live user profile.',
};

const RESTORE_BUTTON_CLASS = 'border-emerald-300 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 dark:border-emerald-400/30 dark:text-emerald-200 dark:hover:bg-emerald-400/12 dark:hover:text-emerald-100';

/** The user behind an audit row: live profile when it exists, the audit snapshot otherwise. */
export const AuditUserSheet: React.FC<{
    log: AdminAuditRecord | null;
    onClose: () => void;
    onRestored: () => Promise<void>;
    clearPageError: () => void;
}> = ({ log, onClose, onRestored, clearPageError }) => {
    const { confirm: confirmDialog } = useAppDialog();
    const live = useAuditLiveRecord<AdminUserRecord>(log, adminGetUserProfile, USER_MESSAGES);
    const [isRestoring, setIsRestoring] = useState(false);
    const profile = live.record;
    const snapshot = getSnapshotForTarget(log);
    const identity = resolveAuditUserIdentity(log, profile);
    const accountStatus = resolveAuditUserAccountStatus(log, profile);

    const restoreUser = async () => {
        const userId = profile?.user_id || log?.target_id || null;
        if (!userId) {
            live.update({ error: 'Cannot restore: no user id available.' });
            return;
        }
        const confirmed = await confirmDialog(buildDecisionConfirmDialog({
            title: 'Restore user account',
            message: 'Restore this user by setting account status back to active?',
            confirmLabel: 'Restore user',
        }));
        if (!confirmed) return;
        setIsRestoring(true);
        clearPageError();
        live.update({ error: null });
        try {
            await adminUpdateUserProfile(userId, { accountStatus: 'active' });
            live.update({ record: await adminGetUserProfile(userId) });
            showAppToast({
                tone: 'success',
                title: 'User restored',
                description: 'Account status has been set to active and recorded in audit logs.',
            });
            await onRestored();
        } catch (error) {
            live.update({ error: toAuditErrorMessage(error, 'Could not restore this user. Try again.') });
        } finally {
            setIsRestoring(false);
        }
    };

    return (
        <AdminDetailSheet
            open={Boolean(log)}
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
            size="md"
            title={identity.name || identity.email || 'User'}
            accessibleTitle="User details"
            subtitle={identity.name ? (identity.email || undefined) : undefined}
            meta={accountStatus && (
                <AdminStatusBadge tone={accountStatus === 'active' ? 'success' : accountStatus === 'deleted' ? 'danger' : 'warning'}>
                    {formatAccountStatusLabel(accountStatus)}
                </AdminStatusBadge>
            )}
            headerActions={identity.userId !== 'n/a' && (
                <Button asChild variant="outline" size="sm">
                    <Link
                        to={`/admin/users?user=${encodeURIComponent(identity.userId)}&drawer=user`}
                        onClick={() => trackEvent('admin__audit--open_in_users')}
                        {...getAnalyticsDebugAttributes('admin__audit--open_in_users')}
                    >
                        Open in Users
                    </Link>
                </Button>
            )}
            footer={accountStatus === 'deleted' && (
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                        trackEvent('admin__audit--restore_user');
                        void restoreUser();
                    }}
                    disabled={isRestoring || !log?.target_id || !profile}
                    aria-busy={isRestoring || undefined}
                    className={RESTORE_BUTTON_CLASS}
                    {...getAnalyticsDebugAttributes('admin__audit--restore_user')}
                >
                    {isRestoring ? 'Restoring…' : 'Restore user'}
                </Button>
            )}
        >
            {live.error && <AuditWarningAlert message={live.error} />}
            {live.isLoading ? (
                <AuditLoadingStatus label="Loading user profile…" />
            ) : (
                <>
                    <section className="flex flex-col gap-2">
                        <AdminSectionHeader as="h3" title="Profile" />
                        <dl className="divide-y divide-border">
                            <AuditDetailRow label="Name">{identity.name || '—'}</AuditDetailRow>
                            <AuditDetailRow label="Email">{identity.email || 'No email'}</AuditDetailRow>
                            <AuditDetailRow label="User id">
                                <CopyableUuid value={identity.userId} textClassName="break-all text-xs" />
                            </AuditDetailRow>
                            <AuditDetailRow label="Role">{identity.role || '—'}</AuditDetailRow>
                            <AuditDetailRow label="Tier">{identity.tier || '—'}</AuditDetailRow>
                            {identity.totalTrips !== null && (
                                <AuditDetailRow label="Trips">
                                    <span className="tabular-nums">{identity.activeTrips ?? 0} active / {identity.totalTrips} total</span>
                                </AuditDetailRow>
                            )}
                        </dl>
                    </section>
                    {Object.keys(snapshot).length > 0 && <AuditSnapshotDisclosure snapshot={snapshot} />}
                </>
            )}
        </AdminDetailSheet>
    );
};
