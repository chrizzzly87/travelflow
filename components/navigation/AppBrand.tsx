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
    <span className={cn('flex items-center gap-1', className)}>
        <span
            className={cn(
                'flex h-7 w-7 items-center justify-center rounded-md bg-[#4F46E5]',
                frameClassName,
            )}
        >
            <img src="/brand-plane.svg" alt="" className={cn('h-4 w-4', imageClassName)} />
        </span>
        <span className={cn('text-lg font-extrabold tracking-tight text-slate-900', wordmarkClassName)}>
            {APP_NAME}
        </span>
    </span>
);
