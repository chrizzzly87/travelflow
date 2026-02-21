# Tech Stack Overview

Last updated: 2026-02-20

This file documents the current TravelFlow stack, major architecture decisions, and recommended next upgrades.

## Current stack (what is running today)

### Core app and runtime

| Area | Current choice | Notes |
| --- | --- | --- |
| Frontend framework | React 18.3.1 + TypeScript | SPA architecture. Entry point in `index.tsx`; routing in `App.tsx`. |
| Build tool | Vite 6 (`@vitejs/plugin-react`) | Uses manual chunking for admin, markdown, UI primitives, icons, Prism, and GenAI SDK in `vite.config.ts`. |
| Styling | Tailwind CSS v4 (`tailwindcss` + `@tailwindcss/vite`, currently `^4.1.18`) | Tokenized theme via CSS variables in `index.css`. No legacy `tailwind.config.js` required for current setup. |
| Router | `react-router-dom` 7.13 | Browser router with locale-aware marketing routes and lazy loaded sections. |
| Language/i18n | `i18next`, `react-i18next`, `i18next-icu` | Path-based locale detection, JSON namespaces loaded dynamically via `import.meta.glob`. |
| Package manager | npm (`package-lock.json` present) | Build/deploy currently assumes npm commands. |

### UI and component system

| Area | Current choice | Notes |
| --- | --- | --- |
| UI primitives | Radix primitives (`checkbox`, `select`, `switch`, `dialog`) | Wrapped in local `components/ui/*` components. |
| Drawer system | `vaul` | Wrapped in local `components/ui/drawer.tsx`. |
| Design system style | "shadcn-style" local wrappers, not full generated shadcn registry | Reusable primitives are custom-maintained in-repo. |
| Icons | `@phosphor-icons/react` and `lucide-react` | Chunk-split in Vite config. |
| Markdown rendering | `react-markdown` + `remark-gfm` + Prism | Used for updates/blog-like rich text surfaces. |
| Flags | `flagpack` | Replaces emoji flags with consistent SVG icons. |

### State management (important)

Current approach:
- React local component state (`useState`) for most UI state.
- Context providers for cross-cutting concerns:
  - `AuthContext`
  - `LoginModalContext`
  - `TripManagerContext`
  - `AppDialogProvider`
  - `GoogleMapsLoader` context
- Service-layer state/persistence via localStorage helpers (`storageService`, `historyService`, preference/consent services) plus window events for sync.

Not currently used:
- Zustand, Redux Toolkit, Jotai, Recoil, MobX, XState (none installed).

Why this currently works:
- Most state is page-local or feature-local.
- Cross-cutting state has been handled with targeted context providers.
- Data writes are mostly explicit service calls (not cached query abstractions yet).

Where pressure is now visible:
- `App.tsx` is large and carries routing + orchestration logic.
- Some cross-page UI/session state is spread across localStorage + context + component state.

### Backend, database, and auth

| Area | Current choice | Notes |
| --- | --- | --- |
| Database and auth | Supabase (`@supabase/supabase-js`) | RLS/RPC-driven app data, auth, admin operations. |
| Client init | `services/supabaseClient.ts` | Supabase can be disabled if env vars are missing/invalid. |
| API runtime | Netlify Edge Functions (Deno) | Functions in `netlify/edge-functions`, helpers in `netlify/edge-lib`. |
| Edge routes | AI generate, benchmark, admin IAM, OG/meta, share resolve, health | Route mapping in `netlify.toml`. |
| Local API parity | `npx netlify dev` | Required for realistic `/api/*` behavior in local development. |

### AI stack

| Area | Current choice | Notes |
| --- | --- | --- |
| App-side generation service | `services/aiService.ts` | Primary shaping/normalization layer for itinerary generation. |
| Providers | Gemini + OpenAI + Anthropic (through edge provider runtime) | Allowlisted models in `netlify/edge-lib/ai-provider-runtime.ts`. |
| Model catalog | `config/aiModelCatalog.ts` | Runtime default currently points to `gemini-3-pro-preview`. |
| SDK/deps | `@google/genai` + provider HTTP calls in edge runtime | Provider-specific key checks and timeout controls implemented. |

### Analytics and tracking

| Area | Current choice | Notes |
| --- | --- | --- |
| Analytics platform | Umami | Loaded only after consent acceptance. |
| Tracking API | `trackEvent(...)`, `trackPageView(...)` | Centralized in `services/analyticsService.ts`. |
| Naming convention | BEM-style event names | Convention documented in `docs/ANALYTICS_CONVENTION.md`. |
| Debug instrumentation | `getAnalyticsDebugAttributes(...)` | Used for QA visibility; does not replace actual tracking calls. |

### Testing and code quality

Current status:
- No unit/integration/e2e test framework is currently wired in `package.json`.
- No `test` script exists.
- No `eslint` or `prettier` scripts currently configured.
- Validation scripts are strong for content/config integrity:
  - `i18n:validate`
  - `updates:validate`
  - `blog:validate`
  - `edge:validate`
  - `plans:validate-sync`
  - sitemap generation/validation in build flow

Implication:
- Content/routing/config regressions are caught well.
- Behavior regressions in UI/business logic are still mostly manual-test dependent.

### Deployment and infra

| Area | Current choice | Notes |
| --- | --- | --- |
| Primary deployment | Netlify | `npm run build` -> `dist`, edge functions + SPA routing in `netlify.toml`. |
| Secondary config | Vercel config present | `vercel.json` exists for Vite SPA deploys. |
| Node version | Node 20 in Netlify build env | Defined in `netlify.toml`. |
| Asset delivery | Netlify static + edge headers | Long-cache headers for assets/fonts/images; OG image generation at edge. |

## Draft vs published release note rule

In this repo, release note visibility is controlled by frontmatter `status`:
- `status: draft` = kept in markdown source, hidden from `/updates`.
- `status: published` = included in `/updates` (if it has at least one `[x]` item).

The updates page explicitly filters to published notes in `services/releaseNotesService.ts`.

Practical workflow:
1. Keep release note in `draft` while scope is still moving.
2. When scope is final and merged/live on `main`, set to `published`.
3. Ensure canonical version ordering and valid `published_at` before merge.

## Recommendations (prioritized)

Complexity scale used below:
- S: 0.5 to 1 day
- M: 2 to 5 days
- L: 1 to 2 weeks
- XL: 2+ weeks

| Priority | Proposal | Why | Estimated complexity |
| --- | --- | --- | --- |
| 1 | Add automated tests baseline (Vitest + RTL + Playwright smoke) | Biggest current risk reducer. Catches regressions before deploys. | L |
| 2 | Add CI workflow for typecheck + validate scripts + tests | Moves quality gates from manual to automatic and protects `main`. | M |
| 3 | Introduce Zustand for selected cross-cutting client state | Reduces prop/context churn and localStorage event glue for shared UI/session state. | M |
| 4 | Add server-state caching layer (TanStack Query) for Supabase-heavy admin/data views | Better loading states, retries, stale data control, fewer ad-hoc fetch patterns. | M-L |
| 5 | Migrate npm -> pnpm | Faster clean installs, lower disk/network overhead, stricter dependency graph behavior. | S-M |
| 6 | Add bundle analysis + performance budgets in CI | Better control of JS growth; package manager changes do not reduce shipped bundle bytes directly. | S |
| 7 | Add linting + formatting baseline (ESLint + Prettier) and then tighten TS config (`strict`) incrementally | Improves maintainability and catches classes of bugs earlier. | M-L |
| 8 | Add production error monitoring (Sentry or similar) | Faster incident triage and better release confidence. | M |

## Package manager decision: npm vs pnpm vs Bun

### Key clarification

Switching package managers does **not** directly reduce browser bundle size.  
Bundle size is driven by imports, chunking, and tree-shaking.

### npm (current)
- Pros: zero migration effort, universally compatible.
- Cons: slower cold installs and larger `node_modules` footprint compared to pnpm.

### pnpm (recommended next step)
- Pros:
  - faster installs in CI and local after warm cache
  - content-addressed store saves disk space
  - stricter dependency resolution can expose hidden issues early
- Cons:
  - may require minor fixes for packages relying on hoisting assumptions
  - CI/deploy setup needs lockfile/tooling updates
- Estimated migration: S-M

### Bun
- Pros:
  - very fast install/runtime tooling
  - integrated package manager + runtime
- Cons:
  - ecosystem compatibility still less predictable than npm/pnpm for some Node build chains
  - additional operational variance when Netlify/Edge paths are already stable on Node + npm
- Estimated migration: M (with higher risk than pnpm)

Recommendation:
- Move to pnpm first.
- Re-evaluate Bun later only if there is a clear runtime/tooling gain requirement.

## Suggested rollout plan

1. Week 1: migrate to pnpm and add CI with existing validators.
2. Week 2: add test baseline (critical service tests + a few Playwright smoke flows).
3. Week 3+: introduce Zustand only for well-scoped shared state slices (not a full rewrite).
4. Ongoing: add bundle budgets and error monitoring.

