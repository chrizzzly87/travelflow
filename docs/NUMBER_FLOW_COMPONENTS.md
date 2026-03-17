# Number Flow Components

Last updated: 2026-03-17

This repo now has a small shared number-animation layer built on top of [`@number-flow/react`](https://github.com/barvian/number-flow).

## Shared primitives

### `components/ui/input.tsx`

Use for standard shadcn-style text inputs when you want the shared border, spacing, and focus treatment without re-implementing field styles.

### `components/ui/number-input.tsx`

Use for controlled numeric fields when you want the value to animate between stable states while still keeping native number-input behavior.

Best fit:
- Currency or budget inputs
- Duration and quantity editors
- Inputs driven by steppers, presets, or synced state

Current notes:
- The animated overlay is designed for controlled values.
- Empty controlled values stay as plain input text.
- Browser spin buttons are hidden so the field matches the rest of the local UI primitives.

Adoption guidance:
- Prefer `NumberInput` for controlled fields that settle into a display state, especially stepper-driven, preset-driven, or calculated inputs.
- Keep plain inputs for cases that behave more like freeform draft entry, or where the surrounding UX has not yet been aligned with the animated overlay.

Example:

```tsx
<NumberInput
  value={days}
  min="0"
  step="0.5"
  onChange={(event) => setDays(Number(event.target.value))}
  format={{ minimumFractionDigits: 1, maximumFractionDigits: 1 }}
/>
```

### `components/ui/animated-number.tsx`

Use for display-only values that should animate smoothly instead of snapping.

Best fit:
- Counters
- Day and range badges
- Totals, KPIs, and calculated values

Use `AnimatedNumberGroup` when multiple values should animate together as one visual unit.

Example:

```tsx
<AnimatedNumberGroup>
  <span className="inline-flex items-center gap-1.5">
    <span>Days</span>
    <AnimatedNumber value={startDay} format={{ maximumFractionDigits: 0 }} />
    <span>-</span>
    <AnimatedNumber value={endDay} format={{ maximumFractionDigits: 0 }} />
  </span>
</AnimatedNumberGroup>
```

## Current usage

- `components/tripview/TripTimelineListView.tsx`
  - Animated `Days X - Y` city badge for the mobile/list timeline.
- `components/CountryInfo.tsx`
  - Animated currency converter input and output value.
- `components/DetailsPanel.tsx`
  - Animated transport duration editor.
- `components/admin/AdminCountUpNumber.tsx`
  - Shared admin counter wrapper.
- `components/profile/ProfileStatCountUp.tsx`
  - Shared profile stat counter wrapper.
- `pages/AdminDesignSystemPlaygroundPage.tsx`
  - Reference demo for the shared text input, animated number input, and display-only animated number.

## Testing note

JSDOM does not fully implement the custom-element animation lifecycle that Number Flow expects during rerenders. `AnimatedNumber` therefore falls back to a plain formatted `<span>` in JSDOM-based tests so browser behavior stays animated without making Vitest unstable.
