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
        // Hover shifts the fill (indigo-700 light / indigo-300 dark); the label
        // colour never changes, so contrast holds in both themes.
        default: "bg-primary text-primary-foreground hover:bg-primary-hover",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40",
        outline:
          "border bg-background shadow-xs hover:bg-secondary hover:text-secondary-foreground dark:border-input dark:bg-input/30 dark:hover:bg-secondary",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        // Same solid hover surface as every other quiet control. The old
        // `dark:hover:bg-accent/50` was a half-strength grey that made the
        // chat header and "Review again" hover differently from the rest.
        ghost:
          "hover:bg-secondary hover:text-secondary-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        // Tinted accent action, quieter than `default` (e.g. "Ask AI", "Add activity").
        soft:
          "border border-accent-200 bg-accent-50 text-accent-700 hover:bg-accent-100 hover:text-accent-800 dark:border-accent-400/30 dark:bg-accent-400/12 dark:text-accent-200 dark:hover:bg-accent-400/20 dark:hover:text-accent-100",
        // Controls that float over the map: opaque card fill (outline's dark fill
        // is translucent), pressed = primary fill, expanded = soft accent. The
        // accent icon hover only applies while not pressed: on a pressed button it
        // turned the dark icon light indigo on indigo.
        floating:
          "border border-border bg-card text-muted-foreground shadow-md hover:bg-secondary not-aria-pressed:hover:text-accent-600 dark:shadow-none dark:not-aria-pressed:hover:text-accent-300 aria-pressed:border-transparent aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:hover:bg-primary-hover aria-expanded:border-accent-300 aria-expanded:bg-accent-50 aria-expanded:text-accent-600 dark:aria-expanded:border-accent-400/30 dark:aria-expanded:bg-accent-400/12 dark:aria-expanded:text-accent-300",
        // Segmented/pressed controls: quiet until `aria-pressed="true"`, then filled.
        // Always pass `aria-pressed` so the selected state is announced, not just painted.
        toggle:
          "text-muted-foreground not-aria-pressed:hover:bg-secondary not-aria-pressed:hover:text-foreground aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:hover:bg-primary-hover",
        // Social sign-in ("Continue with Google"): opaque card fill with a
        // brand-tinted hover. Pick the tint with `data-provider` so light and
        // dark hovers live together here — the login page once shipped only
        // the light tints and hovered near-white in dark mode.
        social:
          "relative rounded-xl border border-border bg-card font-semibold text-foreground transition-colors hover:bg-secondary data-[last-used=true]:border-slate-400 dark:data-[last-used=true]:border-border " +
          "data-[provider=google]:hover:border-[#ea4335]/40 data-[provider=google]:hover:bg-[#fff7f7] dark:data-[provider=google]:hover:border-[#ea4335]/50 dark:data-[provider=google]:hover:bg-[#ea4335]/12 " +
          "data-[provider=facebook]:hover:border-[#1877f2]/40 data-[provider=facebook]:hover:bg-[#f3f8ff] dark:data-[provider=facebook]:hover:border-[#1877f2]/50 dark:data-[provider=facebook]:hover:bg-[#1877f2]/14 " +
          "data-[provider=kakao]:hover:border-[#FFE812]/60 data-[provider=kakao]:hover:bg-[#fffde6] dark:data-[provider=kakao]:hover:border-[#FFE812]/50 dark:data-[provider=kakao]:hover:bg-[#FFE812]/12",
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
