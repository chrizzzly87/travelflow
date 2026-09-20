---
id: rel-2026-09-20-ci-pipeline-reliability
version: v0.184.0
title: "Steadier build checks"
date: 2026-09-20
published_at: 2026-09-20T12:00:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Internal build checks no longer fail over words that are simply spelled the same in two languages, the whole pipeline can now be run locally before pushing, and the checks run on a supported runtime."
---

## Changes
- [ ] [Internal] 🧪 The connectivity/tripView locale gate now fails only on untranslated *sentences*. An audit of every identical value across all ten locales found "Standard", "Normal", "Base", "Satellite", "Export", "Debug", "General", "Direct", "Destination", "Visa", "Model", "Offline", "Online" and "Mono" — each correct in the language that flagged it. The heuristic had zero true positives and a dozen false ones, and paid for them with a per-locale allowlist that every new label had to be added to.
- [ ] [Internal] 📋 Short labels that match English are now printed as a note during the test run instead of failing it, so the signal survives without blocking a branch.
- [ ] [Internal] 🏷️ Brand-name keys are exempt from the sentence check rather than pinned to English — Google and Apple publish real localized names for Maps, and the Russian, Korean, Persian and Urdu locales correctly use them.
- [ ] [Internal] 🔒 Missing-key coverage, placeholder parity and the ICU-plural ban stay hard failures; only the identical-string heuristic was narrowed.
- [ ] [Internal] 🏃 Added a local runner for the PR Quality pipeline that mirrors the workflow stage for stage, warns when the local runtime differs from the pinned one, and reverts the files the build re-encodes so a run leaves no trace.
- [ ] [Internal] ⬆️ Bumped `actions/checkout`, `actions/setup-node` and `actions/upload-artifact` to v7 and `pnpm/action-setup` to v6 across all workflows, clearing the Node.js 20 deprecation warning. All four now run on node24.
- [ ] [Internal] 📝 Documented why `cache: pnpm` must stay explicit on `setup-node` — v6 limited automatic cache detection to npm.
