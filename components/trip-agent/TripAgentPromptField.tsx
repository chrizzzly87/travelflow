import React, { useLayoutEffect, useRef } from 'react';

import type { TripAgentContextRef } from '../../shared/tripAgent';
import { findTripAgentMentions } from './tripAgentMentions';

const SHARED_TEXT_CLASSES = 'w-full whitespace-pre-wrap break-words px-3 py-3 text-sm leading-6';

/**
 * Prompt textarea that highlights `@` mentions in place.
 *
 * A textarea cannot style parts of its value, so the text is mirrored in a
 * backdrop that carries the highlight marks; the textarea sits on top with a
 * transparent background and the two are kept in metric and scroll sync.
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
    spans.forEach((span, index) => {
        if (span.start > cursor) pieces.push(value.slice(cursor, span.start));
        pieces.push(
            <mark
                key={`${span.start}-${index}`}
                className={`rounded-[5px] px-0.5 py-px ${
                    span.contextRef ? 'bg-accent-100 text-accent-900' : 'bg-slate-100 text-slate-700'
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
                className={`pointer-events-none absolute inset-0 overflow-hidden text-transparent ${SHARED_TEXT_CLASSES}`}
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
                onKeyDown={(event) => {
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
                data-slot="input-group-control"
                className={`relative max-h-48 resize-none bg-transparent text-slate-900 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed disabled:opacity-50 ${SHARED_TEXT_CLASSES}`}
            />
        </div>
    );
};
