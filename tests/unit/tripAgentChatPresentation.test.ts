import { describe, expect, it } from 'vitest';

import { buildTripAgentMessageBlocks } from '../../components/trip-agent/tripAgentMessageBlocks';
import { formatTripAgentTimestamp, groupTripAgentThreads } from '../../components/trip-agent/tripAgentTime';
import type { TripAgentMessage } from '../../shared/tripAgent';
import type { TripAgentThread } from '../../services/tripAgentService';

const thread = (id: string, updatedAt: string, status: TripAgentThread['status'] = 'active'): TripAgentThread => ({
    id,
    tripId: 'trip-1',
    title: id,
    status,
    createdBy: 'user-1',
    createdAt: updatedAt,
    updatedAt,
});

const NOW = Date.parse('2026-09-03T12:00:00Z');

describe('buildTripAgentMessageBlocks', () => {
    it('collapses a run of reasoning and tool parts into one activity block', () => {
        const message = {
            id: 'assistant-1',
            role: 'assistant',
            parts: [
                { type: 'reasoning', text: 'Checking the route', state: 'done' },
                { type: 'tool-read_trip_context', toolCallId: 'call-1', state: 'output-available', input: {}, output: {} },
                { type: 'reasoning', text: 'Comparing stays', state: 'done' },
                { type: 'tool-delegate_hotel_search', toolCallId: 'call-2', state: 'output-available', input: {}, output: {} },
                { type: 'text', text: 'Here are three options.' },
            ],
        } as unknown as TripAgentMessage;

        const blocks = buildTripAgentMessageBlocks(message, false);

        expect(blocks.map((block) => block.kind)).toEqual(['activity', 'text']);
        const activity = blocks[0];
        if (activity.kind !== 'activity') throw new Error('expected an activity block');
        expect(activity.steps.map((step) => step.name)).toEqual(['read trip context', 'delegate hotel search']);
        expect(activity.reasoningText).toBe('Checking the route\n\nComparing stays');
    });

    it('keeps a proposal out of the activity block so it stays reviewable', () => {
        const changeSet = {
            schemaVersion: 1,
            id: '4f1c9d5e-0000-4000-8000-000000000000',
            tripId: 'trip-1',
            threadId: '5f1c9d5e-0000-4000-8000-000000000000',
            runId: '6f1c9d5e-0000-4000-8000-000000000000',
            baseTripUpdatedAt: 10,
            summary: 'Relax the route',
            operations: [{ id: 'op-1', kind: 'remove_item', itemId: 'activity-1', rationale: 'Too tight', targetLabel: 'Alfama walk' }],
            sources: [],
            status: 'pending',
            selectedOperationIds: [],
            appliedVersionId: null,
            createdAt: '2026-09-03T11:00:00.000Z',
            appliedAt: null,
        };
        const message = {
            id: 'assistant-2',
            role: 'assistant',
            parts: [
                { type: 'reasoning', text: 'Removing one stop', state: 'done' },
                {
                    type: 'tool-create_trip_proposal',
                    toolCallId: 'call-3',
                    state: 'output-available',
                    input: {},
                    output: { kind: 'trip-agent-proposal', changeSet },
                },
            ],
        } as unknown as TripAgentMessage;

        const blocks = buildTripAgentMessageBlocks(message, false);

        expect(blocks.map((block) => block.kind)).toEqual(['activity', 'proposal']);
    });

    it('marks a failed tool call so the group can show it as a failure', () => {
        const message = {
            id: 'assistant-3',
            role: 'assistant',
            parts: [{
                type: 'tool-delegate_route_planning',
                toolCallId: 'call-4',
                state: 'output-error',
                input: {},
                errorText: 'The route provider is unavailable.',
            }],
        } as unknown as TripAgentMessage;

        const blocks = buildTripAgentMessageBlocks(message, false);
        const activity = blocks[0];
        if (activity?.kind !== 'activity') throw new Error('expected an activity block');
        expect(activity.steps[0].state).toBe('output-error');
        expect(activity.steps[0].detail).toBe('The route provider is unavailable.');
    });
});

describe('formatTripAgentTimestamp', () => {
    it('reads as now, then minutes, then hours', () => {
        expect(formatTripAgentTimestamp('2026-09-03T11:59:50Z', 'en', NOW)).toBe('this minute');
        expect(formatTripAgentTimestamp('2026-09-03T11:55:00Z', 'en', NOW)).toContain('5');
        expect(formatTripAgentTimestamp('2026-09-03T09:00:00Z', 'en', NOW)).toContain('3');
    });

    it('returns an empty string for a missing or unparseable value', () => {
        expect(formatTripAgentTimestamp(undefined, 'en', NOW)).toBe('');
        expect(formatTripAgentTimestamp('not-a-date', 'en', NOW)).toBe('');
    });
});

describe('groupTripAgentThreads', () => {
    it('splits chats by recency and separates archived ones', () => {
        const sections = groupTripAgentThreads([
            thread('today-1', '2026-09-03T10:00:00Z'),
            thread('week-1', '2026-08-30T10:00:00Z'),
            thread('older-1', '2026-07-01T10:00:00Z'),
            thread('archived-1', '2026-09-03T09:00:00Z', 'archived'),
        ], NOW);

        expect(sections.map((section) => section.key)).toEqual(['today', 'week', 'older', 'archived']);
        expect(sections[0].threads.map((entry) => entry.id)).toEqual(['today-1']);
        expect(sections[3].threads.map((entry) => entry.id)).toEqual(['archived-1']);
    });

    it('caps each section and reports the remainder instead of listing everything', () => {
        const threads = Array.from({ length: 14 }, (_, index) => thread(
            `today-${index}`,
            new Date(NOW - index * 60_000).toISOString(),
        ));

        const [today] = groupTripAgentThreads(threads, NOW);

        expect(today.threads).toHaveLength(8);
        expect(today.hiddenCount).toBe(6);
        expect(today.threads[0].id).toBe('today-0');
    });
});

describe('question blocks', () => {
    const questionPart = (output: unknown) => ({
        id: 'assistant-q',
        role: 'assistant',
        parts: [
            { type: 'text', text: 'I removed the Cambodia stops.' },
            {
                type: 'tool-create_trip_proposal',
                toolCallId: 'call-p',
                state: 'output-available',
                input: {},
                output: {
                    kind: 'trip-agent-proposal',
                    changeSet: {
                        schemaVersion: 1,
                        id: '7f1c9d5e-0000-4000-8000-000000000000',
                        tripId: 'trip-1',
                        threadId: '8f1c9d5e-0000-4000-8000-000000000000',
                        runId: '9f1c9d5e-0000-4000-8000-000000000000',
                        baseTripUpdatedAt: 10,
                        summary: 'Remove Cambodia',
                        operations: [{ id: 'op-1', kind: 'remove_item', itemId: 'city-1', rationale: 'x', targetLabel: 'Siem Reap' }],
                        sources: [],
                        status: 'pending',
                        selectedOperationIds: [],
                        appliedVersionId: null,
                        createdAt: '2026-09-04T10:00:00.000Z',
                        appliedAt: null,
                    },
                },
            },
            { type: 'tool-ask_traveler', toolCallId: 'call-q', state: 'output-available', input: {}, output },
        ],
    }) as unknown as TripAgentMessage;

    it('renders the question after the answer and the review card', () => {
        const blocks = buildTripAgentMessageBlocks(questionPart({
            kind: 'trip-agent-question',
            question: 'What should happen to the free days?',
            options: [
                { id: 'extend', label: 'Extend nearby stays', prompt: 'Extend the stays.' },
                { id: 'shorten', label: 'Shorten the trip', prompt: 'Shorten the trip.' },
            ],
            allowCustom: true,
        }), false);

        expect(blocks.map((block) => block.kind)).toEqual(['text', 'proposal', 'question']);
    });

    it('ignores a malformed question instead of rendering an empty card', () => {
        const blocks = buildTripAgentMessageBlocks(questionPart({
            kind: 'trip-agent-question',
            question: 'Too few options',
            options: [{ id: 'only', label: 'Only one', prompt: 'Do it.' }],
        }), false);

        expect(blocks.some((block) => block.kind === 'question')).toBe(false);
    });
});

describe('readTripAgentError', () => {
    it('drops an upstream code token so the reader sees the localized failure only', async () => {
        const { readTripAgentError } = await import('../../services/tripAgentService');
        const error = Object.assign(new Error('This proposal is based on an older trip version.'), {
            code: 'TRIP_AGENT_PROPOSAL_STALE',
            detail: 'TRIP_AGENT_STALE_PROPOSAL',
        });

        const info = readTripAgentError(error);

        expect(info.code).toBe('TRIP_AGENT_PROPOSAL_STALE');
        expect(info.detail).toBeUndefined();
        expect(info.message).toBe('This proposal is based on an older trip version.');
    });

    it('keeps a detail that actually explains something', async () => {
        const { readTripAgentError } = await import('../../services/tripAgentService');
        const info = readTripAgentError(Object.assign(new Error('Could not apply.'), {
            code: 'TRIP_AGENT_REQUEST_FAILED',
            detail: 'The selected changes no longer alter this trip.',
        }));

        expect(info.detail).toBe('The selected changes no longer alter this trip.');
    });
});

describe('failed proposal attempts', () => {
    const message = (parts: unknown[]) => ({ id: 'assistant-f', role: 'assistant', parts }) as unknown as TripAgentMessage;
    const failedCall = {
        type: 'tool-create_trip_proposal',
        toolCallId: 'call-fail',
        state: 'output-error',
        input: {},
        errorText: 'Invalid tool input.',
    };

    it('shows a failure notice when no proposal came out of the run', () => {
        const blocks = buildTripAgentMessageBlocks(message([
            failedCall,
            { type: 'text', text: 'I have created a proposal.' },
        ]), false);

        expect(blocks.map((block) => block.kind)).toEqual(['text', 'proposal-failed']);
    });

    it('hides an attempt that a later successful call replaced', () => {
        const blocks = buildTripAgentMessageBlocks(message([
            failedCall,
            {
                type: 'tool-create_trip_proposal',
                toolCallId: 'call-ok',
                state: 'output-available',
                input: {},
                output: {
                    kind: 'trip-agent-proposal',
                    changeSet: {
                        schemaVersion: 1,
                        id: 'af1c9d5e-0000-4000-8000-000000000000',
                        tripId: 'trip-1',
                        threadId: 'bf1c9d5e-0000-4000-8000-000000000000',
                        runId: 'cf1c9d5e-0000-4000-8000-000000000000',
                        baseTripUpdatedAt: 10,
                        summary: 'Add Alishan',
                        operations: [{ id: 'op-1', kind: 'remove_item', itemId: 'city-1', rationale: 'x', targetLabel: 'Old stop' }],
                        sources: [],
                        status: 'pending',
                        selectedOperationIds: [],
                        appliedVersionId: null,
                        createdAt: '2026-09-04T10:00:00.000Z',
                        appliedAt: null,
                    },
                },
            },
            { type: 'text', text: 'I have created a proposal.' },
        ]), false);

        expect(blocks.map((block) => block.kind)).toEqual(['text', 'proposal']);
    });
});
