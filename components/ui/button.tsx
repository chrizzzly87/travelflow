import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"
import { Kbd } from "@/components/ui/kbd"

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-all outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40",
        outline:
          "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost:
          "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",
        // Segmented/pressed controls: quiet until `aria-pressed="true"`, then filled.
        // Always pass `aria-pressed` so the selected state is announced, not just painted.
        // Tinted accent action, quieter than `default` (e.g. "Ask AI", "Add activity").
        soft:
          "border border-accent-200 bg-accent-50 text-accent-700 hover:bg-accent-100 hover:text-accent-800 dark:border-accent-400/30 dark:bg-accent-400/12 dark:text-accent-200 dark:hover:bg-accent-400/20 dark:hover:text-accent-100",
        // Controls that float over the map: opaque card fill (outline's dark fill
        // is translucent), pressed = primary fill, expanded = soft accent.
        floating:
          "border border-border bg-card text-muted-foreground shadow-md hover:bg-secondary hover:text-accent-600 dark:shadow-none dark:hover:text-accent-300 aria-pressed:border-transparent aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:hover:bg-primary/90 aria-pressed:hover:text-primary-foreground aria-expanded:border-accent-300 aria-expanded:bg-accent-50 aria-expanded:text-accent-600 dark:aria-expanded:border-accent-400/30 dark:aria-expanded:bg-accent-400/12 dark:aria-expanded:text-accent-300",
        toggle:
          "text-muted-foreground hover:bg-secondary hover:text-foreground aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:hover:bg-primary/90 aria-pressed:hover:text-primary-foreground",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        xs: "h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-xs": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    /**
     * Visible shortcut hint, e.g. "⌘⇧P". Rendered as a trailing <Kbd>; pair it
     * with `aria-keyshortcuts` (e.g. "Meta+Shift+P") so assistive tech gets the
     * chord too. Ignored with `asChild`, whose Slot takes exactly one child.
     */
    shortcut?: React.ReactNode
  }

// forwardRef, not a ref-in-props function component: the app renders through
// preact/compat, which does not pass `ref` to a plain function component, so
// Radix `asChild` triggers would hand their popper an empty anchor.
const Button = React.forwardRef(function Button(
  { className, variant = "default", size = "default", asChild = false, shortcut, children, ...props }: ButtonProps,
  ref: React.Ref<HTMLButtonElement>
) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      ref={ref}
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      {asChild || !shortcut ? children : (
        <>
          {children}
          <Kbd className="ms-0.5">{shortcut}</Kbd>
        </>
      )}
    </Comp>
  )
})

export { Button, buttonVariants }
