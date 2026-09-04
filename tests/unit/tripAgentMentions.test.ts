import { describe, expect, it } from 'vitest';

import {
    ambiguousMentionLabels,
    findTripAgentMentions,
    insertMention,
    mentionedContextRefs,
} from '../../components/trip-agent/tripAgentMentions';
import { groupTripAgentChanges, selectedOperationIdsForGroups } from '../../components/trip-agent/tripAgentChangeGroups';
import type { TripAgentContextRef } from '../../shared/tripAgent';

const refs: TripAgentContextRef[] = [
    { kind: 'city', id: 'taipei-1', label: 'Taipei', tripUpdatedAt: 1 },
    { kind: 'city', id: 'taipei-2', label: 'Taipei', tripUpdatedAt: 1 },
    { kind: 'activity', id: 'act-1', label: 'Taipei 101', cityId: 'taipei-1', tripUpdatedAt: 1 },
];

describe('trip agent mentions', () => {
    it('prefers the longer label so a nested name is not swallowed', () => {
        const spans = findTripAgentMentions('add a stop near @Taipei 101 please', refs);

        expect(spans).toHaveLength(1);
        expect(spans[0].contextRef?.id).toBe('act-1');
    });

    it('keeps an unknown mention as plain text without a reference', () => {
        const spans = findTripAgentMentions('what about @Kyoto?', refs);

        expect(spans[0].label).toBe('Kyoto');
        expect(spans[0].contextRef).toBeUndefined();
    });

    it('resolves an ambiguous label to the chosen stop', () => {
        const chosen = mentionedContextRefs('a fun evening in @Taipei', refs, { taipei: refs[1] });

        expect(chosen.map((ref) => ref.id)).toEqual(['taipei-2']);
    });

    it('reports labels that more than one stop answers to', () => {
        expect([...ambiguousMentionLabels(refs)]).toEqual(['taipei']);
    });

    it('replaces the token being typed and leaves a trailing space', () => {
        expect(insertMention('a fun day in @tai', 'Taipei')).toBe('a fun day in @Taipei ');
        expect(insertMention('a fun day', 'Taipei')).toBe('a fun day @Taipei ');
    });
});

describe('groupTripAgentChanges', () => {
    const trip = {
        id: 'trip-1',
        items: [
            { id: 'city-taipei', type: 'city', title: 'Taipei', startDateOffset: 0, duration: 4 },
            { id: 'act-market', type: 'activity', title: 'Night market', startDateOffset: 1, duration: 0.25 },
            { id: 'city-hualien', type: 'city', title: 'Hualien', startDateOffset: 4, duration: 2 },
            { id: 'act-gorge', type: 'activity', title: 'Taroko Gorge', startDateOffset: 4, duration: 0.5 },
            { id: 'travel-1', type: 'travel', title: '2h Train', startDateOffset: 5.5, duration: 0.1 },
        ],
    } as never;

    const operation = (id: string, kind: string, extra: Record<string, unknown> = {}) => ({
        id, kind, rationale: 'because', targetLabel: id, ...extra,
    }) as never;

    it('folds a city removal and everything in that city into one entry', () => {
        const groups = groupTripAgentChanges(trip, [
            operation('remove-hualien', 'remove_item', { itemId: 'city-hualien' }),
            operation('remove-gorge', 'remove_item', { itemId: 'act-gorge' }),
            operation('remove-travel', 'remove_item', { itemId: 'travel-1' }),
        ]);

        expect(groups).toHaveLength(1);
        expect(groups[0].primary.id).toBe('remove-hualien');
        expect(groups[0].operationIds).toEqual(['remove-hualien', 'remove-gorge', 'remove-travel']);
    });

    it('keeps separate stops apart and folds the shifts each one causes', () => {
        const groups = groupTripAgentChanges(trip, [
            operation('shorten-taipei', 'update_item', { itemId: 'city-taipei', changes: { duration: 3 } }),
            operation('move-market', 'move_item', { itemId: 'act-market', startDateOffset: 2 }),
            operation('remove-hualien', 'remove_item', { itemId: 'city-hualien' }),
        ]);

        expect(groups.map((group) => group.id)).toEqual(['shorten-taipei', 'remove-hualien']);
        expect(groups[0].followUps.map((operation) => operation.id)).toEqual(['move-market']);
        expect(selectedOperationIdsForGroups(groups, ['shorten-taipei']))
            .toEqual(['shorten-taipei', 'move-market']);
    });

    it('reunites operations for one stop even when another stop is touched in between', () => {
        const groups = groupTripAgentChanges(trip, [
            operation('move-market', 'move_item', { itemId: 'act-market', startDateOffset: 2 }),
            operation('remove-gorge', 'remove_item', { itemId: 'act-gorge' }),
            operation('rename-taipei', 'update_item', { itemId: 'city-taipei', changes: { title: 'Taipei City' } }),
        ]);

        expect(groups).toHaveLength(2);
        expect(groups[0].operationIds).toEqual(['move-market', 'rename-taipei']);
        expect(groups[0].primary.id).toBe('rename-taipei');
    });

    it('gives a trip-wide change its own entry', () => {
        const groups = groupTripAgentChanges(trip, [
            operation('retitle', 'update_trip', { changes: { title: 'New title' } }),
            operation('remove-gorge', 'remove_item', { itemId: 'act-gorge' }),
        ]);

        expect(groups.map((group) => group.id)).toEqual(['retitle', 'remove-gorge']);
    });

    it('groups an added item under the stop whose days it falls into', () => {
        const groups = groupTripAgentChanges(trip, [
            operation('rename-taipei', 'update_item', { itemId: 'city-taipei', changes: { title: 'Taipei City' } }),
            operation('add-tea', 'add_item', {
                item: { id: 'act-tea', type: 'activity', title: 'Tea', startDateOffset: 2, duration: 0.25, color: '#111' },
            }),
        ]);

        expect(groups).toHaveLength(1);
        expect(groups[0].subjectId).toBe('city-taipei');
    });
});
