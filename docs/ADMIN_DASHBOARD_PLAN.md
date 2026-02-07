# Admin Dashboard Plan

This document defines the purpose and scope of the future authenticated admin dashboard.

## Primary goal
Give admins one at-a-glance view of product health, growth, and usage risk so issues can be detected before they become outages or runaway cost spikes.

## Planned route
- `/admin/dashboard` (no nav link for now)
- Must be protected once auth/roles are ready.

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
1. Add role claims and secure route guard.
2. Add backend aggregation endpoints/views.
3. Build charts + tables from stable API contracts.
4. Add alerting for quota/cost thresholds.
5. Validate with synthetic load and production-like traffic.
