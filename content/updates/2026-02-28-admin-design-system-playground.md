---
id: rel-2026-02-28-admin-design-system-playground
version: v0.69.0
title: "Admin design system playground and toast lab"
date: 2026-02-28
published_at: 2026-02-28T07:44:24Z
status: published
notify_in_app: false
in_app_hours: 24
summary: "Added an admin-only design playground with expanded component coverage and a shared toast QA lab."
---

## Changes
- [ ] [Internal] 🧩 Added a dedicated admin route for a read-only design system playground that groups current shared UI families.
- [ ] [Internal] 🔔 Added a notification lab with scenario picker and trigger controls wired exclusively through the shared `showAppToast(...)` pipeline.
- [ ] [Internal] 📍 Added component usage references per group to show source component paths and real in-repo usage points.
- [ ] [Internal] 🗂️ Added admin sidepanel coverage and aligned app-modal preview behavior to open centered like dialogs.
- [ ] [Internal] 🌍 Added create-trip destination selectors, profile country/region select, and date-range calendar samples to the playground inventory.
- [ ] [Internal] 🎛️ Added broader button variants from landing, inspirations, features, and 404 surfaces for style parity checks.
- [ ] [Internal] 📚 Added a governance rule requiring new shared components to be represented in `/admin/design-system-playground`.
- [ ] [Internal] 📊 Added analytics instrumentation for playground open, component-group view, and toast trigger actions.
- [ ] [Internal] 🧪 Added regression tests for the new admin playground analytics and toast trigger behavior.
