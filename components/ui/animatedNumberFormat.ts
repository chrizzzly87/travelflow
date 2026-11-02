import type { NumberFlowProps } from '@number-flow/react';

export interface AnimatedNumberTextOptions {
    locales?: Intl.LocalesArgument;
    format?: NumberFlowProps['format'];
    prefix?: string;
    suffix?: string;
}

export const formatAnimatedNumberText = (
    value: number,
    { locales, format, prefix, suffix }: AnimatedNumberTextOptions = {},
): string => {
    const formatter = new Intl.NumberFormat(locales, format);
    return `${prefix ?? ''}${formatter.format(value)}${suffix ?? ''}`;
};
