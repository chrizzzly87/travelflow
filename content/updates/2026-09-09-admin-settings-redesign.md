---
id: rel-2026-09-09-admin-settings-redesign
version: v0.165.0
title: "Global settings, rebuilt around the decision you are making"
date: 2026-09-09
published_at: 2026-09-09T12:00:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "The admin global settings page is now one clear surface grouped by rollout, AI model and map, built on shared components."
---

## Changes
- [ ] [Internal] 🧭 Rebuilt admin Global Settings as one surface grouped by the decision being made — rollout, AI model, map — instead of a four-card grid where a section holding a single switch inherited the height of the section holding a model picker.
- [ ] [Internal] 🧱 Added `SettingsPanel`, `SettingsSection` and `SettingsRow` to the shared component set, so every caption sits on one column and every control lands on one edge whatever the section contains.
- [ ] [Internal] 🏷️ Added the missing shadcn `Label` primitive, with the rule that a Radix trigger must never be wrapped in one — a surrounding label forwards a second click and toggles the value twice.
- [ ] [Internal] 🎨 Added `success`, `warning` and `danger` tones to the shared alert so saved and blocked feedback reads as a state rather than a plain panel.
- [ ] [Internal] ⌄ Replaced the select trigger's mismatched chevron with the Phosphor caret the rest of the app uses, and moved the model picker's icons onto the same family — one panel no longer shows two chevron shapes.
- [ ] [Internal] ✂️ Cut the helper copy that restated its own label, and dropped the duplicated caption above the approved-model list.
- [ ] [Internal] ↩️ Added a discard action beside save, so an unfinished edit can be abandoned without reloading the page.
- [ ] [Internal] 📚 Documented the shared component set in a new catalogue and linked it from the agent guide, the design contract and the startup checklist, with a live entry in the component playground.
- [ ] [Internal] 🧪 Regression coverage for the panel primitives and the regrouped settings page, including the double-toggle trap and the discard flow.
