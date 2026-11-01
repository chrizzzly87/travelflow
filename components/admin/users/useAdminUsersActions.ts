import { useState } from 'react';
import {
    adminCreateUserDirect,
    adminCreateUserInvite,
    adminGetTripVersionSnapshots,
    adminGetUserProfile,
    adminHardDeleteUser,
    adminListUserTrips,
    adminListUsers,
    adminResetUserTermsAcceptance,
    adminResetUserUsernameCooldown,
    adminUpdateTrip,
    adminUpdateUserOverrides,
    adminUpdateUserProfile,
    type AdminTripRecord,
    type AdminUserChangeRecord,
    type AdminUserRecord,
} from '../../../services/adminService';
import { buildDangerConfirmDialog, buildTransferTargetPromptDialog } from '../../../services/appDialogPresets';
import { trackEvent } from '../../../services/analyticsService';
import type { PlanTierKey } from '../../../types';
import { useAppDialog } from '../../AppDialogProvider';
import { showAppToast } from '../../ui/appToast';
import { copyTextToClipboard } from '../CopyableUuid';
import {
    areOverrideRecordsEqual,
    asRecord,
    asString,
    buildBulkHardDeleteErrorMessage,
    buildUsersBillingCsv,
    buildUsersBillingCsvFileName,
    findLocalTransferTargets,
    getUserAccountStatus,
    getUserDisplayName,
    getUserReferenceText,
    getUserTotalTrips,
    hasSnapshotData,
    isLikelyEmail,
    isLikelyUserId,
    isUserHardDeleteEligible,
    mergeTripSnapshotWithViewSettings,
    normalizeOverrideRecord,
    parseOverrideDraft,
} from '../adminUsersModel';
import {
    buildBulkHardDeleteMessage,
    buildSingleHardDeleteMessage,
    buildSingleSoftDeleteMessage,
    buildTransferAndHardDeleteMessage,
} from './adminUsersDialogMessages';
import type { AdminUserDetailApi } from './useAdminUserDetail';
import { toAdminUsersErrorMessage, type AdminUsersDataApi } from './useAdminUsersData';
import type { AdminUsersStateApi } from './useAdminUsersState';

export interface UserFullDiffState {
    isOpen: boolean;
    isLoading: boolean;
    errorMessage: string | null;
    title: string;
    description?: string;
    beforeLabel: string;
    afterLabel: string;
    beforeValue: unknown;
    afterValue: unknown;
}

const CLOSED_DIFF: UserFullDiffState = {
    isOpen: false,
    isLoading: false,
    errorMessage: null,
    title: 'Full change diff',
    description: undefined,
    beforeLabel: 'Before snapshot',
    afterLabel: 'After snapshot',
    beforeValue: {},
    afterValue: {},
};

export type CreateUserMode = 'invite' | 'direct';

export interface CreateUserDraft {
    email: string;
    firstName: string;
    lastName: string;
    tierKey: PlanTierKey;
    password: string;
}

export const INITIAL_CREATE_DRAFT: CreateUserDraft = {
    email: '',
    firstName: '',
    lastName: '',
    tierKey: 'tier_free',
    password: '',
};

type TripPatch = { status?: 'active' | 'archived' | 'expired'; tripExpiresAt?: string | null };

const plural = (count: number, singular = '', pluralSuffix = 's'): string => (count === 1 ? singular : pluralSuffix);

const downloadBlob = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
};

const notifySuccess = (title: string, description?: string) => {
    showAppToast({ tone: 'success', title, description });
};

/**
 * The Users screen's side effects: saving, deleting (soft, hard, bulk and
 * transfer-then-delete), resets, trip patches, user creation, CSV export and
 * the full diff modal. One `isSaving` flag covers them all and locks the table.
 *
 * Deletion safeguards follow `docs/ADMIN_USER_DELETION_POLICY.md`: every
 * destructive step is confirmed, soft-deleted users are never hard-deleted, and
 * a transfer that fails part-way skips the hard delete.
 */
export const useAdminUsersActions = (params: {
    data: AdminUsersDataApi;
    table: AdminUsersStateApi;
    detail: AdminUserDetailApi;
}) => {
    const { data, table, detail } = params;
    const { users, setErrorMessage, loadUsers } = data;
    const { selectedUser, selectedVisibleUsers, filteredUsers } = table;
    const { closeUserDetail, replaceSelection, clearSelection } = table.actions;
    const { confirm: confirmDialog, prompt: promptDialog } = useAppDialog();
    const [isSaving, setIsSaving] = useState(false);
    const [fullDiff, setFullDiff] = useState<UserFullDiffState>(CLOSED_DIFF);

    const exportUsersCsv = () => {
        if (filteredUsers.length === 0) return;
        trackEvent('admin__users--export_csv', { rows: filteredUsers.length });
        const fileName = buildUsersBillingCsvFileName(new Date().toISOString());
        downloadBlob(new Blob([buildUsersBillingCsv(filteredUsers)], { type: 'text/csv;charset=utf-8' }), fileName);
        notifySuccess(`Exported ${filteredUsers.length} user${plural(filteredUsers.length)}`, 'Billing columns for the users the table shows.');
    };

    const copyUserId = async (user: AdminUserRecord) => {
        trackEvent('admin__users_row--copy_id');
        const copied = await copyTextToClipboard(user.user_id);
        showAppToast(copied
            ? { tone: 'success', title: 'User ID copied', description: user.user_id }
            : { tone: 'warning', title: 'Could not copy', description: 'Your browser blocked clipboard access. Open the details to select the ID.' });
    };

    const openFullDiff = async (log: AdminUserChangeRecord) => {
        const metadata = asRecord(log.metadata);
        const versionId = asString(metadata.version_id);
        const previousVersionId = asString(metadata.previous_version_id);
        const ownerLabel = selectedUser?.email || selectedUser?.username || selectedUser?.user_id || log.owner_user_id;
        const loadsTripSnapshots = log.target_type === 'trip' && Boolean(log.target_id) && Boolean(versionId);

        setFullDiff({
            isOpen: true,
            isLoading: loadsTripSnapshots,
            errorMessage: null,
            title: `${log.action} · user change`,
            description: [
                `Owner: ${ownerLabel}`,
                log.target_type === 'trip' && log.target_id ? `Trip ID: ${log.target_id}` : null,
                versionId ? `Version: ${versionId}` : null,
            ].filter(Boolean).join(' • '),
            beforeLabel: 'Before snapshot',
            afterLabel: 'After snapshot',
            beforeValue: hasSnapshotData(log.before_data) ? asRecord(log.before_data) : {},
            afterValue: hasSnapshotData(log.after_data) ? asRecord(log.after_data) : {},
        });

        if (!loadsTripSnapshots || !log.target_id || !versionId) return;

        try {
            const snapshots = await adminGetTripVersionSnapshots({
                tripId: log.target_id,
                afterVersionId: versionId,
                beforeVersionId: previousVersionId,
            });
            if (!snapshots) {
                setFullDiff((current) => ({
                    ...current,
                    isLoading: false,
                    errorMessage: 'Trip snapshots were not found for this event. Showing event snapshots when available.',
                }));
                return;
            }
            setFullDiff((current) => ({
                ...current,
                isLoading: false,
                beforeValue: mergeTripSnapshotWithViewSettings(snapshots.before_snapshot, snapshots.before_view_settings),
                afterValue: mergeTripSnapshotWithViewSettings(snapshots.after_snapshot, snapshots.after_view_settings),
                beforeLabel: snapshots.before_label || 'Before version',
                afterLabel: snapshots.after_label || 'After version',
            }));
        } catch (error) {
            setFullDiff((current) => ({
                ...current,
                isLoading: false,
                errorMessage: toAdminUsersErrorMessage(error, 'Could not load trip snapshots.'),
            }));
        }
    };

    const closeFullDiff = () => {
        setFullDiff((current) => ({ ...current, isOpen: false, errorMessage: null, isLoading: false }));
    };

    const saveSelectedUser = async () => {
        if (!selectedUser) return;
        const { draft } = detail;
        setIsSaving(true);
        setErrorMessage(null);
        try {
            const parsedOverrides = parseOverrideDraft(draft.overrides);
            const currentOverrides = normalizeOverrideRecord(selectedUser.entitlements_override);
            const shouldUpdateOverrides = !areOverrideRecordsEqual(parsedOverrides, currentOverrides);
            await adminUpdateUserProfile(selectedUser.user_id, {
                firstName: draft.profile.firstName,
                lastName: draft.profile.lastName,
                username: draft.profile.username,
                gender: draft.profile.gender,
                country: draft.profile.country,
                city: draft.profile.city,
                preferredLanguage: draft.profile.preferredLanguage,
                accountStatus: draft.profile.accountStatus,
                systemRole: draft.profile.role,
                tierKey: draft.tier,
            });
            if (shouldUpdateOverrides) {
                await adminUpdateUserOverrides(selectedUser.user_id, parsedOverrides);
            }
            notifySuccess('User saved', `Changes to "${getUserDisplayName(selectedUser)}" are live.`);
            await loadUsers();
        } catch (error) {
            const fallback = error instanceof SyntaxError
                ? 'Entitlement overrides must be valid JSON.'
                : 'Could not save user.';
            setErrorMessage(toAdminUsersErrorMessage(error, fallback));
        } finally {
            setIsSaving(false);
        }
    };

    /** Runs one sheet-level reset with a loading toast that turns into success or error. */
    const runSelectedUserReset = async (copy: {
        loadingTitle: string;
        loadingDescription: (userName: string) => string;
        successTitle: string;
        successDescription: (userName: string) => string;
        errorTitle: string;
        fallback: string;
        run: (userId: string) => Promise<unknown>;
    }) => {
        if (!selectedUser) return;
        const userName = getUserDisplayName(selectedUser);
        setIsSaving(true);
        setErrorMessage(null);
        const loadingToastId = showAppToast({
            tone: 'loading',
            title: copy.loadingTitle,
            description: copy.loadingDescription(userName),
        });
        try {
            await copy.run(selectedUser.user_id);
            await loadUsers();
            showAppToast({
                id: loadingToastId,
                tone: 'success',
                title: copy.successTitle,
                description: copy.successDescription(userName),
            });
        } catch (error) {
            const reason = toAdminUsersErrorMessage(error, copy.fallback);
            setErrorMessage(reason);
            showAppToast({ id: loadingToastId, tone: 'error', title: copy.errorTitle, description: reason });
        } finally {
            setIsSaving(false);
        }
    };

    const resetUsernameCooldown = () => runSelectedUserReset({
        loadingTitle: 'Revoking username cooldown',
        loadingDescription: (userName) => `Allowing "${userName}" to change username immediately.`,
        successTitle: 'Username cooldown revoked',
        successDescription: (userName) => `"${userName}" can now change username immediately.`,
        errorTitle: 'Cooldown revoke failed',
        fallback: 'Could not reset username cooldown.',
        run: (userId) => adminResetUserUsernameCooldown(userId, 'admin.manual_reset'),
    });

    const resetTermsAcceptance = () => runSelectedUserReset({
        loadingTitle: 'Resetting terms acceptance',
        loadingDescription: (userName) => `Clearing terms acceptance for "${userName}".`,
        successTitle: 'Terms acceptance reset',
        successDescription: (userName) => `"${userName}" will be asked to accept the terms again.`,
        errorTitle: 'Terms reset failed',
        fallback: 'Could not reset terms acceptance.',
        run: (userId) => adminResetUserTermsAcceptance(userId, 'admin.testing.reset_terms'),
    });

    const undoSoftDelete = async (user: AdminUserRecord, quotedUserName: string) => {
        const undoLoadingToastId = showAppToast({
            tone: 'loading',
            title: 'Undo soft-delete',
            description: `Restoring ${quotedUserName}.`,
        });
        setIsSaving(true);
        setErrorMessage(null);
        try {
            await adminUpdateUserProfile(user.user_id, { accountStatus: 'active' });
            await loadUsers();
            showAppToast({
                id: undoLoadingToastId,
                tone: 'success',
                title: 'Soft-delete undone',
                description: `${quotedUserName} was restored and can sign in again.`,
            });
        } catch (undoError) {
            const reason = toAdminUsersErrorMessage(undoError, 'Could not restore user.');
            showAppToast({ id: undoLoadingToastId, tone: 'error', title: 'Undo failed', description: reason });
            setErrorMessage(reason);
        } finally {
            setIsSaving(false);
        }
    };

    /** Soft-deletes an active account (after confirmation) or restores a soft-deleted one. */
    const toggleSoftDelete = async (user: AdminUserRecord) => {
        const nextStatus = getUserAccountStatus(user) === 'deleted' ? 'active' : 'deleted';
        const userName = getUserDisplayName(user);
        const quotedUserName = `"${userName}"`;
        if (nextStatus === 'deleted') {
            const confirmed = await confirmDialog(buildDangerConfirmDialog({
                title: 'Soft delete user',
                message: buildSingleSoftDeleteMessage(userName),
                confirmLabel: 'Soft delete',
            }));
            if (!confirmed) return;
        }
        setIsSaving(true);
        setErrorMessage(null);
        const loadingToastId = showAppToast({
            tone: 'loading',
            title: nextStatus === 'deleted' ? 'Soft-deleting user' : 'Restoring user',
            description: nextStatus === 'deleted'
                ? `Applying soft-delete to ${quotedUserName}.`
                : `Restoring ${quotedUserName}.`,
        });
        try {
            await adminUpdateUserProfile(user.user_id, { accountStatus: nextStatus });
            await loadUsers();
            if (nextStatus === 'deleted') {
                showAppToast({
                    id: loadingToastId,
                    tone: 'remove',
                    title: 'User soft-deleted',
                    description: `${quotedUserName} was soft-deleted. The user can be restored and cannot sign in while deleted.`,
                    action: {
                        label: 'Undo',
                        onClick: () => {
                            void undoSoftDelete(user, quotedUserName);
                        },
                    },
                });
            } else {
                showAppToast({
                    id: loadingToastId,
                    tone: 'success',
                    title: 'User restored',
                    description: `${quotedUserName} was restored and can sign in again.`,
                });
            }
        } catch (error) {
            const reason = toAdminUsersErrorMessage(error, 'Could not update user status.');
            showAppToast({ id: loadingToastId, tone: 'error', title: 'Update failed', description: reason });
            setErrorMessage(reason);
        } finally {
            setIsSaving(false);
        }
    };

    const hardDeleteUser = async (user: AdminUserRecord) => {
        if (!isUserHardDeleteEligible(user)) {
            const reason = 'Hard delete is unavailable for soft-deleted users.';
            setErrorMessage(reason);
            showAppToast({ tone: 'warning', title: 'Hard delete unavailable', description: reason });
            return;
        }
        const userName = getUserDisplayName(user);
        const quotedUserName = `"${userName}"`;
        const sourceTripCount = selectedUser?.user_id === user.user_id
            ? detail.tripStats.total
            : getUserTotalTrips(user);
        const confirmed = await confirmDialog(buildDangerConfirmDialog({
            title: 'Hard delete user',
            message: buildSingleHardDeleteMessage(userName, sourceTripCount),
            confirmLabel: 'Hard delete',
        }));
        if (!confirmed) return;
        setIsSaving(true);
        setErrorMessage(null);
        const loadingToastId = showAppToast({
            tone: 'loading',
            title: 'Hard-deleting user',
            description: `Permanently deleting ${quotedUserName}.`,
        });
        try {
            await adminHardDeleteUser(user.user_id);
            closeUserDetail();
            await loadUsers();
            showAppToast({
                id: loadingToastId,
                tone: 'remove',
                title: 'User hard-deleted',
                description: sourceTripCount > 0
                    ? `${quotedUserName} and ${sourceTripCount} owned trip${plural(sourceTripCount)} were permanently deleted.`
                    : `${quotedUserName} was permanently deleted.`,
            });
        } catch (error) {
            const reason = toAdminUsersErrorMessage(error, 'Could not hard-delete user.');
            showAppToast({ id: loadingToastId, tone: 'error', title: 'Hard delete failed', description: reason });
            setErrorMessage(reason);
        } finally {
            setIsSaving(false);
        }
    };

    const bulkSoftDelete = async () => {
        if (selectedVisibleUsers.length === 0) return;
        const targets = selectedVisibleUsers;
        const selectedSingleUser = targets.length === 1 ? targets[0] : null;
        const confirmed = await confirmDialog(buildDangerConfirmDialog({
            title: 'Soft delete selected users',
            message: selectedSingleUser
                ? buildSingleSoftDeleteMessage(getUserDisplayName(selectedSingleUser))
                : `Soft-delete ${targets.length} selected users?\n\nSoft delete can be reverted later and prevents sign-in while deleted.`,
            confirmLabel: 'Soft delete',
        }));
        if (!confirmed) return;
        setIsSaving(true);
        setErrorMessage(null);
        const loadingToastId = showAppToast({
            tone: 'loading',
            title: 'Soft-deleting users',
            description: `Applying soft-delete to ${targets.length} selected user${plural(targets.length)}.`,
        });
        try {
            await Promise.all(targets.map((user) => adminUpdateUserProfile(user.user_id, { accountStatus: 'deleted' })));
            clearSelection();
            await loadUsers();
            showAppToast({
                id: loadingToastId,
                tone: 'remove',
                title: 'Users soft-deleted',
                description: `${targets.length} user${plural(targets.length)} were soft-deleted successfully.`,
            });
        } catch (error) {
            const reason = toAdminUsersErrorMessage(error, 'Could not soft-delete selected users.');
            showAppToast({ id: loadingToastId, tone: 'error', title: 'Soft delete failed', description: reason });
            setErrorMessage(reason);
        } finally {
            setIsSaving(false);
        }
    };

    const bulkHardDelete = async () => {
        if (selectedVisibleUsers.length === 0) return;
        const hardDeleteUsers = selectedVisibleUsers.filter((user) => isUserHardDeleteEligible(user));
        if (hardDeleteUsers.length === 0) {
            const reason = 'No eligible users selected for hard delete. Soft-deleted users are skipped.';
            setErrorMessage(reason);
            showAppToast({ tone: 'warning', title: 'Hard delete unavailable', description: reason });
            return;
        }
        const selectedTripCount = hardDeleteUsers.reduce((sum, user) => sum + getUserTotalTrips(user), 0);
        const selectedSingleUser = hardDeleteUsers.length === 1 ? hardDeleteUsers[0] : null;
        const confirmed = await confirmDialog(buildDangerConfirmDialog({
            title: 'Hard delete selected users',
            message: selectedSingleUser
                ? buildSingleHardDeleteMessage(getUserDisplayName(selectedSingleUser), selectedTripCount)
                : buildBulkHardDeleteMessage(hardDeleteUsers.length, selectedTripCount),
            confirmLabel: 'Hard delete',
        }));
        if (!confirmed) return;
        setIsSaving(true);
        setErrorMessage(null);
        const loadingToastId = showAppToast({
            tone: 'loading',
            title: 'Hard-deleting users',
            description: `Permanently deleting ${hardDeleteUsers.length} selected user${plural(hardDeleteUsers.length)}.`,
        });
        try {
            const results = await Promise.allSettled(hardDeleteUsers.map((user) => adminHardDeleteUser(user.user_id)));
            const failedUserIds: string[] = [];
            const failedDetails: string[] = [];
            const deletedIds = new Set<string>();
            results.forEach((result, index) => {
                const user = hardDeleteUsers[index];
                if (result.status === 'fulfilled') {
                    deletedIds.add(user.user_id);
                    return;
                }
                failedUserIds.push(user.user_id);
                const reason = toAdminUsersErrorMessage(result.reason, 'Unknown delete error.');
                failedDetails.push(`${getUserReferenceText(user)}: ${reason}`);
            });

            const failed = failedUserIds.length;
            const deleted = results.length - failed;
            const deletedTripCount = hardDeleteUsers
                .filter((user) => deletedIds.has(user.user_id))
                .reduce((sum, user) => sum + getUserTotalTrips(user), 0);
            const bulkErrorMessage = buildBulkHardDeleteErrorMessage(deleted, failedDetails);
            // Only the failed accounts stay selected, so a retry targets just those.
            replaceSelection(failedUserIds);
            if (table.state.detail.userId && deletedIds.has(table.state.detail.userId)) {
                closeUserDetail();
            }
            await loadUsers({ preserveErrorMessage: Boolean(bulkErrorMessage) });
            if (bulkErrorMessage) {
                setErrorMessage(bulkErrorMessage);
                showAppToast({
                    id: loadingToastId,
                    tone: deleted > 0 ? 'warning' : 'error',
                    title: deleted > 0 ? 'Some users were not deleted' : 'Hard delete failed',
                    description: deleted > 0
                        ? `${deleted} user${plural(deleted)} were deleted, but ${failed} failed. The failed accounts stay selected; details are above the table.`
                        : bulkErrorMessage,
                });
            } else {
                showAppToast({
                    id: loadingToastId,
                    tone: 'remove',
                    title: 'Users hard-deleted',
                    description: `${deleted} user${plural(deleted)} and ${deletedTripCount} owned trip${plural(deletedTripCount)} were permanently deleted.`,
                });
            }
        } catch (error) {
            const reason = toAdminUsersErrorMessage(error, 'Could not hard-delete selected users.');
            showAppToast({ id: loadingToastId, tone: 'error', title: 'Hard delete failed', description: reason });
            setErrorMessage(reason);
        } finally {
            setIsSaving(false);
        }
    };

    const resolveTransferTargetUser = async (rawInput: string): Promise<AdminUserRecord> => {
        const normalizedInput = rawInput.trim();
        if (!normalizedInput) {
            throw new Error('Enter a target user email or UUID.');
        }
        const normalizedLower = normalizedInput.toLowerCase();
        const localMatches = findLocalTransferTargets(users, normalizedInput);
        if (localMatches.length > 1) {
            throw new Error('Multiple local users matched that target. Enter a UUID instead.');
        }
        if (localMatches.length === 1) {
            return localMatches[0];
        }
        if (isLikelyUserId(normalizedInput)) {
            const profile = await adminGetUserProfile(normalizedInput);
            if (profile) return profile;
        }
        if (isLikelyEmail(normalizedInput)) {
            const rows = await adminListUsers({ search: normalizedInput, limit: 20 });
            const exactMatches = rows.filter((candidate) => (candidate.email || '').trim().toLowerCase() === normalizedLower);
            if (exactMatches.length > 1) {
                throw new Error('Multiple users found for that email. Enter a UUID instead.');
            }
            if (exactMatches.length === 1) {
                return exactMatches[0];
            }
        }
        throw new Error('Target user not found. Enter an existing user email or UUID.');
    };

    /** Moves every owned trip to an active target account, then hard-deletes the source only if all moved. */
    const transferTripsAndHardDelete = async (user: AdminUserRecord) => {
        const knownTripCount = selectedUser?.user_id === user.user_id
            ? detail.tripStats.total
            : getUserTotalTrips(user);
        if (knownTripCount <= 0) {
            setErrorMessage('No owned trips found to transfer.');
            return;
        }

        const transferTargetInput = await promptDialog(buildTransferTargetPromptDialog({
            title: 'Transfer trips before hard delete',
            message: 'Enter the target user email or UUID. All owned trips will move to this account before hard delete.',
            confirmLabel: 'Continue',
        }));
        if (transferTargetInput === null) return;

        setIsSaving(true);
        setErrorMessage(null);
        try {
            const targetUser = await resolveTransferTargetUser(transferTargetInput);
            if (targetUser.user_id === user.user_id) {
                throw new Error('Target user must be different from the user being deleted.');
            }
            if (getUserAccountStatus(targetUser) !== 'active') {
                throw new Error('Target user must be an active account.');
            }

            const sourceTrips = await adminListUserTrips(user.user_id, { status: 'all' });
            if (sourceTrips.length === 0) {
                throw new Error('No owned trips found to transfer. Reload and try again.');
            }

            const confirmed = await confirmDialog(buildDangerConfirmDialog({
                title: 'Confirm transfer and hard delete',
                message: buildTransferAndHardDeleteMessage(
                    getUserReferenceText(user),
                    getUserReferenceText(targetUser),
                    sourceTrips.length
                ),
                confirmLabel: 'Transfer + hard delete',
            }));
            if (!confirmed) return;

            const transferResults = await Promise.allSettled(
                sourceTrips.map((trip) => adminUpdateTrip(trip.trip_id, { ownerId: targetUser.user_id }))
            );
            const failedTransfers = transferResults.filter((result) => result.status === 'rejected');
            if (failedTransfers.length > 0) {
                const transferredCount = sourceTrips.length - failedTransfers.length;
                throw new Error(
                    transferredCount > 0
                        ? `Transferred ${transferredCount}/${sourceTrips.length} trips. Hard delete was skipped because some transfers failed.`
                        : 'Trip transfer failed. Hard delete was skipped.'
                );
            }

            try {
                await adminHardDeleteUser(user.user_id);
                closeUserDetail();
                await loadUsers();
                notifySuccess(
                    'Trips transferred, user deleted',
                    `Moved ${sourceTrips.length} trip${plural(sourceTrips.length)} to ${getUserReferenceText(targetUser)} and permanently deleted the source user. The audit log shows ${sourceTrips.length} "Transferred trip owner" entr${plural(sourceTrips.length, 'y', 'ies')} and one "Hard-deleted user" entry.`
                );
            } catch (deleteError) {
                await loadUsers();
                const deleteMessage = toAdminUsersErrorMessage(deleteError, 'Could not hard-delete user after transfer.');
                setErrorMessage(
                    `Trips were transferred to ${getUserReferenceText(targetUser)}, but hard delete failed: ${deleteMessage} Retry hard delete for the source user if needed.`
                );
            }
        } catch (error) {
            setErrorMessage(toAdminUsersErrorMessage(error, 'Could not transfer trips before hard delete.'));
        } finally {
            setIsSaving(false);
        }
    };

    const patchTrip = async (trip: AdminTripRecord, patch: TripPatch) => {
        setIsSaving(true);
        setErrorMessage(null);
        try {
            await adminUpdateTrip(trip.trip_id, patch);
            notifySuccess('Trip updated', trip.title || trip.trip_id);
            if (selectedUser) {
                const rows = await adminListUserTrips(selectedUser.user_id);
                detail.setUserTrips(rows);
            }
        } catch (error) {
            setErrorMessage(toAdminUsersErrorMessage(error, 'Could not update trip.'));
        } finally {
            setIsSaving(false);
        }
    };

    /**
     * Invites or creates an account. Resolves to null on success (after
     * `onCreated` runs, before the list reloads) or to the error to show.
     */
    const createUser = async (
        mode: CreateUserMode,
        draft: CreateUserDraft,
        onCreated: () => void
    ): Promise<string | null> => {
        if (mode === 'direct' && draft.password.trim().length < 8) {
            return 'The initial password needs at least 8 characters.';
        }
        setIsSaving(true);
        try {
            if (mode === 'invite') {
                await adminCreateUserInvite({
                    email: draft.email,
                    firstName: draft.firstName,
                    lastName: draft.lastName,
                    tierKey: draft.tierKey,
                    redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/auth/reset-password` : undefined,
                });
            } else {
                await adminCreateUserDirect(draft);
            }
            onCreated();
            notifySuccess(mode === 'invite' ? 'Invite sent' : 'User created', draft.email.trim());
            await loadUsers();
            return null;
        } catch (error) {
            return toAdminUsersErrorMessage(
                error,
                mode === 'invite' ? 'Could not invite user.' : 'Could not create user.'
            );
        } finally {
            setIsSaving(false);
        }
    };

    return {
        isSaving,
        fullDiff,
        openFullDiff,
        closeFullDiff,
        exportUsersCsv,
        copyUserId,
        saveSelectedUser,
        resetUsernameCooldown,
        resetTermsAcceptance,
        toggleSoftDelete,
        hardDeleteUser,
        bulkSoftDelete,
        bulkHardDelete,
        transferTripsAndHardDelete,
        patchTrip,
        createUser,
    };
};

export type AdminUsersActionsApi = ReturnType<typeof useAdminUsersActions>;
