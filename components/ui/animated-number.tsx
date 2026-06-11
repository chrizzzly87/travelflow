import NumberFlow, {
    NumberFlowGroup,
    type NumberFlowElement,
    type NumberFlowProps,
} from '@number-flow/react';
import * as React from 'react';

import { cn } from '../../lib/utils';

type ReactModuleLike = {
    createElement?: (type: unknown, props?: unknown, ...children: unknown[]) => unknown;
};

export interface AnimatedNumberTextOptions {
    locales?: Intl.LocalesArgument;
    format?: NumberFlowProps['format'];
    prefix?: string;
    suffix?: string;
}

export const isPreactCompatReactModule = (reactModule: ReactModuleLike): boolean => {
    try {
        const element = reactModule.createElement?.('span', null);
        return Boolean(
            element
            && typeof element === 'object'
            && (
                '__k' in element
                || '__v' in element
                || '__e' in element
            ),
        );
    } catch {
        return false;
    }
};

export const formatAnimatedNumberText = (
    value: number,
    { locales, format, prefix, suffix }: AnimatedNumberTextOptions = {},
): string => {
    const formatter = new Intl.NumberFormat(locales, format);
    return `${prefix ?? ''}${formatter.format(value)}${suffix ?? ''}`;
};

export interface AnimatedNumberProps extends Omit<NumberFlowProps, 'value' | 'format' | 'locales'> {
    value: number | null | undefined;
    locales?: Intl.LocalesArgument;
    format?: NumberFlowProps['format'];
    fallback?: React.ReactNode;
}

const shouldRenderStaticNumber = (): boolean => (
    isPreactCompatReactModule(React)
    || (typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent))
);

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

        if (shouldRenderStaticNumber()) {
            return (
                <span className={cn('tabular-nums [font-variant-numeric:tabular-nums]', className)}>
                    {formatAnimatedNumberText(value, { locales, format, prefix, suffix })}
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
