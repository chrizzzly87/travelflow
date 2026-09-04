import { z } from 'zod';

import { TRANSPORT_MODE_VALUES } from './transportModes.ts';
import { tripChangeOperationV1Schema, type TripChangeOperationV1 } from './tripAgent.ts';

/**
 * Model-facing shape for trip changes.
 *
 * The internal operation type is a discriminated union of ten strict variants.
 * Function-calling models — Gemini in particular — handle unions poorly and
 * kept producing calls the SDK rejected before the tool ever ran. The wire
 * shape is therefore one flat object with an enum `kind` plus optional fields,
 * which every provider can emit, and it is converted here into the typed
 * operation with the same guarantees.
 */
export const TRIP_AGENT_WIRE_KINDS = [
    'update_trip',
    'add_item',
    'update_item',
    'move_item',
    'remove_item',
    'add_stay',
    'update_stay',
    'remove_stay',
    'replace_itinerary',
    'replace_itinerary_segment',
] as const;

const DEFAULT_ITEM_COLORS: Record<string, string> = {
    city: '#2563eb',
    activity: '#7c3aed',
    travel: '#0f766e',
};

const wireCoordinatesSchema = z.object({
    lat: z.number().finite().min(-90).max(90),
    lng: z.number().finite().min(-180).max(180),
}).strict();

const wireItemSchema = z.object({
    id: z.string().trim().min(1).max(160).optional(),
    type: z.enum(['city', 'activity', 'travel']),
    title: z.string().trim().min(1).max(240),
    startDateOffset: z.number().finite().min(0).max(36_500),
    duration: z.number().finite().positive().max(36_500),
    color: z.string().trim().min(1).max(80).optional(),
    description: z.string().trim().max(8_000).optional(),
    location: z.string().trim().max(500).optional(),
    cost: z.string().trim().max(240).optional(),
    countryCode: z.string().trim().max(8).optional(),
    countryName: z.string().trim().max(120).optional(),
    coordinates: wireCoordinatesSchema.optional(),
    transportMode: z.enum(TRANSPORT_MODE_VALUES).optional(),
    departureTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
}).strict();

const wireStaySchema = z.object({
    id: z.string().trim().min(1).max(160).optional(),
    name: z.string().trim().min(1).max(240),
    address: z.string().trim().max(500).optional(),
    notes: z.string().trim().max(2_000).optional(),
    coordinates: wireCoordinatesSchema.optional(),
}).strict();

const wireItemChangesSchema = z.object({
    title: z.string().trim().min(1).max(240).optional(),
    description: z.string().trim().max(8_000).optional(),
    location: z.string().trim().max(500).optional(),
    cost: z.string().trim().max(240).optional(),
    duration: z.number().finite().positive().max(36_500).optional(),
    startDateOffset: z.number().finite().min(0).max(36_500).optional(),
    transportMode: z.enum(TRANSPORT_MODE_VALUES).optional(),
    departureTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
    coordinates: wireCoordinatesSchema.optional(),
}).strict();

const wireTripChangesSchema = z.object({
    title: z.string().trim().min(1).max(240).optional(),
    startDate: z.string().date().optional(),
    roundTrip: z.boolean().optional(),
}).strict();

const wireStayChangesSchema = z.object({
    name: z.string().trim().min(1).max(240).optional(),
    address: z.string().trim().max(500).optional(),
    notes: z.string().trim().max(2_000).optional(),
    coordinates: wireCoordinatesSchema.optional(),
}).strict();

export const tripAgentWireOperationSchema = z.object({
    id: z.string().trim().min(1).max(120),
    kind: z.enum(TRIP_AGENT_WIRE_KINDS),
    rationale: z.string().trim().min(1).max(1_000),
    targetLabel: z.string().trim().min(1).max(240),
    itemId: z.string().trim().min(1).max(160).optional(),
    cityId: z.string().trim().min(1).max(160).optional(),
    stayId: z.string().trim().min(1).max(160).optional(),
    startDateOffset: z.number().finite().min(0).max(36_500).optional(),
    duration: z.number().finite().positive().max(36_500).optional(),
    startOffset: z.number().finite().min(0).max(36_500).optional(),
    endOffset: z.number().finite().positive().max(36_500).optional(),
    item: wireItemSchema.optional(),
    items: z.array(wireItemSchema).max(500).optional(),
    stay: wireStaySchema.optional(),
    itemChanges: wireItemChangesSchema.optional(),
    tripChanges: wireTripChangesSchema.optional(),
    stayChanges: wireStayChangesSchema.optional(),
}).strict();

export type TripAgentWireOperation = z.infer<typeof tripAgentWireOperationSchema>;

export interface TripAgentWireIssue {
    operationId: string;
    path: string;
    message: string;
}

const generateId = (prefix: string): string => (
    `${prefix}-${(globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)).slice(0, 8)}`
);

const normalizeItem = (item: z.infer<typeof wireItemSchema>) => ({
    ...item,
    id: item.id || generateId(item.type),
    color: item.color || DEFAULT_ITEM_COLORS[item.type] || '#2563eb',
});

const normalizeStay = (stay: z.infer<typeof wireStaySchema>) => ({
    ...stay,
    id: stay.id || generateId('stay'),
    address: stay.address || '',
});

const missing = (operation: TripAgentWireOperation, field: string): TripAgentWireIssue => ({
    operationId: operation.id,
    path: field,
    message: `"${field}" is required for kind "${operation.kind}".`,
});

/**
 * Converts one wire operation into the typed operation, or reports exactly what
 * the model has to add for this kind.
 */
export const toTypedTripChangeOperation = (
    operation: TripAgentWireOperation,
): { status: 'ok'; operation: TripChangeOperationV1 } | { status: 'invalid'; issues: TripAgentWireIssue[] } => {
    const base = { id: operation.id, rationale: operation.rationale, targetLabel: operation.targetLabel };
    const issues: TripAgentWireIssue[] = [];
    let candidate: unknown = null;

    switch (operation.kind) {
        case 'update_trip': {
            if (!operation.tripChanges) issues.push(missing(operation, 'tripChanges'));
            else candidate = { ...base, kind: 'update_trip', changes: operation.tripChanges };
            break;
        }
        case 'add_item': {
            if (!operation.item) issues.push(missing(operation, 'item'));
            else candidate = { ...base, kind: 'add_item', item: normalizeItem(operation.item) };
            break;
        }
        case 'update_item': {
            if (!operation.itemId) issues.push(missing(operation, 'itemId'));
            if (!operation.itemChanges) issues.push(missing(operation, 'itemChanges'));
            if (issues.length === 0) {
                candidate = { ...base, kind: 'update_item', itemId: operation.itemId, changes: operation.itemChanges };
            }
            break;
        }
        case 'move_item': {
            if (!operation.itemId) issues.push(missing(operation, 'itemId'));
            if (operation.startDateOffset === undefined) issues.push(missing(operation, 'startDateOffset'));
            if (issues.length === 0) {
                candidate = {
                    ...base,
                    kind: 'move_item',
                    itemId: operation.itemId,
                    startDateOffset: operation.startDateOffset,
                    ...(operation.duration === undefined ? {} : { duration: operation.duration }),
                };
            }
            break;
        }
        case 'remove_item': {
            if (!operation.itemId) issues.push(missing(operation, 'itemId'));
            else candidate = { ...base, kind: 'remove_item', itemId: operation.itemId };
            break;
        }
        case 'add_stay': {
            if (!operation.cityId) issues.push(missing(operation, 'cityId'));
            if (!operation.stay) issues.push(missing(operation, 'stay'));
            if (issues.length === 0) {
                candidate = { ...base, kind: 'add_stay', cityId: operation.cityId, stay: normalizeStay(operation.stay!) };
            }
            break;
        }
        case 'update_stay': {
            if (!operation.cityId) issues.push(missing(operation, 'cityId'));
            if (!operation.stayId) issues.push(missing(operation, 'stayId'));
            if (!operation.stayChanges) issues.push(missing(operation, 'stayChanges'));
            if (issues.length === 0) {
                candidate = {
                    ...base,
                    kind: 'update_stay',
                    cityId: operation.cityId,
                    stayId: operation.stayId,
                    changes: operation.stayChanges,
                };
            }
            break;
        }
        case 'remove_stay': {
            if (!operation.cityId) issues.push(missing(operation, 'cityId'));
            if (!operation.stayId) issues.push(missing(operation, 'stayId'));
            if (issues.length === 0) {
                candidate = { ...base, kind: 'remove_stay', cityId: operation.cityId, stayId: operation.stayId };
            }
            break;
        }
        case 'replace_itinerary': {
            if (!operation.items?.length) issues.push(missing(operation, 'items'));
            else candidate = { ...base, kind: 'replace_itinerary', items: operation.items.map(normalizeItem) };
            break;
        }
        case 'replace_itinerary_segment': {
            if (operation.startOffset === undefined) issues.push(missing(operation, 'startOffset'));
            if (operation.endOffset === undefined) issues.push(missing(operation, 'endOffset'));
            if (!operation.items?.length) issues.push(missing(operation, 'items'));
            if (issues.length === 0) {
                candidate = {
                    ...base,
                    kind: 'replace_itinerary_segment',
                    startOffset: operation.startOffset,
                    endOffset: operation.endOffset,
                    items: operation.items!.map(normalizeItem),
                };
            }
            break;
        }
    }

    if (issues.length > 0) return { status: 'invalid', issues };

    const parsed = tripChangeOperationV1Schema.safeParse(candidate);
    if (!parsed.success) {
        return {
            status: 'invalid',
            issues: parsed.error.issues.slice(0, 4).map((issue) => ({
                operationId: operation.id,
                path: issue.path.join('.') || '(root)',
                message: issue.message.slice(0, 200),
            })),
        };
    }
    return { status: 'ok', operation: parsed.data };
};

export const toTypedTripChangeOperations = (
    operations: TripAgentWireOperation[],
): { status: 'ok'; operations: TripChangeOperationV1[] } | { status: 'invalid'; issues: TripAgentWireIssue[] } => {
    const converted: TripChangeOperationV1[] = [];
    const issues: TripAgentWireIssue[] = [];

    operations.forEach((operation) => {
        const result = toTypedTripChangeOperation(operation);
        if (result.status === 'ok') converted.push(result.operation);
        else issues.push(...result.issues);
    });

    return issues.length > 0
        ? { status: 'invalid' as const, issues: issues.slice(0, 10) }
        : { status: 'ok' as const, operations: converted };
};

/**
 * Checks every id an operation set points at against the trip it will run on,
 * counting items the set creates itself. Catching an invented id here lets the
 * model correct itself, instead of the reviewer meeting a dead proposal.
 */
export const findUnknownOperationTargets = (
    trip: { items: Array<{ id: string; type: string; hotels?: Array<{ id: string }> }> },
    operations: TripChangeOperationV1[],
): TripAgentWireIssue[] => {
    const itemIds = new Set(trip.items.map((item) => item.id));
    const cityIds = new Set(trip.items.filter((item) => item.type === 'city').map((item) => item.id));
    const stayIds = new Set(trip.items.flatMap((item) => (item.hotels || []).map((stay) => `${item.id}:${stay.id}`)));
    const issues: TripAgentWireIssue[] = [];

    const unknown = (operation: TripChangeOperationV1, path: string, target: string, hint: string): void => {
        issues.push({
            operationId: operation.id,
            path,
            message: `"${target}" is not in this trip. ${hint}`,
        });
    };

    for (const operation of operations) {
        switch (operation.kind) {
            case 'add_item':
                itemIds.add(operation.item.id);
                if (operation.item.type === 'city') cityIds.add(operation.item.id);
                break;
            case 'update_item':
            case 'move_item':
            case 'remove_item':
                if (!itemIds.has(operation.itemId)) {
                    unknown(operation, 'itemId', operation.itemId, 'Use an id from read_trip_context.');
                }
                if (operation.kind === 'remove_item') itemIds.delete(operation.itemId);
                break;
            case 'add_stay':
                if (!cityIds.has(operation.cityId)) {
                    unknown(operation, 'cityId', operation.cityId, 'Stays attach to a city item.');
                } else {
                    stayIds.add(`${operation.cityId}:${operation.stay.id}`);
                }
                break;
            case 'update_stay':
            case 'remove_stay':
                if (!cityIds.has(operation.cityId)) {
                    unknown(operation, 'cityId', operation.cityId, 'Stays attach to a city item.');
                } else if (!stayIds.has(`${operation.cityId}:${operation.stayId}`)) {
                    unknown(operation, 'stayId', operation.stayId, 'Use a stay id from this city.');
                }
                break;
            case 'replace_itinerary':
                itemIds.clear();
                cityIds.clear();
                operation.items.forEach((item) => {
                    itemIds.add(item.id);
                    if (item.type === 'city') cityIds.add(item.id);
                });
                break;
            case 'replace_itinerary_segment':
                operation.items.forEach((item) => {
                    itemIds.add(item.id);
                    if (item.type === 'city') cityIds.add(item.id);
                });
                break;
            default:
                break;
        }
    }

    return issues.slice(0, 10);
};
