# Tech stack

A quick map of what TravelFlow runs on. Exact versions live in `package.json` and
`pnpm-lock.yaml`. How the pieces fit together, and the rules for changing them, are in
[TANSTACK_START_ARCHITECTURE.md](TANSTACK_START_ARCHITECTURE.md).

| Area | Choice | Read next |
| --- | --- | --- |
| Framework | TanStack Start + React 19, TypeScript | [Architecture](TANSTACK_START_ARCHITECTURE.md) |
| Routing | TanStack Router, virtual file routes in `src/virtualRoutes.ts` | [Architecture](TANSTACK_START_ARCHITECTURE.md) |
| Build | Vite 8 with the Start, React and Netlify Start plugins | [Netlify](NETLIFY_TANSTACK_START.md) |
| Hosting | Netlify (`travelflowapp`): `dist/client`, `dist/server`, edge and Node functions | [Netlify](NETLIFY_TANSTACK_START.md), [Edge functions](EDGE_FUNCTIONS.md) |
| Styling | Tailwind CSS 4, CSS variable tokens, shared primitives in `components/ui` | [Design system](DESIGN_SYSTEM_COMPONENTS.md), [Admin design](DESIGN.md) |
| Locale | i18next + react-i18next, per-request SSR instances | [I18n workflow](I18N_PAGE_WORKFLOW.md) |
| Database and auth | Supabase with RLS and RPC permission checks | [Supabase runbook](SUPABASE_RUNBOOK.md) |
| AI | AI SDK 7 with server-side provider adapters | [AI guardrails](AI_AGENT_FEATURE_GUARDRAILS.md) |
| Maps | Google Maps and Mapbox | [Maps workflow](MAPS_INTEGRATION_WORKFLOW.md) |
| Analytics | Consent-controlled Umami | [Analytics convention](ANALYTICS_CONVENTION.md) |
| PWA | Generated service worker and offline trip data | [Offline](PWA_OFFLINE.md) |
| Admin charts | recharts 3 | `components/admin/charts` |
| Tests | Vitest + React Testing Library; Playwright for built-app suites | [Testing scope](TESTING_PHASE2_SCOPE.md) |
| Tooling | Node 22 (`.node-version`), pnpm 10 (`packageManager`) | `AGENTS.md` |

Only public browser configuration may use `VITE_*`. Provider keys and privileged
Supabase credentials stay server-side.
