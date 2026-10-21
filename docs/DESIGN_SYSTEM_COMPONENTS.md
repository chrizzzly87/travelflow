# Shared UI Components (LLM Reference)

The catalogue of shared components in `components/ui/`. Read this **before** hand-rolling a
wrapper, a caption, a settings row or a panel: nearly every layout an admin or product page
needs is already here, and a one-off `<div>` version drifts from `docs/DESIGN.md` within a
release.

- Visual contract for admin surfaces: `docs/DESIGN.md`.
- Brand and marketing styling: `docs/BRAND_CI_GUIDELINES.md`.
- Live examples you can click: **`/admin/design-system-playground`** (linked from the admin nav
  under Tools). Its "Settings Panels", "Inputs + Textareas" and "Dialogs + Drawers + Modals"
  tabs cover everything below.
- `/admin/component-playground` also exists but is **deliberately unlisted** — it sets
  `noindex,nofollow,noarchive` and a test asserts it stays out of the admin nav. Reach it by
  URL; do not add it to `adminNavConfig.ts`.

## Rules that apply to everything in `components/ui/`

1. **The app renders through `preact/compat`.** A plain function component never receives
   `ref`. Anything used with Radix `asChild`, or focused/measured by a library, must be a real
   `forwardRef`. Symptoms of getting this wrong: `getBoundingClientRect is not a function`,
   `focus is not a function`, a popover anchored at the page origin.
2. **Icons follow the surface.** Admin and product chrome use `@phosphor-icons/react`
   (`CaretDown`, `CaretUpDown`, `Check`, `MagnifyingGlass`). Do not introduce a second icon
   family into a component that already uses one — two chevron shapes on one panel is the
   most common review comment on this repo.
3. **Prefer logical padding on inputs.** `components/ui/input.tsx` uses `ps-3 pe-3`, not
   `px-3`: tailwind-merge does not treat `px` as conflicting with `ps`, so a caller passing
   `ps-9` to clear a leading icon lost to the base `px-3` and the icon sat on the text. For the
   same reason, position a leading icon with `start-3` — `inset-inline-start-3` is **not** a
   Tailwind utility and silently resolves to `0`.
4. **Never wrap a Radix trigger in a `<label>`.** A `Switch`, a `SelectTrigger` and a plain
   button all handle their own click. A surrounding label forwards a second one, so the value
   toggles twice. Caption those with a `<span>`; `SettingsRow` does it for you.
5. **Radii and heights come from `docs/DESIGN.md`**: `rounded-md` for controls, `rounded-lg`
   for panels, 36–40px control height. Avoid `rounded-2xl` on internal tooling.
6. **Use logical properties** (`ps-*`, `pe-*`, `ms-*`, `me-*`, and `start-*`/`end-*` for
   insets) wherever direction may change.
7. **Tooltips are `data-tooltip`, not Radix Tooltip.** Radix `Tooltip` never opens under
   `preact/compat`: the trigger's `data-state` stays `closed` on hover and focus even though its
   listeners are attached. It works under the real React that Vitest runs, so a unit test cannot
   catch it. `components/ui/tooltip.tsx` was removed for that reason; do not re-add it with
   `shadcn add tooltip` (upstream is the same Radix wrapper). Put `data-tooltip="…"` on the
   element instead: `components/GlobalTooltipLayer.tsx` (mounted once in `App.tsx`) shows it on
   hover and keyboard focus, above everything. It also picks up a button's `aria-label` or
   `title`; opt out with `data-no-global-tooltip="true"`. Content is plain text and the layer
   picks its own side. `test/components/aiElementsTooltips.test.tsx` fails if Radix Tooltip is
   imported again.

---

## `settings-panel.tsx` — group, card, panel, section, row

The layout for any page that is a list of settings. Two surfaces, one row primitive.

Both surfaces stack **vertically**. Never put them in a grid: a grid track stretches every
card to the tallest sibling, so a group holding one switch inherits the whitespace of the
group holding a model picker. That is the failure `docs/DESIGN.md` warns about, and it is what
this file exists to prevent.

### Which surface

| use | when |
| --- | --- |
| `SettingsGroup` + `SettingsCard` | Groups are independent product areas an admin dips into one at a time. **Default choice.** |
| `SettingsPanel` + `SettingsSection` | The groups read as one continuous form and dividers suit them better than separate cards. |

`SettingsCard` carries the shadcn card treatment on a real `<section>` rather than nesting
`<Card>`: `Card` is a plain function component, and under `preact/compat` it would never
receive `ref` (rule 1). Same tokens, semantic element, working ref.

### `SettingsGroup`

The vertical stack for `SettingsCard`s. Takes no props beyond a `div`'s.

### `SettingsPanel`

The single surface for `SettingsSection`s. Renders the border, radius and dividers.

### `SettingsCard` / `SettingsSection`

Identical props; the only difference is the surface.

| prop | type | notes |
| --- | --- | --- |
| `title` | `ReactNode` | Sentence case. Name the **decision**, not the database column. |
| `description` | `ReactNode` | One decision-relevant sentence. Omit when the title says it all. |
| `icon` | `ReactNode` | A 16px Phosphor icon. Rendered in a muted tile. |
| `aside` | `ReactNode` | Status or a count, at the inline end of the heading. |

### `SettingsRow`

| prop | type | notes |
| --- | --- | --- |
| `label` | `ReactNode` | Required. |
| `description` | `ReactNode` | One line. Anything longer belongs on the section. |
| `htmlFor` | `string` | Given one, the caption renders as a real `<label>`. **Only** for real form elements — see rule 4. |
| `layout` | `'inline' \| 'stacked'` | `inline` (default) puts the control at the inline end on the caption's baseline: switches, selects, short inputs. `stacked` gives it a full-width line below: pickers, lists, editors. |
| `note` | `ReactNode` | Rendered under the control. Use it for the *consequence of the current value*, not for a restatement of the label. |

An `inline` row uses a **fixed 18rem control track**, not `auto`. An auto track sizes to its
own content, so two selects in one group came out at different widths and a width utility on
the trigger never took effect. Give a select `className="w-full"` to fill the track; leave a
short input its own narrow width and it right-aligns within it.

```tsx
import { SettingsCard, SettingsGroup, SettingsRow } from '@/components/ui/settings-panel';

<SettingsGroup>
  <SettingsCard
    icon={<ChatCircleDots weight="duotone" />}
    title="Trip Agent"
    description="The planning chat inside a trip."
  >
    <SettingsRow label="Open to everyone" description="Every account whose plan allows it.">
      <Switch checked={on} onCheckedChange={setOn} aria-label="Open to everyone" />
    </SettingsRow>
  </SettingsCard>

  <SettingsCard icon={<Sparkle weight="duotone" />} title="AI model">
    <SettingsRow label="Default model" layout="stacked">
      <AiModelPicker value={id} models={models} onChange={setId} />
    </SettingsRow>
    <SettingsRow label="Age limit" htmlFor="age-limit">
      <NumberInput id="age-limit" min={1} max={36} steppers suffix=" months" className="w-36" … />
    </SettingsRow>
    <SettingsRow label="Provider" note={consequenceOfCurrentChoice}>
      <Select …><SelectTrigger className="w-full"><SelectValue /></SelectTrigger>…</Select>
    </SettingsRow>
  </SettingsCard>
</SettingsGroup>
```

**Grouping and naming.** Group rows by the product area an administrator is steering, and name
the group after that area rather than after the mechanism. A card called "Rollout" holding two
chat switches and one planner switch tells a reader less than a "Trip Agent" card and a
"Planner" card do. Name a switch for what it opens (`Open to everyone`), not for the thing it
sits under — the card title already said that.

**Copy.** The row label and the section description carry the meaning. Resist a hint on every
row — a caption that restates its label is noise, and it is what makes a settings page look
old.

Reference implementation: `pages/AdminGlobalSettingsPage.tsx`.
Tests: `tests/browser/ui/settingsPanel.browser.test.ts`.

---

## `dialog.tsx` — content, header, body, footer

`DialogContent` is a **flex column with a bounded height**. Put the long part in `DialogBody`;
the header and footer are its flex siblings, so they stay pinned while it scrolls — no
`position: sticky` involved.

```tsx
<DialogContent size="md" showCloseButton>
  <DialogHeader>
    <DialogTitle>Default AI model</DialogTitle>
    <DialogDescription>Only approved models are used at runtime.</DialogDescription>
  </DialogHeader>
  <DialogBody>…the long, scrolling part…</DialogBody>
  <DialogFooter>
    <Button variant="ghost">Cancel</Button>
    <Button>Save</Button>
  </DialogFooter>
</DialogContent>
```

**Every horizontal inset is the same `px-5`**, so the title, the body and the footer buttons
line up. Content placed directly inside `DialogContent` instead of `DialogBody` gets **no
padding** and sits flush against the edge — that was the bug that made the model picker's
search field wider than its own title.

| part | prop | notes |
| --- | --- | --- |
| `DialogContent` | `size` | `sm` 420 · `md` 560 · `lg` 680 (default) · `xl` 860. Prefer these over a hand-written width. |
| | `showCloseButton` | Off by default — several dialogs here draw their own, and two in one corner looks broken. |
| `DialogHeader` | `divided` | Rule beneath the header, for when the body scrolls under it. |
| `DialogBody` | `padded` | Off when the body owns its own padding. |
| | `scroll` | Off when a **child** owns the scrolling. Two nested scrollers trap the wheel in the inner one and strand the outer scrollbar. |
| `DialogFooter` | `sticky` | On by default: rule above, solid background. Off for a dialog that pads itself inline. |

The height cap is `max-h-[min(85dvh,48rem)]`. A dialog whose content must not be clipped — a
free-form visual rather than a form — opts out with `max-h-none` plus `overflow-visible`.

For a modal with a title bar, its own close button and a footer slot already assembled, use
`app-modal.tsx` instead of composing these by hand.

---

## `search-input.tsx`

A search field with its magnifying glass and an optional clear button. Built on `InputGroup`,
which lays the icon out with **flex**.

```tsx
<SearchInput
  placeholder="Search a provider or model…"
  value={query}
  onChange={(event) => setQuery(event.currentTarget.value)}
  onClear={() => setQuery('')}
/>
```

**Never rebuild this with an absolutely positioned icon over a padded input.** That pattern has
broken twice here, in both directions:

1. The icon used `inset-inline-start-3`, which is not a Tailwind utility, so it resolved to `0`
   and sat on the placeholder. The input's `ps-9` was separately lost to the base `px-3`.
2. Once both were fixed, putting a gutter (`px-5`) on the same element that carried `relative`
   moved the positioning context out from under the input, and the icon landed *outside* the
   field entirely.

Flex has no positioning context to get wrong: the icon is a sibling of the input, so a gutter
on any ancestor moves both together.

`InputGroupInput`, `InputGroupTextarea` and `Textarea` were plain function components and were
converted to `forwardRef` so this composes cleanly — under `preact/compat` they would otherwise
have dropped the ref silently (rule 1).

---

## `label.tsx`

The shadcn label primitive, on Radix. Use it for controls that own a real form element
(`Input`, `Textarea`, `NumberInput`). Do **not** wrap a Radix trigger — see rule 4. Most pages
should reach for `SettingsRow`'s `htmlFor` instead of importing this directly.

---

## `alert.tsx`

Inline page feedback. Variants: `default`, `destructive` (text-only emphasis on the card
surface), and the tone variants `success`, `warning`, `danger`, which carry their own border
and tint so they read as a state rather than a panel.

```tsx
<Alert variant="success">
  <CheckCircle weight="duotone" />
  <AlertDescription>Saved. Visitors pick the change up on their next page load.</AlertDescription>
</Alert>
```

Use `showAppToast` (`components/ui/appToast.tsx`) instead when the feedback is transient and
the user's attention is elsewhere on the page.

---

## `number-input.tsx`

Numeric field. The native spinners are suppressed, so pass `steppers` when the value should be
clickable as well as typeable:

```tsx
<NumberInput min={1} max={36} steppers suffix=" months" className="w-36" value={n} onChange={…} />
```

The steppers write through `HTMLInputElement.prototype`'s value setter before dispatching
`input`. React patches the *instance* setter to track the last value it rendered; a direct
`node.value = …` updates that tracker too, so the event that follows looks like a no-op and
`onChange` never runs. Going via the prototype leaves the tracker stale, which is what makes
the edit register. Do not "simplify" this back to a direct assignment — it works in the app
(preact) and silently fails under React in tests.

`steppers` is off by default so existing call sites are unchanged.

---

## `button.tsx` — the one button

Every clickable action in the planner, the trip page and the AI chat is a `Button`. Do not
hand-roll `<button className="inline-flex … bg-accent-600 text-white …">`: those copies each
carried their own colours, and they drifted out of step with the theme (the dark primary fill
was the light one, a disabled control turned bright grey, pressed toggles lost `aria-pressed`).

| Variant | Use for |
|---|---|
| `default` | The one primary action in a group (Apply, Preview, Copy trip, Send). |
| `outline` | A secondary action beside it. |
| `ghost` | Tertiary actions and icon-only controls in a toolbar or header. |
| `secondary` | A quiet filled action; give it tinted colours for status banners. |
| `soft` | Tinted accent action, quieter than `default` ("Ask AI", "Add activity"). |
| `toggle` | Segmented controls. Pressed styling comes from `aria-pressed="true"`, so always pass it. |
| `floating` | Controls sitting on the map: opaque card fill, `aria-pressed` fills with primary, `aria-expanded` tints. |
| `social` | Social sign-in rows. Set `data-provider` (`google`, `facebook`, `kakao`) for the brand hover tint in both themes; use `components/auth/SocialLoginButton`, which the login page and the auth modal share. |
| `link` / `destructive` | As named. |

Sizes are `xs`, `sm`, `default`, `lg` and the square `icon-xs`, `icon-sm`, `icon`, `icon-lg`
(24/32/36/40px). Drop a lucide or Phosphor icon in as a child; the button sizes it unless the
icon has its own `size-*`.

`shortcut` renders a trailing `<Kbd>` hint that follows the label colour, so it reads on every
variant in both themes. Pair it with `aria-keyshortcuts` for assistive tech:

```tsx
<Button size="sm" shortcut="⌘⇧P" aria-keyshortcuts="Meta+Shift+P Control+Shift+P">
  <Eye className="size-3.5" />Preview
</Button>
```

**Dark mode.** `bg-primary` resolves through `--tf-primary`; `.dark` points it at indigo‑400
and `--primary-foreground` at dark ink. Change the two together, never one — the fill staying
indigo‑600 while the ink went dark is the bug that made Preview and Send unreadable.

Leave a raw `<button>` only where the element is not a button-shaped action: resize handles,
whole list rows or cards that act as one target, and click-away backdrops.

---

## `select.tsx`

Radix select. The trigger renders a Phosphor `CaretDown`; the item indicator is a Phosphor
`Check`. Never replace it with a native `<select>` (`docs/DESIGN.md`).

The trigger truncates its own value, so a long option cannot push the caret past the edge.
Give it `className="w-full"` inside a `SettingsRow` to fill the fixed control track — an
unconstrained trigger sizes to its content, and two selects then disagree on width.

---

## `today-badge.tsx`

The "Today" marker, for every surface that marks the current day: both timelines, the
itinerary list, the phone day strip and the day panel. Use it rather than writing another
pill — four hand-rolled versions in three different colours is exactly what this replaced.

Sizes are `sm` (inside a timeline column or a day strip) and `md` (beside a heading). The
colours come from the `--tf-today-badge-*` tokens in `index.css`, which are **solid** on both
sides: the badge overlaps the day column's own tint and the grid lines behind it, so a
translucent fill stacks with whatever it lands on.

The rest of the today palette lives beside it — `--tf-today-wash` for the column tint,
`--tf-today-cell` for the stronger header cell, `--tf-today-line` for the hairline, and
`--tf-today-text` / `--tf-today-text-strong` for the date itself. Reach for those instead of a
`red-50` wash: that colour is all but white, and in dark mode it painted a pale slab down the
middle of the timeline.

---

## Where to put a new shared component

1. It is a generic primitive with no product knowledge → `components/ui/`, and add a section here.
2. It knows about admin data or admin routes → `components/admin/`.
3. It knows about a trip, a timeline or a destination → the matching feature folder.

Anything landing in `components/ui/` needs: a `forwardRef` where a ref could plausibly be
passed, a `data-slot` attribute for testing and styling, a Vitest file under `tests/browser/ui/`,
and an entry in this document.

Changing one of these is a change to every caller. Before editing a shared primitive, grep for
its usages and check each one still holds up — adding a height cap to `DialogContent`, for
example, silently clipped two long forms that had previously been free to grow past the
viewport.
