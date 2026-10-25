import React, { useEffect, useRef, useState } from 'react';

import { cn } from '../../lib/utils';

/** Copies text, falling back to a hidden textarea where the Clipboard API is unavailable. */
export const copyTextToClipboard = async (value: string): Promise<boolean> => {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        try {
            await navigator.clipboard.writeText(value);
            return true;
        } catch {
            // Fall through to legacy copy path.
        }
    }

    if (typeof document === 'undefined') return false;

    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'fixed';
    textarea.style.top = '-9999px';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, value.length);
    try {
        return document.execCommand('copy');
    } catch {
        return false;
    } finally {
        document.body.removeChild(textarea);
    }
};

interface CopyableUuidProps {
    value: string;
    className?: string;
    textClassName?: string;
    hintClassName?: string;
    ariaLabel?: string;
    stopPropagation?: boolean;
    focusable?: boolean;
}

export const CopyableUuid: React.FC<CopyableUuidProps> = ({
    value,
    className,
    textClassName,
    hintClassName,
    ariaLabel,
    stopPropagation = true,
    focusable = true,
}) => {
    const textRef = useRef<HTMLSpanElement | null>(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (!copied) return;
        if (typeof window === 'undefined') return;
        const timer = window.setTimeout(() => setCopied(false), 1400);
        return () => {
            window.clearTimeout(timer);
        };
    }, [copied]);

    const selectText = () => {
        if (typeof window === 'undefined' || typeof document === 'undefined') return;
        const node = textRef.current;
        if (!node) return;
        const selection = window.getSelection();
        if (!selection) return;
        const range = document.createRange();
        range.selectNodeContents(node);
        selection.removeAllRanges();
        selection.addRange(range);
    };

    const handleCopy = async (event?: React.MouseEvent | React.KeyboardEvent) => {
        if (event && stopPropagation) {
            event.preventDefault();
            event.stopPropagation();
        }
        selectText();
        const didCopy = await copyTextToClipboard(value);
        if (didCopy) setCopied(true);
    };

    return (
        <span
            role={focusable ? 'button' : undefined}
            tabIndex={focusable ? 0 : undefined}
            onClick={(event) => {
                void handleCopy(event);
            }}
            onKeyDown={(event) => {
                if (!focusable) return;
                if (event.key === 'Enter' || event.key === ' ') {
                    // Space would otherwise scroll the page when propagation is allowed.
                    event.preventDefault();
                    void handleCopy(event);
                }
            }}
            className={cn(
                'group/uuid inline-flex min-w-0 max-w-full cursor-copy items-center gap-1 rounded-sm px-1 text-start outline-none',
                'hover:bg-secondary focus-visible:ring-[3px] focus-visible:ring-ring/50',
                className
            )}
            data-tooltip={copied ? 'Copied' : 'Copy'}
            aria-label={ariaLabel || `Copy UUID ${value}`}
        >
            <span ref={textRef} className={cn('min-w-0 select-all font-mono', textClassName)}>
                {value}
            </span>
            <span
                aria-hidden="true"
                className={cn(
                    'text-[10px] font-medium text-muted-foreground opacity-0 transition-opacity group-hover/uuid:opacity-100 group-focus-visible/uuid:opacity-100',
                    copied && 'text-emerald-700 opacity-100 dark:text-emerald-200',
                    hintClassName
                )}
            >
                {copied ? 'Copied' : 'Copy'}
            </span>
            <span className="sr-only" aria-live="polite">{copied ? 'Copied' : ''}</span>
        </span>
    );
};
