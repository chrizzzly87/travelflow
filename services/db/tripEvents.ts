import type { ITrip, ITimelineItem } from '../../types';
import { requireSupabase } from './internal';

interface TripEventSnapshot {
    title: string;
    status: 'active' | 'archived' | 'expired';
    showOnPublicProfile: boolean;
    tripExpiresAt: string | null;
    sourceKind: string | null;
}

type TripVersionSnapshot = {
    versionId: string | null;
    label: string | null;
    trip: ITrip | null;
};

const MAX_TIMELINE_DIFF_ITEMS = 8;
const VISUAL_LABEL_PREFIX = /^\s*visual\s*:\s*/i;

interface TripTimelineDiffSummary {
    counts: {
        deleted_items: number;
        added_items: number;
        transport_mode_changes: number;
        updated_items: number;
    };
    deleted_items: Array<Record<string, unknown>>;
    added_items: Array<Record<string, unknown>>;
    transport_mode_changes: Array<Record<string, unknown>>;
    updated_items: Array<Record<string, unknown>>;
    truncated: boolean;
}

interface TripTimelineVisualChange {
    field: string;
    label: string;
    before_value: string | null;
    after_value: string | null;
    summary: string;
}

type TripSecondaryActionCode =
    | 'trip.city.updated'
    | 'trip.activity.updated'
    | 'trip.activity.deleted'
    | 'trip.transport.updated'
    | 'trip.segment.deleted'
    | 'trip.trip_dates.updated'
    | 'trip.visibility.updated';

const asTimelineDiffItems = (value: unknown): Array<Record<string, unknown>> => (
    Array.isArray(value)
        ? value.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object' && !Array.isArray(entry))
        : []
);

const readTimelineEntryItemType = (entry: Record<string, unknown>): string | null => {
    const direct = typeof entry.item_type === 'string' ? entry.item_type.trim().toLowerCase() : '';
    if (direct) return direct;
    for (const snapshot of [entry.before, entry.after]) {
        if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) continue;
        const snapshotType = (snapshot as Record<string, unknown>).type;
        const normalizedType = typeof snapshotType === 'string' ? snapshotType.trim().toLowerCase() : '';
        if (normalizedType) return normalizedType;
    }
    return null;
};

const hasTimelineDateFieldChange = (entry: Record<string, unknown>): boolean => {
    const changedFields = Array.isArray(entry.changed_fields)
        ? entry.changed_fields.filter((field): field is string => typeof field === 'string')
        : [];
    return changedFields.some((field) => (
        field === 'start_date_offset'
        || field === 'duration'
    ));
};

export const buildTripSecondaryActionCodes = (
    timelineDiffV1: Record<string, unknown> | null,
    options?: {
        previousTrip?: ITrip | null;
        nextTrip?: ITrip | null;
        visibilityChanged?: boolean;
    }
): TripSecondaryActionCode[] => {
    const codes = new Set<TripSecondaryActionCode>();

    if (timelineDiffV1) {
        const transportModeChanges = asTimelineDiffItems(timelineDiffV1.transport_mode_changes);
        if (transportModeChanges.length > 0) {
            codes.add('trip.transport.updated');
        }

        const deletedItems = asTimelineDiffItems(timelineDiffV1.deleted_items);
        deletedItems.forEach((entry) => {
            const itemType = readTimelineEntryItemType(entry);
            if (itemType === 'activity') {
                codes.add('trip.activity.deleted');
            }
            if (itemType === 'travel-empty' || itemType === 'travel') {
                codes.add('trip.segment.deleted');
            }
        });

        const updatedItems = asTimelineDiffItems(timelineDiffV1.updated_items);
        updatedItems.forEach((entry) => {
            const itemType = readTimelineEntryItemType(entry);
            if (itemType === 'activity') {
                codes.add('trip.activity.updated');
            }
            if (itemType === 'city') {
                codes.add('trip.city.updated');
            }
            if (itemType === 'travel' && hasTimelineDateFieldChange(entry)) {
                codes.add('trip.trip_dates.updated');
            }
            if (itemType === 'city' && hasTimelineDateFieldChange(entry)) {
                codes.add('trip.trip_dates.updated');
            }
        });
    }

    if (options?.previousTrip && options.nextTrip && options.previousTrip.startDate !== options.nextTrip.startDate) {
        codes.add('trip.trip_dates.updated');
    }

    if (options?.visibilityChanged) {
        codes.add('trip.visibility.updated');
    }

    return Array.from(codes).sort();
};

export const createEventCorrelationId = (): string => {
    try {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return crypto.randomUUID();
        }
    } catch {
        // fallback below
    }
    return `corr-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

export const createEventId = (): string => {
    try {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return crypto.randomUUID();
        }
    } catch {
        // fallback below
    }
    return `evt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

export const normalizeCorrelationId = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    return trimmed.slice(0, 160);
};

export const createDeterministicCorrelationId = (prefix: string, parts: Array<string | number | null | undefined>): string => {
    const normalizedParts = parts
        .map((part) => {
            if (part === null || part === undefined) return '';
            return String(part)
                .trim()
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-+|-+$/g, '');
        })
        .filter(Boolean);
    if (normalizedParts.length === 0) return createEventCorrelationId();
    return `${prefix}-${normalizedParts.join('-')}`.slice(0, 180);
};

export const toTripEventSnapshotFromTrip = (trip: ITrip): TripEventSnapshot => ({
    title: (trip.title || 'Untitled trip').trim() || 'Untitled trip',
    status: trip.status && ['active', 'archived', 'expired'].includes(trip.status)
        ? trip.status
        : 'active',
    showOnPublicProfile: trip.showOnPublicProfile !== false,
    tripExpiresAt: typeof trip.tripExpiresAt === 'string' ? trip.tripExpiresAt : null,
    sourceKind: typeof trip.sourceKind === 'string' && trip.sourceKind.trim()
        ? trip.sourceKind.trim()
        : null,
});

export const toTripEventSource = (value: string | null | undefined): string => {
    const normalized = typeof value === 'string' ? value.trim() : '';
    if (!normalized) return 'trip.editor';
    return normalized.slice(0, 120);
};

export const readOwnedTripEventSnapshot = async (
    client: ReturnType<typeof requireSupabase>,
    ownerId: string,
    tripId: string
): Promise<TripEventSnapshot | null> => {
    const { data, error } = await client
        .from('trips')
        .select('title, status, show_on_public_profile, trip_expires_at, source_kind')
        .eq('id', tripId)
        .eq('owner_id', ownerId)
        .maybeSingle();
    if (error) return null;
    if (!data) return null;
    const status = typeof data.status === 'string' && ['active', 'archived', 'expired'].includes(data.status)
        ? data.status as TripEventSnapshot['status']
        : 'active';
    return {
        title: typeof data.title === 'string' && data.title.trim() ? data.title.trim() : 'Untitled trip',
        status,
        showOnPublicProfile: data.show_on_public_profile !== false,
        tripExpiresAt: typeof data.trip_expires_at === 'string' ? data.trip_expires_at : null,
        sourceKind: typeof data.source_kind === 'string' && data.source_kind.trim() ? data.source_kind.trim() : null,
    };
};

const toTimelineDiffItemSnapshot = (item: ITimelineItem): Record<string, unknown> => ({
    id: item.id,
    type: item.type,
    title: item.title,
    start_date_offset: item.startDateOffset,
    duration: item.duration,
    location: item.location ?? null,
    description: item.description ?? null,
    transport_mode: item.transportMode ?? null,
    activity_type: Array.isArray(item.activityType) ? item.activityType : [],
});

const arraysEqual = (left: string[], right: string[]): boolean => (
    left.length === right.length && left.every((value, index) => value === right[index])
);

export const buildTripTimelineDiffSummary = (
    previousTrip: ITrip | null,
    nextTrip: ITrip
): TripTimelineDiffSummary | null => {
    if (!previousTrip) return null;
    const previousItems = Array.isArray(previousTrip.items) ? previousTrip.items : [];
    const nextItems = Array.isArray(nextTrip.items) ? nextTrip.items : [];
    const previousById = new Map(previousItems.map((item) => [item.id, item]));
    const nextById = new Map(nextItems.map((item) => [item.id, item]));

    const deletedItems: Array<Record<string, unknown>> = [];
    const addedItems: Array<Record<string, unknown>> = [];
    const transportModeChanges: Array<Record<string, unknown>> = [];
    const updatedItems: Array<Record<string, unknown>> = [];

    previousItems.forEach((beforeItem) => {
        const afterItem = nextById.get(beforeItem.id);
        if (!afterItem) {
            deletedItems.push({
                item_id: beforeItem.id,
                item_type: beforeItem.type,
                before: toTimelineDiffItemSnapshot(beforeItem),
                after: null,
            });
            return;
        }

        const beforeActivities = Array.isArray(beforeItem.activityType) ? beforeItem.activityType : [];
        const afterActivities = Array.isArray(afterItem.activityType) ? afterItem.activityType : [];
        const changedFields: string[] = [];

        if (beforeItem.title !== afterItem.title) changedFields.push('title');
        if (beforeItem.startDateOffset !== afterItem.startDateOffset) changedFields.push('start_date_offset');
        if (beforeItem.duration !== afterItem.duration) changedFields.push('duration');
        if ((beforeItem.location ?? null) !== (afterItem.location ?? null)) changedFields.push('location');
        if ((beforeItem.description ?? null) !== (afterItem.description ?? null)) changedFields.push('description');
        if (!arraysEqual(beforeActivities, afterActivities)) changedFields.push('activity_type');

        const transportChanged = (beforeItem.transportMode ?? null) !== (afterItem.transportMode ?? null);
        if (transportChanged) {
            transportModeChanges.push({
                item_id: afterItem.id,
                item_type: afterItem.type,
                title: afterItem.title || beforeItem.title || 'Untitled segment',
                before_mode: beforeItem.transportMode ?? null,
                after_mode: afterItem.transportMode ?? null,
            });
            changedFields.push('transport_mode');
        }

        if (changedFields.length > 0) {
            updatedItems.push({
                item_id: afterItem.id,
                item_type: afterItem.type,
                changed_fields: changedFields,
                before: toTimelineDiffItemSnapshot(beforeItem),
                after: toTimelineDiffItemSnapshot(afterItem),
            });
        }
    });

    nextItems.forEach((afterItem) => {
        if (previousById.has(afterItem.id)) return;
        addedItems.push({
            item_id: afterItem.id,
            item_type: afterItem.type,
            before: null,
            after: toTimelineDiffItemSnapshot(afterItem),
        });
    });

    if (
        deletedItems.length === 0
        && addedItems.length === 0
        && transportModeChanges.length === 0
        && updatedItems.length === 0
    ) {
        return null;
    }

    return {
        counts: {
            deleted_items: deletedItems.length,
            added_items: addedItems.length,
            transport_mode_changes: transportModeChanges.length,
            updated_items: updatedItems.length,
        },
        deleted_items: deletedItems.slice(0, MAX_TIMELINE_DIFF_ITEMS),
        added_items: addedItems.slice(0, MAX_TIMELINE_DIFF_ITEMS),
        transport_mode_changes: transportModeChanges.slice(0, MAX_TIMELINE_DIFF_ITEMS),
        updated_items: updatedItems.slice(0, MAX_TIMELINE_DIFF_ITEMS),
        truncated: (
            deletedItems.length > MAX_TIMELINE_DIFF_ITEMS
            || addedItems.length > MAX_TIMELINE_DIFF_ITEMS
            || transportModeChanges.length > MAX_TIMELINE_DIFF_ITEMS
            || updatedItems.length > MAX_TIMELINE_DIFF_ITEMS
        ),
    };
};

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

const normalizeVisualValue = (value: string): string | null => {
    const normalized = value.trim();
    if (!normalized || normalized === '—') return null;
    return normalized;
};

export const parseVisualChangesFromLabel = (label: string | null | undefined): TripTimelineVisualChange[] => {
    const normalizedLabel = typeof label === 'string' ? label.trim() : '';
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
                const labelName = directionalMatch[1].trim() || 'Visual change';
                const beforeValue = normalizeVisualValue(directionalMatch[2] ?? '');
                const afterValue = normalizeVisualValue(directionalMatch[3] ?? '');
                return {
                    field: normalizeVisualFieldKey(labelName),
                    label: labelName,
                    before_value: beforeValue,
                    after_value: afterValue,
                    summary: segment,
                };
            }

            const colonMatch = segment.match(/^([^:]+):\s*(.*)$/);
            if (colonMatch) {
                const labelName = colonMatch[1].trim() || 'Visual change';
                const afterValue = normalizeVisualValue(colonMatch[2] ?? '');
                return {
                    field: normalizeVisualFieldKey(labelName),
                    label: labelName,
                    before_value: null,
                    after_value: afterValue ?? segment,
                    summary: segment,
                };
            }

            const lowerSegment = segment.toLowerCase();
            const isZoom = lowerSegment === 'zoomed in' || lowerSegment === 'zoomed out';
            return {
                field: isZoom ? 'zoom_level' : normalizeVisualFieldKey(segment),
                label: isZoom ? 'Zoom level' : 'Visual change',
                before_value: null,
                after_value: segment,
                summary: segment,
            };
        });
};

export const buildTripTimelineDiffV1 = (
    timelineDiff: TripTimelineDiffSummary | null,
    visualChanges: TripTimelineVisualChange[]
): Record<string, unknown> | null => {
    if (!timelineDiff && visualChanges.length === 0) return null;

    return {
        schema: 'timeline_diff_v1',
        version: 1,
        counts: {
            deleted_items: timelineDiff?.counts.deleted_items ?? 0,
            added_items: timelineDiff?.counts.added_items ?? 0,
            transport_mode_changes: timelineDiff?.counts.transport_mode_changes ?? 0,
            updated_items: timelineDiff?.counts.updated_items ?? 0,
            visual_changes: visualChanges.length,
        },
        deleted_items: timelineDiff?.deleted_items ?? [],
        added_items: timelineDiff?.added_items ?? [],
        transport_mode_changes: timelineDiff?.transport_mode_changes ?? [],
        updated_items: timelineDiff?.updated_items ?? [],
        visual_changes: visualChanges,
        truncated: timelineDiff?.truncated ?? false,
    };
};

export const readLatestTripVersionSnapshot = async (
    client: ReturnType<typeof requireSupabase>,
    tripId: string
): Promise<TripVersionSnapshot | null> => {
    const { data, error } = await client
        .from('trip_versions')
        .select('id, data, label')
        .eq('trip_id', tripId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error || !data) return null;
    const rawTrip = data.data as ITrip | null;
    const trip = rawTrip && rawTrip.id !== tripId ? { ...rawTrip, id: tripId } : rawTrip;
    return {
        versionId: typeof data.id === 'string' ? data.id : null,
        label: typeof data.label === 'string' ? data.label : null,
        trip,
    };
};

const hasRecentTripEvent = async (
    client: ReturnType<typeof requireSupabase>,
    tripId: string,
    action: string,
    withinMs = 15000
): Promise<boolean> => {
    const cutoffIso = new Date(Date.now() - withinMs).toISOString();
    const { data, error } = await client
        .from('trip_user_events')
        .select('id')
        .eq('trip_id', tripId)
        .eq('action', action)
        .gte('created_at', cutoffIso)
        .order('created_at', { ascending: false })
        .limit(1);
    if (error) return false;
    return Array.isArray(data) && data.length > 0;
};

export const writeTripEventFallback = async (
    client: ReturnType<typeof requireSupabase>,
    payload: {
        ownerId: string;
        tripId: string;
        action: 'trip.created' | 'trip.updated' | 'trip.archived' | 'trip.share_created';
        source: string;
        metadata: Record<string, unknown>;
        correlationId?: string;
        dedupeWindowMs?: number;
    }
): Promise<void> => {
    try {
        const dedupeWindowMs = typeof payload.dedupeWindowMs === 'number'
            ? payload.dedupeWindowMs
            : 15000;
        if (dedupeWindowMs > 0) {
            const alreadyLogged = await hasRecentTripEvent(client, payload.tripId, payload.action, dedupeWindowMs);
            if (alreadyLogged) return;
        }

        const existingCorrelationId = typeof payload.metadata.correlation_id === 'string'
            ? payload.metadata.correlation_id.trim()
            : '';
        const correlationId = existingCorrelationId || payload.correlationId || createEventCorrelationId();
        const existingEventId = typeof payload.metadata.event_id === 'string'
            ? payload.metadata.event_id.trim()
            : '';
        const existingEventKind = typeof payload.metadata.event_kind === 'string'
            ? payload.metadata.event_kind.trim()
            : '';
        const existingCausationId = typeof payload.metadata.causation_id === 'string'
            ? payload.metadata.causation_id.trim()
            : '';
        const existingSourceSurface = typeof payload.metadata.source_surface === 'string'
            ? payload.metadata.source_surface.trim()
            : '';
        const existingSchemaVersion = typeof payload.metadata.event_schema_version === 'number'
            ? payload.metadata.event_schema_version
            : 1;
        const metadataWithCorrelation: Record<string, unknown> = {
            ...payload.metadata,
            event_schema_version: Number.isFinite(existingSchemaVersion) ? Math.max(1, Math.trunc(existingSchemaVersion)) : 1,
            event_id: existingEventId || createEventId(),
            event_kind: existingEventKind || payload.action,
            correlation_id: correlationId,
            causation_id: existingCausationId || correlationId,
            source_surface: existingSourceSurface || payload.source,
            actor_user_id: payload.ownerId,
            actor_type: 'user',
            target_type: 'trip',
            target_id: payload.tripId,
            redaction_policy: 'none',
        };

        await client.from('trip_user_events').insert({
            trip_id: payload.tripId,
            owner_id: payload.ownerId,
            action: payload.action,
            source: payload.source,
            metadata: metadataWithCorrelation,
        });
    } catch {
        // best effort fallback logging only
    }
};

export const writeTripLifecycleEventFallback = async (
    client: ReturnType<typeof requireSupabase>,
    payload: {
        ownerId: string;
        tripId: string;
        source: string;
        before: TripEventSnapshot | null;
        after: TripEventSnapshot;
        correlationId?: string;
    }
): Promise<void> => {
    const { before, after } = payload;
    if (!before) {
        await writeTripEventFallback(client, {
            ownerId: payload.ownerId,
            tripId: payload.tripId,
            action: 'trip.created',
            source: payload.source,
            correlationId: payload.correlationId,
            metadata: {
                trip_id: payload.tripId,
                status_after: after.status,
                title_after: after.title,
                show_on_public_profile_after: after.showOnPublicProfile,
                trip_expires_at_after: after.tripExpiresAt,
                source_kind_after: after.sourceKind,
            },
        });
        return;
    }

    const hasDiff = (
        before.status !== after.status
        || before.title !== after.title
        || before.showOnPublicProfile !== after.showOnPublicProfile
        || before.tripExpiresAt !== after.tripExpiresAt
        || before.sourceKind !== after.sourceKind
    );
    if (!hasDiff) return;

    const secondaryActionCodes = buildTripSecondaryActionCodes(null, {
        visibilityChanged: before.showOnPublicProfile !== after.showOnPublicProfile,
    });

    await writeTripEventFallback(client, {
        ownerId: payload.ownerId,
        tripId: payload.tripId,
        action: 'trip.updated',
        source: payload.source,
        correlationId: payload.correlationId,
        metadata: {
            trip_id: payload.tripId,
            status_before: before.status,
            status_after: after.status,
            title_before: before.title,
            title_after: after.title,
            show_on_public_profile_before: before.showOnPublicProfile,
            show_on_public_profile_after: after.showOnPublicProfile,
            trip_expires_at_before: before.tripExpiresAt,
            trip_expires_at_after: after.tripExpiresAt,
            source_kind_before: before.sourceKind,
            source_kind_after: after.sourceKind,
            secondary_action_codes: secondaryActionCodes,
        },
    });
};
