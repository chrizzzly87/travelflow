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
- [ ] [Internal] 🧩 Extended the shared itinerary structured-output schema into live create-trip and async worker generation so app traffic now follows the same JSON contract as Promptfoo and the admin benchmark.
- [ ] [Internal] 🛡️ Added regression coverage and workflow documentation for the strict structured-output schema subset so future schema edits do not silently break OpenAI-backed eval runs.
- [ ] [Internal] 🔧 Updated the local Promptfoo wrapper to auto-load repo env files and handle forwarded CLI flags cleanly, so `pnpm ai:eval` matches normal local developer expectations.
- [ ] [Internal] 🧭 Tightened the trip-generation prompt contract to match the shared schema keys and raised the eval token/concurrency defaults for steadier first-run Promptfoo smoke tests.
- [ ] [Internal] 🚨 Added a second Promptfoo security pack with adversarial classic-trip scenarios so prompt-injection attempts against notes, requested cities, and destinations can be checked locally and in manual CI.
- [ ] [Internal] 🧱 Extended the manual AI eval workflow to run the regression pack, the security pack, or both, with separate report artifacts for each.
- [ ] [Internal] 🔐 Hardened live trip prompt assembly so user-controlled request fields are rendered as explicit data blocks and no longer read like free-form model instructions.
- [ ] [Internal] 🔁 Hardened GPT-5-family OpenAI runtime fallback so temperature-restricted requests automatically continue through the Responses API instead of breaking create-trip or Promptfoo eval runs.
- [ ] [Internal] 🧾 Improved OpenAI structured-output diagnostics and compact retry handling so GPT-5 Nano/Mini refusal, incomplete, or truncation-prone Responses payloads no longer collapse into a misleading blank-content parse failure.
- [ ] [Internal] 📦 Raised the default OpenAI structured-output completion budget for itinerary generation so GPT-5 Nano/Mini have more room to finish valid JSON before truncation on create-trip, admin benchmark, and Promptfoo flows.
