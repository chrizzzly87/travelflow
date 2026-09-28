---
id: rel-2026-09-28-trip-agent-instant-open
version: v0.197.0
title: "Plan with AI opens instantly"
date: 2026-09-28
published_at: 2026-09-28T12:00:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "The Plan with AI panel now slides open the moment you click, and your chat loads inside it faster."
---

## Changes
- [x] [Improved] ⚡ The Plan with AI panel now opens the moment you click the button, with a short loading preview inside while your chat arrives.
- [x] [Improved] 🏎️ Your chat loads faster: it starts preparing as soon as you point at the button, and a first chat is set up in a single step.
- [x] [Improved] 🔁 Reopening the panel on the same trip shows your last conversation right away while it checks for anything new.
- [ ] [Internal] 🧩 Split the panel into a small frame that ships with the planner and a separately loaded chat chunk; the chunk is fetched while the page is idle.
- [ ] [Internal] 🛰️ The bootstrap request can create the first thread itself (`ensureThread`), replacing a list → create → list sequence.
- [ ] [Internal] 🐛 Fixed the panel loading its bootstrap twice on every open, and a slow response overwriting a newer thread selection.
- [ ] [Internal] 🧪 Added tests for the shell rendering before its chunk, a single bootstrap per open, prefetch reuse, and thread resolution on the server.
