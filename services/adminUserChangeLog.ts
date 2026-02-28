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

export interface UserChangeSecondaryActionPresentation {
    key: string;
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

const VISUAL_LABEL_PREFIX = /^\s*visual\s*:\s*/i;

const VISUAL_FIELD_KEY_MAP: Record<string, string> = {
    'map view': 'map_view',
    'route view': 'route_view',
    'city names': 'city_names',
    'map layout': 'map_layout',
    'timeline layout': 'timeline_layout',
    zoom: 'zoom_level',
    'zoom level': 'zoom_level',
};

const normalizeVisualFieldKey = (value: string): string => {
    const normalized = value.trim().toLowerCase().replace(/\s+/g, ' ');
    if (!normalized) return 'change';
    if (VISUAL_FIELD_KEY_MAP[normalized]) return VISUAL_FIELD_KEY_MAP[normalized];
    return normalized
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        || 'change';
};

const normalizeVisualValue = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;
    const normalized = value.trim();
    if (!normalized || normalized === '—') return null;
    return normalized;
};

const resolveVisualChangesFromVersionLabel = (value: unknown): UserChangeDiffEntry[] => {
    if (typeof value !== 'string') return [];
    const normalizedLabel = value.trim();
    if (!normalizedLabel || !VISUAL_LABEL_PREFIX.test(normalizedLabel)) return [];

    const body = normalizedLabel.replace(VISUAL_LABEL_PREFIX, '').trim();
    if (!body) return [];

    return body
        .split('·')
        .map((segment) => segment.trim())
        .filter(Boolean)
        .map((segment) => {
            const directionalMatch = segment.match(/^([^:]+):\s*(.*?)\s*→\s*(.*)$/);
            if (directionalMatch) {
                const labelName = directionalMatch[1].trim() || 'visual';
                return {
                    key: `visual_${normalizeVisualFieldKey(labelName)}`,
                    beforeValue: normalizeVisualValue(directionalMatch[2]),
                    afterValue: normalizeVisualValue(directionalMatch[3]),
                } satisfies UserChangeDiffEntry;
            }

            const colonMatch = segment.match(/^([^:]+):\s*(.*)$/);
            if (colonMatch) {
                const labelName = colonMatch[1].trim() || 'visual';
                return {
                    key: `visual_${normalizeVisualFieldKey(labelName)}`,
                    beforeValue: null,
                    afterValue: normalizeVisualValue(colonMatch[2]) ?? segment,
                } satisfies UserChangeDiffEntry;
            }

            const lowerSegment = segment.toLowerCase();
            const field = lowerSegment === 'zoomed in' || lowerSegment === 'zoomed out'
                ? 'zoom_level'
                : normalizeVisualFieldKey(segment);
            return {
                key: `visual_${field}`,
                beforeValue: null,
                afterValue: segment,
            } satisfies UserChangeDiffEntry;
        });
};

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
    const timelineDiffV1 = asRecord(metadata.timeline_diff_v1 as Record<string, unknown> | null | undefined);
    const timelineDiffLegacy = asRecord(metadata.timeline_diff as Record<string, unknown> | null | undefined);
    const timelineDiff = Object.keys(timelineDiffV1).length > 0 ? timelineDiffV1 : timelineDiffLegacy;
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

    const visualChanges = normalizeTimelineDiffItems(timelineDiff.visual_changes);
    visualChanges.forEach((entry) => {
        const rawField = asText(entry.field) || asText(entry.label) || 'change';
        const normalizedField = normalizeVisualFieldKey(rawField);
        const beforeValue = hasOwn(entry, 'before_value')
            ? entry.before_value
            : (hasOwn(entry, 'before') ? entry.before : null);
        const afterValue = hasOwn(entry, 'after_value')
            ? entry.after_value
            : (hasOwn(entry, 'after') ? entry.after : null);
        if (toComparableValue(beforeValue) === toComparableValue(afterValue)) return;
        entries.push({
            key: `visual_${normalizedField}`,
            beforeValue,
            afterValue,
        });
    });

    return entries;
};

const TRIP_SETTINGS_KEYS = new Set([
    'status',
    'title',
    'show_on_public_profile',
    'trip_expires_at',
    'source_kind',
]);

const normalizeEntityLabel = (rawEntity: string): string => {
    const normalized = rawEntity.trim().toLowerCase();
    if (!normalized || normalized === 'item') return 'itinerary item';
    if (normalized === 'travel') return 'transport';
    return normalized.replace(/_/g, ' ');
};

const makeSecondaryAction = (
    key: string,
    label: string,
    operation: 'updated' | 'added' | 'deleted'
): UserChangeSecondaryActionPresentation => {
    const className = operation === 'added'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
        : operation === 'deleted'
            ? 'border-rose-200 bg-rose-50 text-rose-800'
            : 'border-sky-200 bg-sky-50 text-sky-800';

    return { key, label, className };
};

const SECONDARY_ACTION_CODE_PRESENTATION: Record<string, UserChangeSecondaryActionPresentation> = {
    'trip.activity.added': makeSecondaryAction('added_activity', 'Added activity', 'added'),
    'trip.activity.updated': makeSecondaryAction('updated_activity', 'Updated activity', 'updated'),
    'trip.activity.deleted': makeSecondaryAction('deleted_activity', 'Deleted activity', 'deleted'),
    'trip.transport.added': makeSecondaryAction('added_transport', 'Added transport', 'added'),
    'trip.transport.updated': makeSecondaryAction('transport_updated', 'Updated transport', 'updated'),
    'trip.transport.deleted': makeSecondaryAction('deleted_transport', 'Deleted transport', 'deleted'),
    'trip.city.added': makeSecondaryAction('added_city', 'Added city', 'added'),
    'trip.city.updated': makeSecondaryAction('updated_city', 'Updated city', 'updated'),
    'trip.city.deleted': makeSecondaryAction('deleted_city', 'Deleted city', 'deleted'),
    'trip.item.added': makeSecondaryAction('added_item', 'Added itinerary item', 'added'),
    'trip.item.updated': makeSecondaryAction('updated_item', 'Updated itinerary item', 'updated'),
    'trip.item.deleted': makeSecondaryAction('deleted_item', 'Deleted itinerary item', 'deleted'),
    'trip.view.updated': makeSecondaryAction('trip_view', 'Updated trip view', 'updated'),
};

const resolveSecondaryActionFromDiffKey = (diffKey: string): UserChangeSecondaryActionPresentation | null => {
    const normalized = diffKey.trim().toLowerCase();
    if (!normalized) return null;

    if (normalized.startsWith('visual_')) {
        return makeSecondaryAction('trip_view', 'Updated trip view', 'updated');
    }
    if (normalized.startsWith('transport_mode')) {
        return makeSecondaryAction('transport_updated', 'Updated transport', 'updated');
    }
    if (TRIP_SETTINGS_KEYS.has(normalized)) {
        return makeSecondaryAction('trip_settings_updated', 'Updated trip settings', 'updated');
    }

    const head = normalized.split('·')[0]?.trim() ?? normalized;
    const changedEntityMatch = head.match(/^(added|deleted|updated)_([a-z0-9_]+)$/);
    if (changedEntityMatch) {
        const operation = changedEntityMatch[1] as 'added' | 'deleted' | 'updated';
        const entity = changedEntityMatch[2];
        const normalizedEntity = normalizeEntityLabel(entity);

        if (operation === 'updated' && TRIP_SETTINGS_KEYS.has(entity)) {
            return makeSecondaryAction('trip_settings_updated', 'Updated trip settings', 'updated');
        }
        if (operation === 'updated' && entity.includes('transport')) {
            return makeSecondaryAction('transport_updated', 'Updated transport', 'updated');
        }
        if (operation === 'updated' && entity.includes('date')) {
            return makeSecondaryAction('trip_dates_updated', 'Updated trip dates', 'updated');
        }

        return makeSecondaryAction(
            `${operation}_${normalizedEntity.replace(/\s+/g, '_')}`,
            `${operation.charAt(0).toUpperCase()}${operation.slice(1)} ${normalizedEntity}`,
            operation
        );
    }

    return null;
};

export const resolveUserChangeSecondaryActions = (
    record: AdminUserChangeRecord,
    diffEntries: UserChangeDiffEntry[]
): UserChangeSecondaryActionPresentation[] => {
    const normalizedAction = record.action.trim().toLowerCase();
    if (normalizedAction !== 'trip.updated' && normalizedAction !== 'trip.update') return [];

    const byKey = new Map<string, UserChangeSecondaryActionPresentation>();
    const metadata = asRecord(record.metadata);
    const secondaryActionCodes = Array.isArray(metadata.secondary_actions)
        ? metadata.secondary_actions
            .filter((value): value is string => typeof value === 'string')
            .map((value) => value.trim().toLowerCase())
            .filter(Boolean)
        : [];

    secondaryActionCodes.forEach((actionCode) => {
        const presentation = SECONDARY_ACTION_CODE_PRESENTATION[actionCode];
        if (!presentation || byKey.has(presentation.key)) return;
        byKey.set(presentation.key, presentation);
    });
    if (byKey.size > 0) {
        return Array.from(byKey.values()).slice(0, 4);
    }
    if (diffEntries.length === 0) return [];

    diffEntries.forEach((entry) => {
        const secondaryAction = resolveSecondaryActionFromDiffKey(entry.key);
        if (!secondaryAction || byKey.has(secondaryAction.key)) return;
        byKey.set(secondaryAction.key, secondaryAction);
    });

    return Array.from(byKey.values()).slice(0, 4);
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
            const visualFallbackEntries = timelineEntries.length > 0
                ? []
                : resolveVisualChangesFromVersionLabel(metadata.version_label);
            const combined = [...timelineEntries, ...visualFallbackEntries, ...lifecycleEntries];
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
