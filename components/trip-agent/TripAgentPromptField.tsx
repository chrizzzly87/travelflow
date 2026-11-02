import React, { useLayoutEffect, useRef, useState } from 'react';

import type { TripAgentContextRef } from '../../shared/tripAgent';
import { findTripAgentMentions, type TripAgentMentionSpan } from './tripAgentMentions';

const SHARED_TEXT_CLASSES = 'w-full whitespace-pre-wrap break-words px-3 py-3 text-sm leading-6';

/** The mention the caret is in, counting the spot just before its "@". */
export const mentionAtCaret = (spans: TripAgentMentionSpan[], caret: number): TripAgentMentionSpan | undefined => (
    spans.find((span) => caret >= span.start && caret < span.end)
);

/**
 * Removes a whole mention and one of the spaces around it, so deleting
 * "in @Kyoto in" leaves "in in" rather than a double space. Returns the new
 * text and where the caret belongs.
 */
export const removeMention = (value: string, span: { start: number; end: number }): { value: string; caret: number } => {
    let start = span.start;
    let end = span.end;
    if (value[end] === ' ') end += 1;
    else if (start > 0 && value[start - 1] === ' ') start -= 1;
    return { value: `${value.slice(0, start)}${value.slice(end)}`, caret: start };
};

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
 *
 * Deleting follows the two-step pattern of GitHub and Linear: Backspace just
 * after a mention (or Delete just before it) first selects the whole mention,
 * and the next press removes it. Inside its letters, text edits as usual.
 */
export const TripAgentPromptField: React.FC<{
    value: string;
    /** The new text and where the caret ended up in it. */
    onValueChange: (value: string, caret: number) => void;
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
    // A caret to restore with the next value, before the browser paints:
    // setting a controlled value moves the caret to the end.
    const pendingCaretRef = useRef<number | null>(null);
    const spans = findTripAgentMentions(value, contextRefs);
    // The mention the selection covers exactly, drawn as active.
    const [selectedStart, setSelectedStart] = useState<number | null>(null);

    const syncSelection = (element: HTMLTextAreaElement) => {
        const covered = spans.find((span) => (
            span.contextRef && element.selectionStart === span.start && element.selectionEnd === span.end
        ));
        setSelectedStart(covered ? covered.start : null);
    };

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
        if (pendingCaretRef.current !== null) {
            element.setSelectionRange(pendingCaretRef.current, pendingCaretRef.current);
            pendingCaretRef.current = null;
        }
        if (backdropRef.current) backdropRef.current.scrollTop = element.scrollTop;
    }, [value]);

    const pieces: React.ReactNode[] = [];
    let cursor = 0;
    spans.forEach((span) => {
        if (span.start > cursor) pieces.push(value.slice(cursor, span.start));
        pieces.push(
            // No horizontal padding and an inset ring: the backdrop must keep the
            // textarea's text metrics exactly, or every later character drifts
            // off its mark, and an outer ring would eat the space after it.
            <mark
                key={`mention-${span.start}-${span.end}`}
                className={`rounded-[4px] py-px text-transparent ${
                    !span.contextRef
                        ? 'bg-mention-unknown'
                        : (activeMention && activeMention.start === span.start) || selectedStart === span.start
                            ? 'bg-mention-active ring-2 ring-inset ring-mention-active-ring'
                            : 'bg-mention ring-1 ring-inset ring-mention-ring'
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
                onChange={(event) => onValueChange(event.currentTarget.value, event.currentTarget.selectionStart)}
                onClick={(event) => {
                    const element = event.currentTarget;
                    if (!onMentionActivate || element.selectionStart !== element.selectionEnd) return;
                    const span = mentionAtCaret(spans, element.selectionStart);
                    if (span?.contextRef) onMentionActivate(span);
                }}
                onSelect={(event) => syncSelection(event.currentTarget)}
                onKeyUp={(event) => syncSelection(event.currentTarget)}
                onMouseUp={(event) => syncSelection(event.currentTarget)}
                onBlur={() => setSelectedStart(null)}
                onKeyDown={(event) => {
                    const element = event.currentTarget;
                    if ((event.key === 'Backspace' || event.key === 'Delete') && !event.altKey && !event.metaKey && !event.ctrlKey) {
                        const { selectionStart, selectionEnd } = element;
                        const selected = spans.find((span) => (
                            span.contextRef && selectionStart === span.start && selectionEnd === span.end
                        ));
                        if (selected) {
                            // Second press: the whole mention goes.
                            event.preventDefault();
                            const next = removeMention(value, selected);
                            pendingCaretRef.current = next.caret;
                            onValueChange(next.value, next.caret);
                            setSelectedStart(null);
                            return;
                        }
                        if (selectionStart === selectionEnd) {
                            const adjacent = spans.find((span) => span.contextRef && (
                                event.key === 'Backspace' ? span.end === selectionStart : span.start === selectionStart
                            ));
                            if (adjacent) {
                                // First press: select it, so the reader sees what goes next.
                                event.preventDefault();
                                element.setSelectionRange(adjacent.start, adjacent.end);
                                setSelectedStart(adjacent.start);
                                return;
                            }
                        }
                    }
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
