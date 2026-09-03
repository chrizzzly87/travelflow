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
    const operation = (id: string, kind: string, extra: Record<string, unknown> = {}) => ({
        id, kind, rationale: 'because', targetLabel: id, ...extra,
    }) as never;

    it('folds the moves a change causes into that change', () => {
        const groups = groupTripAgentChanges([
            operation('shorten-kenting', 'update_item', { itemId: 'kenting', changes: { duration: 2 } }),
            operation('move-activity', 'move_item', { itemId: 'act-1', startDateOffset: 9 }),
            operation('move-travel', 'move_item', { itemId: 'travel-1', startDateOffset: 9 }),
            operation('remove-hualien', 'remove_item', { itemId: 'hualien' }),
        ]);

        expect(groups.map((group) => group.id)).toEqual(['shorten-kenting', 'remove-hualien']);
        expect(groups[0].followUps).toHaveLength(2);
        expect(selectedOperationIdsForGroups(groups, ['shorten-kenting']))
            .toEqual(['shorten-kenting', 'move-activity', 'move-travel']);
    });
});
