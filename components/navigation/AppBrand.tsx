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
    <span className={cn('flex items-center gap-2', className)}>
        <span
            className={cn(
                'flex h-8 w-8 items-center justify-center rounded-lg',
                frameClassName,
            )}
        >
            <img src="/favicon.svg" alt="" className={cn('h-7 w-7', imageClassName)} />
        </span>
        <span className={cn('text-lg font-extrabold tracking-tight text-slate-900', wordmarkClassName)}>
            {APP_NAME}
        </span>
    </span>
);
