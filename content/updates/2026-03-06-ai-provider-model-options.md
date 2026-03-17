---
id: rel-2026-03-06-ai-provider-model-options
version: v0.0.0
title: "Expanded AI model options for planning and benchmark runs"
date: 2026-03-06
published_at: 2026-03-06T10:00:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Expanded trip planning and benchmark model coverage with more OpenRouter options and updated execution allowlists."
---

## Changes
- [x] [Improved] 🤖 Added three new AI model choices for trip planning: Gemini 3.1 Flash Lite Preview, GPT-5.4, and GPT-5.4 Pro.
- [x] [Improved] 🧠 Added three more OpenRouter model choices across trip creation and benchmark testing: Nemotron 3 Super Free, Grok 4.20 Beta, and Qwen3.5-9B.
- [x] [Fixed] 🧾 Admin trip details now show richer generation failure context, including raw attempt metadata, queue timing, and latest worker payload details for faster timeout diagnosis.
- [ ] [Internal] 💵 Added benchmark estimate coverage and runtime allowlist support for the new models.
- [ ] [Internal] ⏱️ Raised the default async AI worker timeout to 120 seconds and aligned stale-attempt recovery heuristics so slower GPT-5.4 runs are less likely to fail prematurely.
- [ ] [Internal] 🛑 Slow-generation trip banners no longer offer abort-and-retry while an async worker attempt is still running, preventing overlapping GPT-5.4 retries from the trip view.
