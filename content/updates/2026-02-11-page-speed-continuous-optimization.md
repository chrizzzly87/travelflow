---
id: rel-2026-02-11-page-speed-continuous-optimization
version: v0.47.0
title: "Page speed baseline and continuous optimization"
date: 2026-02-12
published_at: 2026-02-12T14:34:52Z
status: published
notify_in_app: true
in_app_hours: 24
summary: "Homepage and content pages now load and transition faster, with smoother media previews and a more interactive example-trip carousel."
---

## Changes
- [x] [Improved] ⚡ Homepage, blog, and marketing pages now feel much faster, especially on first visit.
- [x] [Improved] 🖼️ Images now appear with smoother progressive loading, so cards and headers become readable sooner on slower connections.
- [x] [Improved] 🗺️ Example trip map previews now load faster and more reliably across homepage and share surfaces.
- [x] [Improved] 🧭 Opening routes feels smoother with fewer blank-loading flashes between pages.
- [x] [Improved] 🔤 Typography now loads more reliably with fewer external font delays.
- [x] [Improved] 🎢 Homepage example trips now use a clean continuous desktop scroll with subtle perspective taper on entry, and now support endless swipe with center snapping on mobile.
- [x] [Improved] 🧲 Mobile carousel swipe now uses smoother native center snapping after release.
- [x] [Fixed] 📱 Endless mobile scrolling now stays stable at loop boundaries without jittering or reverse snap jumps.
- [x] [Improved] 🎯 Mobile carousel snapping now feels more natural with native browser snap behavior and no abrupt post-swipe jumps.
- [x] [Improved] 🌫️ Mobile carousel edge fades now blend over cards smoothly instead of hard clipping at the viewport edge.
- [x] [Fixed] 🖼️ Example trip cards now prioritize stable built-in map previews for more consistent image loading.
- [x] [Fixed] ✅ Map-based previews and social images now fall back gracefully when map provider restrictions occur.
- [x] [Fixed] 🤖 Private trip/share paths are now kept out of search indexing while public pages remain crawlable.
- [ ] [Internal] 🧱 Added build-time image placeholder manifest generation (`sharp` + `blurhash`) and integrated it into the production build pipeline.
- [ ] [Internal] 🧩 Moved simulated-login debug state helpers into a standalone service to decouple debug toggles from Supabase runtime imports.
- [ ] [Internal] 🎨 Deferred Prism theme CSS loading to the admin benchmark route to avoid render-blocking CSS on non-admin pages.
- [ ] [Internal] 🧹 Production builds now prune `console.log/info/debug` calls while retaining warnings and errors.
- [ ] [Internal] 🧭 Reverted homepage example card motion to linear desktop marquee transforms and limited scaling to a short right-edge taper zone.
- [ ] [Internal] 📱 Mobile carousel now uses a repeated data strip with scroll-position recentering to keep native swipe + snap behavior effectively endless.
- [ ] [Internal] 🧮 Mobile loop recentering now normalizes centered card positions into the middle strip via measured modular offsets.
- [ ] [Internal] 🎯 Switched mobile to native `snap-mandatory`; loop recentering now runs after idle/`scrollend` and uses snap-neutral teleporting to prevent boundary direction reversals.
- [ ] [Internal] 📐 Removed forced post-snap JS center correction and kept native CSS snapping, while preserving endless-loop recentering after idle/`scrollend`.
- [ ] [Internal] 🌫️ Replaced mobile mask-based edge softening with explicit overlay gradients to avoid hard-cut clipping on some browsers/compositors.
- [ ] [Internal] 🗺️ Removed runtime map preview URL usage from homepage cards so map images resolve from stable local card assets first.
- [ ] [Internal] 🧭 Hardened Google Maps loader readiness checks to wait for a constructible `google.maps.Map` before initializing trip maps.
- [ ] [Internal] 🧭 Added route-module warmup and link-intent preloading for first-navigation chunk compilation smoothness.
- [ ] [Internal] 📦 Added conservative Vite `manualChunks` groups so heavy dependency buckets can cache independently.
- [ ] [Internal] 🗺️ Switched homepage example trip cards to pre-generated map assets instead of runtime map preview API calls.
- [ ] [Internal] 🔤 Self-hosted `Space Grotesk` and `Bricolage Grotesque` font subsets to remove external font request chains.
- [ ] [Internal] 🌍 Added self-hosted global script font fallbacks (Cyrillic/Greek/Devanagari/Arabic/Hebrew/Thai) for broader locale coverage.
- [ ] [Internal] 🛠️ Deferred on-page debugger loading behind explicit debug entry points (`debug()`, `?debug=1`, persisted auto-open).
