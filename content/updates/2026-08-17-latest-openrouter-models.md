---
id: rel-2026-08-17-latest-openrouter-models
version: v0.159.0
title: "Latest AI models for trip planning"
date: 2026-08-17
published_at: 2026-08-17T12:00:00Z
status: draft
notify_in_app: true
in_app_hours: 24
summary: "Trip creation and model benchmarks now include a live OpenRouter catalog, newer Google Flash and Kimi options, and clearer model controls."
---

## Changes
- [x] [New feature] 🧠 Trip creation and AI benchmarks now offer Claude 5, Gemini Flash 3.7, Kimi K3, Grok 4.6, and DeepSeek V4 alongside GLM 5.2.
- [x] [New feature] 🎛️ Admins can choose the public trip-creation default, filter the live model catalog, hide older models, and remove every benchmark target at once.
- [x] [Improved] ✨ A clearer model workspace and prominent add action make benchmark setup faster and easier to understand.
- [x] [Improved] ⚡ Benchmarks use speed-first routing, compact structured output, and selectable reasoning effort to reduce avoidable delays.
- [x] [Improved] 🧭 A unified benchmark setup keeps trip templates, execution controls, and model selection in one focused workflow.
- [x] [Improved] 🎚️ Each compatible model can use its own reasoning level, while adjustable parallel requests help reduce provider contention and timeouts.
- [x] [Improved] 🔎 Trip template details now include a readable scenario overview and syntax-highlighted structured data.
- [x] [Fixed] ⏱️ Trip benchmarks no longer waste their time limit retrying loosely formatted model responses.
- [x] [Fixed] ⏱️ Running-time counters now update once per second without refreshing the entire benchmark dashboard.
- [ ] [Internal] 🔒 Live imports require explicit admin approval and compatible structured output before production use.
