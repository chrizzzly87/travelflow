---
id: rel-2026-09-03-trip-agent-collaborative-planning
version: v0.162.0
title: "Plan together with Trip Agent"
date: 2026-09-03
published_at: 2026-09-03T12:00:00Z
status: draft
notify_in_app: true
in_app_hours: 24
summary: "Trip Agent brings shared, context-aware planning into each trip while keeping every edit under your control."
---

## Changes
- [x] [New feature] 💬 Open a shared AI planning chat beside your trip, pick up where you left off after a reload, and switch between past chats.
- [x] [New feature] 📌 Type `@` to attach a city, activity, stay or transfer to your message, and `/` to pick a ready-made request; both filter as you type.
- [x] [New feature] ✅ Review suggested edits grouped per stop, preview them in your own calendar, timeline and map, then apply only what you picked.
- [x] [New feature] 🧭 When a change frees up days, Trip Agent asks what to do with them and you choose an option — or type your own — in the chat.
- [x] [Improved] 🕰️ Approved edits land as one undoable trip version, and an applied set collapses to a single line with a Revert button.
- [x] [Improved] ⌨️ Cmd/Ctrl+Shift+P flips the preview on and off, also while you are typing; leaving the preview restores your plan exactly.
- [x] [Improved] 🌍 A moving orb, the running step and a live timer show that work is happening from the moment you hit send.
- [x] [Improved] 🔍 Each step opens to show what it actually did, and a panel lists what Trip Agent can read, research and propose.
- [x] [Improved] 🛡️ Free accounts get three requests per day, counted on the server, with a clear note when the limit resets.
- [x] [Improved] 🔒 Trip Agent's private thinking is no longer shown or stored — only the plan it writes for you.
- [x] [Improved] 🏷️ Failures name a plain-language reason with a retry, instead of an internal code or a silent stop.
- [x] [Fixed] 🧷 Fixed approved changes disappearing again, previews flickering, and a change that no longer fits breaking the whole review.
- [x] [Fixed] ↩️ Revert now puts back exactly the plan you had before applying, instead of undoing whatever you did last.
- [x] [Improved] ❓ When a change leaves a real choice open, Trip Agent asks first and proposes only once you have answered.
- [x] [Fixed] 📅 Fixed the calendar showing the previous plan until you switched views and back.

- [ ] [Internal] 🔐 Persistent shared threads, messages, runs, tool records, proposals, prompt versions and quotas behind an admin-preview flag, with atomic approval through one Supabase version.
- [ ] [Internal] 🔌 Flat wire schema for trip-change operations plus a typed converter and unknown-target validation, because function-calling models cannot emit the internal discriminated union.
- [ ] [Internal] 🎚️ Model resolution follows the approved app-wide default, with OpenRouter reasoning effort, data-collection denial and a run budget under Netlify's 60 second synchronous limit.
- [ ] [Internal] 🪵 Central redaction for logs, run records and client payloads; reasoning parts are stripped before persistence and on read.
- [ ] [Internal] 🧭 Allowlisted specialist boundaries for grounded stay and route research, with an explicit unavailable state when a server-side Maps grounding key is missing.
- [ ] [Internal] 🧪 Regression coverage for typed operations, wire conversion, redaction, mention parsing, change grouping and the preview-to-apply flow, plus a read-only dry-run script that replays a turn against a real trip.
- [ ] [Internal] 🧱 Netlify build on Node 22 with a 4 GB heap; dropped the math, mermaid and syntax-highlighting markdown packages that the chat never used.
- [ ] [Internal] 📄 Runtime documented in docs/trip-agent/ARCHITECTURE.md; migration 20260904120000 corrects share/expiry permission checks and the stale-proposal write.
