---
id: rel-2026-10-09-openrouter-model-refresh
version: v0.205.0
title: "A faster, fresher AI benchmark lineup"
date: 2026-10-09
published_at: 2026-10-09T01:25:13Z
status: published
notify_in_app: true
in_app_hours: 24
summary: "The benchmark dashboard now starts with a smaller, faster set of current AI models while keeping premium alternatives available."
---

## Changes
- [x] [Improved] ⚡ The default benchmark lineup is now limited to eight current models chosen for speed, provider coverage, and structured trip output.
- [x] [New feature] 🧠 New OpenAI, Claude, Gemini, Grok, DeepSeek, GLM, Qwen, and Mistral models are available with model-specific reasoning choices where supported.
- [x] [Fixed] 🧹 Three discontinued model options no longer appear or fail when selected.
- [ ] [Internal] 🔎 Added a repeatable authenticated catalog audit that reports compatible, unavailable, and stale model identifiers without exposing credentials.
- [ ] [Internal] 🧪 Verified every newly approved model with a live schema-constrained OpenRouter request and expanded catalog, runtime, and preference migration coverage.
