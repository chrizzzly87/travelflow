import { describe, expect, it } from 'vitest';

import {
    groupHotelOptionsByBudget,
    toRouteAlternatives,
    tripAgentHotelResultSchema,
    tripAgentRouteResultSchema,
} from '../../shared/tripAgentSpecialistResults';
import { asSpecialistResult, buildTripAgentMessageBlocks } from '../../components/trip-agent/tripAgentMessageBlocks';
import type { TripAgentMessage } from '../../shared/tripAgent';

const option = (id: string, budgetGroup: 'low' | 'medium' | 'high') => ({
    id, name: `Stay ${id}`, address: 'Somewhere 1', budgetGroup, budgetBasis: 'mid-range in this area', sourceIds: [],
});

describe('specialist results', () => {
    it('buckets stays into the three budget groups, capped at three each', () => {
        const groups = groupHotelOptionsByBudget([
            option('a', 'low'), option('b', 'low'), option('c', 'low'), option('d', 'low'),
            option('e', 'medium'), option('f', 'high'),
        ]);

        expect(groups.low).toHaveLength(3);
        expect(groups.medium.map((entry) => entry.id)).toEqual(['e']);
        expect(groups.high.map((entry) => entry.id)).toEqual(['f']);
    });

    it('accepts numbers a model sent as strings', () => {
        const parsed = tripAgentHotelResultSchema.safeParse({
            cityId: 'city-1',
            options: [{ ...option('a', 'low'), rating: '4.5' }],
        });

        expect(parsed.success).toBe(true);
        if (!parsed.success) return;
        expect(parsed.data.options[0].rating).toBe(4.5);
    });

    it('rejects a stay without a budget group', () => {
        expect(tripAgentHotelResultSchema.safeParse({
            cityId: 'city-1',
            options: [{ id: 'a', name: 'Stay', budgetBasis: 'x' }],
        }).success).toBe(false);
    });

    it('caps route alternatives at three and starts them without operations', () => {
        expect(tripAgentRouteResultSchema.safeParse({
            alternatives: Array.from({ length: 4 }, (_, index) => ({
                id: `r${index}`, title: 'Route', summary: 'Summary', affectedStopIds: [], sourceIds: [],
            })),
        }).success).toBe(false);

        const alternatives = toRouteAlternatives({
            alternatives: [{ id: 'r1', title: 'Coastal', summary: 'Slower but scenic', affectedStopIds: ['city-1'], sourceIds: [] }],
        });
        expect(alternatives[0].operations).toEqual([]);
    });
});

describe('specialist blocks in a message', () => {
    const message = (output: unknown, toolName = 'delegate_hotel_search') => ({
        id: 'assistant-s',
        role: 'assistant',
        parts: [
            { type: `tool-${toolName}`, toolCallId: 'call-1', state: 'output-available', input: {}, output },
            { type: 'text', text: 'Here is what I found.' },
        ],
    }) as unknown as TripAgentMessage;

    it('renders stays as their own card and keeps the step in the activity row', () => {
        const blocks = buildTripAgentMessageBlocks(message({
            status: 'complete',
            summary: 'Three options.',
            hotelOptions: { cityId: 'city-1', groups: { low: [option('a', 'low')], medium: [], high: [] } },
        }), false);

        expect(blocks.map((block) => block.kind)).toEqual(['activity', 'hotels', 'text']);
    });

    it('renders route alternatives as their own card', () => {
        const blocks = buildTripAgentMessageBlocks(message({
            status: 'complete',
            summary: 'Two options.',
            routeAlternatives: [{ id: 'r1', title: 'Coastal', summary: 'Scenic', affectedStopIds: [], operations: [], sourceIds: [] }],
        }, 'delegate_route_planning'), false);

        expect(blocks.map((block) => block.kind)).toEqual(['activity', 'routes', 'text']);
    });

    it('ignores an unavailable specialist answer', () => {
        expect(asSpecialistResult({
            type: 'tool-delegate_hotel_search',
            toolCallId: 'c',
            state: 'output-available',
            input: {},
            output: { status: 'unavailable', summary: 'Grounding is not configured.' },
        } as never)).toBeNull();
    });
});
