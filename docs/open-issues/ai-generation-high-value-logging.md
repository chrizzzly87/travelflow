# AI Generation High-Value Logging Expansion (Follow-up)

## Status
Open issue (follow-up). Runtime AI safety monitoring, bounded prompt-security logging, and admin incident visibility have now shipped; this follow-up remains focused on deeper provider correlation, phase timings, and persistence-path attribution.

## Objective
Expand generation logging to prioritize high-signal, low-noise diagnostics that materially improve failure analysis and recovery.

## Why
Current logs cover core attempt diagnostics, but key operational gaps still exist:
1. Weak phase-level timing attribution.
2. Limited provider escalation identifiers.
3. Incomplete persistence-path visibility (local vs DB vs queue).
4. Limited validation quality diagnostics for malformed outputs.

## Scope
### 1) Request/Provider correlation
Log on every attempt:
- `request_id` (existing)
- `provider_request_id` (new)
- `provider_region` (if exposed)
- `provider_status_family` (2xx/4xx/5xx)

### 2) Phase timings (new)
- `queue_wait_ms`
- `provider_call_ms`
- `parse_ms`
- `normalize_ms`
- `db_write_ms`
- `total_duration_ms`

### 3) Validation and output-shape diagnostics (new)
- `schema_valid` (bool)
- `validation_error_count`
- `validation_error_types` (array, bounded)
- `output_city_count`
- `output_activity_count`
- `output_travel_segment_count`
- `output_truncated` (bool heuristic)

### 4) Persistence-path diagnostics (new)
- `persist_path`: `server_direct | client_direct | local_only | queued_sync`
- `persist_outcome`: `success | failed | deferred`
- `sync_queue_entry_id` (if deferred)

### 5) Retry decision diagnostics (new)
- `retry_strategy`: `default_model | fallback_model | manual_model`
- `retry_reason`: `timeout | parse_failure | provider_error | user_requested`
- `retry_of_attempt_id`
- `retry_budget_remaining`

### 6) Abort/source attribution (new)
- `abort_source`: `user_click | tab_close | client_timeout | server_timeout | unknown`
- `abort_signal_reason`

### 7) Prompt/config fingerprinting (safe)
- `prompt_template_version` (existing/required)
- `prompt_fingerprint_sha256` (new)
- `normalizer_version` (new)

## Out of Scope
1. Logging full raw prompts by default for all users.
2. Storing full model raw output unbounded in hot-path tables.
3. Adding high-cardinality, low-value UI event spam.

## Storage Design
Primary tables:
- `trip_generation_attempts` (canonical attempt record)
- `ai_generation_events` (provider telemetry stream)

Additions:
1. Extend `trip_generation_attempts.metadata` schema conventions (bounded JSON).
2. Extend `ai_generation_events.metadata` with phase and provider correlation fields.
3. Optional: `trip_generation_attempt_artifacts` for large payloads with TTL retention.

## Retention and Privacy
1. Keep request/diagnostic metadata for operational window (e.g. 30-90 days by tier).
2. Hash sensitive prompt variants (`prompt_fingerprint_sha256`) unless explicit debug opt-in.
3. Redact direct user-entered secrets from logged payload fragments.
4. Enforce owner/admin read rules for trip-level diagnostics.

## Dashboard / Alerting Targets
1. Timeout rate by provider/model.
2. Parse/validation failure rate by model.
3. Stuck-running attempts beyond timeout window.
4. Persist-path degradation (`local_only` / `queued_sync`) spikes.
5. Retry success rate and average retries per successful trip.

## Acceptance Criteria
1. Every attempt can be traced from user action to provider request and DB persistence outcome.
2. Timeout and parse failures are separable in metrics without log forensics.
3. Retry effectiveness can be measured per model/provider.
4. Production incidents can be reproduced from stored snapshot + fingerprint + diagnostics.

## Test Plan
1. Unit
- metadata builders produce bounded/safe payloads
- phase timing math and fallback handling

2. Integration
- attempt start/finish logs include new fields
- provider correlation survives both success and failure

3. Browser/E2E
- offline/supabase outage paths emit correct `persist_path` + `persist_outcome`
- tab-close abort emits `abort_source=tab_close`

4. Data quality checks
- nullability constraints for optional fields
- dashboard queries return consistent dimensions

## Rollout Plan
1. Phase 1: schema-compatible metadata enrichment behind flag.
2. Phase 2: dashboard + alert wiring.
3. Phase 3: tighten required fields once coverage is stable.

## GitHub Issue Draft
### Title
Expand AI generation logging with phase timings, provider correlation, and persistence-path diagnostics

### Body
Improve AI trip generation observability by adding high-value, low-noise diagnostics to attempt and telemetry logs.

Scope:
- Add provider correlation (`provider_request_id`) and status family dimensions.
- Add phase timings (`queue_wait_ms`, `provider_call_ms`, `parse_ms`, `normalize_ms`, `db_write_ms`).
- Add validation/output-shape diagnostics (schema status, error types, output counts).
- Add persistence-path diagnostics (`persist_path`, `persist_outcome`, queue fallback IDs).
- Add retry decision diagnostics and abort-source attribution.
- Add safe fingerprinting (`prompt_template_version`, `prompt_fingerprint_sha256`, `normalizer_version`).

Acceptance criteria:
- Each attempt is fully traceable across provider call, normalization, and persistence path.
- Timeout/parse/provider/persistence failure modes can be segmented from SQL dashboards.
- Retry effectiveness and fallback quality can be measured by provider/model.
- Logging remains privacy-safe and bounded.
