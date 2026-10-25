# Admin Dashboard Plan

This document defines the purpose and the longer-term scope of the admin Overview.

**Status (2026-10-24):** the Overview ships at `/admin/dashboard` as the first item in the admin
sidebar, behind the admin route guard. It covers group 1 and part of group 2 below from
Supabase data (KPI tiles, new users and trips, user mix by plan level, trips by status, recent
users). Group 3 (infrastructure and API usage) lives on the AI telemetry and Worker health
screens instead of here. What each admin screen does today is in
[`ADMIN_SCREENS.md`](./ADMIN_SCREENS.md); this file keeps the plan for what is still missing.

All dashboard surfaces follow the shared interaction and visual rules in [`DESIGN.md`](./DESIGN.md).

## Primary goal
Give admins one at-a-glance view of product health, growth, and usage risk so issues can be detected before they become outages or runaway cost spikes.

## Route
- `/admin/dashboard` — "Overview", first item in the admin sidebar and the `⌘K` palette.
- Protected by the admin route guard (`AdminRoute` in `app/routes/DeferredAppRoutes.tsx`).

## Core metric groups

### 1) User and account metrics
- Total registered users
- New users per day/week/month
- Active users (DAU / WAU / MAU)
- Anonymous vs authenticated usage share

Potential data source:
- Supabase auth users and application session records

### 2) Trip and product usage metrics
- Total trips created
- Trips created per user
- Average trip edits per trip
- Sharing usage (view-only vs editable links)
- Feature interaction funnel (create, edit, share, print)

Potential data source:
- `trips`, `trip_versions`, `shared_trips`, history snapshots

### 3) Infrastructure and API usage metrics
- Gemini request count, token usage, latency, errors
- Google Cloud Maps usage and quota consumption
- Estimated daily/monthly cost trend
- Alert thresholds (for example 80% quota)

Potential data source:
- Google Cloud Monitoring / billing exports
- Gemini usage endpoints/logging pipeline
- Internal server-side usage aggregation table

## Dashboard sections (proposed)
1. KPI strip (totals + trend deltas)
2. Product activity charts (users + trips)
3. API usage and quota health cards
4. Recent incidents/errors panel
5. Drill-down table (top users, heavy API usage, failed requests)

## Access and security requirements
- Admin-only route guard (role-based)
- Audit log for dashboard access
- No raw secrets in browser bundles
- Rate-limited backend metric endpoints

## Rollout checklist
1. [x] Add role claims and secure route guard.
2. [ ] Add backend aggregation endpoints/views (the Overview still aggregates up to 500 users and trips client-side).
3. [x] Build charts + tables (shared admin charts on Recharts, `components/admin/charts/`).
4. [ ] Add alerting for quota/cost thresholds.
5. [ ] Validate with synthetic load and production-like traffic.
6. [ ] Active users (DAU/WAU/MAU) and sharing usage — needs session/event aggregation first.
