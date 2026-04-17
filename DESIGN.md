# TravelFlow Design System

This file is the practical design source of truth for new product UI. It exists to keep the app sharp, calm, and intentional instead of drifting into generic AI gradients, purple glows, and over-explained card piles.

## Core Principles
- No decorative gradients as generic filler. Gradients are banned for standard page backgrounds, hero panels, cards, and modal chrome.
- No AI-purple default styling. TravelFlow accents should feel grounded, useful, and product-led rather than synthetic.
- Prefer quiet, solid surfaces with strong typography, spacing, and hierarchy over glossy effects.
- Use color to signal meaning, not to decorate everything.
- Keep helper copy short. Working surfaces should open directly into the tool, not into a paragraph.

## Typography
- Heading font: `Bricolage Grotesque`
- Secondary/display support: `Space Grotesk`
- Body font: system sans stack via `--tf-font-body`
- Headings should feel compact and editorial:
  - display: `text-3xl` to `text-5xl`, `tracking-tight`, `font-black` or `font-bold`
  - section title: `text-lg` to `text-2xl`, `font-bold`
  - eyebrow: uppercase, `text-[11px]`, high tracking
- Body copy should stay readable and restrained:
  - default body: `text-sm` to `text-base`
  - line height: `leading-6` or `leading-7`
  - max width for long text: about `60ch` to `68ch`

## Color
### Product accent
- Accent palette is teal-led, not indigo-led.
- Primary interactive accent:
  - `--tf-accent-50`: `#eef7f4`
  - `--tf-accent-100`: `#d8ece5`
  - `--tf-accent-200`: `#b5d7ca`
  - `--tf-accent-300`: `#8ac0ad`
  - `--tf-accent-400`: `#609b87`
  - `--tf-accent-500`: `#477a69`
  - `--tf-accent-600`: `#365f52`
  - `--tf-accent-700`: `#2b4c42`
  - `--tf-accent-800`: `#243d36`
  - `--tf-accent-900`: `#20342f`
  - `--tf-accent-950`: `#0f1c19`
- Use accent color for:
  - primary buttons
  - active pills and selected states
  - focus outlines
  - links that need emphasis

### Surface palette
- Default app canvas: neutral and bright
- Trip-prep/workspace canvas: warm paper-like neutrals
  - canvas: `#f4efe7`
  - raised card: `#fffdf9`
  - muted card: `#f7f2ea`
- Border palette:
  - default border: `stone-200` / `slate-200`
  - stronger dividers: `stone-300`

### Semantic accents
- Warning: amber range
- Success/verified: emerald range
- Info/utility: use muted neutrals first, accent only when action is needed
- Avoid mixing multiple saturated accents inside one section

## Spacing
- Use a stable spacing rhythm based on `4`, `6`, `8`, `12`, `16`, `24`, `32`
- Card padding:
  - small cards: `p-4`
  - standard cards: `p-5` to `p-6`
  - page hero/shell cards: `p-6` to `p-8`
- Section gaps:
  - stacked sections: `gap-4` to `gap-6`
  - page-level bands: `gap-6` to `gap-8`
- Do not compress supporting tools into tiny gutters just to fit more on screen. Let the layout breathe.

## Radius
- Global radius token remains `--radius: 0.625rem`
- Actual UI usage should cluster around:
  - input/button: `rounded-md` to `rounded-lg`
  - cards: `rounded-[1.25rem]` to `rounded-[2rem]`
  - large workspace shells: `rounded-[2rem]` to `rounded-[2.25rem]`
- Avoid mixing too many radius values within the same surface

## Borders
- Borders do most of the structural work
- Standard card border: `border border-stone-200` or `border-slate-200`
- Muted sections can use `border-stone-200/80`
- Prefer full borders, dividers, and subtle section bands over loud colored outlines
- Avoid thick one-sided borders as decoration

## Controls
- Primary actions:
  - solid accent fill
  - white text
  - rounded `md` or `lg`
  - no gradient fills
- Secondary actions:
  - white or warm-neutral background
  - stone border
  - stone text
  - hover by shifting background one step warmer, not by adding glow
- Pills and chips:
  - default to neutral outlined pills
  - use accent-filled pills only for active state or true emphasis
- Inputs and selects:
  - use calm white or warm-neutral surfaces
  - rely on border, label, and spacing for hierarchy
  - never style form controls like marketing banners

## Shadows
- Shadows should be soft, broad, and low-contrast
- Preferred shadow profile:
  - `shadow-[0_20px_45px_-28px_rgba(37,32,26,0.25)]`
  - `shadow-[0_14px_30px_-24px_rgba(37,32,26,0.2)]`
- Do not use large colored glow shadows for standard UI
- If a shadow reads as “marketing chrome” instead of hierarchy, remove it

## Layout
- Default page containers:
  - `max-w-[1400px]` to `max-w-[1520px]`
  - centered with `mx-auto`
  - horizontal padding `px-4`, `sm:px-6`, `lg:px-8`
- Use grid layouts for multi-panel workspaces
- Prefer one main content column plus one supporting rail over three equally weighted columns
- Keep mobile collapse strict and single-column

## Navigation
- Top navigation should stay compact and structural, not decorative
- Workspace switching belongs in a dedicated segmented bar or compact menu directly inside the tool
- Side rails should carry:
  - secondary navigation
  - utilities
  - warnings
  - source links
- Do not overload the global header with deep workflow controls when a workspace bar or side rail can hold them more clearly

## Motion
- Motion should be minimal and purposeful
- Allowed:
  - state fades
  - small translate/scale on button press
  - subtle stagger on larger page mounts
- Avoid:
  - floating gradient blobs
  - perpetual shimmer as decoration
  - oversized glassmorphism effects

## Modal Rules
- Modals are for short actions, metadata, or confirmations
- Do not place large multi-section operating surfaces inside a modal when the user needs to read, compare, or act across sections
- Modal chrome should stay neutral and paper-like:
  - warm background
  - clear header divider
  - no gradient header fills
  - no oversized drop shadows
- If content has:
  - navigation
  - multiple chapters
  - a working checklist
  - repeated source references
  - route-specific context
  then it belongs in a dedicated workspace page, not in the modal

## Trip Workspace Rules
- Planner remains the primary route-building canvas
- Secondary support tools should live as dedicated workspace pages, switched from a compact in-tool nav
- Companion pages should feel denser and calmer than marketing pages:
  - solid backgrounds
  - neutral cards
  - no gradient heroes
  - trimmed helper copy
- Route context should always stay visible on support pages so they feel tied to the itinerary
- Recommended structure for support pages:
  - compact workspace nav under the trip header
  - one main content column
  - one sticky support rail for warnings, utilities, and source links
  - clear section cards with minimal intro copy

## Anti-Slop Checklist
- No gradient hero unless the feature genuinely needs one
- No purple-blue default accent fallback
- No card-on-card-on-card nesting without hierarchy
- No repeated helper paragraphs above every section
- No giant empty marketing headlines inside utility pages
- No decorative glass, glow, or abstract blobs in tool workflows
