import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

// tailwind-merge 3 does not know Tailwind v4's `max-h-none`, so it kept a
// component's default cap next to a caller's `max-h-none` and the cap won.
const twMerge = extendTailwindMerge({
  extend: { classGroups: { "max-h": [{ "max-h": ["none"] }] } },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
