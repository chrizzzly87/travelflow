import { describe, expect, it } from 'vitest';

import type { ITrip } from '../../types';
import {
    deriveTripActivityBoardCards,
    moveTripActivityBoardCard,
    resolveTripActivityBoardInsertion,
    returnTripActivityBoardCardToShortlist,
} from '../../components/tripview/workspace/tripActivityBoard';

const buildTrip = (): ITrip => ({
    id: 'trip-thailand',
    title: 'Thailand Highlights',
    startDate: '2026-04-10',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    items: [
        {
            id: 'city-bangkok',
            type: 'city',
            title: 'Bangkok',
            startDateOffset: 0,
            duration: 3,
            color: 'bg-amber-500',
        },
        {
            id: 'activity-floating-market',
            type: 'activity',
            title: 'Floating market morning',
            startDateOffset: 1,
            duration: 1,
            color: 'bg-amber-500',
            activityType: ['culture'],
            description: 'Planner activity that should not duplicate when already linked.',
        },
        {
            id: 'activity-river-dinner',
            type: 'activity',
            title: 'River dinner cruise',
            startDateOffset: 2,
            duration: 1,
            color: 'bg-amber-500',
            activityType: ['food'],
        },
    ],
    activityBoard: [
        {
            id: 'explore-floating-market',
            title: 'Floating market morning',
            cityItemId: 'city-bangkok',
            timelineItemId: 'activity-floating-market',
            source: 'explore',
            status: 'booked',
            activityType: ['culture'],
            description: 'Booked from Explore.',
            sortOrder: 0,
        },
    ],
});

describe('components/tripview/workspace/tripActivityBoard', () => {
    it('derives implicit planner cards without duplicating explicitly linked cards', () => {
        const cards = deriveTripActivityBoardCards(buildTrip());

        expect(cards).toHaveLength(2);
        expect(cards.filter((card) => card.timelineItemId === 'activity-floating-market')).toHaveLength(1);
        expect(cards.find((card) => card.timelineItemId === 'activity-floating-market')).toMatchObject({
            status: 'booked',
            source: 'explore',
        });
        expect(cards.find((card) => card.timelineItemId === 'activity-river-dinner')).toMatchObject({
            status: 'planned',
            source: 'planner',
        });
    });

    it('moves cards within a workflow lane and re-normalizes sort order', () => {
        const moved = moveTripActivityBoardCard([
            {
                id: 'planned-a',
                title: 'A',
                cityItemId: 'city-bangkok',
                source: 'planner',
                status: 'planned',
                activityType: ['culture'],
                sortOrder: 0,
            },
            {
                id: 'planned-b',
                title: 'B',
                cityItemId: 'city-bangkok',
                source: 'planner',
                status: 'planned',
                activityType: ['food'],
                sortOrder: 1,
            },
        ], 'planned-b', 'planned', 'planned-a');

        expect(moved.map((card) => card.id)).toEqual(['planned-b', 'planned-a']);
        expect(moved.map((card) => card.sortOrder)).toEqual([0, 1]);
    });

    it('supports dropping after another card inside the same workflow lane', () => {
        const moved = moveTripActivityBoardCard([
            {
                id: 'planned-a',
                title: 'A',
                cityItemId: 'city-bangkok',
                source: 'planner',
                status: 'planned',
                activityType: ['culture'],
                sortOrder: 0,
            },
            {
                id: 'planned-b',
                title: 'B',
                cityItemId: 'city-bangkok',
                source: 'planner',
                status: 'planned',
                activityType: ['food'],
                sortOrder: 1,
            },
            {
                id: 'planned-c',
                title: 'C',
                cityItemId: 'city-bangkok',
                source: 'planner',
                status: 'planned',
                activityType: ['nightlife'],
                sortOrder: 2,
            },
        ], 'planned-a', 'planned', 'planned-b', 'after');

        expect(moved.map((card) => card.id)).toEqual(['planned-b', 'planned-a', 'planned-c']);
        expect(moved.map((card) => card.sortOrder)).toEqual([0, 1, 2]);
    });

    it('resolves a between-card insertion slot from lane geometry', () => {
        const insertion = resolveTripActivityBoardInsertion([
            { id: 'planned-a', top: 100, height: 72 },
            { id: 'planned-b', top: 188, height: 72 },
            { id: 'planned-c', top: 276, height: 72 },
        ], 210);

        expect(insertion).toEqual({
            overCardId: 'planned-b',
            insertPosition: 'before',
        });
    });

    it('resolves a tail insertion slot when dragging below the last card', () => {
        const insertion = resolveTripActivityBoardInsertion([
            { id: 'planned-a', top: 100, height: 72 },
            { id: 'planned-b', top: 188, height: 72 },
        ], 320);

        expect(insertion).toEqual({
            overCardId: 'planned-b',
            insertPosition: 'after',
        });
    });

    it('returns linked cards to shortlist by clearing the timeline link', () => {
        const returned = returnTripActivityBoardCardToShortlist([
            {
                id: 'explore-talad-noi',
                title: 'Talat Noi canal and photo walk',
                cityItemId: 'city-bangkok',
                timelineItemId: 'activity-talad-noi',
                source: 'explore',
                status: 'planned',
                activityType: ['culture', 'sightseeing'],
                sortOrder: 0,
            },
        ], 'explore-talad-noi');

        expect(returned).toEqual([
            expect.objectContaining({
                id: 'explore-talad-noi',
                status: 'shortlist',
                timelineItemId: null,
                sortOrder: 0,
            }),
        ]);
    });
});
