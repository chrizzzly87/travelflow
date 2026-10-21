---
id: rel-2026-09-18-native-i18next-plurals
version: v0.178.0
title: "Counted messages read correctly in Polish and Russian"
date: 2026-09-18
published_at: 2026-09-18T20:00:00Z
status: published
notify_in_app: false
in_app_hours: 24
summary: "Polish and Russian need more than a singular and a plural. The storage notice now uses the right form for two, five and twenty-two, instead of one wording stretched over all of them."
---

## Changes
- [x] [Fixed] 🔢 Polish and Russian have separate wording for two, five and twenty-two of something. The storage notice now picks the right one instead of reusing a single phrase for every count.
- [ ] [Internal] 🧪 Verified against `Intl.PluralRules` that i18next resolves plural categories correctly in this app: `pl` 2 → few, `pl` 5 → many, `ru` 11 → many. The `One`/`Many` split used elsewhere in `common.json` is a workaround that was never required — native suffix keys work with the existing single-brace interpolation config.
- [ ] [Internal] Converted `storageNotice.tripsPrunedDescription` from `*One`/`*Many` to i18next suffix keys across all 11 locales, giving each locale exactly the CLDR categories `Intl.PluralRules` resolves for it (ko `_other` only; ru/pl `_one`/`_few`/`_many`/`_other`). The caller now passes `count` and picks nothing.
- [ ] [Internal] `scripts/validate-i18n.mjs` compares plural keys by base name, so `key_few` existing in `pl` but not `en` is no longer reported as a parity gap.
- [ ] [Internal] 📚 Ported the i18n documentation from #495 (`AGENTS.md`, `CLAUDE.md`, `CODEX.md`, `LLM.md`, `docs/I18N_PAGE_WORKFLOW.md`, `docs/TECH_STACK.md`, `docs/UX_COPY_GUIDELINES.md`): ICU MessageFormat is unavailable, `i18next-icu` is an unused leftover, and plurals use suffix keys — with a per-locale CLDR category table. Applied as targeted line edits, not whole files, so the deploy-target and design-system sections added to `CLAUDE.md` since that branch forked are preserved.
- [ ] [Internal] Took #495's `tests/unit/storageNoticePlurals.test.ts` unchanged; it passes against the converted locale files. #495 is superseded and closed.
- [ ] [Internal] ⚠️ Follow-up: the `connectivity` and `tripView` `One`/`Many` key pairs from v0.176.0 still carry the two-way split, so their ru/pl strings are phrased to avoid grammatical agreement. They can now move to suffix keys and be written naturally.
