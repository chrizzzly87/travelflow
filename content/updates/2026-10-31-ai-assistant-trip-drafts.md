---
id: rel-2026-10-31-ai-assistant-trip-drafts
version: v0.213.0
title: "Plan with your own AI assistant"
date: 2026-10-31
published_at: 2026-10-31T19:48:42Z
status: published
notify_in_app: false
in_app_hours: 24
summary: "Ask ChatGPT, Claude or Gemini to plan a trip, then open it in TravelFlow and save it to your trips."
---

## Changes
- [x] [New feature] 🤖 Ask ChatGPT, Claude or Gemini to plan a trip and send it to TravelFlow. You get a link that opens the full trip on a timeline and map.
- [x] [New feature] 📋 Using a chat that can't send it for you? Paste the assistant's answer on the new import page and your trip opens right away.
- [x] [Improved] 💾 Save a trip from an AI assistant to your trips with one click, then edit, share and export it like any other trip.
- [ ] [Internal] 🧩 Add a remote MCP server, in-page WebMCP tools, an HTTP API with OpenAPI, and llms.txt files that describe the trip format. None of them call our own models.
- [ ] [Internal] 🗄️ Store external trip drafts in their own table with rate limits and 30-day expiry, record each save, and add an admin overview of drafts and conversion.
