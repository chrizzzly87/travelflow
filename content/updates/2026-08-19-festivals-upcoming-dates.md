---
id: rel-2026-08-19-festivals-upcoming-dates
version: v0.162.0
title: "Festivals with real dates"
date: 2026-08-19
published_at: 2026-08-19T12:00:00Z
status: draft
notify_in_app: true
in_app_hours: 24
summary: "The festivals page is live with 84 celebrations across 42 countries, each showing its next date or the season it usually falls in."
---

## Changes
- [x] [New feature] 🎊 The festivals page is live: 84 celebrations across 42 countries, sorted so the next one to happen comes first.
- [x] [New feature] 📅 Every festival shows either its confirmed next date or an honest "usually in March" — we never guess a day we cannot source.
- [x] [New feature] 🏮 Lunar and movable celebrations like Lunar New Year, Diwali and Carnival carry confirmed dates for the years we could verify, and the rule that moves them the rest of the time.
- [x] [New feature] 🧭 Filter by region and month to find what is happening where you already want to go.
- [x] [New feature] 🧳 Start a trip straight from a festival card and the dates come with it, or jump to the country guide first.
- [x] [Improved] 🔗 Cards link out to the official festival or tourism board page so you can check the programme yourself.
- [ ] [Internal] Extended the shared destination event model with day, recurrence kind, and per-year known dates, with validation for each.
- [ ] [Internal] Added a pure, clock-injectable festival date resolution service covering fixed, lunar, movable and seasonal recurrence plus year-boundary rollover.
- [ ] [Internal] Added Event JSON-LD for the listed festivals, omitting dates for approximate occurrences.
