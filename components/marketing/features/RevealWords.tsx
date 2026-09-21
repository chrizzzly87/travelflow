import React from 'react';
import { cn } from '../../../lib/utils';

export interface RevealWordsSegment {
    text: string;
    /** Styling for this run of words, e.g. the accent-coloured tail of a headline. */
    className?: string;
}

interface RevealWordsProps {
    segments: RevealWordsSegment[];
    /** Held before the first word so a heading can trail the element above it. */
    startDelayMs?: number;
    className?: string;
}

interface RevealWord {
    text: string;
    className?: string;
    /** Position across every segment, so the stagger does not restart mid-headline. */
    index: number;
    /** Whether a space is needed before this word once the spans are laid out inline. */
    leadingSpace: boolean;
}

const toWords = (segments: RevealWordsSegment[]): RevealWord[] => segments.flatMap((segment) => (
    segment.text.split(/\s+/).filter(Boolean).map((text) => ({ text, className: segment.className }))
)).map((word, index) => ({ ...word, index, leadingSpace: index > 0 }));

/**
 * Word-by-word blur reveal, the CSS-only equivalent of React Bits' Blur/Split
 * Text. The animated words are hidden from assistive tech and the full string is
 * exposed once, so a screen reader reads a sentence rather than a word list.
 */
export const RevealWords: React.FC<RevealWordsProps> = ({ segments, startDelayMs = 0, className }) => {
    const words = toWords(segments);
    const spoken = words.map((word) => word.text).join(' ');

    return (
        <span
            className={cn('tf-reveal-words', className)}
            style={{ '--tf-reveal-start': `${startDelayMs}ms` } as React.CSSProperties}
        >
            <span className="sr-only">{spoken}</span>
            <span aria-hidden="true">
                {words.map((word) => (
                    <React.Fragment key={`${word.text}-${word.index}`}>
                        {word.leadingSpace ? ' ' : null}
                        <span
                            className={cn('tf-reveal-word', word.className)}
                            style={{ '--tf-word': word.index } as React.CSSProperties}
                        >
                            {word.text}
                        </span>
                    </React.Fragment>
                ))}
            </span>
        </span>
    );
};
