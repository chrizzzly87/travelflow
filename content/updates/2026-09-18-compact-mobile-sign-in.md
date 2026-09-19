---
id: rel-2026-09-18-compact-mobile-sign-in
version: v0.179.0
title: "The sign-in window fits on a phone screen — and now speaks your language"
date: 2026-09-18
published_at: 2026-09-19T12:00:00Z
status: draft
notify_in_app: true
in_app_hours: 24
summary: "Signing in on a phone no longer pushes the buttons off the bottom of the screen, and the whole sign-in screen is now translated in every language TravelFlow offers."
---

## Changes
- [x] [Fixed] 🌍 Signing in is now fully translated in Spanish, French, Portuguese, Italian, Polish, Russian, Persian and Urdu. Until now the whole sign-in and password-reset screen stayed in English in those languages, even with the rest of the app translated.
- [x] [Fixed] 📱 The sign-in window now fits on a phone screen. The intro lines above the form are hidden on small screens, so the email field and the buttons are visible the moment it opens.
- [x] [Improved] ✍️ The heading is shorter and sits on one line everywhere, on phones and on desktop.
- [x] [Improved] 🧹 The small note under the password links is gone — it explained something most people never needed and cost a line of space on every visit.
- [x] [Fixed] 📜 On a short screen the window now scrolls inside itself instead of running past the bottom edge.
- [x] [Improved] 🇰🇷 Korean sign-in now shows the terms and privacy wording in Korean instead of English.
- [ ] [Internal] 🗑️ `copy.passwordResetHint` removed from all eleven locale files and from both the modal and the login page.
- [ ] [Internal] 📐 The dialog is a flex column capped at `100dvh` minus the viewport padding, with the header pinned and the body scrolling.
- [ ] [Internal] 🌐 The `auth` namespace was an English copy in eight locale files; every key is now localized, with the provider placeholder preserved.
