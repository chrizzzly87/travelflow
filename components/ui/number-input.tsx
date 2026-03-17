import * as React from 'react';

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
}

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
            suffix,
            value,
            ...props
        },
        ref,
    ) => {
        const [isFocused, setIsFocused] = React.useState(false);
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
                    ref={ref}
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
                        className,
                    )}
                />
                {showAnimatedValue && (
                    <div
                        aria-hidden="true"
                        className={cn(
                            'pointer-events-none absolute inset-y-0 start-0 flex w-full items-center px-3 text-sm text-slate-900',
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
