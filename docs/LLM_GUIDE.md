# TravelFlow LLM Guide (Compact)

This doc is a compact, structured overview of the app to help future agents make safe, consistent changes.

**Design Reference**
- UI and component styling rules: `docs/BRAND_CI_GUIDELINES.md`.
- Paywall/lifecycle behavior rules: `docs/PAYWALL_GUIDELINES.md`.
- Locale routing + translation workflow: `docs/I18N_PAGE_WORKFLOW.md`.
- UX writing and CTA/planner copy rules: `docs/UX_COPY_GUIDELINES.md`.
- Analytics naming and instrumentation format: `docs/ANALYTICS_CONVENTION.md`.
- Netlify PR preview and feature-branch deploy workflow: `docs/NETLIFY_FEATURE_BRANCH_DEPLOY.md`.
- Timeline/audit event diff contract: `docs/TIMELINE_DIFF_EVENT_CONTRACT.md`.
- For manual Netlify CLI draft deploys, follow `docs/NETLIFY_FEATURE_BRANCH_DEPLOY.md`: build with `dotenv-cli`, then deploy with `netlify deploy --no-build --dir=dist`.
- Browser storage disclosures and policy source: `lib/legal/cookies.config.ts` (cookies/localStorage/sessionStorage registry).
- Storage Phase 2 migration tracker: `docs/STORAGE_POLICY_MIGRATION_CHECKLIST.md`.

**Project Overview**
- App type: Single-page travel planner with timeline + map + print/list views.
- Marketing routes: `/`, `/features`, `/updates`, `/blog`, `/login`, plus locale-prefixed variants (`/es/*`, `/de/*`, `/fr/*`, `/pt/*`, `/ru/*`, `/it/*`) for marketing pages.
- Trip creation route: `/create-trip`.
- Core data model: `ITrip` with `ITimelineItem[]` for cities, travel, activities.
- Primary view: `components/TripView.tsx`.
- URL-encoded persistence: `utils.ts` (`compressTrip`, `decompressTrip`) used by `App.tsx`.
- Release updates source: `content/updates/*.md` parsed via `services/releaseNotesService.ts`.

**Key Files**
- `App.tsx`
- `components/TripView.tsx`
- `components/Timeline.tsx`
- `components/VerticalTimeline.tsx`
- `components/TimelineBlock.tsx`
- `components/ItineraryMap.tsx`
- `components/DetailsPanel.tsx`
- `components/PrintLayout.tsx`
- `utils.ts`
- `types.ts`
- `config/paywall.ts`
- `data/exampleTrips.ts`

**Data Model**
- `types.ts`
- `ITimelineItem.type`: `city | activity | travel | travel-empty`
- City items carry `coordinates`, `color`, `duration`, `startDateOffset`.
- Travel items carry `transportMode`, `duration`, `startDateOffset`.
- Activities have `activityType`, `startDateOffset`, `duration`.

**URL Persistence (Important)**
- Always persist view state changes in the URL via `compressTrip(trip, viewSettings)` in `App.tsx`.
- `TripView` calls `onViewSettingsChange(settings)` to update URL.
- If you add new view settings, update:
  - `IViewSettings` in `types.ts`
  - `TripView` state initialization
  - URL compression (handled by `compressTrip` in `utils.ts`)
  - URL usage in `App.tsx` (`onViewSettingsChange`)
- LocalStorage is used for some defaults, but URL should remain the source of truth for shareability.

**TripView Layout**
- Horizontal layout: timeline left, map right.
- Vertical layout: map top, timeline bottom.
- Timeline view modes:
  - `horizontal` timeline in `Timeline.tsx`
  - `vertical` timeline in `VerticalTimeline.tsx`
- Controls overlay for zoom and timeline view toggle.

**Timeline Behavior**
- Resizing a city shifts later items based on the drag start snapshot.
- Logic located in `Timeline.tsx` and `VerticalTimeline.tsx`.
- If modifying resize logic, keep:
  - `dragStartItemsRef` baseline snapshot
  - `diff = newDuration - dragState.originalDuration`
  - Shift later items against `dragState.originalOffset + dragState.originalDuration`
  - Boundary epsilon to move travel attached at city end
- City “fill” actions:
  - Timeline hover button: `TimelineBlock.tsx`
  - Details panel button: `DetailsPanel.tsx`
  - Handler: `handleForceFill` in `TripView.tsx`

**Map Behavior**
- `components/ItineraryMap.tsx` uses Google Maps API.
- Default map style is `standard`, but user can change.
- Pins are colored by city and highlight selected city.
- Routes draw directional arrow and transport icon at midpoint.
- Travel mode icons are consistent with timeline `transportMode`.

**Print/List View**
- `components/PrintLayout.tsx` renders:
  - Calendar view
  - Map
  - Detailed per-city itinerary with daily activities and notes

**Common Pitfalls**
- Do not break URL persistence of view settings.
- Changes to timeline resizing can introduce drift if not based on drag start snapshot.
- Map pins should always reflect city color and selection state.
- Transport icons and lines should stay aligned with travel items.
- Do not introduce browser storage keys without registering them in `lib/legal/cookies.config.ts`.

**Agent Checklist for UI Changes**
1. Update `IViewSettings` if new view state is added.
2. Ensure URL encoding/decoding includes new state.
3. Keep localStorage default as fallback only.
4. Ensure layout-specific changes handle both horizontal and vertical modes.
5. Confirm selection and hover styles are visible against existing backgrounds.
6. For behavioral code changes, add/update Vitest tests in the same PR and run `pnpm test:core` before handoff when feasible.
7. For bug fixes, include a regression test that fails pre-fix and passes post-fix.
8. Docs-only, copy-only, and style-only changes are exempt from mandatory new tests.
9. If a PR adds files under `services/` or `config/`, include matching `tests/**` entries in the PR checklist/description.
10. For TripView/route-loader orchestration work, follow `docs/TESTING_PHASE2_SCOPE.md`.
11. If behavior/features changed, update markdown release notes following `docs/UPDATE_FORMAT.md`.
12. Keep release notes in `status: draft` while the feature PR is open; publish metadata (`status`, version, `published_at`) after merge to `main`.
13. If publishing a new release entry, bump to a new strictly increasing `version`.
14. Check direction safety and logical property usage (`inline`/`block`/`start`/`end`) for new UI; if unclear, ask for clarification before finalizing.
15. For any user-facing copy changes, ask the user for style approval in EN/DE before finalizing unless they explicitly skip this step.
16. For clickable marketing/planner UI changes, instrument `trackEvent(...)` + `getAnalyticsDebugAttributes(...)` following `docs/ANALYTICS_CONVENTION.md`.
17. For any cookie/localStorage/sessionStorage change, update `lib/legal/cookies.config.ts` and run `pnpm storage:validate`.
18. For `gh pr create/edit`, use `--body-file` (or stdin heredoc) with real Markdown newlines; avoid escaped `\n` and escaped backticks in inline `--body` text.
