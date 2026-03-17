import NumberFlow, {
    NumberFlowGroup,
    type NumberFlowElement,
    type NumberFlowProps,
} from '@number-flow/react';
import * as React from 'react';

import { cn } from '../../lib/utils';

export interface AnimatedNumberProps extends Omit<NumberFlowProps, 'value' | 'format' | 'locales'> {
    value: number | null | undefined;
    locales?: Intl.LocalesArgument;
    format?: NumberFlowProps['format'];
    fallback?: React.ReactNode;
}

export const AnimatedNumber = React.forwardRef<NumberFlowElement, AnimatedNumberProps>(
    ({ className, value, fallback = null, format, locales, prefix, suffix, ...props }, ref) => {
        if (value === null || value === undefined || !Number.isFinite(value)) {
            if (fallback === null) return null;
            return (
                <span className={cn('tabular-nums [font-variant-numeric:tabular-nums]', className)}>
                    {fallback}
                </span>
            );
        }

        if (typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent)) {
            const formatter = new Intl.NumberFormat(locales, format);
            return (
                <span className={cn('tabular-nums [font-variant-numeric:tabular-nums]', className)}>
                    {`${prefix ?? ''}${formatter.format(value)}${suffix ?? ''}`}
                </span>
            );
        }

        return (
            <NumberFlow
                ref={ref}
                value={value}
                format={format}
                locales={locales}
                prefix={prefix}
                suffix={suffix}
                className={cn('tabular-nums [font-variant-numeric:tabular-nums]', className)}
                {...props}
            />
        );
    },
);

AnimatedNumber.displayName = 'AnimatedNumber';

export { NumberFlowGroup as AnimatedNumberGroup };
