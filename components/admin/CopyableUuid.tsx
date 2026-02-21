import React, { useEffect, useRef, useState } from 'react';

const mergeClasses = (...classes: Array<string | undefined | null | false>) => classes.filter(Boolean).join(' ');

const copyToClipboard = async (value: string): Promise<boolean> => {
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
        const didCopy = await copyToClipboard(value);
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
                    void handleCopy(event);
                }
            }}
            className={mergeClasses(
                'group inline-flex max-w-full cursor-copy items-center gap-1 rounded px-1 text-left outline-none',
                'hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-accent-300',
                className
            )}
            title={copied ? 'Copied' : 'Click to select and copy UUID'}
            aria-label={ariaLabel || `Copy UUID ${value}`}
        >
            <span ref={textRef} className={mergeClasses('select-all font-mono', textClassName)}>
                {value}
            </span>
            <span
                aria-hidden="true"
                className={mergeClasses(
                    'text-[10px] font-semibold text-slate-500 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100',
                    copied && 'opacity-100 text-emerald-700',
                    hintClassName
                )}
            >
                {copied ? 'Copied' : 'Copy'}
            </span>
        </span>
    );
};
