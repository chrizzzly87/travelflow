import type { UIMessage } from 'ai';
import { z } from 'zod';

import type { ITrip, ITimelineItem } from '../types';
import { TRANSPORT_MODE_VALUES } from './transportModes.ts';

export const TRIP_AGENT_SCHEMA_VERSION = 1 as const;

const coordinatesSchema = z.object({
    lat: z.number().finite().min(-90).max(90),
    lng: z.number().finite().min(-180).max(180),
}).strict();

export const tripAgentHotelSchema = z.object({
    id: z.string().trim().min(1).max(160),
    name: z.string().trim().min(1).max(240),
    address: z.string().trim().max(500),
    coordinates: coordinatesSchema.optional(),
    notes: z.string().trim().max(2_000).optional(),
}).strict();

const countryInfoSchema = z.object({
    currencyCode: z.string().trim().min(1).max(12),
    currencyName: z.string().trim().min(1).max(120),
    exchangeRate: z.number().finite().positive(),
    languages: z.array(z.string().trim().min(1).max(80)).max(20),
    electricSockets: z.string().trim().min(1).max(500),
    visaInfoUrl: z.string().url().max(2_000).optional(),
    auswaertigesAmtUrl: z.string().url().max(2_000).optional(),
}).strict();

const timelineItemSchema = z.object({
    id: z.string().trim().min(1).max(160),
    type: z.enum(['city', 'activity', 'travel', 'travel-empty']),
    title: z.string().trim().min(1).max(240),
    startDateOffset: z.number().finite().min(0).max(36_500),
    duration: z.number().finite().positive().max(36_500),
    color: z.string().trim().min(1).max(80),
    description: z.string().trim().max(8_000).optional(),
    link: z.string().url().max(2_000).optional(),
    location: z.string().trim().max(500).optional(),
    coordinates: coordinatesSchema.optional(),
    imageUrl: z.string().url().max(2_000).optional(),
    cost: z.string().trim().max(240).optional(),
    countryCode: z.string().trim().max(8).optional(),
    countryName: z.string().trim().max(120).optional(),
    cityPlanStatus: z.enum(['confirmed', 'uncertain']).optional(),
    cityPlanGroupId: z.string().trim().max(160).optional(),
    cityPlanOptionIndex: z.number().int().nonnegative().optional(),
    isApproved: z.boolean().optional(),
    transportMode: z.enum(TRANSPORT_MODE_VALUES).optional(),
    activityType: z.array(z.enum([
        'general', 'food', 'culture', 'sightseeing', 'relaxation', 'nightlife',
        'sports', 'hiking', 'wildlife', 'shopping', 'adventure', 'beach', 'nature',
    ])).max(13).optional(),
    aiInsights: z.object({
        cost: z.string().max(240),
        bestTime: z.string().max(500),
        tips: z.string().max(2_000),
    }).strict().optional(),
    hotels: z.array(tripAgentHotelSchema).max(50).optional(),
    bufferBefore: z.number().finite().min(0).max(10_080).optional(),
    bufferAfter: z.number().finite().min(0).max(10_080).optional(),
    departureTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
    routeDistanceKm: z.number().finite().nonnegative().max(100_000).optional(),
    routeDurationHours: z.number().finite().nonnegative().max(10_000).optional(),
    loading: z.boolean().optional(),
}).strict();

const timelineItemPatchSchema = timelineItemSchema
    .omit({ id: true, type: true })
    .partial()
    .refine((value) => Object.keys(value).length > 0, 'At least one item field must change.');

const operationBaseSchema = z.object({
    id: z.string().trim().min(1).max(120),
    rationale: z.string().trim().min(1).max(1_000),
    targetLabel: z.string().trim().min(1).max(240),
});

export const tripChangeOperationV1Schema = z.discriminatedUnion('kind', [
    operationBaseSchema.extend({
        kind: z.literal('update_trip'),
        changes: z.object({
            title: z.string().trim().min(1).max(240).optional(),
            startDate: z.string().date().optional(),
            roundTrip: z.boolean().optional(),
            countryInfo: countryInfoSchema.optional(),
        }).strict().refine((value) => Object.keys(value).length > 0, 'At least one trip field must change.'),
    }).strict(),
    operationBaseSchema.extend({
        kind: z.literal('add_item'),
        item: timelineItemSchema,
    }).strict(),
    operationBaseSchema.extend({
        kind: z.literal('update_item'),
        itemId: z.string().trim().min(1).max(160),
        changes: timelineItemPatchSchema,
    }).strict(),
    operationBaseSchema.extend({
        kind: z.literal('move_item'),
        itemId: z.string().trim().min(1).max(160),
        startDateOffset: z.number().finite().min(0).max(36_500),
        duration: z.number().finite().positive().max(36_500).optional(),
    }).strict(),
    operationBaseSchema.extend({
        kind: z.literal('remove_item'),
        itemId: z.string().trim().min(1).max(160),
    }).strict(),
    operationBaseSchema.extend({
        kind: z.literal('add_stay'),
        cityId: z.string().trim().min(1).max(160),
        stay: tripAgentHotelSchema,
    }).strict(),
    operationBaseSchema.extend({
        kind: z.literal('update_stay'),
        cityId: z.string().trim().min(1).max(160),
        stayId: z.string().trim().min(1).max(160),
        changes: tripAgentHotelSchema.omit({ id: true }).partial()
            .refine((value) => Object.keys(value).length > 0, 'At least one stay field must change.'),
    }).strict(),
    operationBaseSchema.extend({
        kind: z.literal('remove_stay'),
        cityId: z.string().trim().min(1).max(160),
        stayId: z.string().trim().min(1).max(160),
    }).strict(),
    operationBaseSchema.extend({
        kind: z.literal('replace_itinerary'),
        items: z.array(timelineItemSchema).max(1_000),
    }).strict(),
    operationBaseSchema.extend({
        kind: z.literal('replace_itinerary_segment'),
        startOffset: z.number().finite().min(0).max(36_500),
        endOffset: z.number().finite().positive().max(36_500),
        items: z.array(timelineItemSchema).max(500),
    }).strict().refine((value) => value.endOffset > value.startOffset, {
        message: 'Segment end must be after its start.',
        path: ['endOffset'],
    }),
]);

export type TripChangeOperationV1 = z.infer<typeof tripChangeOperationV1Schema>;

export const tripAgentSourceSchema = z.object({
    id: z.string().trim().min(1).max(160),
    title: z.string().trim().min(1).max(500),
    url: z.string().url().max(2_000),
    provider: z.string().trim().min(1).max(120),
}).strict();

export type TripAgentSource = z.infer<typeof tripAgentSourceSchema>;

export const tripAgentContextRefSchema = z.object({
    kind: z.enum(['trip', 'city', 'activity', 'stay', 'travel']),
    id: z.string().trim().min(1).max(160),
    label: z.string().trim().min(1).max(240),
    cityId: z.string().trim().min(1).max(160).optional(),
    tripUpdatedAt: z.number().int().nonnegative(),
}).strict();

export type TripAgentContextRef = z.infer<typeof tripAgentContextRefSchema>;

export const tripAgentChangeSetV1Schema = z.object({
    schemaVersion: z.literal(TRIP_AGENT_SCHEMA_VERSION),
    id: z.string().uuid(),
    tripId: z.string().trim().min(1).max(160),
    threadId: z.string().uuid(),
    runId: z.string().uuid(),
    baseTripUpdatedAt: z.number().int().nonnegative(),
    summary: z.string().trim().min(1).max(2_000),
    operations: z.array(tripChangeOperationV1Schema).min(1).max(100),
    sources: z.array(tripAgentSourceSchema).max(30).default([]),
    status: z.enum(['pending', 'applied', 'applied_partial', 'rejected', 'stale']),
    selectedOperationIds: z.array(z.string().max(120)).max(100).default([]),
    appliedVersionId: z.string().uuid().nullable().default(null),
    createdAt: z.string().datetime(),
    appliedAt: z.string().datetime().nullable().default(null),
}).strict();

export type TripAgentChangeSetV1 = z.infer<typeof tripAgentChangeSetV1Schema>;

export type TripAgentKey = 'trip_orchestrator' | 'hotel_scout' | 'route_planner';

export interface TripAgentDefinition {
    key: TripAgentKey;
    enabled: boolean;
    model: string;
    fallbackModel: string;
    reasoningEffort: 'none' | 'minimal' | 'low' | 'medium' | 'high';
    publishedPromptVersionId: string | null;
    toolIds: string[];
    mcpCapabilityIds: string[];
}

export interface TripAgentQuotaState {
    enabled: boolean;
    limit: number | null;
    used: number;
    remaining: number | null;
    resetsAt: string;
}

export interface TripAgentHotelOption {
    id: string;
    name: string;
    address: string;
    budgetGroup: 'low' | 'medium' | 'high';
    budgetBasis: string;
    placeUrl?: string;
    rating?: number;
    sourceIds: string[];
}

export interface TripAgentRouteAlternative {
    id: string;
    title: string;
    summary: string;
    affectedStopIds: string[];
    distanceKm?: number;
    durationHours?: number;
    operations: TripChangeOperationV1[];
    sourceIds: string[];
}

export type TripAgentDataParts = {
    quota: TripAgentQuotaState;
    publicPlan: { id: string; label: string; status: 'pending' | 'active' | 'complete' | 'error' };
    toolStatus: { id: string; label: string; status: 'running' | 'complete' | 'error' };
    proposal: TripAgentChangeSetV1;
    hotelOptions: { cityId: string; groups: Record<'low' | 'medium' | 'high', TripAgentHotelOption[]> };
    routeAlternatives: { alternatives: TripAgentRouteAlternative[] };
    notice: { tone: 'info' | 'warning' | 'error'; message: string };
};

export type TripAgentMessage = UIMessage<{
    authorId?: string;
    authorLabel?: string;
    createdAt?: string;
    model?: string;
    runId?: string;
}, TripAgentDataParts>;

export interface TripAgentApplyResult {
    trip: ITrip;
    appliedOperationIds: string[];
    noOpOperationIds: string[];
}

const stableItemSort = (items: ITimelineItem[]): ITimelineItem[] => (
    items
        .map((item, index) => ({ item, index }))
        .sort((left, right) => (
            left.item.startDateOffset - right.item.startDateOffset
            || left.index - right.index
        ))
        .map(({ item }) => item)
);

const assertUniqueItemIds = (items: ITimelineItem[]): void => {
    const ids = new Set<string>();
    for (const item of items) {
        if (ids.has(item.id)) throw new Error(`Duplicate itinerary item id: ${item.id}`);
        ids.add(item.id);
    }
};

const findCityIndex = (items: ITimelineItem[], cityId: string): number => {
    const cityIndex = items.findIndex((item) => item.id === cityId && item.type === 'city');
    if (cityIndex < 0) throw new Error(`City not found: ${cityId}`);
    return cityIndex;
};

export const applyTripAgentOperations = (
    inputTrip: ITrip,
    rawOperations: TripChangeOperationV1[],
    selectedOperationIds: string[] = rawOperations.map((operation) => operation.id),
    now: number = Date.now(),
): TripAgentApplyResult => {
    const operations = z.array(tripChangeOperationV1Schema).max(100).parse(rawOperations);
    const operationIds = new Set<string>();
    for (const operation of operations) {
        if (operationIds.has(operation.id)) throw new Error(`Duplicate operation id: ${operation.id}`);
        operationIds.add(operation.id);
    }

    const selectedIds = new Set(selectedOperationIds);
    for (const selectedId of selectedIds) {
        if (!operationIds.has(selectedId)) throw new Error(`Unknown selected operation id: ${selectedId}`);
    }

    let nextTrip: ITrip = structuredClone(inputTrip);
    const appliedOperationIds: string[] = [];
    const noOpOperationIds: string[] = [];

    for (const operation of operations) {
        if (!selectedIds.has(operation.id)) continue;
        const before = JSON.stringify(nextTrip);

        switch (operation.kind) {
            case 'update_trip':
                nextTrip = { ...nextTrip, ...operation.changes };
                break;
            case 'add_item':
                if (nextTrip.items.some((item) => item.id === operation.item.id)) {
                    throw new Error(`Itinerary item already exists: ${operation.item.id}`);
                }
                nextTrip = { ...nextTrip, items: stableItemSort([...nextTrip.items, operation.item]) };
                break;
            case 'update_item': {
                const itemIndex = nextTrip.items.findIndex((item) => item.id === operation.itemId);
                if (itemIndex < 0) throw new Error(`Itinerary item not found: ${operation.itemId}`);
                const items = [...nextTrip.items];
                items[itemIndex] = { ...items[itemIndex], ...operation.changes };
                nextTrip = { ...nextTrip, items: stableItemSort(items) };
                break;
            }
            case 'move_item': {
                const itemIndex = nextTrip.items.findIndex((item) => item.id === operation.itemId);
                if (itemIndex < 0) throw new Error(`Itinerary item not found: ${operation.itemId}`);
                const items = [...nextTrip.items];
                items[itemIndex] = {
                    ...items[itemIndex],
                    startDateOffset: operation.startDateOffset,
                    ...(operation.duration === undefined ? {} : { duration: operation.duration }),
                };
                nextTrip = { ...nextTrip, items: stableItemSort(items) };
                break;
            }
            case 'remove_item': {
                if (!nextTrip.items.some((item) => item.id === operation.itemId)) {
                    throw new Error(`Itinerary item not found: ${operation.itemId}`);
                }
                nextTrip = { ...nextTrip, items: nextTrip.items.filter((item) => item.id !== operation.itemId) };
                break;
            }
            case 'add_stay': {
                const cityIndex = findCityIndex(nextTrip.items, operation.cityId);
                const hotels = nextTrip.items[cityIndex].hotels ?? [];
                if (hotels.some((hotel) => hotel.id === operation.stay.id)) {
                    throw new Error(`Stay already exists: ${operation.stay.id}`);
                }
                const items = [...nextTrip.items];
                items[cityIndex] = { ...items[cityIndex], hotels: [...hotels, operation.stay] };
                nextTrip = { ...nextTrip, items };
                break;
            }
            case 'update_stay': {
                const cityIndex = findCityIndex(nextTrip.items, operation.cityId);
                const hotels = nextTrip.items[cityIndex].hotels ?? [];
                const stayIndex = hotels.findIndex((hotel) => hotel.id === operation.stayId);
                if (stayIndex < 0) throw new Error(`Stay not found: ${operation.stayId}`);
                const nextHotels = [...hotels];
                nextHotels[stayIndex] = { ...nextHotels[stayIndex], ...operation.changes };
                const items = [...nextTrip.items];
                items[cityIndex] = { ...items[cityIndex], hotels: nextHotels };
                nextTrip = { ...nextTrip, items };
                break;
            }
            case 'remove_stay': {
                const cityIndex = findCityIndex(nextTrip.items, operation.cityId);
                const hotels = nextTrip.items[cityIndex].hotels ?? [];
                if (!hotels.some((hotel) => hotel.id === operation.stayId)) {
                    throw new Error(`Stay not found: ${operation.stayId}`);
                }
                const items = [...nextTrip.items];
                items[cityIndex] = {
                    ...items[cityIndex],
                    hotels: hotels.filter((hotel) => hotel.id !== operation.stayId),
                };
                nextTrip = { ...nextTrip, items };
                break;
            }
            case 'replace_itinerary':
                assertUniqueItemIds(operation.items);
                nextTrip = { ...nextTrip, items: stableItemSort(operation.items) };
                break;
            case 'replace_itinerary_segment': {
                assertUniqueItemIds(operation.items);
                const retained = nextTrip.items.filter((item) => (
                    item.startDateOffset < operation.startOffset
                    || item.startDateOffset >= operation.endOffset
                ));
                const retainedIds = new Set(retained.map((item) => item.id));
                for (const item of operation.items) {
                    if (retainedIds.has(item.id)) throw new Error(`Replacement item id collides with retained item: ${item.id}`);
                }
                nextTrip = { ...nextTrip, items: stableItemSort([...retained, ...operation.items]) };
                break;
            }
        }

        if (before === JSON.stringify(nextTrip)) noOpOperationIds.push(operation.id);
        else appliedOperationIds.push(operation.id);
    }

    assertUniqueItemIds(nextTrip.items);
    const parsedItems = z.array(timelineItemSchema).max(1_000).parse(nextTrip.items);
    if (appliedOperationIds.length > 0) {
        nextTrip = { ...nextTrip, items: parsedItems, updatedAt: now };
    }

    return { trip: nextTrip, appliedOperationIds, noOpOperationIds };
};

export const buildTripAgentContextRefs = (
    trip: ITrip,
    selectedItemId: string | null,
    selectedCityIds: string[],
): TripAgentContextRef[] => {
    const selectedIds = new Set(selectedCityIds);
    if (selectedItemId) selectedIds.add(selectedItemId);

    return trip.items
        .filter((item) => selectedIds.has(item.id))
        .map((item) => ({
            kind: item.type === 'city' ? 'city' as const : item.type === 'activity' ? 'activity' as const : 'travel' as const,
            id: item.id,
            label: item.title,
            tripUpdatedAt: trip.updatedAt,
        }));
};
