import NumberFlow, {
    NumberFlowGroup,
    type NumberFlowElement,
    type NumberFlowProps,
} from '@number-flow/react';
import * as React from 'react';

import { cn } from '../../lib/utils';
import { formatAnimatedNumberText } from './animatedNumberFormat';
import { useHydrated } from '../../hooks/useHydrated';

export interface AnimatedNumberProps extends Omit<NumberFlowProps, 'value' | 'format' | 'locales'> {
    value: number | null | undefined;
    locales?: Intl.LocalesArgument;
    format?: NumberFlowProps['format'];
    fallback?: React.ReactNode;
}

export const AnimatedNumber = React.forwardRef<NumberFlowElement, AnimatedNumberProps>(
    ({ className, value, fallback = null, format, locales, prefix, suffix, ...props }, ref) => {
        const hydrated = useHydrated();
        const canAnimate = hydrated && typeof customElements !== 'undefined' && Boolean(customElements.get('number-flow-react'));
        if (value === null || value === undefined || !Number.isFinite(value)) {
            if (fallback === null) return null;
            return (
                <span className={cn('tabular-nums [font-variant-numeric:tabular-nums]', className)}>
                    {fallback}
                </span>
            );
        }

        // SSR and the hydration render share readable text. Enhance only when
        // the platform has registered the animation element; unsupported hosts
        // keep fully functional number updates without a runtime-specific branch.
        if (!canAnimate) return <span className={cn('tabular-nums [font-variant-numeric:tabular-nums]', className)}>
            {formatAnimatedNumberText(value, { locales, format, prefix, suffix })}
        </span>;

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
