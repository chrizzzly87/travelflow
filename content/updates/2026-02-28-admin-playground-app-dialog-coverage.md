---
id: rel-2026-02-28-admin-playground-app-dialog-coverage
version: v0.70.0
title: "Admin playground app dialog coverage follow-up"
date: 2026-02-28
published_at: 2026-02-28T08:30:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Extended the admin design playground with real shared confirm/prompt dialog variants used across app and admin flows."
---

## Changes
- [ ] [Internal] 🧩 Added real `useAppDialog` confirm and prompt samples to the admin design playground dialog section.
- [ ] [Internal] ⚠️ Added destructive and non-destructive confirm variants to mirror existing archive/hard-delete and decision flows.
- [ ] [Internal] 📝 Added text and URL prompt variants, including optional input and URL validation patterns from current product usage.
- [ ] [Internal] 🧱 Added shared dialog preset builders so admin flows reuse the same confirm/prompt configuration patterns.
- [ ] [Internal] 🛡️ Migrated admin users/trips/audit/benchmark dialog calls to shared presets and standardized destructive actions on danger tone.
- [ ] [Internal] ✅ Added missing single-user soft-delete confirmation in admin users before executing the destructive status change.
- [ ] [Internal] 🔔 Switched single-user admin soft-delete and hard-delete success flows from inline notes to shared Sonner toasts, including loading/error feedback.
- [ ] [Internal] ↩️ Added Undo from the single-user soft-delete success toast to restore account status directly from the toast action.
- [ ] [Internal] ✍️ Rewrote single-user soft-delete/hard-delete confirm copy to quote the selected user name and explain reversible soft delete vs permanent hard delete.
- [ ] [Internal] 📚 Documented current app dialog variants and harmonization targets in the admin playground follow-up issue doc.
- [ ] [Internal] 🧪 Added regression coverage for triggering shared confirm/prompt dialog samples in the playground.
