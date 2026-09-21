---
id: rel-2026-09-21-faq-page-translations
version: v0.186.0
title: "The FAQ page now speaks your language"
date: 2026-09-21
published_at: 2026-09-21T06:44:21Z
status: published
notify_in_app: true
in_app_hours: 24
summary: "The help centre was still answering in English on every language version — questions, answers and headings are now translated across all supported languages."
---

## Changes
- [x] [Fixed] 🌍 The help centre answered in English no matter which language you were browsing in. Every heading, question and answer is now translated.
- [x] [Improved] 💬 When an answer tells you which option to pick on the contact form, it now names that option exactly as the form shows it in your language, so you can find it without guessing.
- [x] [Improved] 🧭 The short list of common questions on the contact page is translated too, instead of switching to English halfway down.
- [ ] [Internal] 🗂️ Moved the FAQ heading, section titles and all 16 question/answer pairs out of hardcoded component literals into a new `faq` locale namespace across all 11 locale bundles.
- [ ] [Internal] 🔗 Contact-form option names quoted inside FAQ answers are interpolated from the existing `common:contact.form.*` keys rather than re-translated, so the quoted label cannot drift from the form.
- [ ] [Internal] ✅ Added regression coverage asserting the FAQ heading resolves from the locale bundle and that a non-English locale renders translated headings and interpolated labels.
