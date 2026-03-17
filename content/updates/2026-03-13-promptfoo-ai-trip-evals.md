---
id: rel-2026-03-13-promptfoo-ai-trip-evals
version: v0.91.0
title: "Promptfoo now covers classic AI trip regression checks"
date: 2026-03-13
published_at: 2026-03-13T11:00:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Added a report-only Promptfoo regression layer for classic AI trip creation, extended it with a manual adversarial security pack, and hardened prompt assembly so user-controlled trip inputs are treated as data instead of instructions."
---

## Changes
- [ ] [Internal] 🤖 Added a lightweight Promptfoo regression pack for classic AI trip creation that reuses the shared benchmark validator, scenario-to-prompt builder, and existing provider runtime.
- [ ] [Internal] 📊 Added a manual GitHub Actions workflow plus JSON and HTML report artifacts so AI trip eval runs can be shared without going through the admin benchmark UI.
- [ ] [Internal] 🧱 Added a shared itinerary JSON schema, enabled provider-time structured output where supported, and wired schema assertions into Promptfoo so evals catch JSON-shape drift earlier.
- [ ] [Internal] 🛡️ Added regression coverage and workflow documentation for the strict structured-output schema subset so future schema edits do not silently break OpenAI-backed eval runs.
- [ ] [Internal] 🔧 Updated the local Promptfoo wrapper to auto-load repo env files and handle forwarded CLI flags cleanly, so `pnpm ai:eval` matches normal local developer expectations.
- [ ] [Internal] 🧭 Tightened the trip-generation prompt contract to match the shared schema keys and raised the eval token/concurrency defaults for steadier first-run Promptfoo smoke tests.
- [ ] [Internal] 🚨 Added a second Promptfoo security pack with adversarial classic-trip scenarios so prompt-injection attempts against notes, requested cities, and destinations can be checked locally and in manual CI.
- [ ] [Internal] 🧱 Extended the manual AI eval workflow to run the regression pack, the security pack, or both, with separate report artifacts for each.
- [ ] [Internal] 🔐 Hardened live trip prompt assembly so user-controlled request fields are rendered as explicit data blocks and no longer read like free-form model instructions.
- [ ] [Internal] 🛰️ Added production runtime safety monitoring that preflights user-controlled trip inputs, postflights model output, logs bounded security evidence to AI telemetry and trip attempts, and surfaces suspicious or blocked incidents inside the existing admin telemetry and trip diagnostics views.
- [ ] [Internal] 🧼 Added lightweight runtime prompt sanitization for obvious instruction-like fragments so safe trip intent can keep flowing without over-blocking traveler notes and destination fields.
- [ ] [Internal] 🧯 Fixed a trip-page safety recovery regression where the flagged-input review banner could initialize before its retry handlers, causing the recovery UI to crash instead of rendering.
- [ ] [Internal] 🧪 Improved local async retry ergonomics by proxying the enqueue endpoint through Vite and surfacing clearer dev-only guidance when Netlify worker routes are not running on `localhost:8888`.
- [ ] [Internal] 🔁 Hardened local editing and hot-reload behavior by keeping the wrapped app history on a single underlying listener and fixing the edge-runtime import path for the new prompt sanitization helper.
- [x] [Improved] 🛟 When AI trip generation pauses for suspicious text, you now get a guided review flow that highlights the affected fields and lets you edit or clear them before retrying.
