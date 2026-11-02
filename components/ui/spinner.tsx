import * as React from 'react';
import { SpinnerGap } from '@phosphor-icons/react';

import { cn } from '@/lib/utils';

/** The one loading glyph. Phosphor `SpinnerGap`, matching the rest of the icon set. */
function Spinner({ className, ...props }: React.ComponentProps<typeof SpinnerGap>) {
  return <SpinnerGap aria-hidden="true" className={cn('size-4 animate-spin motion-reduce:animate-none', className)} {...props} />;
}

export { Spinner };
