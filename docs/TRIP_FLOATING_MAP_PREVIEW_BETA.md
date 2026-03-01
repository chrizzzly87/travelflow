# Trip Floating Map Preview Beta

This experiment keeps the planner map mounted once on desktop and animates the same map surface between:

- `docked`: fills the regular map area in the planner layout.
- `floating`: minimizes to a draggable floating card that snaps to viewport corners plus a bottom-center slot.

## Why this structure

- Prevents Google Map remount flicker during dock/undock transitions.
- Keeps drag interactions isolated from map pan/zoom gestures by using a dedicated top grab handle.
- Supports a quick floating-size toggle (compact/expanded) plus a portrait/landscape orientation toggle in floating mode.
- Keeps orientation switches space-efficient by swapping the current floating surface width/height.
- Preserves snapped corner/edge placement through viewport resize so right/bottom anchors stay pinned.
- Persists dock mode, snapped position, snapped size preset, and orientation via `tf_map_preview_state_v1`.
- Suppresses auto-fit zoom-only history labels/toasts so only manual zooming emits “Zoomed in/out” visual change messages.
- Includes docked/floating transitions in visual history snapshots so undo/redo can restore mode changes.
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
