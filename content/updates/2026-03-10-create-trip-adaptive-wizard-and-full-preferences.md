---
id: rel-2026-03-10-create-trip-adaptive-wizard-and-full-preferences
version: v0.0.0
title: "Create Trip now adapts the wizard flow and uses the full planning brief"
date: 2026-03-10
published_at: 2026-03-10T16:45:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Trip creation now starts from what the traveler already knows, carries traveler and transport constraints through generation, and uses stricter prompt rules for more reliable itinerary output."
---

## Changes
- [x] [Improved] 🧭 Trip creation now starts by asking what you already know, then reorders the wizard around destinations, dates, or inspiration instead of forcing one fixed flow.
- [x] [Improved] 👨‍👩‍👧‍👦 Traveler setup, trip style, transport preferences, route constraints, and flexible timing now actively shape routes, activities, and suitability warnings in generated itineraries.
- [x] [Improved] 🕛 Exact-date trips now assume midday arrival and departure, so trip spans, loading previews, and real timeline stays use half-day boundaries with more accurate labels like 3 days / 2 nights.
- [x] [Improved] 🧾 The planner now uses stricter itinerary instructions so trip generation is more likely to return the expected JSON structure without losing practical travel guidance.
- [x] [Fixed] 🗺️ Trip maps now recover missing city markers more reliably by resolving ambiguous stop names like island localities with destination context instead of dropping the route.
- [x] [Fixed] 🔁 Returning to a claimed trip setup after switching login methods no longer loops claim errors or spams loading/auth modals and warning toasts.
- [x] [Improved] 🧭 If a trip draft was already claimed by another account, the planner now shows a dedicated modal with clear next steps and a create-similar shortcut that carries the full trip setup back into Create Trip.
- [x] [Fixed] 🔐 Anonymous trip starts now move from a short loading state into a dedicated account-required modal, so signing in to claim and start the trip feels clearer and more intentional.
- [x] [Fixed] ✉️ Correcting your email during anonymous sign-up no longer fails just because you reused the same password while upgrading the guest session.
- [x] [Improved] 🔔 Trip creation now asks whether you want a browser notification before generation starts and can notify you when the itinerary finishes in a background tab.
- [x] [Improved] ⚠️ Traveler-fit cautions from itinerary generation are now easier to review in trip information, instead of being buried only inside city descriptions.
- [ ] [Internal] 🧰 Added worktree bootstrap helpers that copy local `.env` and `.env.local` files into active worktrees before dev startup.
- [ ] [Internal] 🧪 Added an opt-in Playwright auth sandbox and claim-conflict end-to-end coverage so queued-trip login/register handoffs can be tested without real accounts.
- [ ] [Internal] 🧪 Added shared create-trip draft payloads, benchmark metadata updates, and regression coverage for prompt building, prefill decoding, and the adaptive wizard flow.
