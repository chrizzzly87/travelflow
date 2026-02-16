# Trip Creation DB Tracking Plan (Design Only)

## Scope
Design a tracking model for create-trip submissions and generated trips without shipping migrations in this release.

## Objectives
- Track funnel and quality metrics for trip creation.
- Preserve anonymous-user behavior before auth rollout.
- Support future user-level joins after login/auth is enabled.
- Keep privacy-safe defaults and explicit retention limits.

## Event Stream Design
Capture two layers:
1. Client analytics events (Umami)
- `create_trip__cta--generate`
- `create_trip__toggle--roundtrip`
- `create_trip__toggle--route_lock`
- `create_trip__section--expand`
- `app__chunk_recovery--reload`

2. Server-side creation telemetry (DB)
- One row per create attempt
- One row per successful generated trip linkage

Recommended logical event types:
- `create_trip_attempted`
- `create_trip_succeeded`
- `create_trip_failed`

## Anonymous Session Linkage
Before auth, use a stable anonymous key:
- `anon_session_id` (UUID, client-generated, persisted in localStorage)
- Attach to each create-attempt record
- Do not store raw IP or user-agent; if needed, store coarse hashed fingerprint with rotating salt

## Post-Auth User Linkage
After login rollout:
- Add nullable `user_id` FK on tracking rows
- Backfill linkage by matching recent `anon_session_id` during login handshake
- Keep both identifiers for auditability (`anon_session_id`, `user_id`)

## Proposed Schema (Future)
Table: `trip_creation_events`
- `id` UUID PK
- `created_at` timestamptz
- `event_type` text check
- `trip_id` text nullable
- `user_id` uuid nullable
- `anon_session_id` text nullable
- `request_id` text nullable
- `prompt_contract_version` text default `classic_v1`
- `payload_json` jsonb

Table: `trip_creation_attempts`
- `id` UUID PK
- `created_at` timestamptz
- `user_id` uuid nullable
- `anon_session_id` text nullable
- `status` text (`success`/`failed`)
- `error_code` text nullable
- `duration_ms` integer nullable
- `trip_id` text nullable
- `input_snapshot_json` jsonb
- `effective_defaults_json` jsonb

Indexes (future)
- `(created_at desc)`
- `(user_id, created_at desc)`
- `(anon_session_id, created_at desc)`
- `(status, created_at desc)`

## Privacy and Compliance
- Minimize PII: no free-text personal profile fields outside explicit notes already sent for generation.
- Truncate/sanitize user notes before persistence where possible.
- Add retention windows:
  - raw attempt payloads: 30-90 days
  - aggregate metrics: long-term
- Support deletion workflows by `user_id` once auth is live.

## Rollout Phases
1. Phase 1 (now): Documentation + client analytics only.
2. Phase 2: Add DB tables + write-path for attempts/success/failure.
3. Phase 3: Add auth linkage (`user_id`) + backfill from `anon_session_id`.
4. Phase 4: Add dashboards/queries and alerting for error spikes.

## Open Decisions
- Final retention duration for raw `input_snapshot_json`.
- Whether notes should be stored raw, summarized, or redacted.
- Whether benchmark events should be stored in the same tables or separate admin-only tables.
