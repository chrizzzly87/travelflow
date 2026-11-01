---
id: rel-2026-11-01-admin-users-split
version: v0.217.0
title: "Users screen restructure"
date: 2026-11-01
published_at: 2026-11-01T12:00:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "The admin Users screen is split into a reducer-backed state hook, data and action hooks, a pure model and focused components, with no change in behaviour."
---

## Changes
- [ ] [Internal] 🧩 Split the admin Users page into a reducer-backed state hook, data, detail and action hooks, and focused queue tiles, filter bar, table row, selection bar, create dialog and user sheet components under `components/admin/users/`.
- [ ] [Internal] 🧮 Moved URL parsing, filtering, sorting, paging, column handling, CSV export, override comparison and bulk-delete wording into pure helpers in `adminUsersModel.ts`; the page, its selection and the sheet's list pages are derived on render.
- [ ] [Internal] 🛡️ Kept every deletion safeguard, toast and error sentence, analytics event and URL query key as it was; the deletion confirmations live in one file next to the policy they follow.
- [ ] [Internal] 🧪 Added reducer and model unit tests plus a browser test covering filtering, sorting, opening the user sheet and confirmed bulk soft and hard deletes.
