# Trip Workspace TODO

Last updated: 2026-03-23
Owner: Codex + @chrizzzly
Goal: Turn Trip View into a routed Trip Workspace with a fixed shadcn sidebar on desktop, matching mobile navigation, and shared trip -> country -> city context across the main trip jobs.

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
- [x] Add the official shadcn `sidebar` component to the project and wire it into the trip workspace shell.
- [x] Replace the current custom left companion sidebar with the shadcn desktop shell while preserving the better mobile toolbar pattern.
- [x] Introduce a `Trip Workspace` app shell that treats the sidebar and content area as first-class layout primitives.
- [x] Make `Overview` the default content page when a trip opens.
- [x] Limit the current planner-specific right details panel to the `Planner` page only.
- [x] Keep the trip modal focused on basic trip actions and remove destination knowledge as its main job.
- [x] Audit current custom companion-sidebar work so only reusable pieces survive into the routed shell.

## Routing and state
- [x] Add or normalize dedicated trip workspace routes for all first-class workspace pages.
- [x] Route: `/trip/:tripId/overview`
- [x] Route: `/trip/:tripId/planner`
- [x] Route: `/trip/:tripId/places`
- [x] Route: `/trip/:tripId/explore`
- [x] Route: `/trip/:tripId/phrases`
- [x] Route: `/trip/:tripId/bookings`
- [x] Route: `/trip/:tripId/notes`
- [x] Route: `/trip/:tripId/photos`
- [x] Decide how the existing trip loader routes compose with nested workspace routing and keep URL restoration stable for shared/example routes.
- [x] Persist the active workspace page in route state and normalized view settings where it helps restore the same destination cleanly.
- [x] Keep planner-specific view state isolated so map mode, timeline mode, and selection state do not leak into non-planner pages.
- [x] Persist shared workspace route context so country and city selections survive page switches and route restoration.

## Route context and SEA demo
- [x] Add a shared route context bar to every non-planner page so users can move between trip, country, and city without losing the route shape.
- [x] Replace the flat Thailand-only workspace seed with a multi-country Southeast Asia dataset based on the homepage backpacking route.
- [x] Keep route-wide summaries and country rollups readable while letting deeper pages drill into the active country and city.
- [x] Make standalone workspace pages manage local context changes correctly even when they are rendered outside the full Trip Workspace shell.
- [x] Add data-level regression coverage for the SEA route builder, including return border crossings.

## Page backlog
- [x] `Overview`: build the trip dashboard with countdown, date range, next city, next booking, weather snapshot, top risks, quick tasks, and recent notes.
- [x] `Planner`: keep the current calendar + map + timeline workspace, with the right-side details panel available only here.
- [x] `Places`: build dedicated destination intelligence for country facts, official-link placeholders, sockets, connectivity, driving side, etiquette, safety notes, neighborhoods, transit, highlights, and saved stays.
- [x] `Explore`: build a discovery page for activities, upcoming events, neighborhoods, accommodation recommendations, and save-to-trip actions.
- [x] `Explore`: add an activity workflow board with `Shortlist`, `Planned`, `Booked`, and `Done`, plus planner handoff and mobile-friendly move actions.
- [x] `Phrases`: build a lightweight language support page with useful phrases, translations, pronunciation, saved phrases, and simple flashcards.
- [x] `Bookings`: add a logistics page for reservations, confirmations, due dates, and missing-booking gaps.
- [x] `Budget`: add a trip cost page for spend pace, booking pressure, scenario planning, and route-sensitive buffers.
- [x] `Weather`: add a route-conditions page for city-by-city travel feel, rain risk, sea watch, and packing signals.
- [x] `Notes`: add a diary and trip-notes page for daily notes, city notes, and planning checklists.
- [x] `Photos`: add a simple album page as the visual memory layer.

## Phrases example requirements
- [x] Adapt the example route state to a Southeast Asia demo with Thai, Khmer, Vietnamese, and Lao phrase packs.
- [x] Include phrase groups for `Basics`, `Transport`, `Food`, and `Emergency`.
- [x] Include at least one phrase card with translation, pronunciation, and `Save to Flashcards`.
- [x] Include at least one phrase card with copy and speak actions.
- [x] Include a compact flashcard summary with `due today`, `saved phrases`, and offline-pack state.

## Data and content structure
- [x] Define how country guide data and city guide data are represented without overloading itinerary-item descriptions.
- [x] Decide which destination content is trip-specific versus general destination knowledge and label it clearly in the UI.
- [x] Add source and freshness treatment for dynamic travel information and official links.
- [x] Define the minimal booking, notes, and phrases example data needed for Phase 1 and early Phase 2 shells.
- [x] Define a lightweight trip-level activity workflow model so Explore can track shortlist, planned, booked, and done without overloading itinerary items.
- [x] Move `Overview` and `Places` map surfaces onto the shared Trip map workflow instead of custom one-off map implementations.

## UX clarity and navigation rules
- [x] Keep icons paired with clear labels in the desktop sidebar and mobile toolbar.
- [x] Support a desktop icon-collapse mode so the workspace can feel like a compact dashboard instead of a permanently wide rail.
- [x] Ensure each page has one dominant job so users understand why they are there.
- [ ] Keep empty states instructional and action-oriented.
- [x] Make it visually obvious when content is trip-specific, city-specific, or country-level.
- [x] Preserve a dashboard feel on desktop instead of a planner-plus-panels feel.

## Overview upgrades
- [x] Add a color-coded timeline calendar to `Overview` so the route is visible without opening the planner.
- [x] Highlight the current day inside the overview calendar when it falls within the trip window.
- [x] Add a compact overview map that shows the high-level route without planner controls.
- [x] Keep the overview map intentionally lighter than the planner map so the page reads like a dashboard, not an editor.

## Next ideas backlog
- [x] Add a `Travel kit` page for packing lists, adapters, emergency numbers, and trip checklists.
- [x] Add a `Budget` page for planned spend, booked spend, and daily burn-rate tracking.
- [x] Add a `Documents` page for passports, visa notes, insurance, tickets, and booking PDFs.
- [x] Add a `Weather` layer for city-by-city forecasts, seasonal warnings, and disruption watchlists.

## Validation and rollout
- [x] Add route and workspace regression coverage following `docs/TESTING_PHASE2_SCOPE.md`.
- [x] Add analytics for workspace navigation and page-level CTA interactions using the repo analytics convention.
- [x] Validate new and changed map surfaces against `docs/MAPS_INTEGRATION_WORKFLOW.md`.
- [x] Update active locale files for the current workspace copy and Explore workflow labels.
- [x] Keep the existing draft release note accurate as the workspace implementation evolves.

## Done
- [x] Locked the Trip Workspace information architecture and phased scope.
- [x] Locked the desktop sidebar grouping and the desktop/mobile navigation model.
- [x] Wrote the execution tracker that we can update commit by commit.
- [x] Installed the shadcn sidebar shell and turned Trip View into a routed Trip Workspace with `Overview` as the default page.
- [x] Kept the planner as its own page with the calendar, map, timeline, and right-side selection details isolated there.
- [x] Added dedicated workspace pages for `Overview`, `Places`, `Explore`, `Phrases`, `Bookings`, `Notes`, and `Photos` using Thailand demo data and clear demo badges.
- [x] Added route helpers, loader updates, analytics hooks, locale wiring, and regression coverage for the workspace shell.
- [x] Added a true desktop sidebar collapse mode with icon-only navigation and tooltip-backed labels.
- [x] Added a color-coded overview calendar and a compact overview route map so the trip dashboard has its own strong visual anchors.
- [x] Rebuilt the desktop workspace shell as a header-aware frame so the sidebar now sits below the Trip header and preserves full-height proportions.
- [x] Swapped the overview and places map surfaces over to the shared Trip map implementation instead of the broken standalone workspace map.
- [x] Split the new Trip Workspace into dedicated page components and added interactive flashcards, shortlist, notes, and photo demo behaviors.
- [x] Added regression coverage for sidebar persistence, planner-only routing, and phrase flashcard interactions.
- [x] Tightened the trip modal into an actions-first surface and moved destination prep into a clean handoff to the routed `Places` page.
- [x] Added clearer source freshness, trip-specific vs general context labels, and interactive overlay guidance to the `Places` page.
- [x] Added a routed `Travel kit` page with interactive checklists, emergency quick references, offline prep toggles, converter tools, and Thailand demo support content.
- [x] Added a routed `Documents` page with packet tabs, verification toggles, offline dossier prep, and quick links back into bookings, places, and travel support flows.
- [x] Added a routed `Budget` page with scenario switching, cost-category filters, reserve controls, and route-aware spend pacing for the Thailand demo trip.
- [x] Added a routed `Weather` page with route-stop switching, weather lenses, disruption framing, and quick links back into planner, places, and travel support pages.
- [x] Turned the `Places` map into a real visual overlay surface with neighborhood zones, stay anchors, and route-focus paths instead of layer guidance text only.
- [x] Added an Explore activity workflow board with drag-and-drop lanes on desktop, menu-based moves on mobile, planner scheduling handoff, and booked-activity visibility inside `Bookings`.
- [x] Added unit and browser regression coverage for activity-board derivation, filter persistence, mobile move actions, and booked-activity summaries.
- [x] Updated active locale files with the current Explore workflow copy and mode labels.
- [x] Polished the Explore workflow board so it reads more like a kanban playground, with a dedicated drag handle, cleaner lane styling, and overlay layers that sit above the workspace shell correctly.
- [x] Reworked the Explore board into a denser task-board layout with a true drag overlay, narrower lanes, and compact cards that stay visible while moving.
- [x] Added visible kanban drop targets so dragging now shows clear target lanes and between-card insertion zones instead of only moving the floating card.
- [x] Refined the Explore board drag math so same-lane moves now keep showing a clear placeholder slot based on the lane geometry instead of losing the insertion preview when the hover target stays on the column.
- [x] Reworked the workspace demo around the homepage-style Southeast Asia backpacking route so Places, Weather, Budget, Travel kit, Documents, Phrases, Explore, Notes, and Photos all read as a multi-country product instead of a Thailand-only mock.
- [x] Added a shared trip -> country -> city context bar across non-planner pages and kept that context synced through Trip Workspace state restoration.
- [x] Expanded `Places`, `Weather`, `Budget`, `Travel kit`, `Documents`, `Phrases`, `Explore`, `Notes`, and `Photos` around country-aware and city-aware route context instead of one flat destination layer.
- [x] Fixed standalone workspace pages so route context switches work even outside the full Trip Workspace shell, and covered the SEA dataset builder with unit regressions.
- [x] Simplified the `Places` neighborhood renderer into numbered map zones plus a compact legend, so district overlays stay readable without colliding with city markers or stay labels.
- [x] Swapped the `Places` map-layer pills over to the shared shadcn toggle-group pattern and covered the overlay structure with focused regression tests.
- [x] Moved `Places` neighborhood areas, stay anchors, and route paths onto native Google Maps circles, polylines, and overlay markers so they stay attached while the map pans.
- [x] Fixed the `Places` map fit so city overlays are framed inside the visible viewport instead of zooming past the districts and hiding the planning geometry.

## Open
- [ ] Replace the Southeast Asia demo dataset with live bookings, discovery, phrase, destination, travel-kit, document, budget, weather, and places-overlay services when the backend inputs are ready.
- [ ] Deepen page empty states and first-time hints so sparse countries or cities still feel guided instead of quiet.
- [ ] Decide whether the next destination polish should focus on richer map interactions like hover states and compare mode, or on service-backed freshness data.
- [ ] Decide whether the next workspace utility slice should focus on `planner-to-budget sync`, `weather-driven map overlays`, or `cross-page route transition summaries`.
