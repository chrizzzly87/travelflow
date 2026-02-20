import React from 'react';
import { flagCodeToEmoji } from '../../utils/flagUtils';

type FlagIconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

interface FlagIconProps {
    code?: string | null;
    value?: string | null;
    size?: FlagIconSize;
    className?: string;
    square?: boolean;
    rounded?: boolean;
    fallback?: React.ReactNode;
    label?: string;
}

const SIZE_CLASS_MAP: Record<FlagIconSize, string> = {
    xs: 'text-[10px]',
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
    xl: 'text-xl',
    '2xl': 'text-2xl',
};

export const FlagIcon: React.FC<FlagIconProps> = ({
    code,
    value,
    size = 'md',
    className = '',
    square = false,
    rounded = true,
    fallback = '🌍',
    label,
}) => {
    const emojiFlag = flagCodeToEmoji(code || value);
    const baseClassName = [SIZE_CLASS_MAP[size], 'inline-block shrink-0 align-middle leading-none', className]
        .filter(Boolean)
        .join(' ')
        .trim();

    if (!emojiFlag) {
        if (!fallback) return null;
        return (
            <span
                className={baseClassName}
                role={label ? 'img' : undefined}
                aria-label={label}
                aria-hidden={label ? undefined : true}
            >
                {fallback}
            </span>
        );
    }

    return (
        <span
            className={[
                baseClassName,
                square ? 'inline-flex h-[1.05em] w-[1.05em] items-center justify-center' : '',
                rounded ? 'rounded-[2px]' : '',
            ].filter(Boolean).join(' ')}
            role={label ? 'img' : undefined}
            aria-label={label}
            aria-hidden={label ? undefined : true}
        >
            {emojiFlag}
        </span>
    );
};
