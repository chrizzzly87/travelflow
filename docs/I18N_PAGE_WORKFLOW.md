# I18n + Locale Page Workflow

This document defines how to add or change localized pages in TravelFlow.

## URL Strategy (Locked)
- English marketing pages stay on root paths (example: `/features`).
- Non-English marketing pages use locale-prefixed paths (example: `/de/features`, `/fr/features`).
- Tool/app URLs stay unprefixed for tracking stability (example: `/create-trip`, `/trip/*`, `/s/*`, `/example/*`, `/admin/*`).

## Locale Contract
- Locale source of truth: `config/locales.ts`.
- Route building/parsing source of truth: `config/routes.ts`.
- Current phase locales: `en`, `es`, `de`, `fr`, `pt`, `ru`, `it`, `pl`, `ko`, `fa`, `ur`.
- Direction map is locale-based (`ltr` for most locales, `rtl` for `fa` and `ur`).
- Keep `document.documentElement.lang` and `document.documentElement.dir` in sync via runtime locale updates in `App.tsx`.

## Translation Files
- Runtime i18n bootstrap: `i18n.ts` (`i18next + react-i18next + i18next-icu`).
- Store strings per namespace at `locales/<locale>/<namespace>.json`.
- Interpolation uses ICU-style placeholders: `{name}` (not `{{name}}`).
- App name is provided through default interpolation variable `appName`.
- For tone and copy quality, apply `docs/UX_COPY_GUIDELINES.md` before writing localized strings.

## ICU Placeholder Rules (Mandatory)

Because this project uses `i18next-icu`, interpolation must follow ICU syntax.

- Correct: `{name}`, `{count}`, `{maxActiveTripsLabel}`
- Wrong: `{{name}}`, `{{count}}`, `{{maxActiveTripsLabel}}`

Examples:

- Correct: `"days": "{count} days"`
- Correct: `"Trip retention: {tripExpirationLabel}"`
- Wrong: `"days": "{{count}} days"`
- Wrong: `"Trip retention: {{tripExpirationLabel}}"`

Validation:

- Run `npm run i18n:validate` (also executed in `npm run build`).
- The validator fails if any locale string still contains legacy `{{...}}` placeholders.

## Namespace Placement Strategy

When adding new text, decide namespace first to avoid copy drift and duplication.

Global/shared namespaces:

- `common.json`: navigation, shared UI labels, repeated cross-page CTA/microcopy.
- `pages.json`: generic marketing page copy reused by multiple pages.
- `legal.json`: legal and compliance pages.

Route/feature-specific namespaces:

- `home.json`, `features.json`, `pricing.json`, `blog.json`, `auth.json`, `settings.json`, `wip.json`.
- Use these when copy is specific to one route/feature and unlikely to be reused globally.

Local feature data files (not global locale namespaces):

- For structured content tightly coupled to one feature, keep local data files (for example `data/exampleTripCards.ts`) if it is intentionally feature-scoped.
- If that content becomes locale-sensitive, migrate it to locale namespaces and load by language.

Namespace decision checklist:

1. Is this text reused in multiple pages/components? Use `common.json` (or `pages.json`/`legal.json` by domain).
2. Is this text only for one route/feature? Use that route namespace.
3. Is this structured feature data rather than simple UI copy? Consider a local data file first; localize later only if needed.
4. Document the chosen namespace in the PR summary when adding many keys.

## Locale Coverage Rules

Active locales must stay in sync: `en`, `es`, `de`, `fr`, `pt`, `ru`, `it`, `pl`, `ko`, `fa`, `ur`.

When adding a new key:

1. Add the key to `locales/en/<namespace>.json`.
2. Add the same key to all active locale files under the same namespace.
3. Run `npm run i18n:validate`.
4. Run `npm run build` before handoff.

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
5. Add localized strings in required namespaces for `en/es/de/fr/pt/ru/it/pl/ko/fa/ur`.
6. Add SEO metadata in `netlify/edge-functions/site-og-meta.ts`:
   - `MARKETING_PATH_PATTERNS`
   - `PAGE_META`
   - `LOCALIZED_PAGE_META`
7. Confirm sitemap coverage in `scripts/generate-sitemap.mjs`:
   - Indexable static marketing routes are auto-derived from `MARKETING_ROUTE_CONFIGS` in `App.tsx`.
   - If a static route is utility/error-only and should not be indexed, add it to `NON_INDEXABLE_STATIC_PATHS`.
8. Update navigation/footer links to use route helpers (`buildLocalizedMarketingPath`).
9. Update release notes in `content/updates/*.md`.

## New Tool/App Page Checklist
1. Keep the URL unprefixed (no locale segment).
2. Use active app language for text + formatting.
3. Do not introduce locale-specific tool path variants unless explicitly approved.
4. Admin workspace copy (`/admin/*`) is English-only by default; do not add locale keys for admin-only labels unless localization is explicitly requested.

## AI Translation Disclaimer
- Localized marketing pages show translation disclaimer banner via `components/marketing/TranslationNoticeBanner.tsx`.
- Banner is injected by `components/marketing/MarketingLayout.tsx`.
- Banner links to localized `/contact` route for reporting translation issues.
- Banner can be dismissed for the current browser session (session storage).

## Language Suggestion Banner Behavior
- Banner is shown only on marketing pages when browser-preferred locale differs from current locale.
- Dismissing the banner hides it for the current browser session.
- Switching via banner CTA permanently acknowledges the hint (stored locally), so it is not shown again on future visits unless storage is cleared.

## Logical Properties Requirement (Direction Safety)
- For every new or updated component, evaluate if CSS logical properties should be used for direction safety:
  - Prefer properties like `margin-inline`, `padding-inline`, `inset-inline`, `text-align: start`, `border-inline`.
  - If physical properties are intentionally used (`left/right`, `ml/mr`, `pl/pr`), document the reason in code review or PR context.
- If direction behavior is ambiguous, ask product/user for clarification before finalizing.
- Active locales now include RTL (`fa`, `ur`), so components must be reviewed for both direction modes.
