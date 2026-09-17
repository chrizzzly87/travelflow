import * as React from 'react';
import { CaretDown, CaretUp } from '@phosphor-icons/react';

import { cn } from '../../lib/utils';
import { AnimatedNumber } from './animated-number';
import { Input, type InputProps } from './input';

const parseNumericValue = (value: number | string | null | undefined): number | null => {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null;
    }
    if (typeof value !== 'string') return null;

    const trimmed = value.trim();
    if (!trimmed) return null;

    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
};

export interface NumberInputProps extends Omit<InputProps, 'type' | 'value' | 'defaultValue'> {
    value?: number | string | null;
    defaultValue?: number | string;
    locales?: Intl.LocalesArgument;
    format?: React.ComponentProps<typeof AnimatedNumber>['format'];
    prefix?: string;
    suffix?: string;
    animated?: boolean;
    overlayClassName?: string;
    /**
     * Show increment/decrement buttons at the inline end. The native spinners
     * are suppressed by this component, so without this the value can only be
     * typed. Off by default so existing call sites are unchanged.
     */
    steppers?: boolean;
}

interface UseNumberStepperOptions {
    forwardedRef: React.ForwardedRef<HTMLInputElement>;
    value: number | string | null | undefined;
    step: NumberInputProps['step'];
    min: NumberInputProps['min'];
    max: NumberInputProps['max'];
    disabled?: boolean;
}

/** Bounds, the merged ref, and the write that makes a step look like a keystroke. */
const useNumberStepper = ({ forwardedRef, value, step, min, max, disabled }: UseNumberStepperOptions) => {
    const inputRef = React.useRef<HTMLInputElement | null>(null);

    const attachRef = React.useCallback((node: HTMLInputElement | null) => {
        inputRef.current = node;
        if (typeof forwardedRef === 'function') forwardedRef(node);
        else if (forwardedRef) forwardedRef.current = node;
    }, [forwardedRef]);

    const stepSize = Number(step) || 1;
    const minValue = min !== undefined ? Number(min) : Number.NEGATIVE_INFINITY;
    const maxValue = max !== undefined ? Number(max) : Number.POSITIVE_INFINITY;
    const currentValue = parseNumericValue(value) ?? 0;

    const stepBy = React.useCallback((direction: 1 | -1) => {
        const node = inputRef.current;
        if (!node) return;
        const from = parseNumericValue(node.value) ?? parseNumericValue(value) ?? 0;
        const next = Math.min(maxValue, Math.max(minValue, from + (direction * stepSize)));
        if (next === from) return;

        // Write through the prototype setter, not `node.value`. React patches
        // the instance setter to track the last value it rendered; a direct
        // assignment updates that tracker too, so the input event that follows
        // looks like a no-op and onChange never runs. Going via the prototype
        // leaves the tracker stale, which is what makes React treat this as a
        // real edit. The app runs on preact, the tests on React — this keeps
        // both honest.
        const nativeSetter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype,
            'value',
        )?.set;
        if (nativeSetter) nativeSetter.call(node, String(next));
        else node.value = String(next);

        node.dispatchEvent(new Event('input', { bubbles: true }));
    }, [maxValue, minValue, stepSize, value]);

    return {
        attachRef,
        stepBy,
        canIncrease: !disabled && currentValue < maxValue,
        canDecrease: !disabled && currentValue > minValue,
    };
};

const STEPPER_BUTTON_CLASS =
    'flex flex-1 items-center justify-center text-slate-500 transition-colors '
    + 'hover:bg-slate-100 hover:text-slate-900 disabled:pointer-events-none disabled:opacity-40';

/**
 * The increment/decrement column. `tabIndex={-1}` keeps them out of the tab
 * order: the field itself is the keyboard affordance, and Up/Down already work
 * there natively.
 */
const NumberInputSteppers: React.FC<{
    onStep: (direction: 1 | -1) => void;
    canIncrease: boolean;
    canDecrease: boolean;
}> = ({ onStep, canIncrease, canDecrease }) => (
    <div className="absolute inset-y-px end-px flex w-8 flex-col overflow-hidden rounded-e-md border-s border-slate-200">
        <button
            type="button"
            tabIndex={-1}
            aria-label="Increase"
            disabled={!canIncrease}
            onClick={() => onStep(1)}
            className={STEPPER_BUTTON_CLASS}
        >
            <CaretUp weight="bold" className="size-3" />
        </button>
        <button
            type="button"
            tabIndex={-1}
            aria-label="Decrease"
            disabled={!canDecrease}
            onClick={() => onStep(-1)}
            className={cn(STEPPER_BUTTON_CLASS, 'border-t border-slate-200')}
        >
            <CaretDown weight="bold" className="size-3" />
        </button>
    </div>
);

export const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
    (
        {
            animated = true,
            className,
            defaultValue,
            format,
            locales,
            onBlur,
            onFocus,
            overlayClassName,
            prefix,
            steppers = false,
            suffix,
            value,
            ...props
        },
        ref,
    ) => {
        const [isFocused, setIsFocused] = React.useState(false);
        const { attachRef, stepBy, canIncrease, canDecrease } = useNumberStepper({
            forwardedRef: ref,
            value,
            step: props.step,
            min: props.min,
            max: props.max,
            disabled: props.disabled,
        });
        const numericValue = React.useMemo(
            () => parseNumericValue(value),
            [value],
        );
        const hasControlledValue = value !== undefined;
        const showAnimatedValue = animated && hasControlledValue && !isFocused && numericValue !== null;

        return (
            <div className="relative">
                <Input
                    {...props}
                    ref={attachRef}
                    type="number"
                    inputMode={props.inputMode ?? 'decimal'}
                    value={value ?? undefined}
                    defaultValue={defaultValue}
                    onFocus={(event) => {
                        setIsFocused(true);
                        onFocus?.(event);
                    }}
                    onBlur={(event) => {
                        setIsFocused(false);
                        onBlur?.(event);
                    }}
                    className={cn(
                        '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
                        showAnimatedValue && 'text-transparent caret-slate-900',
                        steppers && 'pe-9',
                        className,
                    )}
                />
                {steppers && (
                    <NumberInputSteppers onStep={stepBy} canIncrease={canIncrease} canDecrease={canDecrease} />
                )}
                {showAnimatedValue && (
                    <div
                        aria-hidden="true"
                        className={cn(
                            'pointer-events-none absolute inset-y-0 start-0 flex w-full items-center ps-3 pe-3 text-sm text-slate-900',
                            steppers && 'pe-9',
                            props.disabled && 'opacity-50',
                            overlayClassName,
                        )}
                    >
                        <AnimatedNumber
                            value={numericValue}
                            locales={locales}
                            format={format}
                            prefix={prefix}
                            suffix={suffix}
                        />
                    </div>
                )}
            </div>
        );
    },
);

NumberInput.displayName = 'NumberInput';
