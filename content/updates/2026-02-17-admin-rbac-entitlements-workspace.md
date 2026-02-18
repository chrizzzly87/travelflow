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
- [x] [Improved] 🧱 Refined the admin sidebar with icon-based navigation, cleaner active highlighting, and a desktop collapse mode.
- [x] [Improved] 📱 Added a dedicated mobile admin navigation drawer so the workspace remains usable on smaller screens.
- [x] [Improved] 🔗 Made admin table/search/filter states bookmarkable by persisting page settings in the URL.
- [x] [Improved] 🧭 Unified AI benchmarking inside the main admin workspace and added an easy route back to the main planning experience.
- [x] [Improved] 🪪 Polished the profile avatar dropdown with clearer grouping for profile, settings, planner, and admin destinations.
- [x] [Improved] 🗂️ Reworked user management into a full-width table with richer account context, activity timestamps, and cleaner row action menus.
- [x] [Improved] 🧪 Added default filtering to hide anonymous accounts while keeping quick access when you explicitly need to inspect them.
- [x] [Improved] 🪟 Moved user creation into a focused modal and refined user-detail editing into a clearer right-side drawer with prefilled fields.
- [x] [Improved] 🎚️ Refreshed admin filters and status controls with modern select components and clearer selected labels across admin pages.
- [x] [Improved] 🧍 Added account/profile access to the mobile admin sidebar footer so navigation controls stay reachable on small screens.
- [x] [Improved] 🧭 Simplified admin navigation layout so top controls align cleanly in one row on larger screens while profile access is anchored in the sidebar.
- [x] [Improved] 📐 Fixed collapsed-sidebar behavior by moving the collapse toggle outside the rail and reducing icon overflow edge cases.
- [x] [Improved] 🧰 Refined toolbar behavior so primary actions stay on one line, with cleaner iconography and more stable control ordering.
- [x] [Improved] 🗃️ Switched user details to a full-height right-side drawer with smoother slide-in behavior and clearer section ordering.
- [x] [Fixed] 🧹 Improved identity filtering so placeholder/anonymous records are easier to separate from real activated accounts by default.
- [x] [Improved] 🔄 Unified reload controls across admin data tables with a shared icon style and inline loading motion feedback.
- [x] [Improved] 🧪 Upgraded user/trip table filters to chip-style multi-select menus with persistent URL state for bookmarkable filtered views.
- [x] [Improved] 📊 Added richer user activation insights (including pending activation tracking and ratio cards) directly in the Users workspace.
- [x] [Improved] 🧠 Reduced admin metric flicker by caching recent users/trips/tier snapshots locally before live refresh completes.
- [x] [Fixed] 🪄 Fixed admin filter popovers to open and select reliably across table toolbars, including sticky/scrolling layouts.
- [x] [Improved] 🔢 Standardized animated number transitions across compact dashboard metric cards for smoother data updates.
- [x] [Fixed] 🧩 Fixed dropdown layering in side drawers/dialogs so account status, role, and tier selectors are fully usable again.
- [x] [Improved] 🔗 Added direct trip-open links in admin trip listings and connected-trip sections so visual verification is one click away.
- [x] [Improved] 👤 Made trip owner cells open a user-information drawer for faster account context checks without leaving trip operations.
- [ ] [Internal] 🗒️ Documented deferred admin-shell and user-management follow-up backlog for the next layout-focused iteration.
- [x] [Fixed] 🔎 Improved admin filtering so search and date-range controls update Users, Trips, Tiers, and Audit views consistently.
- [x] [Fixed] 🧮 Fixed admin workspace data panels failing to load by aligning backend response types for users/trips/audit queries.
- [x] [Fixed] ⏳ Fixed a trip-management issue where changing status could unintentionally clear the existing expiration date.
- [x] [Fixed] 🧑‍🔧 Fixed a profile-settings stability issue that could prevent authenticated users from loading the settings form.
- [ ] [Internal] 🔐 Added admin identity edge API wiring for invite/direct creation and hard-delete operations using service-role authorization.
- [ ] [Internal] 🧾 Added admin audit log schema and RPC plumbing for user/trip/tier action tracking and replay.
- [ ] [Internal] 🛡️ Hardened profile update safety with privileged-field guardrails while preserving user self-service edits for profile data.
- [ ] [Internal] 🧩 Isolated admin routes into a dedicated lazy-loaded workspace router so non-admin paths avoid admin chunk preload/bundle impact.
- [ ] [Internal] 📘 Added explicit RBAC hardening TODOs documenting the migration from compatibility permissions to strict role-only checks.
- [ ] [Internal] 🧯 Updated SQL migration order to drop/recreate legacy RPCs (`get_current_user_access`, `admin_list_users`, `admin_get_user_profile`) when return signatures evolve.
