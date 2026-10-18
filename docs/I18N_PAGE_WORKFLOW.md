# I18n + Locale Page Workflow

This document defines how to add or change localized pages in TravelFlow.

## URL Strategy (Locked)
- English marketing pages stay on root paths (example: `/features`).
- Non-English marketing pages use locale-prefixed paths (example: `/de/features`, `/fr/features`).
- Trip/share/example/account/admin identity URLs stay unprefixed. Creation and library routes currently accept optional locale prefixes through their native route definitions; preserve existing URL contracts rather than inventing aliases. The route graph in `src/virtualRoutes.ts` is authoritative.

## Locale Contract
- Locale source of truth: `config/locales.ts`.
- Route building/parsing source of truth: `config/routes.ts`.
- Current phase locales: `en`, `es`, `de`, `fr`, `pt`, `ru`, `it`, `pl`, `ko`, `fa`, `ur`.
- Direction map is locale-based (`ltr` for most locales, `rtl` for `fa` and `ur`).
- The native root document in `src/routes/__root.tsx` emits `lang` and `dir`. Check both direct SSR and client navigation; do not reintroduce an App-level route interpreter to update them.
- `getRouter()` creates a request-local i18next instance on the server. Pass that instance to namespace preload helpers and `I18nextProvider`; never change the browser singleton from an SSR request.
- Native route preloading may load namespaces, but must not change the visible locale on hover. The root `beforeLoad` distinguishes preload from navigation.
- Optional locale parameters are validated by `app/routing/localePolicy.ts`. Default-language `/en` prefixes and unsupported prefixes are not canonical aliases.

## Translation Files
- Runtime i18n bootstrap: `i18n.ts` (`i18next + react-i18next`, no ICU MessageFormat plugin).
- Store strings per namespace at `locales/<locale>/<namespace>.json`.
- Interpolation uses single-brace placeholders: `{name}` (not `{{name}}`).
- App name is provided through default interpolation variable `appName`.
- For tone and copy quality, apply `docs/UX_COPY_GUIDELINES.md` before writing localized strings.

## Placeholder Rules (Mandatory)

`i18n.ts` overrides i18next interpolation to single braces
(`interpolation: { prefix: '{', suffix: '}' }`), so placeholders use one brace, not two.

- Correct: `{name}`, `{count}`, `{maxActiveTripsLabel}`
- Wrong: `{{name}}`, `{{count}}`, `{{maxActiveTripsLabel}}`

Examples:

- Correct: `"days": "{count} days"`
- Correct: `"Trip retention: {tripExpirationLabel}"`
- Wrong: `"days": "{{count}} days"`
- Wrong: `"Trip retention: {{tripExpirationLabel}}"`

### ICU MessageFormat is NOT available

The single-brace syntax above is *only* an interpolation prefix/suffix change. No ICU
plugin is registered with i18next, so ICU MessageFormat constructs are never parsed and
render literally to the user:

- Wrong: `"{count, plural, one {1 trip} other {# trips}}"` — the user sees that raw text.
- Wrong: `{count, number}`, `{date, date, short}`, `{gender, select, ...}`.

`i18next-icu` appears in `package.json` but is never wired into `i18n.ts` — it was
dropped from the runtime deliberately for bundle cost (see
`docs/PERFORMANCE_EXECUTION_TODO.md`). Do not infer ICU support from the dependency list.

### Pluralization

Use i18next native plural suffix keys, and pass `count` from the call site:

```json
"tripsPrunedDescription_one": "Your oldest saved trip was removed from this device to free up space.",
"tripsPrunedDescription_other": "Your {count} oldest saved trips were removed from this device to free up space."
```

```ts
t('storageNotice.tripsPrunedDescription', { count: prunedCount });
```

i18next selects the form via `Intl.PluralRules`, so each locale needs every CLDR category
it can resolve — not just `_one`/`_other`:

| Categories | Locales |
| --- | --- |
| `one`, `other` | `en`, `de`, `fa`, `ur` |
| `one`, `many`, `other` | `es`, `fr`, `pt`, `it` |
| `one`, `few`, `many`, `other` | `ru`, `pl` |
| `other` | `ko` |

Confirm a locale's categories with
`new Intl.PluralRules(locale).resolvedOptions().pluralCategories`.

Validation:

- Run `pnpm i18n:validate` (also executed in `pnpm build`).
- The validator fails if any locale string still contains legacy `{{...}}` placeholders.
- `tests/unit/storageNoticePlurals.test.ts` guards the plural keys against ICU regressions.

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
3. Run `pnpm i18n:validate`.
4. Run `pnpm build` before handoff.

## New Marketing Page Checklist

1. Choose the owning native public route area. Add the leaf route module and register
   its optional locale path in `src/virtualRoutes.ts`. Let the router plugin regenerate
   the route tree; do not create a separate route copy for every locale.
2. Add the page component using existing marketing composition. Keep critical content
   SSR-safe and first-render markup deterministic.
3. Update canonical URL/namespace helpers in `config/routes.ts` where the page needs
   a route key or namespace selection. Keep English slugs for every locale.
4. Add the required translation keys to all active locales. Load the route's namespaces
   before rendering through the native root/route boundary.
5. Use native `head` metadata and the shared metadata resolver. Do not add HTML edge
   middleware that rewrites Start's output after rendering.
6. Verify sitemap generation includes the new canonical and localized URLs and excludes
   utility/noindex routes. During migration, the sitemap consumer must be kept aligned
   with the native graph; the retired App route array is not a source of truth.
7. If prerendering is justified, add an explicit page to the Start configuration in
   `vite.config.ts`. Otherwise the public route renders on demand. No Playwright
   HTML-capture registry or manual global prefetch entry is required.
8. Use canonical route helpers/native Links for navigation. Test direct load, client
   navigation, locale switching and RTL output. Check first interaction against a
   production build, not just development.
9. Run locale/content tests and validators and update the feature's single draft note.

## New Tool/App Page Checklist

1. Add a native leaf under the area that owns its lifecycle and access requirements.
2. Preserve the area's URL contract. Trip/share/example/admin IDs stay unprefixed;
   do not add localized slug aliases or compatibility redirects without their own issue.
3. Use the active application language and formatting with the appropriate namespaces.
4. Keep browser-storage/session dependent rendering under an explicit client boundary.
   Enabling SSR later requires a server-safe session and authorization design.
5. Admin workspace copy is English-only unless explicitly requested otherwise.

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
