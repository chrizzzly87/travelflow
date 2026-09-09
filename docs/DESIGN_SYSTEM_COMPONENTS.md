# Shared UI Components (LLM Reference)

The catalogue of shared components in `components/ui/`. Read this **before** hand-rolling a
wrapper, a caption, a settings row or a panel: nearly every layout an admin or product page
needs is already here, and a one-off `<div>` version drifts from `docs/DESIGN.md` within a
release.

- Visual contract for admin surfaces: `docs/DESIGN.md`.
- Brand and marketing styling: `docs/BRAND_CI_GUIDELINES.md`.
- Live examples you can click: `/admin/component-playground` and `/admin/design-system`.

## Rules that apply to everything in `components/ui/`

1. **The app renders through `preact/compat`.** A plain function component never receives
   `ref`. Anything used with Radix `asChild`, or focused/measured by a library, must be a real
   `forwardRef`. Symptoms of getting this wrong: `getBoundingClientRect is not a function`,
   `focus is not a function`, a popover anchored at the page origin.
2. **Icons follow the surface.** Admin and product chrome use `@phosphor-icons/react`
   (`CaretDown`, `CaretUpDown`, `Check`, `MagnifyingGlass`). Do not introduce a second icon
   family into a component that already uses one — two chevron shapes on one panel is the
   most common review comment on this repo.
3. **Never wrap a Radix trigger in a `<label>`.** A `Switch`, a `SelectTrigger` and a plain
   button all handle their own click. A surrounding label forwards a second one, so the value
   toggles twice. Caption those with a `<span>`; `SettingsRow` does it for you.
4. **Radii and heights come from `docs/DESIGN.md`**: `rounded-md` for controls, `rounded-lg`
   for panels, 36–40px control height. Avoid `rounded-2xl` on internal tooling.
5. **Use logical properties** (`ps-*`, `pe-*`, `inset-inline-start-*`) wherever direction may
   change.

---

## `settings-panel.tsx` — panel, section, row

The layout for any page that is a list of settings. Added because a grid of cards stretches
every card to the tallest sibling, so a section holding one switch inherits the whitespace of
the section holding a model picker. `docs/DESIGN.md` asks for the opposite: one surface with
dividers and section headings.

### `SettingsPanel`

The single surface. One per page. Renders the border, radius and the dividers between
sections. Takes no props beyond a `div`'s.

### `SettingsSection`

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
| `htmlFor` | `string` | Given one, the caption renders as a real `<label>`. **Only** for real form elements — see rule 3. |
| `layout` | `'inline' \| 'stacked'` | `inline` (default) puts the control at the inline end on the caption's baseline: switches, selects, short inputs. `stacked` gives it a full-width line below: pickers, lists, editors. |
| `note` | `ReactNode` | Rendered under the control. Use it for the *consequence of the current value*, not for a restatement of the label. |

```tsx
import { SettingsPanel, SettingsRow, SettingsSection } from '@/components/ui/settings-panel';

<SettingsPanel>
  <SettingsSection
    icon={<Flag weight="duotone" />}
    title="Rollout"
    description="Who can reach a feature that is not open to everyone yet."
  >
    <SettingsRow label="Trip Agent" description="The planning chat inside a trip.">
      <Switch checked={on} onCheckedChange={setOn} aria-label="Trip Agent" />
    </SettingsRow>
  </SettingsSection>

  <SettingsSection icon={<Sparkle weight="duotone" />} title="AI model">
    <SettingsRow label="Default model" layout="stacked">
      <AiModelPicker value={id} models={models} onChange={setId} />
    </SettingsRow>
    <SettingsRow label="Age limit" htmlFor="age-limit">
      <NumberInput id="age-limit" min={1} max={36} suffix=" months" className="w-36" … />
    </SettingsRow>
  </SettingsSection>
</SettingsPanel>
```

**Grouping.** Group rows by the decision an administrator is making, not by where the value is
stored. Three feature gates spread across three cards read as three unrelated jobs; the same
three under one "Rollout" heading read as one. A section holding a single row is a sign the
grouping is wrong.

**Copy.** The row label and the section description carry the meaning. Resist a hint on every
row — a caption that restates its label is noise, and it is what makes a settings page look
old.

Reference implementation: `pages/AdminGlobalSettingsPage.tsx`.
Tests: `tests/browser/ui/settingsPanel.browser.test.ts`.

---

## `label.tsx`

The shadcn label primitive, on Radix. Use it for controls that own a real form element
(`Input`, `Textarea`, `NumberInput`). Do **not** wrap a Radix trigger — see rule 3. Most pages
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

## `select.tsx`

Radix select. The trigger renders a Phosphor `CaretDown` that rotates while the list is open;
the item indicator is a Phosphor `Check`. Never replace it with a native `<select>`
(`docs/DESIGN.md`).

Give the trigger an explicit width on wide layouts (`className="w-full sm:w-72"`) — an
unconstrained trigger inside a flex row collapses to its content.

---

## Where to put a new shared component

1. It is a generic primitive with no product knowledge → `components/ui/`, and add a section here.
2. It knows about admin data or admin routes → `components/admin/`.
3. It knows about a trip, a timeline or a destination → the matching feature folder.

Anything landing in `components/ui/` needs: a `forwardRef` where a ref could plausibly be
passed, a `data-slot` attribute for testing and styling, a Vitest file under `tests/browser/ui/`,
and an entry in this document.
