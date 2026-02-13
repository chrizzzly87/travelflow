---
id: rel-2026-02-12-i18n-locale-seo-rollout
version: v0.37.0
title: "I18n foundation and locale-aware SEO rollout"
date: 2026-02-12
published_at: 2026-02-12T20:35:58Z
status: published
notify_in_app: false
in_app_hours: 24
summary: "Improved multilingual UX with faster switching and persistent locale-banner dismissal across language changes."
---

## Changes
- [x] [New feature] 🌍 Marketing pages now support localized URLs for Spanish, German, French, Italian, Portuguese, and Russian while English stays on root URLs.
- [x] [New feature] 🇪🇸 Added full Spanish translations across all active namespaces (home, features, pages, pricing, blog, legal, settings, and shared UI).
- [x] [New feature] 🇵🇹 Added full Portuguese translations across all active namespaces (home, features, pages, pricing, blog, legal, settings, and shared UI).
- [x] [Improved] 🎛️ Language selectors now use a consistent style, include Spanish correctly, and follow the requested order: English, Spanish, German, French, Italian, Portuguese, Russian.
- [x] [Improved] 🧭 Language switching preserves the current route when possible and avoids forced browser-language redirects.
- [x] [Fixed] 📱 Mobile language switching now updates reliably from the menu and applies locale changes consistently across page sections.
- [x] [Improved] 🏷️ Locale and translation-info banners now use shorter mobile CTA labels to avoid awkward wrapping on small screens.
- [x] [Fixed] 🙈 Global hover tooltips are now disabled on touch/mobile devices to prevent sticky floating labels.
- [x] [Improved] 🔕 Dismissing the locale suggestion banner now hides it for the rest of the current session.
- [x] [Fixed] ✅ Locale suggestion dismissal now remains persistent while switching between languages in the same session.
- [x] [Fixed] 🚫 After switching via the language suggestion CTA, the suggestion banner is now acknowledged and no longer shown again.
- [x] [Improved] ⚠️ Translation quality notice banner can now be dismissed for the current session.
- [x] [Improved] 📰 Non-English blog pages can show native + English articles with a locale-aware language filter and clear English-content notice.
- [x] [Fixed] 🔗 English blog entries opened from non-English views now route to the correct article language variant.
- [x] [Improved] ✍️ Blog pages now feature a creator-focused community CTA for bloggers and storytellers to submit ideas via contact.
- [x] [Improved] 🔤 Blog cards and article content now set explicit `lang` attributes per post language (including `lang="en"` for English content on non-English pages).
- [x] [Improved] 🔎 Localized marketing pages now output locale-aware canonical and `hreflang` clusters, including `x-default`, plus localized title/description metadata.
- [x] [Improved] 🍪 Cookie consent banner and shared footer/header CTA copy are now localized for all supported locales.
- [x] [Fixed] 🧩 Placeholder interpolation now resolves correctly in translated strings (for example `{year}`, `{appName}`, counts, and query values).
- [ ] [Internal] 🗺️ Expanded sitemap/blog validation/edge metadata locale support to include Spanish and Portuguese.
- [ ] [Internal] 📘 Updated i18n and LLM docs so new localized pages follow consistent routing, SEO, copywriting, and analytics conventions.
- [ ] [Internal] 📊 Locale-switch attribution now uses Umami event payload fields instead of URL query tracking params.
