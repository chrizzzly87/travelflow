---
id: rel-2026-02-12-i18n-locale-seo-rollout
version: v0.53.0
title: "I18n foundation and locale-aware SEO rollout"
date: 2026-02-12
published_at: 2026-02-12T16:23:49Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Shipped multilingual routing and translation foundations, locale-aware SEO tags, and localized blog/planner behavior without changing tool URL contracts."
---

## Changes
- [x] [New feature] 🌍 Marketing pages now support locale-prefixed URLs for German, French, Italian, and Russian while keeping English on root URLs.
- [x] [Improved] 🧭 Added language switcher behavior that preserves the current route when possible and avoids forced browser-language redirects.
- [x] [Improved] 🔎 SEO metadata is now locale-aware with canonical handling, full `hreflang` clusters (including `x-default`), and localized `<html lang>`/`dir` attributes.
- [x] [Improved] 📰 Blog content now supports language-scoped posts and translation groups, including deterministic fallback to locale home when localized variants are missing.
- [x] [Improved] 🗺️ Planner/settings language support now covers EN/DE/FR/IT/RU while keeping `/create-trip`, `/trip/*`, and `/s/*` URL structures unchanged.
- [x] [Improved] 🗣️ Homepage copy and key page headlines are now localized across EN/DE/FR/IT/RU, including inspirations, updates, and share-unavailable views.
- [x] [Improved] 🍪 Cookie consent banner copy and actions are now translated for EN/DE/FR/IT/RU.
- [x] [Improved] 🌐 Locale-prefixed marketing pages now emit localized meta titles and descriptions in addition to localized `hreflang`/canonical clusters.
- [x] [Improved] ✍️ Fixed locale typography fidelity (umlauts/accents) across newly added DE/FR/IT translation strings and localized metadata labels.
- [x] [Fixed] 🧩 Locale placeholders now interpolate correctly across all languages (for example year/app name/count/query in footer, cookie banner, and dynamic labels).
- [x] [Improved] ⚠️ Non-English marketing pages now show an AI-translation disclaimer with a localized link to report translation issues.
- [x] [Improved] 📬 Added a localized contact placeholder page for translation feedback, available on `/contact` and locale-prefixed marketing routes.
- [x] [Improved] 📰 Non-English blog pages can now show native and English articles together with a language filter and clear English-article badge.
- [x] [Fixed] 🏳️ Language suggestion prompts no longer appear when the active locale is already part of the browser's preferred supported languages.
- [x] [Improved] 🎛️ Navigation language selectors now use a consistent input/button style with accessible labeling and flag-enhanced options.
- [ ] [Internal] 🧱 Introduced centralized locale and route contracts (`config/locales.ts`, `config/routes.ts`) plus locale path parsing/build helpers.
- [ ] [Internal] 🗺️ Added automated sitemap generation and robots rules for localized marketing/blog crawl coverage.
- [ ] [Internal] 📘 Added `docs/I18N_PAGE_WORKFLOW.md` and linked it from agent guidance files to standardize localized page implementation steps.
- [ ] [Internal] ✍️ Added `docs/UX_COPY_GUIDELINES.md` to standardize modern, friendly marketing/planner copy and transcreation quality rules.
- [ ] [Internal] 🗣️ Added an EN/DE copy sign-off requirement for agents before finalizing user-facing text updates.
- [ ] [Internal] 🇪🇸 Added baseline Spanish common translation resource at `locales/es/common.json` for future locale rollout.
- [ ] [Internal] 📊 Added analytics instrumentation requirements to LLM guidance and linked `docs/ANALYTICS_CONVENTION.md` so tracking format is applied consistently.
- [ ] [Internal] 🧭 Added repository agent rules to require logical-property checks for new UI changes and explicit clarification when direction-aware styling is ambiguous.
- [ ] [Internal] 🏷️ Added shared app globals (`config/appGlobals.ts`) so app name and default meta branding can be changed in one place across UI and edge metadata generators.
