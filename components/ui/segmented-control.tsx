import React, { forwardRef } from 'react';

import { cn } from '../../lib/utils';

/**
 * A row of mutually exclusive choices — the "Exact dates / Flexible window",
 * "Sign in / Create account" pill pair.
 *
 * This exists because four files had each hand-rolled the same control with
 * slightly different classes, and every one of them got dark mode wrong in the
 * same way: the active segment took an accent-tinted background but kept a dark
 * accent text colour, so the selected option became dark-on-dark and you could
 * not tell which one was active. Fixing that in four places would have left a
 * fifth copy waiting to be written.
 *
 * The active segment uses the primary at full strength with contrasting ink, so
 * the selection is unmistakable in either theme.
 *
 * Rendered as real radios, not buttons: arrow keys move between options and a
 * screen reader announces both the group and the current selection, which a row
 * of <button>s does not give you.
 */

export interface SegmentedOption<T extends string> {
    value: T;
    label: React.ReactNode;
    /** Announced instead of `label` when the visible label is an icon or glyph. */
    srLabel?: string;
    disabled?: boolean;
}

export interface SegmentedControlProps<T extends string> {
    /** Groups the radios. Must be unique on the page. */
    name: string;
    /** Announced as the group's purpose; visually hidden. */
    label: string;
    value: T;
    options: Array<SegmentedOption<T>>;
    onChange: (value: T) => void;
    size?: 'sm' | 'md';
    className?: string;
    disabled?: boolean;
}

const SIZES = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
} as const;

const SegmentedControlInner = <T extends string>(
    { name, label, value, options, onChange, size = 'sm', className, disabled }: SegmentedControlProps<T>,
    ref: React.ForwardedRef<HTMLDivElement>,
) => (
    <div
        ref={ref}
        role="radiogroup"
        aria-label={label}
        className={cn('inline-flex rounded-xl border border-border bg-card p-1', className)}
    >
        {options.map((option) => {
            const checked = option.value === value;
            const isDisabled = disabled || option.disabled;
            return (
                <label
                    key={option.value}
                    className={cn(
                        'relative cursor-pointer rounded-lg font-semibold transition-colors select-none',
                        SIZES[size],
                        checked
                            // Full-strength primary with contrasting ink. The accent
                            // inverts between themes, so the ink has to as well.
                            ? 'bg-accent-600 text-white dark:bg-accent-400 dark:text-background'
                            : 'text-muted-foreground hover:text-foreground',
                        isDisabled && 'pointer-events-none opacity-50',
                        'focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1',
                    )}
                >
                    <input
                        type="radio"
                        name={name}
                        value={option.value}
                        checked={checked}
                        disabled={isDisabled}
                        onChange={() => onChange(option.value)}
                        className="sr-only"
                    />
                    {option.srLabel ? <span className="sr-only">{option.srLabel}</span> : null}
                    <span aria-hidden={option.srLabel ? true : undefined}>{option.label}</span>
                </label>
            );
        })}
    </div>
);

/**
 * forwardRef because the app renders through preact/compat, where a plain
 * function component never receives `ref` — anything a parent may want to focus
 * or measure has to forward explicitly.
 */
export const SegmentedControl = forwardRef(SegmentedControlInner) as <T extends string>(
    props: SegmentedControlProps<T> & { ref?: React.ForwardedRef<HTMLDivElement> },
) => ReturnType<typeof SegmentedControlInner>;
