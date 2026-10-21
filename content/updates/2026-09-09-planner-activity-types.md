---
id: rel-2026-09-09-planner-activity-types
version: v0.164.0
title: "The planner labels what each activity actually is"
date: 2026-09-09
published_at: 2026-09-09T04:30:00Z
status: published
notify_in_app: true
in_app_hours: 24
summary: "Activities the planning chat adds now carry their real categories — a night food market comes in as food and nightlife — so the timeline is colour-coded from the first proposal."
---

## Changes
- [x] [Fixed] 🌃 Activities the planning chat adds now arrive with the categories that fit them — a night food market comes in as food and nightlife, a temple visit as culture and sightseeing — instead of every one landing as "General".
- [x] [Improved] 🎨 Those categories colour the timeline block right away, so a proposed day reads at a glance without retyping anything by hand.
- [x] [Improved] 🏷️ Ask the chat to recategorise an activity and both the labels and the block colour follow.

- [ ] [Internal] 🔌 Added activityTypes to the model-facing operation schema for new and updated items; the field simply did not exist before, so every value a model sent was dropped on the way in.
- [ ] [Internal] 🧭 Extended the planner instructions with the allowed taxonomy and worked examples, and made the derived colour authoritative over a model-supplied one.
- [ ] [Internal] 🧰 Moved the activity taxonomy, aliases and colours into a shared edge-safe module so the agent and the client resolve labels identically.
- [ ] [Internal] 🧪 Regression coverage for proposed types surviving conversion, invented labels resolving, untyped activities falling back, and cities never picking up activity types.
- [ ] [Internal] ⏱️ Release-note validation no longer fails a build over a published_at stamped a few minutes ahead of the build clock; inside a 24-hour window it warns, and a date typed more than a day out still fails.
- [ ] [Internal] 🔢 Added `pnpm updates:fix`, which clamps a future publish timestamp and renumbers a version two worktrees claimed at once, instead of bouncing the build back for a hand edit.
