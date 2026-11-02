---
id: rel-2026-11-02-admin-ai-benchmark-split
version: v0.218.0
title: "AI benchmark admin page split into focused parts"
date: 2026-11-02
published_at: 2026-11-02T09:00:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "The admin AI benchmark page is split into smaller state, data and view modules with the same behaviour."
---

## Changes
- [ ] [Internal] 🧩 The AI benchmark admin page is now a thin composition over `components/admin/ai-benchmark/`, down from 3,335 to about 200 lines.
- [ ] [Internal] 🗂️ Run setup, the model catalog, the session and its runs, and the screen state each have their own reducer, with unit tests.
- [ ] [Internal] 🔌 Loading and polling (session, models, preferences, telemetry) and the run, judging, export and setup actions live in separate hooks.
- [ ] [Internal] 🖍️ The template JSON is highlighted with rendered tokens instead of injected HTML; the markup is unchanged.
- [ ] [Internal] 🧪 A new browser flow test starts a run, opens it in the sheet, rates it and compares it, and passes against the old page too.
