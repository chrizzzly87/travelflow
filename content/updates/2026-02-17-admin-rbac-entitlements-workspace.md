---
id: rel-2026-02-17-admin-rbac-entitlements-workspace
version: v0.50.0
title: "Admin RBAC workspace + profile onboarding"
date: 2026-02-17
published_at: 2026-02-17T20:40:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Introduced a full admin operations workspace, role-aware account menu, and mandatory profile onboarding/settings flow for authenticated users."
---

## Changes
- [x] [New feature] 🧭 Added a full-width admin workspace with a structured sidebar, operational overview cards, and dedicated sections for users, trips, tiers, and audit history.
- [x] [New feature] 🧑‍💼 Added advanced user provisioning controls with searchable/filterable user management, detail side panel editing, and invite/direct account creation flows.
- [x] [New feature] 🧳 Added admin trip lifecycle controls so status and expiration can be reviewed and updated from dedicated trip management views.
- [x] [New feature] 👤 Replaced the simple auth action with a role-aware avatar account menu that gives users direct access to profile/settings and gives admins fast access to admin sections.
- [x] [New feature] 📝 Added mandatory post-login profile onboarding plus a reusable profile settings page for editing personal details and language preference.
- [x] [Fixed] 🔎 Improved admin filtering so search and date-range controls update Users, Trips, Tiers, and Audit views consistently.
- [x] [Fixed] ⏳ Fixed a trip-management issue where changing status could unintentionally clear the existing expiration date.
- [x] [Fixed] 🧑‍🔧 Fixed a profile-settings stability issue that could prevent authenticated users from loading the settings form.
- [ ] [Internal] 🔐 Added admin identity edge API wiring for invite/direct creation and hard-delete operations using service-role authorization.
- [ ] [Internal] 🧾 Added admin audit log schema and RPC plumbing for user/trip/tier action tracking and replay.
- [ ] [Internal] 🛡️ Hardened profile update safety with privileged-field guardrails while preserving user self-service edits for profile data.
- [ ] [Internal] 🧩 Isolated admin routes into a dedicated lazy-loaded workspace router so non-admin paths avoid admin chunk preload/bundle impact.
- [ ] [Internal] 📘 Added explicit RBAC hardening TODOs documenting the migration from compatibility permissions to strict role-only checks.
