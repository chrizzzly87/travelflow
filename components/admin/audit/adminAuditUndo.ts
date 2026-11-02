import {
    adminGetTripVersionSnapshots,
    adminOverrideTripCommit,
    adminUpdatePlanEntitlements,
    adminUpdateTrip,
    adminUpdateUserOverrides,
    adminUpdateUserProfile,
} from '../../../services/adminService';
import {
    asRecord,
    asString,
    buildUndoOverrideMetadata,
    extractRevertibleProfilePatch,
    isPlanTierKey,
    type AuditTimelineEntry,
    type AuditTimelineIndex,
} from './adminAuditModel';
import { AuditUserFacingError } from './useAdminAuditData';

const undoUserChange = async (
    entry: Extract<AuditTimelineEntry, { kind: 'user' }>,
    index: AuditTimelineIndex,
): Promise<void> => {
    const action = entry.log.action.trim().toLowerCase();
    const targetId = entry.log.target_id;
    if (action === 'trip.created' || action === 'trip.archived') {
        if (!targetId) throw new AuditUserFacingError('Trip id missing for undo.');
        await adminUpdateTrip(targetId, { status: action === 'trip.created' ? 'archived' : 'active' });
        return;
    }
    if (action === 'trip.updated') {
        if (!targetId) throw new AuditUserFacingError('Trip id missing for undo.');
        const metadata = asRecord(entry.log.metadata);
        const versionId = asString(metadata.version_id);
        if (!versionId) throw new AuditUserFacingError('Version id missing for undo.');
        const versionSnapshots = await adminGetTripVersionSnapshots({
            tripId: targetId,
            afterVersionId: versionId,
            beforeVersionId: asString(metadata.previous_version_id),
        });
        if (!versionSnapshots) throw new AuditUserFacingError('Version snapshots unavailable for undo.');
        const beforeSnapshot = asRecord(versionSnapshots.before_snapshot);
        if (Object.keys(beforeSnapshot).length === 0) {
            throw new AuditUserFacingError('No previous snapshot found for undo.');
        }
        await adminOverrideTripCommit({
            tripId: targetId,
            data: beforeSnapshot,
            viewSettings: asRecord(versionSnapshots.before_view_settings),
            label: `Audit undo ${entry.log.id}`,
            metadata: buildUndoOverrideMetadata(entry, index),
        });
        return;
    }
    if (action === 'profile.updated') {
        if (!targetId) throw new AuditUserFacingError('User id missing for undo.');
        const patch = extractRevertibleProfilePatch(entry.log.before_data);
        if (!patch) throw new AuditUserFacingError('No revertible profile fields found for this row.');
        await adminUpdateUserProfile(targetId, patch);
        return;
    }
    throw new AuditUserFacingError('Undo is not supported for this action.');
};

const undoAdminChange = async (
    entry: Extract<AuditTimelineEntry, { kind: 'admin' }>,
    index: AuditTimelineIndex,
): Promise<void> => {
    const action = entry.log.action.trim().toLowerCase();
    const targetId = entry.log.target_id;
    if (!targetId) throw new AuditUserFacingError('Target id missing for undo.');
    const before = asRecord(entry.log.before_data);

    if (action === 'admin.trip.override_commit') {
        const tripData = asRecord(before.data as Record<string, unknown> | null | undefined);
        if (Object.keys(tripData).length === 0) {
            throw new AuditUserFacingError('No previous trip snapshot found for this undo.');
        }
        await adminOverrideTripCommit({
            tripId: targetId,
            data: tripData,
            viewSettings: asRecord(before.view_settings as Record<string, unknown> | null | undefined),
            label: `Audit undo ${entry.log.id}`,
            metadata: buildUndoOverrideMetadata(entry, index),
        });
        return;
    }
    if (action === 'admin.trip.update') {
        const patch: Parameters<typeof adminUpdateTrip>[1] = {};
        const hasOwn = (key: string) => Object.prototype.hasOwnProperty.call(before, key);
        if (hasOwn('status')) {
            const status = asString(before.status);
            if (status === 'active' || status === 'archived' || status === 'expired') patch.status = status;
        }
        if (hasOwn('trip_expires_at')) patch.tripExpiresAt = asString(before.trip_expires_at);
        if (hasOwn('owner_id')) patch.ownerId = asString(before.owner_id);
        if (Object.keys(patch).length === 0) {
            throw new AuditUserFacingError('No revertible trip fields found for this row.');
        }
        await adminUpdateTrip(targetId, patch);
        return;
    }
    if (action === 'admin.user.update_profile' || action === 'admin.user.update_tier') {
        const patch = extractRevertibleProfilePatch(entry.log.before_data);
        if (!patch) throw new AuditUserFacingError('No revertible user fields found for this row.');
        await adminUpdateUserProfile(targetId, patch);
        return;
    }
    if (action === 'admin.user.update_overrides') {
        await adminUpdateUserOverrides(
            targetId,
            asRecord(before.entitlements_override as Record<string, unknown> | null | undefined),
        );
        return;
    }
    if (action === 'admin.tier.update_entitlements') {
        const entitlements = asRecord(before.entitlements as Record<string, unknown> | null | undefined);
        if (Object.keys(entitlements).length === 0) {
            throw new AuditUserFacingError('No previous tier entitlements found for this row.');
        }
        if (!isPlanTierKey(targetId)) throw new AuditUserFacingError('Tier key missing or invalid for undo.');
        await adminUpdatePlanEntitlements(targetId, entitlements);
        return;
    }
    throw new AuditUserFacingError('Undo is not supported for this action.');
};

/** Writes the change that reverts `entry`; each revert is itself audited server-side. */
export const executeAuditUndo = (entry: AuditTimelineEntry, index: AuditTimelineIndex): Promise<void> => (
    entry.kind === 'user' ? undoUserChange(entry, index) : undoAdminChange(entry, index)
);
