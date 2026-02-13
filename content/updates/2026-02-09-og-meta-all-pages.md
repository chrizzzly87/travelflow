---
id: rel-2026-02-09-og-meta-all-pages
version: v0.27.0
title: "Better social previews for every page"
date: 2026-02-09
published_at: 2026-02-09T22:30:00Z
status: published
notify_in_app: false
in_app_hours: 24
summary: "Every marketing page now shows the right title, description, and branded badge when shared on social media."
---

## Changes
- [x] [Improved] 🔗 Sharing links to Inspirations, Pricing, and Blog pages now show accurate titles and descriptions instead of generic fallbacks.
- [x] [Improved] 🏷️ Social preview images display a page-specific badge (e.g. "TRIP INSPIRATIONS", "PRICING", "BLOG") instead of always showing "TravelFlow".
- [x] [Improved] 🌍 Country-specific inspiration pages (e.g. /inspirations/country/Japan) generate dynamic OG meta with the country name.
- [x] [Improved] 📝 Blog post social previews now pull real titles and summaries for richer link cards.
- [ ] [Internal] Added edge function routes for /inspirations/*, /pricing, and /blog/* in netlify.toml.
- [ ] [Internal] Extended PageDefinition with optional pill field and added BLOG_META static map for blog post metadata.
