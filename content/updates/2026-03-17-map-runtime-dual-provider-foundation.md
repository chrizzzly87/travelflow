---
id: rel-2026-03-17-map-runtime-dual-provider-foundation
version: v0.0.0
title: "Dual-provider map runtime foundation"
date: 2026-03-17
published_at: 2026-03-17T18:00:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Adds a shared map runtime foundation so Google and Mapbox can be tested side by side without changing the current production planner behavior."
---

## Changes
- [ ] [Internal] 🗺️ Added a shared map runtime contract, cookie override flow, and admin debugger controls so Google-only and mixed Mapbox-visual presets can be tested with the same resolver across planner, preview, and OG map surfaces.
- [ ] [Internal] 🧪 Moved the admin map runtime controls into a dedicated Maps debugger tab and added a safer Google fallback when Mapbox basemap requests fail at runtime.
- [ ] [Internal] 🧱 Fixed the Mapbox visual basemap mount so shared planner/blog map surfaces keep a full-height canvas instead of collapsing to an empty viewport during mixed-runtime testing.
- [ ] [Internal] 🧭 Restored shared Google overlay behavior above the Mapbox basemap by hiding only the Google base pane in mixed-runtime mode, so planner interactions, markers, and route layers stay visible while Mapbox visuals are enabled, and kept the debugger on the last admin tab after reloads even if auth finishes resolving a moment later.
- [ ] [Internal] 🛰️ Reworked the trip-page mixed map surface so Google’s placeholder background and attribution chrome no longer cover the Mapbox basemap, while Mapbox now owns direct map interaction and keeps its camera synced with Google-backed overlays.
- [ ] [Internal] ✨ Moved the trip page’s visible city markers, route lines, and label overlays onto native Mapbox rendering in mixed mode, added a cleaner Standard-style basemap profile, softened the initial Mapbox camera experience with a globe-to-trip intro and less aggressive resize churn, and kept the Google canvas hidden while Mapbox is warming up so the two map surfaces stop flashing against each other.
- [ ] [Internal] 🎥 Smoothed the trip page’s mixed Mapbox camera handoff by waiting for gesture completion before syncing back to Google, starting the Mapbox canvas directly from a globe view, increasing fit/recenter safe-zone padding, improving city label spacing, and making Standard-style switches use the supported Mapbox config flow instead of brittle runtime layer mutations.
- [ ] [Internal] 🧩 Stabilized trip-page mixed map state by cleaning up the Mapbox satellite basemap, rebuilding native route layers after style reloads, enlarging recenter safe-zones, shifting marker zoom transitions earlier, and preventing stale deferred trip snapshots from overwriting newer map, city, or timeline changes.
- [ ] [Internal] ✈️ Replayed the dual-provider map foundation onto the latest `origin/main` base, made local history snapshots write before navigation so delayed style commits stop snapping back to stale views, restored country context on the cleaner Mapbox basemaps, surfaced the globe intro before Google overlays finish warming, centered trip labels above their pins, and added curved flight paths with a straight ground shadow on the trip page.
- [ ] [Internal] 🎛️ Extracted trip-page map tuning into a shared provider-aware helper so Google and Mapbox can use different fit padding, focus zooms, marker zoom bands, resize thresholds, and intro-camera timing without scattering new magic numbers across the planner surface, and restored the current-main package baseline so branch builds stop failing on missing shared dependencies.
- [ ] [Internal] 💾 Persisted the debugger open state and last active tab so reloads return to the same workspace, including the Maps tab during provider testing.
- [ ] [Internal] 🧭 Extracted provider-specific location search and route computation into dedicated services so the planner renderer can stay visually stable while map providers are evaluated behind cleaner seams.
- [ ] [Internal] 🖼️ Made trip preview and OG/static map generation runtime-aware, including provider-specific cache separation so Google and Mapbox preview assets do not collide during testing.
- [ ] [Internal] 🔐 Documented the required Mapbox runtime environment keys in the example env file so local and edge testing can be configured without guesswork.
