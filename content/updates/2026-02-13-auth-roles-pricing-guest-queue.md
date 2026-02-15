---
id: rel-2026-02-13-auth-roles-pricing-guest-queue
version: v0.51.0
title: "Auth, Tiers, and Guest Trip Queue Foundation"
date: 2026-02-13
published_at: 2026-02-13T14:06:09Z
status: published
notify_in_app: true
in_app_hours: 24
summary: "Added production auth with tier-based access, synced pricing tiers, and queued guest trip handoff."
---

## Changes
- [x] [New feature] 🔐 Added production login and registration with email/password plus Google, Apple, and Facebook sign-in.
- [x] [New feature] 🎒 Introduced Backpacker, Explorer, and Globetrotter tiers with entitlement-driven limits in app and database.
- [x] [Improved] 💳 Updated pricing page to render tier limits from the shared plan catalog without runtime database calls.
- [x] [New feature] 🧪 Added protected admin routes and admin navigation for dashboard, AI benchmark, and access control.
- [x] [New feature] ⏳ Added guest create-trip queue handoff: fake loading, delayed auth modal, then post-login generation resume.
- [x] [Improved] 🪟 Added login modal interception for normal login taps so users can authenticate in-context and continue on the same page.
- [x] [Improved] 🎨 Refined auth UI with branded social provider icons and stronger visual hierarchy for sign-in actions.
- [x] [Improved] 🧭 Added a dedicated admin navigation shell with direct links to Dashboard, AI Benchmark, Access Control, and a quick "Back to Platform" action.
- [x] [Improved] 🔁 Hardened OAuth return flow so post-login resumes reliably redirect users to the page where authentication started.
- [x] [Improved] 🛂 Added login/logout controls in trip and example views so auth actions are accessible directly inside the planner workspace.
- [x] [Improved] 🏷️ Added a lightweight "Last used" social provider badge on both login page and login modal using local storage preferences.
- [x] [Improved] ✅ Updated "Last used" provider behavior to persist only after a successful social login callback (not on click or failed attempts).
- [x] [Improved] 🧭 Restyled the admin header to match the main site navigation language while keeping admin-only links and a top-right back-to-platform action.
- [ ] [Internal] 🗃️ Added Supabase RPC and schema extensions for roles, tier overrides, queued generation requests, and auth flow logs.
- [ ] [Internal] 📈 Added auth observability with structured analytics events and local redacted `tf_auth_trace_v1` debugging buffer.
- [ ] [Internal] 🛡️ Migrated AI benchmark edge auth to admin bearer-token verification with optional emergency key fallback flag.
- [ ] [Internal] 🌐 Added i18n guardrails and validation for ICU placeholder syntax (`{name}`), locale parity checks, and namespace placement guidance for LLM agents.
- [ ] [Internal] 🧭 Expanded Supabase OAuth setup documentation with field-level dashboard mapping, direct auth links, and `travelflowapp.netlify.app` + `localhost:5173` examples.
