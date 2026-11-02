import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * A keyboard shortcut hint. The border and text follow `currentColor`, so the
 * same hint reads on a filled primary button, a ghost button and plain text in
 * both themes — a fixed `border-white/30` vanished on dark mode's light fill.
 */
function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "pointer-events-none inline-flex h-4 min-w-4 select-none items-center justify-center rounded border border-current/35 px-1 font-sans text-[10px] font-medium leading-none tracking-normal opacity-80",
        className
      )}
      {...props}
    />
  )
}

export { Kbd }
