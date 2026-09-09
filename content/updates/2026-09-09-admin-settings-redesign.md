---
id: rel-2026-09-09-admin-settings-redesign
version: v0.165.0
title: "Global settings, rebuilt around the decision you are making"
date: 2026-09-09
published_at: 2026-09-09T12:00:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "The admin global settings page is now a card per product area, built on shared components."
---

## Changes
- [ ] [Internal] 🧭 Rebuilt admin Global Settings as a card per product area — Trip Agent, Planner, AI model, Map — stacked in one column, instead of a two-by-two grid where a card holding a single switch inherited the height of the card holding a model picker.
- [ ] [Internal] 🧱 Added `SettingsGroup`, `SettingsCard`, `SettingsPanel`, `SettingsSection` and `SettingsRow` to the shared component set, with a fixed control track so two selects in one group can no longer disagree on width.
- [ ] [Internal] 🏷️ Added the missing shadcn `Label` primitive, with the rule that a Radix trigger must never be wrapped in one — a surrounding label forwards a second click and toggles the value twice.
- [ ] [Internal] 🎨 Added `success`, `warning` and `danger` tones to the shared alert so saved and blocked feedback reads as a state rather than a plain panel.
- [ ] [Internal] ⌄ Replaced the select trigger's mismatched chevron with the Phosphor caret the rest of the app uses, and moved the model picker's icons onto the same family — one panel no longer shows two chevron shapes.
- [ ] [Internal] ✂️ Cut the helper copy that restated its own label, and dropped the duplicated caption above the approved-model list.
- [ ] [Internal] ↩️ Added a discard action beside save, so an unfinished edit can be abandoned without reloading the page.
- [ ] [Internal] 📚 Documented the shared component set in a new catalogue and linked it from the agent guide, the design contract and the startup checklist, with a live entry in the component playground.
- [ ] [Internal] 🔢 Gave the shared number input optional increment and decrement buttons, since the component suppresses the browser's own spinners.
- [ ] [Internal] 📐 Fixed the model search field: the magnifying glass sat on top of the placeholder because its offset used a class Tailwind does not generate, and the field's leading padding lost to the input's own shorthand.
- [ ] [Internal] 🪟 Rebuilt the shared dialog: one shared gutter for header, body and footer (the model picker's search field used to run wider than its own title), a bounded height with only the body scrolling, width presets, an optional close button and an optional pinned footer.
- [ ] [Internal] ↔️ Moved the value-dependent hint into the label column so it wraps against the caption instead of spanning the row under the control.
- [ ] [Internal] 🧪 Regression coverage for the dialog gutter, height cap and footer, the card layout, the shared control track, the stepper buttons, the double-toggle trap and the discard flow.
