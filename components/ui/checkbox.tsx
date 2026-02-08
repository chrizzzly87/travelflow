import * as React from 'react';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { Check } from 'lucide-react';

const mergeClasses = (...classes: Array<string | undefined | null | false>) => classes.filter(Boolean).join(' ');

export type CheckboxProps = React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>;

export const Checkbox = React.forwardRef<React.ElementRef<typeof CheckboxPrimitive.Root>, CheckboxProps>(
    ({ className, ...props }, ref) => (
        <CheckboxPrimitive.Root
            ref={ref}
            className={mergeClasses(
                'peer h-4 w-4 shrink-0 rounded-[4px] border border-gray-300 bg-white shadow-sm outline-none transition-colors',
                'data-[state=checked]:border-accent-500 data-[state=checked]:bg-accent-500',
                'focus-visible:ring-2 focus-visible:ring-accent-300 focus-visible:ring-offset-2',
                'disabled:cursor-not-allowed disabled:opacity-50',
                className
            )}
            {...props}
        >
            <CheckboxPrimitive.Indicator className="flex items-center justify-center text-white">
                <Check className="h-3.5 w-3.5 stroke-[3]" />
            </CheckboxPrimitive.Indicator>
        </CheckboxPrimitive.Root>
    )
);

Checkbox.displayName = CheckboxPrimitive.Root.displayName;
