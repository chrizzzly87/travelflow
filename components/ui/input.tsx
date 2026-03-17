import * as React from 'react';

import { cn } from '../../lib/utils';

export type InputProps = React.ComponentPropsWithoutRef<'input'>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className, type, ...props }, ref) => (
        <input
            ref={ref}
            type={type}
            data-slot="input"
            className={cn(
                'flex h-10 w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition-[border-color,box-shadow,color]',
                'placeholder:text-slate-500 selection:bg-accent-100 selection:text-slate-900',
                'focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-0',
                'disabled:cursor-not-allowed disabled:opacity-50',
                'aria-invalid:border-red-300 aria-invalid:ring-2 aria-invalid:ring-red-200',
                'file:border-0 file:bg-transparent file:text-sm file:font-medium',
                className,
            )}
            {...props}
        />
    ),
);

Input.displayName = 'Input';
