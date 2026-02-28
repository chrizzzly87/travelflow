# Admin Design System Playground and Notification Lab (Follow-up)

## Status
Open issue (follow-up). Not in current profile/trip archive scope.
GitHub issue: https://github.com/chrizzzly87/travelflow/issues/196

## Objective
Add a dedicated admin workspace page to inspect all shared UI components and interaction states in one place, including a toast/notification trigger lab.

## Why
- We currently have multiple visual variants for similar controls across pages.
- There is no single in-app surface to compare component behavior/state side-by-side.
- Toast behavior now has a shared style system that needs quick manual QA coverage.

## Proposed Scope
1. Add an admin-only route: `admin/design-system-playground`.
2. Build grouped sections for currently used component families:
- Buttons (all variants, states, sizes, icon-only).
- Inputs and textareas.
- Select/dropdown variants.
- Switches and checkboxes.
- Tabs and segmented controls.
- Dialogs/drawers/modals.
- Cards/badges/chips.
- Tooltip/popover patterns.
3. Add an interactive “Notification Lab” section:
- Dropdown with predefined notification scenarios.
- Trigger button to fire the selected toast.
- Include states for success, info, warning, error, loading, destructive/archive with undo.
4. Show usage metadata for each component group:
- Primary source component path.
- Example pages using it (at least 1-3 references).
5. Keep the playground read-only:
- No persistence side effects.
- No production data writes.

## Notification Lab Scenarios (Initial)
1. Trip archived (remove + undo action)
2. Archive undo success
3. Batch archive completed
4. Profile settings saved
5. Share link copied
6. History undo/redo feedback
7. Generic warning and generic error
8. Loading/in-progress sample

## Technical Notes
1. Reuse existing components from `components/ui/*` and product wrappers.
2. Reuse `showAppToast(...)` only; no direct `sonner` usage in playground examples.
3. Consider a small local fixture map for sample props and interaction permutations.
4. Keep this page excluded from navigation for non-admin users.

## Analytics
Track basic playground usage:
1. `admin__design_playground--open`
2. `admin__design_playground_component_group--view`
3. `admin__design_playground_toast--trigger`

## Rollout Plan
1. Phase 1: Route + static grouped previews + notification lab.
2. Phase 2: Add “where used” references per component group.
3. Phase 3: Add visual regression snapshot harness for core groups.

## Risks and Mitigations
1. Component drift from real production usage:
- Pull examples directly from shared primitives and wrappers.
2. Maintenance overhead:
- Keep a curated subset first, expand only when a component family is stabilized.
3. Admin performance impact:
- Lazy-load heavy groups and examples where needed.

## GitHub Issue Draft
### Title
Admin design system playground with notification test lab

### Body
Create an admin-only design system playground to audit current UI components and interaction states in one place, plus a notification lab for manual toast QA.

Scope:
- Add `/admin/design-system-playground` route.
- Group and render existing component families (buttons, select, switch, tabs, dialogs, etc.).
- Add a notification lab with a scenario dropdown and trigger button.
- Show where each component group is used in the app.
- Keep the page read-only (no backend writes).

Acceptance criteria:
- Admins can open the page and preview shared component variants/states.
- Notification lab triggers all defined toast scenarios through `showAppToast`.
- Each component group shows at least one real usage reference.
- Basic analytics events fire for page open, group views, and toast triggers.
