# I18n + Locale Page Workflow

This document defines how to add or change localized pages in TravelFlow.

## URL Strategy (Locked)
- English marketing pages stay on root paths (example: `/features`).
- Non-English marketing pages use locale-prefixed paths (example: `/de/features`, `/fr/features`).
- Tool/app URLs stay unprefixed for tracking stability (example: `/create-trip`, `/trip/*`, `/s/*`, `/example/*`, `/admin/*`).

## Locale Contract
- Locale source of truth: `config/locales.ts`.
- Route building/parsing source of truth: `config/routes.ts`.
- Current phase locales: `en`, `de`, `fr`, `it`, `ru`.
- Direction map currently remains `ltr` for all active locales.
- Keep `document.documentElement.lang` and `document.documentElement.dir` in sync via runtime locale updates in `App.tsx`.

## Translation Files
- Runtime i18n bootstrap: `i18n.ts` (`i18next + react-i18next + i18next-icu`).
- Store strings per namespace at `locales/<locale>/<namespace>.json`.
- Interpolation uses ICU-style placeholders: `{name}` (not `{{name}}`).
- App name is provided through default interpolation variable `appName`.
- For tone and copy quality, apply `docs/UX_COPY_GUIDELINES.md` before writing localized strings.

## New Marketing Page Checklist
1. Add page component in `pages/` and wrap with `MarketingLayout` when applicable.
2. Add route key and path in `config/routes.ts`:
   - `RouteKey`
   - `buildPath(...)`
   - `LOCALIZED_MARKETING_ROUTE_KEYS`
   - `MARKETING_PATH_PATTERNS`
3. Register route in `App.tsx`:
   - lazy import
   - `MARKETING_ROUTE_CONFIGS`
   - preload rule (if route-level preloading is needed)
4. Add prefetch rule in `config/prefetchTargets.ts`.
5. Add localized strings in required namespaces for `en/de/fr/it/ru`.
6. Add SEO metadata in `netlify/edge-functions/site-og-meta.ts`:
   - `MARKETING_PATH_PATTERNS`
   - `PAGE_META`
   - `LOCALIZED_PAGE_META`
7. Add route to sitemap list in `scripts/generate-sitemap.mjs` (`MARKETING_PATHS`).
8. Update navigation/footer links to use route helpers (`buildLocalizedMarketingPath`).
9. Update release notes in `content/updates/*.md`.

## New Tool/App Page Checklist
1. Keep the URL unprefixed (no locale segment).
2. Use active app language for text + formatting.
3. Do not introduce locale-specific tool path variants unless explicitly approved.

## AI Translation Disclaimer
- Localized marketing pages show translation disclaimer banner via `components/marketing/TranslationNoticeBanner.tsx`.
- Banner is injected by `components/marketing/MarketingLayout.tsx`.
- Banner links to localized `/contact` route for reporting translation issues.

## Logical Properties Requirement (Direction Safety)
- For every new or updated component, evaluate if CSS logical properties should be used for direction safety:
  - Prefer properties like `margin-inline`, `padding-inline`, `inset-inline`, `text-align: start`, `border-inline`.
  - If physical properties are intentionally used (`left/right`, `ml/mr`, `pl/pr`), document the reason in code review or PR context.
- If direction behavior is ambiguous, ask product/user for clarification before finalizing.
- Even though active locales are `ltr`, components must be reviewed with future RTL support in mind.
