import type { TripAgentContextRef } from '../../shared/tripAgent';

export interface TripAgentMentionSpan {
    start: number;
    end: number;
    label: string;
    contextRef?: TripAgentContextRef;
}

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Finds `@label` mentions in the draft. Known labels win over the generic
 * single-word form, so "@Taipei 101" resolves to the activity rather than to
 * "@Taipei".
 */
export const findTripAgentMentions = (
    text: string,
    refs: TripAgentContextRef[],
): TripAgentMentionSpan[] => {
    const spans: TripAgentMentionSpan[] = [];
    const byLength = [...refs].sort((a, b) => b.label.length - a.label.length);

    const claimed = (start: number, end: number): boolean => spans.some(
        (span) => start < span.end && end > span.start,
    );

    byLength.forEach((contextRef) => {
        if (!contextRef.label.trim()) return;
        const pattern = new RegExp(`@${escapeRegExp(contextRef.label)}(?![\\w-])`, 'gi');
        let match = pattern.exec(text);
        while (match) {
            const start = match.index;
            const end = start + match[0].length;
            if (!claimed(start, end)) spans.push({ start, end, label: contextRef.label, contextRef });
            match = pattern.exec(text);
        }
    });

    const generic = /@([\p{L}\p{N}][\p{L}\p{N}'’-]*)/gu;
    let match = generic.exec(text);
    while (match) {
        const start = match.index;
        const end = start + match[0].length;
        if (!claimed(start, end)) spans.push({ start, end, label: match[1] });
        match = generic.exec(text);
    }

    return spans.sort((a, b) => a.start - b.start);
};

/** Context references the draft currently mentions, in reading order. */
export const mentionedContextRefs = (
    text: string,
    refs: TripAgentContextRef[],
    /** Chosen reference per label, for labels that occur more than once. */
    preferred: Record<string, TripAgentContextRef> = {},
): TripAgentContextRef[] => {
    const seen = new Set<string>();
    return findTripAgentMentions(text, refs).flatMap((span) => {
        const contextRef = preferred[span.label.toLowerCase()] || span.contextRef;
        if (!contextRef) return [];
        const key = `${contextRef.kind}:${contextRef.id}`;
        if (seen.has(key)) return [];
        seen.add(key);
        return [contextRef];
    });
};

/** Labels that more than one reference answers to. */
export const ambiguousMentionLabels = (refs: TripAgentContextRef[]): Set<string> => {
    const counts = new Map<string, number>();
    refs.forEach((contextRef) => {
        const label = contextRef.label.toLowerCase();
        counts.set(label, (counts.get(label) || 0) + 1);
    });
    return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([label]) => label));
};

/**
 * Replaces the `@query` the caret sits behind with the chosen label, keeping a
 * trailing space so the next word is not swallowed into the mention.
 */
export const insertMention = (text: string, label: string): string => {
    const replaced = text.replace(/(^|\s)@[^\s]*$/, `$1@${label} `);
    return replaced === text ? `${text}${text.endsWith(' ') || text === '' ? '' : ' '}@${label} ` : replaced;
};
