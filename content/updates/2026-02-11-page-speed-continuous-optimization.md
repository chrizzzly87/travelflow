---
id: rel-2026-02-11-page-speed-continuous-optimization
version: v0.54.0
title: "Page speed baseline and continuous optimization"
date: 2026-02-12
published_at: 2026-02-12T06:25:49Z
status: published
notify_in_app: true
in_app_hours: 24
summary: "Added hybrid BlurHash + Netlify Image CDN delivery, removed eager homepage DB bundle loading, and fixed crawler/caching edge cases."
---

## Changes
- [x] [Improved] 🖼️ Added progressive BlurHash placeholders with production Netlify Image CDN delivery (AVIF/WebP + responsive widths) for blog cards/headers, inspirations cards, and homepage example trip cards.
- [x] [Improved] 🗺️ Reduced example trip map over-download by lowering default preview source dimensions/scale and serving responsive map card `srcset` variants.
- [x] [Improved] ⚡ Home route no longer eagerly loads Supabase-heavy DB code; trip/session DB modules now lazy-load only when trip flows actually need them.
- [x] [Improved] 🧠 Added immutable cache headers for hashed `/assets/*` files to improve repeat-visit performance.
- [x] [Fixed] 🤖 Added a valid `robots.txt` and explicitly disallowed crawler access to `/trip/` and `/s/` while keeping all other paths crawlable.
- [x] [Fixed] 🛠️ Resolved React runtime warnings by switching progressive image `fetchPriority` delivery to a lowercase DOM `fetchpriority` attribute and removing nested anchor markup in Inspirations cards.
- [ ] [Internal] 🧱 Added build-time image placeholder manifest generation (`sharp` + `blurhash`) and integrated it into the production build pipeline.
- [ ] [Internal] 🧩 Moved simulated-login debug state helpers into a lightweight standalone service to decouple debug toggles from Supabase runtime imports.
- [ ] [Internal] 🎨 Deferred Prism theme CSS loading to the admin benchmark route so non-admin pages avoid that render-blocking stylesheet.
- [ ] [Internal] 🧹 Production builds now prune `console.log/info/debug` calls while retaining warnings/errors.
- [x] [Improved] ⚡ Blog and marketing routes now load via lazy route chunks instead of shipping planner-heavy code on first paint.
- [x] [Improved] 🗺️ Removed globally injected Leaflet CDN assets from the HTML shell so non-map pages stop paying map-library cost.
- [x] [Improved] 🚀 On `/blog/best-time-visit-japan` (Lighthouse mobile sample), key metrics improved from roughly FCP `4.9s → 2.5s` (~`49%` faster), LCP `5.3s → 3.5s` (~`34%` faster), TBT `80ms → 3ms` (~`96%` lower), and Speed Index `5.5s → 2.5s` (~`55%` faster).
- [x] [Improved] 🖼️ Recompressed and regenerated responsive blog image derivatives, reducing the optimized blog image set by ~`452 KB` (`45` files, ~`15.4%` less transfer).
- [x] [Improved] 🧠 Increased blog image browser caching from 1 hour to 30 days (`s-maxage` 1 year) for faster repeat visits.
- [x] [Improved] 🧩 Added `content-visibility` with intrinsic-size hints for below-the-fold sections on blog detail pages.
- [x] [Improved] 📦 Added conservative Vite `manualChunks` groups so large dependency buckets can be cached independently.
- [x] [Improved] 🛠️ Deferred loading of the on-page debugger until explicitly requested (`debug()`/`?debug=1`/persisted auto-open).
- [x] [Improved] 🔤 Self-hosted `Space Grotesk` with local `woff2` subsets (`latin`, `latin-ext`, `vietnamese`) and `font-display: swap` to remove Google Fonts request chains.
- [x] [Improved] ✍️ Added a self-hosted `Bricolage Grotesque` heading option (latin/latin-ext/vietnamese subsets) for faster local typography experiments without external font CDNs.
- [x] [Improved] 🌍 Added self-hosted global script fallbacks (Cyrillic, Greek, Devanagari, Arabic, Hebrew, Thai) so international city/country names render reliably beyond English/German/Spanish/French Latin text.
- [x] [Improved] 🖼️ Updated OG image edge rendering to load local self-hosted fonts first, with resilient fallback if local assets are unavailable.
- [ ] [Internal] 📋 Added a persistent performance backlog document to keep route-by-route Lighthouse improvements active.
