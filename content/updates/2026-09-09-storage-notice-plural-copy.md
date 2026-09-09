---
id: rel-2026-09-09-storage-notice-plural-copy
version: v0.164.0
title: "Readable storage notice in every language"
date: 2026-09-09
published_at: 2026-09-09T04:25:25Z
status: published
notify_in_app: false
in_app_hours: 24
summary: "The notice shown when older trips are removed to free up device space now reads as a proper sentence in all eleven languages."
---

## Changes
- [x] [Fixed] 🧹 The message about older trips being removed to free up space showed raw formatting code instead of a sentence. It now reads correctly, in singular and plural.
- [x] [Improved] 🔤 Restored the missing accents in that notice for German, Spanish, French, Italian, Portuguese and Polish.
- [ ] [Internal] 🈳 Replaced the inert ICU `plural` block in `storageNotice.tripsPrunedDescription` with i18next plural suffix keys across all 11 locales, covering every CLDR category each locale resolves.
- [ ] [Internal] 📄 Corrected the false `i18next-icu` claim in `CLAUDE.md`, `AGENTS.md`, `CODEX.md`, `LLM.md`, `docs/I18N_PAGE_WORKFLOW.md`, `docs/TECH_STACK.md` and `docs/UX_COPY_GUIDELINES.md`; the runtime registers no ICU plugin.
- [ ] [Internal] 🧪 Added `tests/unit/storageNoticePlurals.test.ts` guarding against raw ICU output and missing plural categories.
