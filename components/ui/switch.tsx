import * as React from 'react';
import * as SwitchPrimitive from '@radix-ui/react-switch';

const mergeClasses = (...classes: Array<string | undefined | null | false>) => classes.filter(Boolean).join(' ');

export type SwitchProps = React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>;

export const Switch = React.forwardRef<React.ElementRef<typeof SwitchPrimitive.Root>, SwitchProps>(
    ({ className, ...props }, ref) => (
        <SwitchPrimitive.Root
            ref={ref}
            className={mergeClasses(
                'peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-transparent bg-slate-300 transition-colors',
                'data-[state=checked]:bg-accent-600 data-[state=unchecked]:bg-slate-300',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-300 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
                'disabled:cursor-not-allowed disabled:opacity-50',
                className
            )}
            {...props}
        >
            <SwitchPrimitive.Thumb
                className={mergeClasses(
                    'pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform',
                    'data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0'
                )}
            />
        </SwitchPrimitive.Root>
    )
);

Switch.displayName = SwitchPrimitive.Root.displayName;
