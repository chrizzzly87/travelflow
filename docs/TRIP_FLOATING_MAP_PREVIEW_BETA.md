# Trip Floating Map Preview Beta

This experiment keeps the planner map mounted once on desktop and animates the same map surface between:

- `docked`: fills the regular map area in the planner layout.
- `floating`: minimizes to a draggable 2:3 floating card that snaps to viewport corners.

## Why this structure

- Prevents Google Map remount flicker during dock/undock transitions.
- Keeps drag interactions isolated from map pan/zoom gestures by using a dedicated top grab handle.
- Persists dock mode, snapped position, and snapped size preset via `tf_map_preview_state_v1`.
- Makes rollback simple by isolating behavior in one component.

## Key files

- `/Users/chrizzzly/.codex/worktrees/12f5/travelflow-codex/components/tripview/TripFloatingMapPreview.tsx`
- `/Users/chrizzzly/.codex/worktrees/12f5/travelflow-codex/components/tripview/TripViewPlannerWorkspace.tsx`
- `/Users/chrizzzly/.codex/worktrees/12f5/travelflow-codex/components/tripview/floatingMapPreviewState.ts`
- `/Users/chrizzzly/.codex/worktrees/12f5/travelflow-codex/components/tripview/useTripResizeControls.ts`

## Fast disable / removal path

1. Set `TRIP_FLOATING_MAP_PREVIEW_BETA_ENABLED` to `false` in `TripViewPlannerWorkspace.tsx`.
2. If fully removing, delete `TripFloatingMapPreview.tsx` and render the map directly in the docked layout path again.
3. Keep `useTripResizeControls` auto-fit guard that excludes layout-direction-only toggles to avoid zoom/history flooding regressions.
