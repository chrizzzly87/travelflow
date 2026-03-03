---
id: rel-2026-03-03-zero-results-route-availability-followup
version: v0.0.0
title: "German-ready Terms, acceptance tracking, and re-accept enforcement"
date: 2026-03-03
published_at: 2026-03-03T10:00:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Implemented a production-ready Terms system with versioning, audited acceptance records, and mandatory re-accept flow."
---

## Changes
- [x] [Improved] 📜 Replaced the placeholder Terms page with a complete Terms of Service document, including visible version and last-updated metadata.
- [x] [Improved] ✅ New registrations now require explicit acknowledgement of Terms of Service and Privacy Policy before account creation can continue.
- [x] [Improved] 🔐 Signed-in users are now blocked from protected account areas until they accept the current Terms version when a re-accept is required.
- [x] [Improved] 📣 Signed-in users now receive a global in-app legal notice when Terms change, including non-blocking “inform-only” updates.
- [x] [Fixed] 🛠️ Admin accounts can now keep using the admin workspace even when Terms re-acceptance is pending.
- [x] [Fixed] 🎛️ Terms notice banners no longer briefly flash before redirecting users to the Terms acceptance page.
- [x] [Improved] 🧭 Terms notices now use the shared global-note visual style with a clearer legal icon treatment.
- [x] [Improved] 💳 Billing language now clarifies the Merchant-of-Record checkout model while keeping platform-use contract ownership transparent.
- [x] [Improved] 🧩 Admin workspace now includes a Legal Terms panel to publish DE/EN Terms versions, switch current versions, and test force vs inform rollout modes.
- [x] [Improved] ⚖️ Legal notice and dispute-resolution wording was updated for current German DDG/VSBG framing, including EU ODR discontinuation context.
- [x] [Improved] 📊 Admin user table now supports a Terms acceptance filter, optional Terms/Last-log columns, and saved per-admin column preferences.
- [x] [Improved] 🧱 Admin user and audit tables now keep their leading selection column visible while horizontally scrolling.
- [x] [Improved] 📚 User detail drawers now paginate connected trips and user change logs in smaller chunks for faster scanning.
- [x] [Improved] 🎚️ Audit action filters now start with all action checkboxes selected, with quick select-all/deselect-all controls.
- [x] [Fixed] 🧾 Terms acceptance events now include before/after profile snapshots so admin user-change diffs show what changed.
- [x] [Fixed] 🧮 Terms publish/switch SQL now qualifies current-version column references to avoid ambiguous `is_current` errors.
- [x] [Improved] 🧠 Terms publishing now auto-suggests and auto-bumps to the next available version to prevent accidental duplicates.
- [x] [Improved] 📌 Admin users/trips tables now use more robust sticky-column sizing with truncated UUID copy chips and horizontal-scroll shadow cues.
- [x] [Improved] 🕒 Admin users table now shows both relative and exact timestamps for last sign-in and last-log columns.
- [x] [Improved] 🧷 Trips table now keeps the checkbox + trip columns sticky together as one frozen left block while horizontally scrolling.
- [x] [Improved] 🧪 User details now include a testing action to reset Terms acceptance state without manual database edits.
- [x] [Fixed] 🧭 Admin logs now show descriptive labels for Terms reset and username-cooldown reset actions, with user-change diff entries for cooldown resets.
- [x] [Fixed] 🔢 Terms draft versioning now increments from the highest existing suffix and keeps the date prefix read-only to prevent regressions like `-2` to `-1`.
- [ ] [Internal] 🧾 Added append-only Terms version and acceptance-event storage with profile snapshot fields for fast access checks and audits.
- [ ] [Internal] 🗃️ Terms versions now persist full DE/EN markdown content in the database so `/terms` always renders the current published legal text.
- [ ] [Internal] 🧮 Extended access and admin data contracts to include Terms acceptance state, then propagated those fields through auth/admin services.
- [ ] [Internal] 🧯 Terms acceptance UI now surfaces the underlying save error message to make RPC/schema rollout issues diagnosable in-app.
- [ ] [Internal] 🧱 Hardened Terms acceptance RPC writes with a backward-compatible insert fallback for partially migrated databases.
- [ ] [Internal] 🧪 Added regression coverage for Terms guard redirects, acceptance submission flow, register consent gating, and admin acceptance visibility.
