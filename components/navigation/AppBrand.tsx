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
                'flex h-8 w-8 items-center justify-center rounded-lg bg-accent-600 shadow-lg shadow-accent-200',
                frameClassName,
            )}
        >
            <img src="/favicon.svg" alt="" className={cn('h-[18px] w-[18px]', imageClassName)} />
        </span>
        <span className={cn('text-lg font-extrabold tracking-tight text-slate-900', wordmarkClassName)}>
            {APP_NAME}
        </span>
    </span>
);
