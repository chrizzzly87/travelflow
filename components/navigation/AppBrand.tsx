import React from 'react';

import { APP_NAME } from '../../config/appGlobals';
import { cn } from '../../lib/utils';

interface AppBrandProps {
    className?: string;
    frameClassName?: string;
    imageClassName?: string;
    wordmarkClassName?: string;
}

export const AppBrand: React.FC<AppBrandProps> = ({
    className,
    frameClassName,
    imageClassName,
    wordmarkClassName,
}) => (
    <span className={cn('flex items-center gap-1.5', className)}>
        <span
            className={cn(
                'flex h-9 w-9 items-center justify-center rounded-[0.625rem]',
                frameClassName,
            )}
        >
            <img src="/favicon.svg" alt="" className={cn('h-5 w-5', imageClassName)} />
        </span>
        <span className={cn('text-lg font-extrabold tracking-tight text-slate-900', wordmarkClassName)}>
            {APP_NAME}
        </span>
    </span>
);
