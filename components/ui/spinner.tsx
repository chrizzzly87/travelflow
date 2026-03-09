import * as React from 'react';
import { Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';

function Spinner({ className, ...props }: React.ComponentProps<typeof Loader2>) {
  return <Loader2 className={cn('h-4 w-4 animate-spin', className)} {...props} />;
}

export { Spinner };
