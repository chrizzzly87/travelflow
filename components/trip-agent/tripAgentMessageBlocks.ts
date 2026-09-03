import { isToolUIPart } from 'ai';

import {
    tripAgentChangeSetV1Schema,
    type TripAgentChangeSetV1,
    type TripAgentMessage,
} from '../../shared/tripAgent';
import type { TripAgentActivityStep } from './TripAgentActivityGroup';
import type { ToolPart } from '../ai-elements/tool';

export type TripAgentMessageBlock =
    | { kind: 'text'; key: string; text: string }
    | { kind: 'activity'; key: string; reasoningText: string; steps: TripAgentActivityStep[]; isStreaming: boolean }
    | { kind: 'proposal'; key: string; changeSet: TripAgentChangeSetV1 }
    | { kind: 'source'; key: string; url: string; title: string };

export const resolveToolName = (part: ToolPart): string => (
    part.type === 'dynamic-tool' ? part.toolName : part.type.slice('tool-'.length)
);

export const asProposal = (part: ToolPart): TripAgentChangeSetV1 | null => {
    if (resolveToolName(part) !== 'create_trip_proposal' || part.state !== 'output-available') return null;
    const output = part.output as { kind?: unknown; changeSet?: unknown } | undefined;
    if (output?.kind !== 'trip-agent-proposal') return null;
    const result = tripAgentChangeSetV1Schema.safeParse(output.changeSet);
    return result.success ? result.data : null;
};

const humanizeToolName = (name: string): string => name.replaceAll('_', ' ');

const asRecord = (value: unknown): Record<string, unknown> => (
    value && typeof value === 'object' ? value as Record<string, unknown> : {}
);

const clip = (value: unknown, max = 200): string => {
    if (typeof value === 'string') return value.slice(0, max);
    if (value === undefined || value === null) return '';
    try {
        return JSON.stringify(value).slice(0, max);
    } catch {
        return '';
    }
};

/**
 * One readable line per tool call, so a chip explains what the step actually
 * did instead of only that it happened.
 */
export const describeToolStep = (part: ToolPart): string => {
    const name = resolveToolName(part);
    const input = asRecord(part.state === 'input-streaming' ? undefined : (part as { input?: unknown }).input);
    const output = asRecord(part.state === 'output-available' ? (part as { output?: unknown }).output : undefined);

    if (part.state === 'output-error') return clip((part as { errorText?: string }).errorText, 400);

    if (name === 'read_trip_context') {
        const trip = asRecord(output.trip);
        const items = Array.isArray(trip.items) ? trip.items.length : null;
        return items === null ? 'Reading the current trip.' : `Read the current trip: ${items} timeline items.`;
    }
    if (name === 'delegate_hotel_search' || name === 'delegate_route_planning') {
        const request = name === 'delegate_hotel_search'
            ? [input.cityId ? `City ${clip(input.cityId, 60)}` : '', clip(input.task, 200)]
            : [clip(input.task, 200), Array.isArray(input.affectedStopIds) ? `${input.affectedStopIds.length} stops` : ''];
        const answer = output.status === 'unavailable'
            ? `Unavailable: ${clip(output.summary, 200)}`
            : clip(output.summary, 300);
        return [...request.filter(Boolean), answer].filter(Boolean).join(' · ');
    }
    if (name === 'create_trip_proposal') {
        if (output.kind === 'trip-agent-proposal-invalid') {
            const issues = Array.isArray(output.issues) ? output.issues : [];
            return `Rejected: ${issues.map((issue) => clip(issue, 80)).join(' · ').slice(0, 400)}`;
        }
        const changeSet = asRecord(output.changeSet);
        const operations = Array.isArray(changeSet.operations) ? changeSet.operations.length : 0;
        return operations ? `Proposed ${operations} changes for your review.` : clip(input.summary, 240);
    }
    return clip(input, 240);
};

/**
 * Collapses each contiguous run of reasoning and tool activity into a single
 * block so a long run reads as one line instead of one card per event.
 */
export const buildTripAgentMessageBlocks = (
    message: TripAgentMessage,
    isStreaming: boolean,
): TripAgentMessageBlock[] => {
    const blocks: TripAgentMessageBlock[] = [];
    let activity: Extract<TripAgentMessageBlock, { kind: 'activity' }> | null = null;

    const closeActivity = () => {
        if (activity && (activity.reasoningText.trim() || activity.steps.length > 0)) blocks.push(activity);
        activity = null;
    };
    const openActivity = (key: string) => {
        if (!activity) {
            activity = { kind: 'activity', key, reasoningText: '', steps: [], isStreaming: false };
        }
        return activity;
    };

    message.parts.forEach((part, index) => {
        const key = `${message.id}-${index}`;
        if (part.type === 'reasoning') {
            const group = openActivity(key);
            group.reasoningText = [group.reasoningText, part.text || ''].filter(Boolean).join('\n\n');
            if (part.state === 'streaming') group.isStreaming = true;
            return;
        }
        if (isToolUIPart(part)) {
            const proposal = asProposal(part);
            if (proposal) {
                closeActivity();
                blocks.push({ kind: 'proposal', key, changeSet: proposal });
                return;
            }
            const group = openActivity(key);
            group.steps.push({
                key,
                name: humanizeToolName(resolveToolName(part)),
                state: part.state,
                detail: describeToolStep(part) || undefined,
            });
            if (part.state === 'input-streaming' || part.state === 'input-available' || part.state === 'approval-requested') {
                group.isStreaming = true;
            }
            return;
        }
        if (part.type === 'text') {
            closeActivity();
            if (part.text.trim()) blocks.push({ kind: 'text', key, text: part.text });
            return;
        }
        if (part.type === 'source-url') {
            closeActivity();
            blocks.push({ kind: 'source', key, url: part.url, title: part.title || part.url });
        }
    });
    closeActivity();

    if (isStreaming) {
        const last = blocks.at(-1);
        if (last?.kind === 'activity' && !blocks.some((block) => block.kind === 'text')) last.isStreaming = true;
    }
    return blocks;
};

