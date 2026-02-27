# TravelFlow Brand And UI Guidelines

Use this file as the source of truth for new UI components, banners, and marketing-facing in-app surfaces.

## Brand Naming
- Product name is `TravelFlow` (single word, capital `T` + `F`).
- Do not introduce alternative product spellings in UI copy.

## Color System
- Accent color must use existing tokens from `index.css` (`--tf-accent-*` / `accent-*` classes).
- Primary actions use `accent-600` background with `accent-700` hover.
- Secondary actions use white/neutral backgrounds with `accent-200` borders and `accent-700` text.
- Avoid adding one-off hex values when an existing accent token is available.

## Icon Rules
- Preferred icon family: `@phosphor-icons/react`.
- Use `weight="duotone"` for feature communication surfaces (banners, notices, CTA buttons).
- Keep icon proportions natural; do not squash/stretch icons with mismatched width/height containers.
- Icon-only buttons must include `aria-label` and should expose a tooltip on desktop.

## Component Rules
- Preferred component patterns: `shadcn` style primitives in `components/ui` and matching utility classes.
- Button radius: `rounded-md` for CTA controls unless an existing component already defines another radius.
- Banner cards: subtle border, soft blur background, clear visual hierarchy (eyebrow, headline, support text, CTA row).
- In floating banners and cards with multiple CTAs, right-align actions (`justify-end`) unless a page pattern explicitly differs.

## Toast Rules
- All product toasts must route through `showAppToast(...)` in `components/ui/appToast.tsx`.
- Do not import `sonner` directly outside `components/ui/appToast.tsx` and `components/ui/sonner.tsx`.
- Toast containers stay subtle: white/glass surface, soft border, colored icon badge, no fully tinted card backgrounds.
- Title must be short and action-oriented; description should contain concrete context (for example trip title/count).
- For destructive flows (archive/remove), use tone `remove` and provide an inline undo action where restoration is possible.
- Use Lucide icons in toast metadata for visual consistency with neutral stroke-based iconography.

## CI Guardrail
- Run `pnpm toasts:validate` (enforced in PR quality + build scripts).
- The validator blocks direct `sonner` imports and direct `toast.success/error/...` calls outside the shared toast layer.

## Section Link Pattern
- For content-section links (for example "Discover more inspirations"), use the shared inline-link visual pattern instead of outlined button styling:
  - `inline-flex items-center gap-1 text-sm font-semibold text-accent-600 transition-colors hover:text-accent-800`
- Keep these links in normal content flow (typically under section content) unless the page already has a different established layout.
- Track section-link interaction via Umami event names (`trackEvent(...)`) following `docs/ANALYTICS_CONVENTION.md`; do not add ad-hoc tracking query parameters when event tracking is already available.

## Accessibility
- Maintain visible keyboard focus (`focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2`).
- Keep text contrast high enough against backgrounds (avoid low-contrast gray-on-gray pairs).
- Add `aria-label` to icon-only controls and ensure semantic button/link usage.
- Ensure touch targets are practical on mobile (target ~40px+ in height for primary controls).

## Mobile Optimization
- Respect safe areas for fixed UI (`env(safe-area-inset-bottom)` for bottom banners).
- Prevent floating surfaces from blocking key interactions; keep copy concise and CTA row compact.
- Validate layout on both narrow mobile and desktop widths before shipping.
