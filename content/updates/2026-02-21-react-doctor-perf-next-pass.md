---
id: rel-2026-02-21-react-doctor-perf-next-pass
version: v0.54.0
title: "React doctor and trip performance follow-up"
date: 2026-02-21
published_at: 2026-02-21T10:30:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Follow-up fixes target React Doctor blockers and next trip-page performance extraction work."
---

## Changes
- [ ] [Internal] 🩺 Cleared the current React Doctor blocking errors on blog routes by removing a conditional hook path and replacing locale-derived filter reset effects with locale-scoped state.
- [ ] [Internal] 🧩 Reduced duplicated trip-detail wiring in the planner by centralizing selected-item panel rendering paths, shrinking the core trip view bundle while keeping behavior unchanged.
- [ ] [Internal] 📊 Captured a fresh strict-preview Lighthouse baseline for a valid `/trip/:id` URL after the extraction pass to confirm transfer/request budgets remained stable.
- [ ] [Internal] ⚙️ Removed redundant DB session bootstrap awaits in shared/example copy handlers because the downstream persistence calls already ensure session state.
