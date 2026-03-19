# Trip Workspace TODO

Last updated: 2026-03-19
Owner: Codex + @chrizzzly
Goal: Turn Trip View into a routed Trip Workspace with a fixed shadcn sidebar on desktop, matching mobile navigation, and dedicated pages for the main trip jobs.

## Working rule
- [x] Keep this file as the single implementation checklist for the Trip Workspace overhaul.
- [x] After each implementation commit, update the `Done` and `Open` sections before closing the task update.

## Locked product decisions
- [x] Default trip landing page becomes `Overview`, not `Planner`.
- [x] `Planner` becomes one dedicated page among many.
- [x] Desktop uses the official shadcn app-shell pattern: `SidebarProvider` + `Sidebar` + `SidebarInset`.
- [x] Mobile keeps the bottom toolbar, but it must map to the same workspace destinations as desktop.
- [x] Calendar, map, and timeline live inside `Planner` only, not on every trip screen.
- [x] The right-side details panel exists only inside `Planner`.
- [x] The trip modal stays available for basic trip actions: rename, share, export, history, settings, advanced or debug.
- [x] Destination knowledge moves out of the modal and into dedicated workspace pages.
- [x] Phase 1 scope is `Overview`, `Planner`, `Places`, `Explore`, `Phrases`, and modal cleanup.
- [x] Phase 2 scope is `Bookings`, `Notes`, `Photos`, richer city maps, and flashcard progress.

## Locked sidebar structure
- [x] `Trip`
- [x] `Overview`
- [x] `Planner`
- [x] `Bookings`
- [x] `Destination`
- [x] `Places`
- [x] `Explore`
- [x] `Phrases`
- [x] `Memories`
- [x] `Notes`
- [x] `Photos`
- [x] Footer actions stay available for `Share`, `Export`, and `Settings`.

## Foundation and shell
- [ ] Add the official shadcn `sidebar` component to the project and wire it into the trip workspace shell.
- [ ] Replace the current custom left companion sidebar with the shadcn desktop shell while preserving the better mobile toolbar pattern.
- [ ] Introduce a `Trip Workspace` app shell that treats the sidebar and content area as first-class layout primitives.
- [ ] Make `Overview` the default content page when a trip opens.
- [ ] Limit the current planner-specific right details panel to the `Planner` page only.
- [ ] Keep the trip modal focused on basic trip actions and remove destination knowledge as its main job.
- [ ] Audit current custom companion-sidebar work so only reusable pieces survive into the routed shell.

## Routing and state
- [ ] Add or normalize dedicated trip workspace routes for all first-class workspace pages.
- [ ] Route: `/trips/:tripId/overview`
- [ ] Route: `/trips/:tripId/planner`
- [ ] Route: `/trips/:tripId/places`
- [ ] Route: `/trips/:tripId/explore`
- [ ] Route: `/trips/:tripId/phrases`
- [ ] Route: `/trips/:tripId/bookings`
- [ ] Route: `/trips/:tripId/notes`
- [ ] Route: `/trips/:tripId/photos`
- [ ] Decide how the existing trip loader routes compose with nested workspace routing and keep URL restoration stable for shared/example routes.
- [ ] Persist the active workspace page in view settings or route state only where it helps restore the same destination cleanly.
- [ ] Keep planner-specific view state isolated so map mode, timeline mode, and selection state do not leak into non-planner pages.

## Page backlog
- [ ] `Overview`: build the trip dashboard with countdown, date range, next city, next booking, weather snapshot, top risks, quick tasks, and recent notes.
- [ ] `Planner`: keep the current calendar + map + timeline workspace, with the right-side details panel available only here.
- [ ] `Places`: build dedicated destination intelligence for country facts, official links, sockets, currency, connectivity, driving side, etiquette, religion or holiday context, safety notes, neighborhoods, transit, highlights, and saved stays.
- [ ] `Explore`: build a discovery page for activities, upcoming events, neighborhoods, accommodation recommendations, and save-to-trip actions.
- [ ] `Phrases`: build a lightweight language support page with useful phrases, translations, pronunciation, saved phrases, and simple flashcards.
- [ ] `Bookings`: add a logistics page for reservations, confirmations, due dates, and missing-booking gaps.
- [ ] `Notes`: add a diary and trip-notes page for daily notes, city notes, and planning checklists.
- [ ] `Photos`: add a simple album page as the visual memory layer.

## Phrases example requirements
- [ ] Add a simple example route state such as `Japanese for Tokyo`.
- [ ] Include phrase groups for `Basics`, `Transport`, `Food`, and `Emergency`.
- [ ] Include at least one phrase card with translation, pronunciation, and `Save to Flashcards`.
- [ ] Include at least one phrase card with copy and speak actions.
- [ ] Include a compact flashcard summary with `due today`, `saved phrases`, and offline-pack state.

## Data and content structure
- [ ] Define how country guide data and city guide data are represented without overloading itinerary-item descriptions.
- [ ] Decide which destination content is trip-specific versus general destination knowledge and label it clearly in the UI.
- [ ] Add source and freshness treatment for dynamic travel information and official links.
- [ ] Define the minimal booking, notes, and phrases example data needed for Phase 1 and early Phase 2 shells.
- [ ] Plan map-surface scope for `Places` so city overlays follow the repository map workflow before implementation.

## UX clarity and navigation rules
- [ ] Keep icons paired with clear labels in the desktop sidebar and mobile toolbar.
- [ ] Ensure each page has one dominant job so users understand why they are there.
- [ ] Keep empty states instructional and action-oriented.
- [ ] Make it visually obvious when content is trip-specific, city-specific, or country-level.
- [ ] Preserve a dashboard feel on desktop instead of a planner-plus-panels feel.

## Validation and rollout
- [ ] Add route and workspace regression coverage following `docs/TESTING_PHASE2_SCOPE.md`.
- [ ] Add analytics for workspace navigation and page-level CTA interactions using the repo analytics convention.
- [ ] Validate any new or changed map surfaces against `docs/MAPS_INTEGRATION_WORKFLOW.md`.
- [ ] Update locale files only when the new user-facing copy is ready for EN/DE sign-off.
- [ ] Keep the existing draft release note accurate as the workspace implementation evolves.

## Done
- [x] Locked the Trip Workspace information architecture and phased scope.
- [x] Locked the desktop sidebar grouping and the desktop/mobile navigation model.
- [x] Wrote the execution tracker that we can update commit by commit.

## Open
- [ ] Start Phase 1 by installing the shadcn sidebar shell and making `Overview` the default page.
- [ ] Convert the current planner screen into a dedicated `Planner` page instead of the whole trip surface.
- [ ] Build the first dedicated routed pages: `Overview`, `Places`, `Explore`, and `Phrases`.
- [ ] Keep the trip modal for basic actions only and move destination intelligence to the new pages.
- [ ] Add regression coverage as the routed workspace shell lands.
