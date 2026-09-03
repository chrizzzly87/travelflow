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
                detail: part.state === 'output-error' ? part.errorText : undefined,
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

