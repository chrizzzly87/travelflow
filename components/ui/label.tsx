import * as React from 'react';
import { Label as LabelPrimitive } from 'radix-ui';

import { cn } from '@/lib/utils';

/**
 * The shadcn label primitive. Use it for controls that own a real form
 * element (input, textarea, number input).
 *
 * Do NOT wrap a Radix trigger — a Switch, a Select trigger, a button — in a
 * label. The label forwards its click to the control, and the control already
 * received the click, so the value toggles twice. Render a plain `<span>`
 * caption for those; `SettingsRow` in `settings-panel.tsx` does that for you.
 */
const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    data-slot="label"
    className={cn(
      'flex items-center gap-2 text-sm leading-none font-medium text-slate-900 select-none',
      'group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50',
      'peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
      className,
    )}
    {...props}
  />
));
Label.displayName = 'Label';

export { Label };
