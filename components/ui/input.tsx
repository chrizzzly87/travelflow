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
                // ps-3/pe-3 rather than px-3: tailwind-merge does not treat px as conflicting
                // with ps, so a caller's `ps-9` for a leading icon lost to px-3 and the
                // icon sat on top of the text.
                'flex h-10 w-full min-w-0 rounded-md border border-border bg-card ps-3 pe-3 py-2 text-sm text-foreground shadow-sm outline-none transition-[border-color,box-shadow,color] dark:shadow-none',
                'placeholder:text-muted-foreground selection:bg-accent-100 selection:text-foreground dark:selection:bg-accent-400/12',
                'focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-0',
                'disabled:cursor-not-allowed disabled:opacity-50',
                'aria-invalid:border-red-300 aria-invalid:ring-2 aria-invalid:ring-red-200 dark:aria-invalid:border-red-400/30',
                'file:border-0 file:bg-transparent file:text-sm file:font-medium',
                className,
            )}
            {...props}
        />
    ),
);

Input.displayName = 'Input';
