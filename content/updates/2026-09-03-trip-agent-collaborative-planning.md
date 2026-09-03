---
id: rel-2026-09-03-trip-agent-collaborative-planning
version: v0.162.0
title: "Plan together with Trip Agent"
date: 2026-09-03
published_at: 2026-09-03T12:00:00Z
status: draft
notify_in_app: true
in_app_hours: 24
summary: "Trip Agent brings shared, context-aware planning into each trip while keeping every edit under your control."
---

## Changes
- [x] [New feature] 💬 Open a shared AI planning chat directly beside your trip and continue the conversation after reloading.
- [x] [New feature] 📍 Select a city or itinerary item before chatting so Trip Agent understands exactly what you want to discuss.
- [x] [New feature] ✅ Review proposed edits one by one, compare before and after, and apply only the changes you choose.
- [x] [Improved] 🕰️ Approved edits become one undoable trip version, keeping the existing history clear and predictable.
- [x] [Improved] 🛡️ Free accounts start with three server-enforced requests per UTC day, with a clear reset notice when the limit is reached.
- [x] [New feature] ⌨️ Type `@` to attach a city, activity, stay, or transfer to your prompt, and `/` to pick a ready-made planning request.
- [x] [New feature] 🧠 Follow Trip Agent's thinking steps in the conversation while it works.
- [x] [Improved] ♻️ Failed requests now appear as a card inside the chat with a named reason and a one-click retry of the same message.
- [x] [Improved] 🧵 Thinking and tool steps now collapse into one line per stretch of work, with chips you can open for detail, instead of a card per event.
- [x] [Improved] 👀 Suggested trip changes are now picked first and previewed as a before-and-after result before anything is saved.
- [x] [Improved] 🕒 Chat bubbles show a short relative time instead of repeating your name.
- [x] [Improved] 🗂️ Chats are named after your first question and the history menu groups them by today, the last 7 days and older.
- [x] [Fixed] 🧩 Fixed the proposal step failing outright when a suggested change was shaped slightly wrong; it is now corrected and retried automatically.
- [x] [Improved] 🧠 Trip Agent now runs on the same default model as the rest of the app, with light thinking, so answers arrive faster and without a wall of reasoning.
- [x] [Fixed] 🧱 Fixed requests that ended with nothing at all: complex itinerary edits ran out of room mid-answer before a single change was proposed.
- [x] [Fixed] 🛰️ Fixed every request failing outright: two conflicting thinking settings were sent to the model provider at once.
- [x] [Improved] ⌨️ The `@` and `/` menus now filter as you type and respond to arrow keys and Enter.
- [x] [Improved] 🏷️ Attached context sits inside the message box as removable chips.
- [x] [Fixed] 🔄 Answers left running when you closed the tab no longer spin forever after a reload; you can simply ask again.
- [x] [Improved] ⏱️ While it works you now see the running step and a live timer, plus a note when a request takes longer.
- [x] [Improved] 🔍 Every step chip opens to show what it actually did, and a new panel lists what Trip Agent can read, research and propose.
- [x] [Improved] 🏷️ Attached trip context now sits as removable chips with icons inside the message box.
- [x] [Fixed] 💾 Fixed the failure that saved your message but never started a reply, and restores the used request when a reply cannot start.
- [x] [Fixed] 🔤 The thinking indicator now uses the same text size as the rest of the conversation.
- [ ] [Internal] 🔐 Added persistent shared threads, messages, runs, tool records, proposals, prompt versions, quotas, and atomic approval records behind an admin-preview feature flag.
- [ ] [Internal] 🧭 Added allowlisted specialist boundaries for grounded stay and route research, with an explicit unavailable state when Maps grounding is not configured.
- [ ] [Internal] 🧪 Added typed-operation and history-adoption regression coverage plus deterministic server-side validation paths.
- [ ] [Internal] 🪵 Accepted empty successful PostgREST write bodies, added quota refunds on pre-stream failures, and added bounded request/run failure logging without prompts or credentials.
- [ ] [Internal] 🗺️ Resolved the stay and route specialists through the shared model resolution so they can run without the AI Gateway, and documented the runtime in docs/trip-agent/ARCHITECTURE.md.
- [ ] [Internal] 🔌 Added a flat wire schema for trip-change operations plus a typed converter, because function-calling models could not emit the discriminated union; added a read-only dry-run script that replays one turn against a real trip.
- [ ] [Internal] 🎚️ Routed the planner through the app-wide default model with an OpenRouter reasoning-effort control and a larger output budget; replaced ICU plural strings, which this app never registered.
- [ ] [Internal] 🎛️ Grouped chat activity, questionnaire-style proposal review, relative timestamps and recency-grouped thread history; dropped the math/mermaid/shiki markdown plugins and made the shared button forward refs for preact/compat popovers.
- [ ] [Internal] 🧱 Raised the Netlify build to Node 22 with a 4 GB heap; the AI SDK, streamdown and shiki module graph exceeded the default V8 heap and aborted every deploy of this branch.
- [ ] [Internal] 🔗 Attached chat context is now described in the run instructions as untrusted data, not only exposed through the trip-context tool.
