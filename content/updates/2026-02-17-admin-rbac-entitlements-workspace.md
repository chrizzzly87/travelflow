---
id: rel-2026-02-17-admin-rbac-entitlements-workspace
version: v0.50.0
title: "Admin RBAC workspace + profile onboarding"
date: 2026-02-17
published_at: 2026-02-17T20:40:00Z
status: published
notify_in_app: false
in_app_hours: 24
summary: "Introduced a full admin operations workspace with safer trip overrides, deep-linked owner drawers, and bulk admin actions across users and trips."
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
- [x] [Improved] 🧭 Enabled admins to open any trip directly from admin tables, while keeping owner-only behavior unchanged for regular users.
- [x] [Improved] 🧭 Updated Trips table interaction so clicking a trip name opens the side drawer, while a dedicated “Open trip” link remains available inside the drawer.
- [x] [Improved] 👤 Made trip owner cells open a user-information drawer for faster account context checks without leaving trip operations.
- [x] [Improved] 🛡️ Added a default read-only safety mode for admin-opened trips, with an explicit edit override switch for authorized admins.
- [x] [Improved] 🔎 Added direct owner-profile deep links from admin trip views so support can jump into the correct user drawer instantly.
- [x] [Improved] ✅ Added multi-select checkboxes in Users and Trips tables with bulk soft-delete and permanent-delete actions.
- [x] [Fixed] 🪟 Restored outside-click drawer close behavior for deep-linked user details so drawers no longer reopen unexpectedly.
- [x] [Improved] 🧳 Reworked connected-trip controls in the user drawer so trip links keep full width while status/date controls stay compact.
- [x] [Improved] 🔗 Added owner deep-link opening inside the Trips workspace so support can inspect owner drawers without switching screens.
- [x] [Fixed] ⏱️ Suppressed release popups for admin trip sessions and during active loading overlays to avoid stacked modal/loading states.
- [x] [Fixed] 🧭 Removed misleading loading overlays on expired admin-opened trips and added clearer unfinished-itinerary messaging.
- [x] [Fixed] 📏 Fixed desktop admin sidebar sizing so the rail reliably fills the full viewport height.
- [x] [Improved] 🔐 Added login-type filtering in User Provisioning with social/username-password/unknown modes plus provider-level social selection.
- [x] [Improved] 🪪 Upgraded login badges in the user table with provider-specific icons/colors and better multi-provider visibility.
- [x] [Improved] 📈 Added per-user trip counters in User Provisioning and surfaced active/total trip totals directly in the user details header.
- [x] [Improved] 🧹 Added trip-count cleanup filters in User Provisioning so admins can quickly isolate users with no trips and empty profile data before deletion.
- [x] [Improved] 🔁 Added safer admin deletion flow with explicit hard-delete impact warnings and a transfer-before-delete option for preserving owned trips.
- [x] [Fixed] 🧾 Improved bulk hard-delete reliability by showing per-user failure reasons and automatically clearing safe historical links that can block deletion.
- [x] [Fixed] 🧮 Prevented soft-deleted accounts from being hard-deleted via bulk selection so admin user totals no longer drop from no-op delete attempts.
- [x] [Fixed] 🧬 Normalized legacy/invalid profile gender values during admin user updates to prevent `profiles_gender_check` save failures.
- [x] [Improved] 🧭 Added clearer hard-delete prompts that explicitly steer admins to transfer trips first when preservation is needed.
- [x] [Improved] ✅ Refined admin row selection UX with clearer selected-row highlighting, larger checkbox click targets, and in-table processing overlays during destructive actions.
- [x] [Fixed] ✅ Restored admin checkbox pointer cursors and enlarged click targets after a checkbox component refactor regression.
- [x] [Improved] 🧩 Disabled accidental text selection on admin pills/chips so clicks and drag gestures no longer highlight pill labels.
- [x] [Improved] 🧾 Upgraded audit history readability with clearer action aliases, colored action/target pills, and direct deep links into related user or trip details.
- [x] [Improved] 📋 Made user and trip UUIDs in admin tables/drawers click-to-select and copy-friendly, with lightweight inline copy feedback.
- [x] [Improved] 🎯 Added field-level before/after change snapshots in audit entries so profile status, role, tier, and trip ownership edits are easier to review.
- [x] [Fixed] 🔗 Cleaned up audit target controls so pills stay separate from action buttons, and added direct in-app drawer opening for both linked users and trips.
- [x] [Improved] 🧩 Added native user/trip detail sidepanels directly inside Audit so target inspection no longer requires switching admin pages.
- [x] [Improved] ♻️ Added soft-deleted user recovery directly from the Audit user drawer, including snapshot fallback when live profile rows are missing.
- [x] [Improved] 🧾 Expanded hard-delete traceability with clearer delete-impact prompts and hard-delete audit metadata that records owned-trip impact.
- [x] [Fixed] 🛠️ Improved admin hard-delete diagnostics so identity API failures now return actionable status details instead of generic error messages.
- [x] [Fixed] 🧾 Prevented no-op “Updated overrides” audit entries when profile/status edits are saved without entitlement override changes.
- [x] [Fixed] 🚧 Added an explicit admin access-denied screen for signed-in non-admin accounts and hardened invalid `/admin/*` URL handling so admins recover back to dashboard routes.
- [x] [Fixed] 🔐 Stabilized delayed session restore UX by auto-closing the login modal after recovery without hard-refresh, while temporarily disabling login actions until auth state is ready.
- [x] [Fixed] 🔐 Improved stale-session recovery so login and preference saves can self-heal after deleted-account session mismatches.
- [x] [Fixed] 🧾 Prevented a login recovery edge case that could silently switch active accounts into an anonymous "unknown user" state.
- [x] [Fixed] 🔐 Fixed anonymous-session detection so the login modal no longer auto-closes by mistaking guest sessions for signed-in accounts.
- [x] [Improved] 🧭 Removed forced profile-onboarding redirects so authenticated users can continue without mandatory completion detours.
- [x] [Improved] 🧭 Added a one-click “Open in Trips” shortcut from user details to jump into filtered trip lifecycle view for that owner.
- [ ] [Internal] 🗒️ Documented deferred admin-shell and user-management follow-up backlog for the next layout-focused iteration.
- [x] [Fixed] 🔎 Improved admin filtering so search and date-range controls update Users, Trips, Tiers, and Audit views consistently.
- [x] [Fixed] 🧮 Fixed admin workspace data panels failing to load by aligning backend response types for users/trips/audit queries.
- [x] [Fixed] ⏳ Fixed a trip-management issue where changing status could unintentionally clear the existing expiration date.
- [x] [Fixed] 🧑‍🔧 Fixed a profile-settings stability issue that could prevent authenticated users from loading the settings form.
- [x] [Fixed] 👥 Fixed an onboarding redirect issue so guest trip links and trip creation stay accessible without forcing profile completion.
- [x] [Fixed] 🔗 Restored shared-token trip loading so valid shared links no longer get rejected as unavailable.
- [x] [Improved] 🧭 Improved shared-link reliability by aligning lifecycle handling with live trip status and expiry metadata.
- [ ] [Internal] 🔐 Added admin identity edge API wiring for invite/direct creation and hard-delete operations using service-role authorization.
- [ ] [Internal] 🧾 Added admin audit log schema and RPC plumbing for user/trip/tier action tracking and replay.
- [ ] [Internal] 🛡️ Hardened profile update safety with privileged-field guardrails while preserving user self-service edits for profile data.
- [ ] [Internal] 🧩 Isolated admin routes into a dedicated lazy-loaded workspace router so non-admin paths avoid admin chunk preload/bundle impact.
- [ ] [Internal] 📘 Added explicit RBAC hardening TODOs documenting the migration from compatibility permissions to strict role-only checks.
- [ ] [Internal] 🧯 Updated SQL migration order to drop/recreate legacy RPCs (`get_current_user_access`, `admin_list_users`, `admin_get_user_profile`) when return signatures evolve.
- [ ] [Internal] 🧬 Switched admin user identity resolution to aggregate providers from auth identities so account-type classification is more reliable.
- [ ] [Internal] 🗂️ Added a deferred open-issue playbook for identity linking/account merge policy, data migration, and admin safety checks.
- [ ] [Internal] 🧾 Added a dedicated audited admin override commit path for non-owned trip edits with lifecycle lock enforcement.
- [ ] [Internal] 🧱 Added a dedicated admin-only hard-delete trip RPC with audit logging so permanent removals are tracked server-side.
- [ ] [Internal] 🧭 Updated agent copy/i18n rules so admin workspace text is English-only by default and exempt from EN/DE sign-off prompts.
- [ ] [Internal] 🧩 Standardized admin destructive confirmations on the shared styled app dialog (`useAppDialog`) and documented prompt-component reuse in repo guidelines.
- [ ] [Internal] 🧪 Added a local Vite proxy plus `dev:netlify` workflow so admin identity actions (`invite`, `create`, `hard delete`) can be tested reliably in development.
- [ ] [Internal] 📘 Documented an env-safe Netlify CLI deploy workflow (`dotenv-cli`) in the LLM/deploy guides so preview builds include required `VITE_SUPABASE_*` keys.
