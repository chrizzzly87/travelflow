# Router compat layer (`lib/router`)

The app was migrated from react-router-dom v7 to the Next.js App Router
(issue #423). Instead of rewriting ~107 files by hand, app code imports a
compat layer from `@/lib/router` that implements the react-router API subset
this codebase uses on top of `next/navigation`.

## How it works

- **`NextRouterAdapter`** (mounted once in `app/[locale]/providers.tsx`)
  reads `usePathname` / `useParams` / `useRouter` from `next/navigation` and
  publishes them through `RouterAdapterContext`. All compat hooks and
  components only read that context — they never touch Next APIs directly.
- **Pathname** comes from Next (correct during SSR/SSG and hydration — this
  is what fixes the active-nav-on-direct-load class of bugs for good).
- **Search / hash / navigation state** come from a small client-side location
  store (`lib/router/locationStore.ts`) that patches `history.pushState` /
  `replaceState` and listens to `popstate`/`hashchange`. During SSR these are
  empty (`''`) — request-time values can't exist in static HTML — and they
  populate synchronously before the first client effect runs. Code that needs
  query params at render time re-renders once after hydration; effects and
  handlers see the real values immediately.
- **`navigate(to, { state })`** stores the state via
  `setPendingNavigationState`; it is attached to the history entry
  (`history.state.__tfRouterState`) after Next commits the navigation, so
  `useLocation().state` survives back/forward like react-router's
  `history.state.usr` did.
- **`useSearchParams()`** returns the familiar `[params, setParams]` tuple.
  `setParams` navigates with `preventScrollReset: true` by default (matching
  react-router: pagination/drawer updates don't jump to the top).
- **`Link` / `NavLink`** render plain anchors and navigate through the
  adapter (with modifier-key/target/external checks). Hover/focus/touch
  triggers `router.prefetch` — this replaces the deleted
  NavigationPrefetchManager/SpeculationRulesManager machinery.
- **`Routes` / `Route` / `RouteBase`** implement minimal path matching
  (static segments, `:params`, trailing `*`, `index`) for the admin workspace
  (`/admin/*` internal router) and for tests.
- **Blog view transitions**: forward transitions are still triggered by the
  blog pages themselves. POP (back/forward) transitions — formerly the
  `appHistory` Proxy — are handled by a `popstate` bridge in
  `NextRouterAdapter` that opens a view transition whose async update
  resolves when the target pathname has rendered (600 ms cap).

## Tests

`MemoryRouter` from `@/lib/router` is a drop-in for react-router's: it
provides the adapter context with an in-memory location, so
`useLocation`/`useNavigate`/`useSearchParams`/`Link`/`Routes` work in Vitest
without the Next runtime. Tests that used to `vi.mock('react-router-dom')`
now mock `@/lib/router` the same way.

## Semantics differences (accepted)

- `useLocation().search`/`hash` are empty during SSR and the hydration
  render (react-router read them synchronously from the browser). Anything
  render-branching on query params settles one render after hydration.
- `Navigate` redirects in an effect (react-router redirected during render).
- Route matching is first-match-in-definition-order without react-router's
  score-based ranking (the app's route patterns don't need ranking).
