---
id: rel-2026-05-21-openrouter-truncation-recovery
version: v0.113.0
title: "More reliable OpenRouter trip generation"
date: 2026-05-21
published_at: 2026-05-21T11:55:25Z
status: published
notify_in_app: false
in_app_hours: 24
summary: "Improved recovery when OpenRouter models return incomplete itinerary JSON."
---

## Changes
- [x] [Fixed] 🧩 OpenRouter trip generation now retries incomplete itinerary responses with a shorter JSON recovery pass.
- [ ] [Internal] 🧪 Added regression coverage for truncated Gemini responses through the OpenRouter path.
