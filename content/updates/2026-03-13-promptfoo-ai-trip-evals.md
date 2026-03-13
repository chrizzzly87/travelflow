---
id: rel-2026-03-13-promptfoo-ai-trip-evals
version: v0.91.0
title: "Promptfoo now covers classic AI trip regression checks"
date: 2026-03-13
published_at: 2026-03-13T11:00:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Added a report-only Promptfoo regression layer for classic AI trip creation, fused it with the shared benchmark validator and scenario mapping, and introduced a shared structured-output itinerary schema for evals."
---

## Changes
- [ ] [Internal] 🤖 Added a lightweight Promptfoo regression pack for classic AI trip creation that reuses the shared benchmark validator, scenario-to-prompt builder, and existing provider runtime.
- [ ] [Internal] 📊 Added a manual GitHub Actions workflow plus JSON and HTML report artifacts so AI trip eval runs can be shared without going through the admin benchmark UI.
- [ ] [Internal] 🧱 Added a shared itinerary JSON schema, enabled provider-time structured output where supported, and wired schema assertions into Promptfoo so evals catch JSON-shape drift earlier.
- [ ] [Internal] 🛡️ Added regression coverage and workflow documentation for the strict structured-output schema subset so future schema edits do not silently break OpenAI-backed eval runs.
- [ ] [Internal] 🔧 Updated the local Promptfoo wrapper to auto-load repo env files and handle forwarded CLI flags cleanly, so `pnpm ai:eval` matches normal local developer expectations.
