---
id: rel-2026-09-28-trip-agent-instant-open
version: v0.199.0
title: "Plan with AI opens instantly"
date: 2026-09-28
published_at: 2026-09-28T12:00:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "The Plan with AI panel opens the moment you click, new chats start instantly, and your chat history lives right inside the panel."
---

## Changes
- [x] [Improved] ⚡ The Plan with AI panel now opens the moment you click the button, with a short loading preview inside while your chat arrives.
- [x] [Improved] 💬 Starting a new chat is instant, and chats you never write in don't clutter your history.
- [x] [Improved] 🌅 A new visit starts with a fresh chat, with your three most recent conversations one click away.
- [x] [Improved] 🗂️ Your chats are now one click away from the chat title, with search, and archive actions that appear when you point at a chat.
- [x] [New feature] ♻️ Archived chats have their own list, where you can restore them.
- [x] [Improved] 🏎️ Your chat loads faster: it starts preparing as soon as you point at the button, and reopening the panel shows your last conversation right away.
- [x] [Fixed] 🧱 The panel is no longer covered by the trip header on smaller screens.
- [ ] [Internal] 🧩 Split the panel into a small frame that ships with the planner and a separately loaded chat chunk; the chunk is fetched while the page is idle.
- [ ] [Internal] 🪪 Drafts get their id in the browser and are saved on first send (`createThread` accepts the id, idempotently); added a `restoreThread` action. No migration.
- [ ] [Internal] 🧭 Which chat is open is remembered per tab in session storage (registered as essential).
- [ ] [Internal] 🐛 Fixed the panel loading its data twice on every open, and a slow response overwriting a newer chat selection.
- [ ] [Internal] 🧪 Added tests for the panel shell, drafts, sessions, history actions, prefetch reuse and the new server actions.
