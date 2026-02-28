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

const hasOwn = (value: Record<string, unknown>, key: string): boolean => (
    Object.prototype.hasOwnProperty.call(value, key)
);

const toComparableValue = (value: unknown): string => JSON.stringify(value ?? null);

const normalizeActionLabel = (action: string): string => {
    const cleaned = action.trim().replace(/[._]+/g, ' ');
    if (!cleaned) return 'User change';
    return cleaned
        .split(/\s+/)
        .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
        .join(' ');
};

const buildTripMetadataDiffEntries = (
    metadata: Record<string, unknown>,
    options?: { requireBefore?: boolean }
): UserChangeDiffEntry[] => {
    const requireBefore = options?.requireBefore === true;
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
        .map(({ key, beforeKey, afterKey }) => {
            const hasBefore = hasOwn(metadata, beforeKey);
            const hasAfter = hasOwn(metadata, afterKey);
            if (!hasAfter) return null;
            if (requireBefore && !hasBefore) return null;
            return {
                key,
                beforeValue: hasBefore ? metadata[beforeKey] : null,
                afterValue: metadata[afterKey],
            };
        })
        .filter((entry): entry is UserChangeDiffEntry => Boolean(entry))
        .filter((entry) => toComparableValue(entry.beforeValue) !== toComparableValue(entry.afterValue));
};

const normalizeTimelineDiffItems = (
    value: unknown
): Array<Record<string, unknown>> => (
    Array.isArray(value)
        ? value
            .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object' && !Array.isArray(entry))
        : []
);

const asText = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed || null;
};

const resolveTimelineItemLabel = (entry: Record<string, unknown>): string => {
    const title = asText(entry.title)
        || asText((entry.before as Record<string, unknown> | null | undefined)?.title)
        || asText((entry.after as Record<string, unknown> | null | undefined)?.title);
    if (title) return title;
    return asText(entry.item_id) || 'Unknown item';
};

const resolveTimelineItemType = (entry: Record<string, unknown>): string | null => {
    const beforeType = asText((entry.before as Record<string, unknown> | null | undefined)?.type);
    if (beforeType) return beforeType;
    return asText((entry.after as Record<string, unknown> | null | undefined)?.type);
};

const buildTripTimelineDiffEntries = (metadata: Record<string, unknown>): UserChangeDiffEntry[] => {
    const timelineDiff = asRecord(metadata.timeline_diff as Record<string, unknown> | null | undefined);
    if (Object.keys(timelineDiff).length === 0) return [];

    const entries: UserChangeDiffEntry[] = [];
    const transportModeChanges = normalizeTimelineDiffItems(timelineDiff.transport_mode_changes);
    transportModeChanges.forEach((entry) => {
        const label = resolveTimelineItemLabel(entry);
        entries.push({
            key: `transport_mode · ${label}`,
            beforeValue: entry.before_mode ?? null,
            afterValue: entry.after_mode ?? null,
        });
    });

    const deletedItems = normalizeTimelineDiffItems(timelineDiff.deleted_items);
    deletedItems.forEach((entry) => {
        const label = resolveTimelineItemLabel(entry);
        const itemType = resolveTimelineItemType(entry);
        const prefix = itemType ? `deleted_${itemType}` : 'deleted_item';
        entries.push({
            key: `${prefix} · ${label}`,
            beforeValue: entry.before ?? entry,
            afterValue: null,
        });
    });

    const addedItems = normalizeTimelineDiffItems(timelineDiff.added_items);
    addedItems.forEach((entry) => {
        const label = resolveTimelineItemLabel(entry);
        const itemType = resolveTimelineItemType(entry);
        const prefix = itemType ? `added_${itemType}` : 'added_item';
        entries.push({
            key: `${prefix} · ${label}`,
            beforeValue: null,
            afterValue: entry.after ?? entry,
        });
    });

    const updatedItems = normalizeTimelineDiffItems(timelineDiff.updated_items);
    updatedItems.forEach((entry) => {
        const label = resolveTimelineItemLabel(entry);
        const before = asRecord(entry.before as Record<string, unknown> | null | undefined);
        const after = asRecord(entry.after as Record<string, unknown> | null | undefined);
        const changedFieldsRaw = Array.isArray(entry.changed_fields)
            ? entry.changed_fields.filter((field): field is string => typeof field === 'string' && field.trim().length > 0)
            : [];

        const candidateFields = changedFieldsRaw.length > 0
            ? changedFieldsRaw
            : Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));

        candidateFields.forEach((field) => {
            const normalizedField = field.trim();
            if (!normalizedField) return;
            const beforeValue = before[normalizedField];
            const afterValue = after[normalizedField];
            if (toComparableValue(beforeValue) === toComparableValue(afterValue)) return;
            entries.push({
                key: `updated_${normalizedField} · ${label}`,
                beforeValue,
                afterValue,
            });
        });
    });

    return entries;
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
        if (record.action === 'trip.updated') {
            const timelineEntries = buildTripTimelineDiffEntries(metadata);
            const lifecycleEntries = buildTripMetadataDiffEntries(metadata, { requireBefore: true });
            const combined = [...timelineEntries, ...lifecycleEntries];
            if (combined.length > 0) {
                return combined;
            }
            return [];
        }

        const entries = buildTripMetadataDiffEntries(metadata, { requireBefore: false });
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

    if (normalizedAction === 'trip.archive_failed') {
        return { label: 'Archive failed', className: 'border-rose-300 bg-rose-50 text-rose-800' };
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
