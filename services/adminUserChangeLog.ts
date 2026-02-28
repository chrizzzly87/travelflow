import type { AdminUserChangeRecord } from './adminService';

export interface UserChangeDiffEntry {
    key: string;
    beforeValue: unknown;
    afterValue: unknown;
}

interface UserChangeActionPresentation {
    label: string;
    className: string;
}

const NOISY_DIFF_KEYS = new Set([
    'updated_at',
    'created_at',
    'onboarding_completed_at',
]);

const asRecord = (value: Record<string, unknown> | null | undefined): Record<string, unknown> => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return value;
};

const toComparableValue = (value: unknown): string => JSON.stringify(value ?? null);

const normalizeActionLabel = (action: string): string => {
    const cleaned = action.trim().replace(/[._]+/g, ' ');
    if (!cleaned) return 'User change';
    return cleaned
        .split(/\s+/)
        .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
        .join(' ');
};

const buildTripMetadataDiffEntries = (metadata: Record<string, unknown>): UserChangeDiffEntry[] => {
    const tripFieldPairs: Array<{
        key: string;
        beforeKey: string;
        afterKey: string;
    }> = [
        { key: 'status', beforeKey: 'status_before', afterKey: 'status_after' },
        { key: 'title', beforeKey: 'title_before', afterKey: 'title_after' },
        {
            key: 'show_on_public_profile',
            beforeKey: 'show_on_public_profile_before',
            afterKey: 'show_on_public_profile_after',
        },
        { key: 'trip_expires_at', beforeKey: 'trip_expires_at_before', afterKey: 'trip_expires_at_after' },
        { key: 'source_kind', beforeKey: 'source_kind_before', afterKey: 'source_kind_after' },
    ];

    return tripFieldPairs
        .map(({ key, beforeKey, afterKey }) => ({
            key,
            beforeValue: metadata[beforeKey] ?? null,
            afterValue: metadata[afterKey] ?? null,
        }))
        .filter((entry) => toComparableValue(entry.beforeValue) !== toComparableValue(entry.afterValue));
};

export const buildUserChangeDiffEntries = (record: AdminUserChangeRecord): UserChangeDiffEntry[] => {
    const before = asRecord(record.before_data);
    const after = asRecord(record.after_data);
    const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));

    if (keys.length > 0) {
        return keys
            .filter((key) => !NOISY_DIFF_KEYS.has(key))
            .filter((key) => toComparableValue(before[key]) !== toComparableValue(after[key]))
            .map((key) => ({
                key,
                beforeValue: before[key],
                afterValue: after[key],
            }))
            .sort((a, b) => a.key.localeCompare(b.key));
    }

    if (record.action === 'trip.archived') {
        const metadata = asRecord(record.metadata);
        const statusBefore = metadata.status_before;
        const statusAfter = metadata.status_after ?? 'archived';
        if (statusBefore !== undefined || statusAfter !== undefined) {
            return [{
                key: 'status',
                beforeValue: statusBefore ?? 'active',
                afterValue: statusAfter,
            }];
        }
    }

    if (record.action === 'trip.updated' || record.action === 'trip.created') {
        const metadata = asRecord(record.metadata);
        const entries = buildTripMetadataDiffEntries(metadata);
        if (entries.length > 0) {
            return entries;
        }
    }

    return [];
};

export const resolveUserChangeActionPresentation = (
    record: AdminUserChangeRecord,
    _diffEntries: UserChangeDiffEntry[]
): UserChangeActionPresentation => {
    const normalizedAction = record.action.trim().toLowerCase();

    if (normalizedAction === 'trip.archived' || normalizedAction === 'trip.archive') {
        return { label: 'Archived trip', className: 'border-amber-300 bg-amber-50 text-amber-800' };
    }

    if (normalizedAction === 'trip.created' || normalizedAction === 'trip.create') {
        return { label: 'Created trip', className: 'border-emerald-300 bg-emerald-50 text-emerald-800' };
    }

    if (normalizedAction === 'trip.updated' || normalizedAction === 'trip.update') {
        return { label: 'Updated trip', className: 'border-sky-300 bg-sky-50 text-sky-800' };
    }

    if (normalizedAction === 'trip.deleted' || normalizedAction === 'trip.delete') {
        return { label: 'Deleted trip', className: 'border-rose-300 bg-rose-50 text-rose-800' };
    }

    if (normalizedAction === 'trip.share_created' || normalizedAction === 'trip.share.create') {
        return { label: 'Shared trip', className: 'border-violet-300 bg-violet-50 text-violet-800' };
    }

    if (normalizedAction === 'profile.updated') {
        return { label: 'Updated profile', className: 'border-indigo-300 bg-indigo-50 text-indigo-800' };
    }

    return {
        label: normalizeActionLabel(record.action),
        className: 'border-slate-300 bg-slate-100 text-slate-800',
    };
};
