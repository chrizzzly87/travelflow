---
id: rel-2026-11-01-profile-previews-and-planner-refactor
version: v0.217.0
title: "Profile link previews and clearer trip warnings"
date: 2026-11-01
published_at: 2026-11-01T21:00:00Z
status: published
notify_in_app: false
in_app_hours: 24
summary: "Shared profile links show a proper preview and load right away, and trip warnings no longer borrow text from the next section."
---

## Changes
- [x] [Improved] 🪪 Shared profile links now show the traveler's name, bio and a preview image in chats and social posts, and the profile with its public trips appears right away instead of after a blank loading pause.
- [x] [Fixed] ⚠️ Trip warnings no longer pick up text from the next section of a city's notes when a city has an empty warnings section.
- [ ] [Internal] 🖥️ `/u/$username` moved from the client-only `_client` area into the server-rendered `_public` area; a route loader calls the validated `getPublicProfilePageData` server function, which reads anonymously (fresh Supabase client, no session, cookies or headers) and returns only public fields plus the first page of publicly visible trips.
- [ ] [Internal] 🔒 Private profiles are masked on the server to first name, last initial and handle; owner and admin views (own private profile, private-profile access, edit button, visibility badge) load only in the browser after hydration.
- [ ] [Internal] 🏷️ Per-profile `head`: title, description (bio or a new `publicProfile.metaDescription` key in all locales), Open Graph title/description/image via the existing `/api/og/site` image, and `noindex` on every profile state; profiles stay out of the sitemap.
- [ ] [Internal] ⏱️ Profiles get their own CDN policy (`s-maxage=60, stale-while-revalidate=300`) so edits show within minutes; backend failures are sent `no-store`. Mixed-case and renamed handles redirect in the loader.
- [ ] [Internal] 🕰️ Trip cards read "today" and expiry from the render clock so server-rendered dates match the first browser render.
- [ ] [Internal] 📦 Kept the profile route's head helpers free of country data (row mapping lives in `shared/publicProfileRows.ts`), so the entry bundle and the trip view don't pull in the optional country-alias chunk; an import-graph test guards it.
- [ ] [Internal] 🔄 Moved the trip generation clock, saved-trip polling and queue worker nudge out of TripView into `useTripGenerationPolling`, with fake-timer hook tests for cadence, completion, trip changes and unmount cleanup.
- [ ] [Internal] 🧪 Added a regression test for an empty Heads Up section followed by another heading.
- [ ] [Internal] 🧩 Moved the trip planner's pure layout constants and helpers (negative-offset normalisation, Heads Up warnings, trip summary, view-transition helpers) into `components/tripview/tripViewModel.ts`, with unit tests.
- [ ] [Internal] 🪟 Moved the lazy modal layer into `components/tripview/TripViewModalLayer.tsx`; every modal keeps its own lazy chunk and recovery key.
- [ ] [Internal] 📅 Extracted the calendar export handlers into `useTripCalendarExport`, with hook tests for scopes, sources and stable handler identities.
- [ ] [Internal] 🧭 The audit log timeline now renders on the shared admin table and can be sorted by When, Actor, Action or Target (newest first stays the default; the choice lives in the URL).
- [ ] [Internal] 🧩 Split the audit log page into a reducer-backed state hook, a data hook, an actions hook and focused filter bar, table, entry, user and trip sheet components under `components/admin/audit/`.
- [ ] [Internal] 🧮 Moved the audit log's parsing, filtering, sorting, paging, undo rules and labels into pure model modules with unit tests; the page offset and selection are now derived on render instead of being corrected by effects.
- [ ] [Internal] 🧪 Added reducer and model unit tests plus a browser test covering the filter, sort, open-sheet and export flows.
- [ ] [Internal] 🧩 Split the admin Users page into a reducer-backed state hook, data, detail and action hooks, and focused queue tiles, filter bar, table row, selection bar, create dialog and user sheet components under `components/admin/users/`.
- [ ] [Internal] 🧮 Moved URL parsing, filtering, sorting, paging, column handling, CSV export, override comparison and bulk-delete wording into pure helpers in `adminUsersModel.ts`; the page, its selection and the sheet's list pages are derived on render.
- [ ] [Internal] 🛡️ Kept every deletion safeguard, toast and error sentence, analytics event and URL query key as it was; the deletion confirmations live in one file next to the policy they follow.
- [ ] [Internal] 🧪 Added reducer and model unit tests plus a browser test covering filtering, sorting, opening the user sheet and confirmed bulk soft and hard deletes.
- [ ] [Internal] 🧹 Removed 41 stale draft release notes and the stale `deno.lock`; edge functions verified on a deploy preview without it.
