import { isToolUIPart } from 'ai';

import {
    tripAgentChangeSetV1Schema,
    type TripAgentChangeSetV1,
    type TripAgentMessage,
} from '../../shared/tripAgent';
import type { TripAgentActivityStep } from './TripAgentActivityGroup';
import type { TripAgentQuestionOption } from './TripAgentQuestionCard';
import type { DynamicToolUIPart, ToolUIPart } from 'ai';

export type TripAgentMessageBlock =
    | { kind: 'text'; key: string; text: string }
    | { kind: 'activity'; key: string; reasoningText: string; steps: TripAgentActivityStep[]; isStreaming: boolean }
    | { kind: 'proposal'; key: string; changeSet: TripAgentChangeSetV1 }
    | { kind: 'proposal-pending'; key: string }
    | { kind: 'proposal-failed'; key: string; detail?: string }
    | { kind: 'question'; key: string; question: string; options: TripAgentQuestionOption[]; allowCustom: boolean }
    | { kind: 'source'; key: string; url: string; title: string };

/** A tool call in a message, static or dynamic. */
export type ToolPart = ToolUIPart | DynamicToolUIPart;

export const resolveToolName = (part: ToolPart): string => (
    part.type === 'dynamic-tool' ? part.toolName : part.type.slice('tool-'.length)
);

export const asQuestion = (part: ToolPart): {
    question: string;
    options: TripAgentQuestionOption[];
    allowCustom: boolean;
} | null => {
    if (resolveToolName(part) !== 'ask_traveler' || part.state !== 'output-available') return null;
    const output = part.output as {
        kind?: unknown;
        question?: unknown;
        options?: unknown;
        allowCustom?: unknown;
    } | undefined;
    if (output?.kind !== 'trip-agent-question') return null;
    if (typeof output.question !== 'string' || !Array.isArray(output.options)) return null;
    const options = output.options.flatMap((entry) => {
        const option = entry as Partial<TripAgentQuestionOption>;
        if (!option?.id || !option.label || !option.prompt) return [];
        return [{
            id: String(option.id),
            label: String(option.label),
            prompt: String(option.prompt),
            ...(option.detail ? { detail: String(option.detail) } : {}),
        }];
    });
    if (options.length < 2) return null;
    return { question: output.question, options, allowCustom: output.allowCustom !== false };
};

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
        // Hidden reasoning is neither streamed nor stored any more; a part left
        // in an old transcript is skipped rather than rendered.
        if (part.type === 'reasoning') return;
        if (isToolUIPart(part)) {
            const proposal = asProposal(part);
            if (proposal) {
                closeActivity();
                blocks.push({ kind: 'proposal', key, changeSet: proposal });
                return;
            }
            const question = asQuestion(part);
            if (question) {
                closeActivity();
                blocks.push({ kind: 'question', key, ...question });
                return;
            }
            if (resolveToolName(part) === 'create_trip_proposal') {
                if (part.state === 'input-streaming' || part.state === 'input-available') {
                    closeActivity();
                    blocks.push({ kind: 'proposal-pending', key });
                    return;
                }
                if (part.state === 'output-error' || part.state === 'output-denied') {
                    closeActivity();
                    blocks.push({
                        kind: 'proposal-failed',
                        key,
                        detail: (part as { errorText?: string }).errorText,
                    });
                    return;
                }
            }
            const group = openActivity(key);
            group.steps.push({
                key,
                name: humanizeToolName(resolveToolName(part)),
                state: part.state,
                detail: describeToolStep(part) || undefined,
            });
            if (isStreaming && (part.state === 'input-streaming' || part.state === 'input-available' || part.state === 'approval-requested')) {
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

    const rank = (block: TripAgentMessageBlock): number => {
        if (block.kind === 'proposal' || block.kind === 'proposal-pending' || block.kind === 'proposal-failed') return 1;
        if (block.kind === 'question') return 2;
        return 0;
    };
    const ordered = [...blocks].sort((left, right) => rank(left) - rank(right));

    // A failed attempt that a later call replaced is history, not news: the
    // model describes the successful proposal, and two cards would contradict.
    if (ordered.some((block) => block.kind === 'proposal')) {
        return ordered.filter((block) => block.kind !== 'proposal-failed' && block.kind !== 'proposal-pending');
    }
    blocks.length = 0;
    blocks.push(...ordered);

    if (isStreaming) {
        const last = blocks.at(-1);
        if (last?.kind === 'activity' && !blocks.some((block) => block.kind === 'text')) last.isStreaming = true;
    }
    return blocks;
};

