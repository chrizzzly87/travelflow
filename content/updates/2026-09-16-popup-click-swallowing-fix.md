---
id: rel-2026-09-16-popup-click-swallowing-fix
version: v0.171.0
title: "Pop-ups no longer swallow your first click"
date: 2026-09-16
published_at: 2026-09-16T20:16:12Z
status: published
notify_in_app: false
in_app_hours: 24
summary: "The cookie notice and the release notice now wait until your click is finished before appearing, so the button you actually pressed responds."
---

## Changes
- [x] [Fixed] 🖱️ The first click on a page now always reaches the button you pressed — the cookie notice and the release notice no longer appear mid-click and absorb it.
- [x] [Fixed] 🍔 Tapping the menu button on a phone opens the menu right away instead of feeling stuck on the first tap.
- [ ] [Internal] ⏱️ Interaction-armed overlays now trigger on pointerup/keyup and mount on the next macrotask, so a `fixed inset-0` backdrop can never be inserted between a visitor's pointerdown and the resulting click.
- [ ] [Internal] 📦 The mobile navigation chunk is prewarmed on pointer-enter, pointer-down and focus of the burger button, closing the dead window between the prerendered header painting and its lazy chunk resolving.
- [ ] [Internal] 🧪 Added regression coverage asserting the release notice stays closed while a pointer is down and only opens once the interaction has finished.
