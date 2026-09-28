import React, { useLayoutEffect, useRef } from 'react';

import type { TripAgentContextRef } from '../../shared/tripAgent';
import { findTripAgentMentions, type TripAgentMentionSpan } from './tripAgentMentions';

const SHARED_TEXT_CLASSES = 'w-full whitespace-pre-wrap break-words px-3 py-3 text-sm leading-6';

/** The mention the caret is in, counting the spot just before its "@". */
export const mentionAtCaret = (spans: TripAgentMentionSpan[], caret: number): TripAgentMentionSpan | undefined => (
    spans.find((span) => caret >= span.start && caret < span.end)
);

/**
 * Prompt textarea that highlights `@` mentions in place.
 *
 * A textarea cannot style parts of its value, so the text is mirrored in a
 * backdrop that carries the highlight marks; the textarea sits on top with a
 * transparent background and the two are kept in metric and scroll sync.
 *
 * A known mention can be swapped: clicking into it, or Alt+ArrowDown with the
 * caret in it (the combobox convention for opening a list), asks the caller to
 * open the list of stops for that mention.
 */
export const TripAgentPromptField: React.FC<{
    value: string;
    onValueChange: (value: string) => void;
    onKeyDown?: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
    contextRefs: TripAgentContextRef[];
    placeholder: string;
    disabled?: boolean;
    ariaExpanded?: boolean;
    ariaControls?: string;
    ariaActiveDescendant?: string;
    textareaRef?: React.MutableRefObject<HTMLTextAreaElement | null>;
    /** The mention whose swap list is open, drawn in its active style. */
    activeMention?: { start: number; end: number } | null;
    onMentionActivate?: (span: TripAgentMentionSpan) => void;
    ariaDescribedBy?: string;
}> = ({
    value,
    onValueChange,
    onKeyDown,
    contextRefs,
    placeholder,
    disabled,
    ariaExpanded,
    ariaControls,
    ariaActiveDescendant,
    textareaRef,
    activeMention,
    onMentionActivate,
    ariaDescribedBy,
}) => {
    const localRef = useRef<HTMLTextAreaElement | null>(null);
    const backdropRef = useRef<HTMLDivElement | null>(null);
    const spans = findTripAgentMentions(value, contextRefs);

    const setRef = (element: HTMLTextAreaElement | null) => {
        localRef.current = element;
        if (textareaRef) textareaRef.current = element;
    };

    // Grow with the content and keep the backdrop aligned with the value.
    useLayoutEffect(() => {
        const element = localRef.current;
        if (!element) return;
        element.style.height = 'auto';
        element.style.height = `${Math.min(element.scrollHeight, 192)}px`;
        if (backdropRef.current) backdropRef.current.scrollTop = element.scrollTop;
    }, [value]);

    const pieces: React.ReactNode[] = [];
    let cursor = 0;
    spans.forEach((span) => {
        if (span.start > cursor) pieces.push(value.slice(cursor, span.start));
        pieces.push(
            <mark
                key={`mention-${span.start}-${span.end}`}
                className={`rounded-[5px] px-0.5 py-px text-transparent ${
                    !span.contextRef
                        ? 'bg-mention-unknown'
                        : activeMention && activeMention.start === span.start
                            ? 'bg-mention-active ring-2 ring-mention-active-ring'
                            : 'bg-mention ring-1 ring-mention-ring'
                }`}
            >
                {value.slice(span.start, span.end)}
            </mark>,
        );
        cursor = span.end;
    });
    pieces.push(value.slice(cursor));

    return (
        <div className="relative min-h-16 w-full">
            <div
                ref={backdropRef}
                aria-hidden="true"
                className={`pointer-events-none absolute inset-0 select-none overflow-hidden text-transparent ${SHARED_TEXT_CLASSES}`}
            >
                {pieces}
                {'​'}
            </div>
            <textarea
                ref={setRef}
                name="message"
                value={value}
                placeholder={placeholder}
                disabled={disabled}
                rows={2}
                onChange={(event) => onValueChange(event.currentTarget.value)}
                onClick={(event) => {
                    const element = event.currentTarget;
                    if (!onMentionActivate || element.selectionStart !== element.selectionEnd) return;
                    const span = mentionAtCaret(spans, element.selectionStart);
                    if (span?.contextRef) onMentionActivate(span);
                }}
                onKeyDown={(event) => {
                    if (event.key === 'ArrowDown' && event.altKey && onMentionActivate) {
                        const span = mentionAtCaret(spans, event.currentTarget.selectionStart);
                        if (span?.contextRef) {
                            event.preventDefault();
                            onMentionActivate(span);
                            return;
                        }
                    }
                    onKeyDown?.(event);
                    if (event.defaultPrevented) return;
                    if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        const form = event.currentTarget.form;
                        const submit = form?.querySelector('button[type="submit"]') as HTMLButtonElement | null;
                        if (!submit?.disabled) form?.requestSubmit();
                    }
                }}
                onScroll={(event) => {
                    if (backdropRef.current) backdropRef.current.scrollTop = event.currentTarget.scrollTop;
                }}
                role="combobox"
                aria-expanded={ariaExpanded}
                aria-controls={ariaControls}
                aria-activedescendant={ariaActiveDescendant}
                aria-describedby={ariaDescribedBy}
                data-slot="input-group-control"
                className={`relative max-h-48 resize-none bg-transparent text-foreground outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 ${SHARED_TEXT_CLASSES}`}
            />
        </div>
    );
};
