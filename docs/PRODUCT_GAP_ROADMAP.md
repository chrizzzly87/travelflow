# TravelFlow Product Gap Roadmap

Last updated: 2026-04-17

This document turns the product-gap analysis into a repo-owned roadmap so competitive context, backlog priorities, and GitHub issue creation stay aligned.

## Positioning

Recommended positioning:
- TravelFlow should be the AI-first visual planner that gets travelers from inspiration to an editable itinerary faster than Wanderlog and TripIt.
- The planner and generation experience should remain the center of the product.
- Operational travel tooling, collaboration, and social memory should compound on top of that core instead of replacing it.

## Competitive Read

TravelFlow strengths today:
- Strong editable AI itinerary generation.
- Visual planner workspace with map and timeline editing.
- Async generation, sharing, public profiles, passport/stamp identity, and paid tiers.

Key competitor gaps to close:
- Wanderlog leads on operational planning breadth: reservations, route optimization, offline, budgets, packing, collaboration.
- TripIt leads on post-booking automation: inbox sync, itinerary ingestion, live trip operations, and alerting.
- Mindtrip leads on AI-native imports and collaborative planning inputs: screenshots, PDFs, saved places, group ideation.
- Polarsteps leads on tracking, relive loops, and social travel memory.

## Roadmap Principles

Prioritize work that improves all three:
- Activation: users reach a good first itinerary quickly.
- Retention: plans stay useful as the trip becomes more concrete.
- Monetization: premium value is obvious without weakening the free planning loop.

Keep these constraints:
- Consumer leisure focus.
- Web-first product.
- AI-first workflow, but not AI-only. Structured data and operational tooling should reduce prompt fragility.

## Priority Tiers

### Now

1. Destination intelligence engine
- Issue alignment: #278, #113, #102, #101
- Why now: raises itinerary quality, traveler trust, and differentiation immediately.

2. First-run activation
- Issue alignment: #277, #100, #93
- Why now: converts first-time users into successful planners faster.

3. Planner reliability core
- Issue alignment: #179, #239, #330, #107
- Why now: trust and repeat usage depend on reliable editing, map clarity, and safe offline/recovery behavior.

### Next

4. Reservation import and trip ops hub
- New issue family.
- Why next: closes the largest practical gap against TripIt and Wanderlog.

5. Social foundation
- Issue alignment: #181, #97, #98, #96
- Why next: supports retention, creator loops, and profile value.

6. Subscription lifecycle and billing clarity
- Issue alignment: #216, #268
- Why next: improves monetization without introducing a broader product rewrite.

7. Embed and distribution platform
- Issue alignment: #99, #189, #188
- Why next: turns itineraries into a growth surface.

### Later

8. Collaboration v1
- Issue alignment: #106

9. Budgeting and expense split
- New issue family.

10. Packing checklists and trip prep
- New issue family.

11. Passport backend and profile identity polish
- Issue alignment: #194, #191, #185, #160, #110

12. Auto travel journal and tracker
- New issue family.

13. Marketing and homepage modernization
- Issue alignment: #95, #144

14. AI safety and benchmark hardening
- Issue alignment: #312, #104, #103

## Project Matrix

| Priority | Project | Complexity | Impact | Issue alignment |
| --- | --- | --- | --- | --- |
| 1 | Destination intelligence engine: traveler-fit, safety, transport, cost, practical warnings | XL | Very High | #278, #113, #102, #101 |
| 2 | First-run activation: onboarding + create-trip wizard final pass + feedback capture | L | Very High | #277, #100, #93 |
| 3 | Planner reliability core: patch undo/redo, offline delta sync, precise activity coordinates, Mapbox parity | XL | High | #179, #239, #330, #107 |
| 4 | Reservation and receipt import + trip ops hub | XL | High | #343 |
| 5 | Social foundation: reactions, bookmarks, follows, creator stats, public profile depth | XL | High | #181, #97, #98, #96 |
| 6 | Subscription lifecycle + billing clarity: grace logic, settings cleanup, upgrade/reactivation UX | M | High | #216, #268 |
| 7 | Embed and distribution platform: interactive trip widgets, preview pipeline, blog embeds | L | High | #99, #189, #188 |
| 8 | Collaboration v1: live presence, cursors, lightweight voting | L | Medium-High | #106 |
| 9 | Budgeting + expense split | M | Medium-High | #345 |
| 10 | Packing checklists + travel prep organizer | M | Medium | #346 |
| 11 | Passport backend + achievements + cover persistence + avatar polish | L | Medium | #194, #191, #185, #160, #110 |
| 12 | Auto travel journal + tracker + relive output | XL | Medium-High | #348 |
| 13 | Marketing and homepage modernization | M | Medium | #95, #144 |
| 14 | AI safety + benchmark hardening | M | Medium | #312, #104, #103 |

## New Issue Families Introduced Here

The backlog was missing explicit issue families for the largest operational travel gaps. The following specs should exist and stay linked from this roadmap:
- reservation import and trip ops hub: #343
- travel alerts and documents hub: #344
- budgeting and expense split: #345
- packing checklists: #346
- external planning imports from Google Maps, screenshots, and PDFs: #347
- auto travel journal and tracker: #348

## Current Backlog Notes

- Issue #269 duplicates #268 and is now closed in favor of #268.
- Existing roadmap weight skews frontend-heavy. Future backlog additions should prefer user workflows and durable data contracts over standalone visual polish.
- When new feature work starts, link PRs back to the roadmap section they advance so the strategy stays traceable.

## Source Notes

External references used in the original planning pass:
- [Wanderlog](https://wanderlog.com/en)
- [TripIt pricing](https://www.tripit.com/web/pro/pricing)
- [TripIt Inbox Sync](https://www.tripit.com/web/blog/news-culture/automate-your-tripit-itineraries-inbox-sync)
- [Mindtrip](https://mindtrip.ai/)
- [Polarsteps](https://www.polarsteps.com/)
- [Polarsteps planning update](https://news.polarsteps.com/releases/planning-update-2025)
- [Polarsteps AI itinerary builder](https://support.polarsteps.com/hc/en-us/articles/27170922889874-How-do-I-use-the-AI-powered-itinerary-builder-to-plan-my-trip)
