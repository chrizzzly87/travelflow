# Tech stack

Current production stack (native TanStack Start since v0.209.0, 2026-10-24). See
[architecture](TANSTACK_START_ARCHITECTURE.md) and
[Netlify deployment](NETLIFY_TANSTACK_START.md). Exact versions live in `package.json`.

## Runtime and build

| Area | Choice | Ownership |
| --- | --- | --- |
| Framework | TanStack Start + React/React DOM 19.3.1 + TypeScript | Native document rendering and hydration (`StartClient`) |
| Routing | TanStack Router with virtual file routes | `src/virtualRoutes.ts`, native area/leaf modules and generated route tree |
| Build | Vite 8, React plugin, Start plugin, Netlify Start adapter | Exact versions in `package.json` and frozen `pnpm-lock.yaml` |
| Styling | Tailwind CSS 4, CSS variable tokens | Shared primitives in `components/ui`, product/admin design contracts |
| Locale | i18next + react-i18next | Request-isolated SSR instances, browser instance, lazy JSON namespaces |
| Tooling | Node 22 + pnpm 10.18.1 | `.node-version`, `netlify.toml`, `packageManager`; newer Node majors break some tests |
| Admin charts | recharts 3 | Shared wrappers in `components/admin/charts` |

Keep the existing `forwardRef` pattern for library-focused, measured and Radix
`asChild` components. Preact, react-router and the old prerender scripts are gone;
older reports that mention them are historical evidence, not instructions.

## Structure and state

The document and shared shell compose providers and cross-cutting UI. Native route
areas separate public marketing, auth, account, admin, creation, library and trip
workspaces. Public routes support SSR and selected prerendering. Browser-session and
local-storage dependent areas currently use selective `ssr: false`.

Trip state belongs to `features/trips/TripWorkspaceLayout`, with separate persistence,
creation and view-preference hooks. Auth access/terms/preferences belong to
`features/auth`. Large remaining TripView/page implementations are incremental
refactor targets; introducing native routes does not prove those internals are finished.

Local React state and focused contexts own UI state. Storage/sync services own local
trip persistence and offline queues. Native route loaders and intent preloading own
route lifecycle. TanStack Start does not imply TanStack Query is installed or that
all remote state has already moved to a query cache. Adopt a server-state cache only
where ownership, invalidation and offline semantics have been defined.

## Backend and integrations

| Area | Choice and boundary |
| --- | --- |
| Database/auth | Supabase; RLS, RPC permissions and endpoint authorization remain authoritative |
| Public server metadata | Native route head plus a validated Start server function for public trip/share summaries |
| Existing APIs | Explicit Netlify Edge Functions and supporting functions for generation, billing, admin, maps and other APIs |
| AI | Provider orchestration and telemetry in existing server/service modules; follow `AI_AGENT_FEATURE_GUARDRAILS.md` |
| Maps | Shared Google Maps/Mapbox integrations; follow `MAPS_INTEGRATION_WORKFLOW.md` |
| Analytics | Consent-controlled Umami via `trackEvent`/`trackPageView`; naming in `ANALYTICS_CONVENTION.md` |
| PWA | Generated worker, offline shell, local trip data and queued edits; API/auth traffic stays network-only |

Only public browser configuration may use `VITE_*`. Provider keys and privileged
Supabase credentials must never enter client bundles or serialized route data.

## Quality and deployment

- Vitest + React Testing Library cover pure modules, services, hooks and component
  behavior. `tests/helpers/routerHarness.tsx` supplies real native router contexts.
- Playwright production and offline suites exercise the built application. Require
  hosted preview evidence for server/edge behavior and first-load interaction.
- `pnpm test:core` runs coverage; `pnpm typecheck` is a CI gate (zero errors);
  `pnpm ci:local` mirrors PR Quality stages.
- Content, i18n, storage, API configuration and release validators supplement behavior
  tests. They do not replace them.
- Netlify publishes `dist/client`; the Start adapter deploys server rendering from
  the server build. See `NETLIFY_TANSTACK_START.md`.
- Performance comparisons must use the same routes, browser, probes and run policy
  before/after, with raw results tied to revisions. No general speed gain is assumed
  from the framework change alone.

## Release and next work

Release notes follow `UPDATE_FORMAT.md`. Future TanStack Query adoption, wider
prerendering or cache policies need their own measured rationale and regression tests.
