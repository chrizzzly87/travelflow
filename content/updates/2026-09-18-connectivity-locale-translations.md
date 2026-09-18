---
id: rel-2026-09-18-connectivity-locale-translations
version: v0.175.0
title: "Connection and trip messages now speak your language"
date: 2026-09-18
published_at: 2026-09-18T10:00:00Z
status: draft
notify_in_app: true
in_app_hours: 24
summary: "Sync warnings, trip details and the storage notice were still showing English on every non-English page. They are now translated across all ten languages, including Persian and Urdu."
---

## Changes
- [x] [Fixed] 🌍 Connection and sync messages appeared in English on every non-English page. They now read in your own language, so you can tell whether your edits are safe without switching to English.
- [x] [Fixed] 🧭 Trip details, the history panel, calendar export and the retry messages were also still English. All of them are translated now.
- [x] [Fixed] 🗄️ The "device storage is full" notice showed unreadable placeholder text instead of a sentence, in every language including English.
- [x] [Improved] 🇮🇷 Persian and Urdu were missing large parts of the contact form, the trip screens and several dialogs, which fell back to English. Both languages are now complete.
- [x] [Improved] 🔤 Restored the accented characters that were stripped out of German, Spanish, French, Italian, Portuguese and Polish messages, so words like "verfügbar" and "podróży" are spelled properly again.
- [x] [Fixed] 🇵🇱 The Polish menu was missing its sign-out and admin labels.
- [x] [Improved] ☁️ Outage messages no longer name the storage provider we use behind the scenes — they just say what is happening to your edits.
- [ ] [Internal] Translated the `connectivity` and `tripView` blocks of `locales/*/common.json` across `de`, `es`, `fr`, `pt`, `it`, `ru`, `pl`, `ko`, `fa` and `ur`: 210 keys per locale, previously verbatim English. English is unchanged.
- [ ] [Internal] Brought `fa` and `ur` to full key parity on `common.json` (177 keys each were absent, covering `contact`, `appDialog`, `connectivity`, `tripView` and `networkStatus`) and dropped two dead keys that existed in no other locale and in no code path.
- [ ] [Internal] 🧮 Russian and Polish only have `One`/`Many` variants available, but both languages need three plural forms. Their `Many` strings are phrased so the count is not grammatically governed by the noun ("Изменений в очереди: {count}"), which reads correctly for every value rather than only for 2–4.
- [ ] [Internal] Replaced `storageNotice.tripsPrunedDescription` with explicit `*One`/`*Many` keys in all 11 locales and moved variant selection into `app/bootstrap/useTripsPrunedNoticeBootstrap.ts`. It was the only ICU plural block in the repo, and `i18next-icu` is never registered in `i18n.ts`, so it rendered as raw pattern source.
- [ ] [Internal] `scripts/validate-i18n.mjs` only compared namespace *files* and `{{…}}` tokens — not keys, not values. It now hard-fails on any ICU plural/select block, and warns on key-parity gaps and values identical to English, with `--strict` to escalate. Warnings stay non-fatal because `pnpm build` runs this script and ~3,000 strings in other namespaces are still untranslated.
- [ ] [Internal] Added `scripts/i18n-identical-allowlist.json` for the values that legitimately match English (language endonyms, brand names, the support address, unit formats, and per-locale loanwords such as "Offline" in German).
- [ ] [Internal] Added regression coverage: `tests/unit/connectivityLocaleCoverage.test.ts` (no English left in the two blocks, key and placeholder parity), `tests/unit/localeIcuPluralSyntax.test.ts` (no ICU plural in any namespace) and `tests/unit/tripsPrunedNotice.test.ts` (variant selection).
