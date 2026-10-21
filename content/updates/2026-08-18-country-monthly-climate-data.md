---
id: rel-2026-08-18-country-monthly-climate-data
version: v0.160.0
title: "Monthly climate data for every country"
date: 2026-08-18
published_at: 2026-08-18T09:00:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Groundwork for picking a travel month and seeing the weather you can expect."
---

## Changes
- [ ] [Internal] 🌡️ Added committed monthly temperature and rainfall normals for all 197 countries from a ten-year reanalysis window.
- [ ] [Internal] 📍 Derived representative sampling points per country from the airport reference, with multiple regional points for large and elongated countries.
- [ ] [Internal] 🗓️ Derived a curated high/shoulder/low season signal per month from existing seasonality, events, and public holidays.
- [ ] [Internal] 🧩 Added a memoized climate lookup service with documented rainfall buckets so surfaces share one set of thresholds.
- [ ] [Internal] ✅ Added a climate dataset validator to the build plus service and validation test coverage.
- [ ] [Internal] 🔁 Added a resumable, cached refresh script and documented the schema, licensing, and known limitations.
