# On-Page Debugger (LLM Extension Guide)

This project includes a global debug toolbar for developer-only QA flows.

## Panel layout
- The toolbar is grouped into three tabs to reduce noise:
- `Testing`: simulated login, forced Supabase connectivity, trip-sync replay, trip-expired toggle.
- `Tracking`: analytics overlay, Umami shortcut, navigation prefetch diagnostics, view-transition diagnostics.
- `SEO`: OG playground, SEO/a11y checks, H1 marker, Lighthouse shortcut.

## Source of truth
- Component: `components/OnPageDebugger.tsx`
- App mount: `App.tsx` (rendered globally)
- Analytics debug attrs: `services/analyticsService.ts`
- Trip-only expired toggle hook: `components/TripView.tsx`

## Runtime API

### `window.debug(command?)`
Opens and controls the toolbar.

Supported calls:
- `debug()` -> open toolbar
- `debug(true|false)` -> force open/close
- `debug({ open, tracking, seo, a11y, simulatedLogin, viewTransition, offline })`

Examples:
- `debug()`
- `debug({ tracking: false })`
- `debug({ seo: true, a11y: true })`
- `debug({ simulatedLogin: true })`
- `debug({ offline: 'offline' })`
- `debug({ offline: 'degraded' })`
- `debug({ offline: 'online' })`

### `window.onPageDebugger`
Programmatic API object exposed by `OnPageDebugger`.

Current methods:
- `show()`
- `hide()`
- `toggle()`
- `setTracking(boolean)`
- `toggleSimulatedLogin(next?)`
- `getSimulatedLogin()`
- `setSupabaseConnectivity(mode)` (`offline` | `degraded` | `clear`)
- `getSupabaseConnectivity()`
- `retryTripSync()`
- `openUmami()`
- `openOgPlayground()`
- `openLighthouse()`
- `runSeoAudit()`
- `runA11yAudit()`
- `runViewTransitionAudit()`
- `getState()`

### `window.toggleSimulatedLogin(next?)`
Defined globally on all routes.

Behavior:
- `toggleSimulatedLogin()` toggles simulated login state
- `toggleSimulatedLogin(true|false)` forces state
- Returns resulting boolean state
- Persists to local storage key `tf_debug_simulated_login`
- Emits event `tf:simulated-login-debug`

Safe call pattern when debug APIs may be stripped in production:
- `window.toggleSimulatedLogin?.()`
- `window.toggleExpired?.(true)`
- `window.toggleSupabaseConnectivity?.('offline')`
- `window.retryTripSyncNow?.()`

### `window.toggleSupabaseConnectivity(mode?)`
Defined globally on all routes.

Behavior:
- `toggleSupabaseConnectivity('offline')` forces outage simulation mode.
- `toggleSupabaseConnectivity('degraded')` forces degraded simulation mode.
- `toggleSupabaseConnectivity('clear')` clears forced override and resumes health monitor.
- Returns resulting connectivity state (`online` | `degraded` | `offline`).
- Persists to local storage key `tf_debug_supabase_connectivity_override`.

### `window.toggleExpired(next?)` (trip page only)
Defined only when route matches `/trip/:tripId`.

Behavior:
- `toggleExpired()` toggles expired debug state
- `toggleExpired(true|false)` forces state
- Returns resulting boolean state
- Disables editing in `TripView` while expired is `true`
- Emits event `tf:trip-expired-debug`

## Debugger toggle persistence

The toolbar now saves toggle state in `localStorage` and restores it after reload:
- `tf_debug_auto_open` (`Enable auto-open`)
- `tf_debug_tracking_enabled` (`Show/Hide Tracking Boxes`)
- `tf_debug_panel_expanded` (`Expand/Collapse`)
- `tf_debug_h1_highlight` (`Mark/Unmark H1`)
- `tf_debug_simulated_login` (`Enable/Disable Sim Login`)
- `tf_debug_supabase_connectivity_override` (`Force Supabase connectivity mode`)

## Route-aware behavior

### On `/trip/:tripId`
- Trip-expired debug control is shown in the `Testing` tab.
- `window.toggleExpired()` is available.
- SEO tab still renders, but route-level SEO checks are intentionally limited and show a guidance note.

### On non-trip routes
- SEO tab includes H1 marker and meta snapshot.
- Trip-expired control is hidden.

## Analytics box overlay contract

Tracking boxes are driven by element attributes:
- `data-tf-track-event`
- `data-tf-track-payload` (JSON string, optional)

Use helper:
- `getAnalyticsDebugAttributes(eventName, payload?)`

Pattern:
```tsx
<button
  onClick={() => trackEvent('home__bottom_cta')}
  {...getAnalyticsDebugAttributes('home__bottom_cta')}
>
  Start
</button>
```

If a tracked element has no debug attrs, it will not be boxed by the overlay.

## Extending the toolbar (recommended pattern)

1. Add route guard first:
   - Use `location.pathname` checks near `isTripDetailRoute` / `showSeoTools`.
2. Add action callback:
   - `const myAction = useCallback(() => { ... }, []);`
3. Add toolbar button in the grid:
   - Keep labels verb-first (`Run ...`, `Open ...`, `Toggle ...`).
4. If cross-component state is needed:
   - Prefer `window` function + `CustomEvent` bridge over deep prop wiring.
5. Keep visual overlays `pointer-events-none` and high z-index.

## Existing event bridge

Event name:
- `tf:trip-expired-debug`

Payload shape:
```ts
{
  available: boolean;
  expired: boolean;
}
```

Producer:
- `TripView` (trip route only)

Consumer:
- `OnPageDebugger`

Event name:
- `tf:simulated-login-debug`

Payload shape:
```ts
{
  available: boolean;
  loggedIn: boolean;
}
```

Producer:
- `OnPageDebugger`

Consumer:
- Paywall/auth-gated UI (future hooks)

Event name:
- `tf:view-transition-debug`

Payload shape (common fields):
```ts
{
  phase: string;
  templateId?: string;
  transitionKey?: string;
  targetPath?: string;
  durationMs?: number;
  reason?: string;
  error?: string;
  useExampleSharedTransition?: boolean;
  expectedCityLaneCount?: number;
}
```

Producers:
- `ExampleTripsCarousel` (transition lifecycle on click/navigation)
- `TripView` (example trip mount + shared transition mode)

Consumer:
- `OnPageDebugger` (View Transition Diagnostics panel)

Event name:
- `tf:supabase-connectivity-status`

Payload shape:
```ts
{
  state: 'online' | 'degraded' | 'offline';
  reason: string | null;
  lastSuccessAt: number | null;
  lastFailureAt: number | null;
  consecutiveFailures: number;
  isForced: boolean;
  forcedState: 'online' | 'degraded' | 'offline' | null;
}
```

Producer:
- `supabaseHealthMonitor`

Consumer:
- `OnPageDebugger`, planner outage banner/hook state

## Quick verification checklist
- `debug()` opens toolbar.
- Tabs switch between `Testing`, `Tracking`, and `SEO` without resetting state.
- Tracking boxes appear on known tracked controls.
- `onPageDebugger.runViewTransitionAudit()` returns anchor counts for `trip-map`, `trip-title`, and `trip-city-lane-*`.
- On `/trip/:id`, `Set Trip Expired` is visible in `Testing`.
- `window.toggleExpired(true)` shows expired banner and disables editing.
- `window.toggleSimulatedLogin(true)` sets simulated login to enabled.
- `window.toggleSupabaseConnectivity('offline')` forces outage mode for planner resilience checks.
- `window.retryTripSyncNow()` retries failed queued trip sync entries.
- On marketing pages, Meta + H1 tools are visible and H1 highlight works.
