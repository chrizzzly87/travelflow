---
id: rel-2026-09-28-ai-elements-tooltips
version: v0.199.1
title: "Trip Agent button tooltips on the app's tooltip layer"
date: 2026-09-28
published_at: 2026-09-28T12:00:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Chat action and prompt buttons now use the app's own tooltips, which show on hover and focus."
---

## Changes
- [ ] [Internal] 💬 Message action and prompt-input buttons pass their tooltip to the global tooltip layer via `data-tooltip` instead of Radix Tooltip, which never opens under preact/compat.
- [ ] [Internal] 🧹 Removed the unusable `components/ui/tooltip.tsx` and documented tooltips in `docs/DESIGN_SYSTEM_COMPONENTS.md`; a Vitest guard fails if Radix Tooltip is imported again.
