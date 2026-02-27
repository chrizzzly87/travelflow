# Trip Source Attribution: System Owner + Canonical Origin Metadata (Follow-up)

## Status
Open issue (follow-up). Not in current profile/selection UX delivery scope.

## Objective
Introduce a canonical source model so trip badges and filters can reliably distinguish:
- Trips copied from other users.
- Trips copied from examples/inspirations.
- Trips originating from a global TravelFlow system catalog owner.

## Current State
- Source attribution is inferred from trip payload fields (`sourceKind`, `forkedFrom*`, template IDs).
- Example copies can be identified in UI, but DB does not enforce a canonical source owner taxonomy.

## Proposed Scope
1. Add canonical source columns on `trips`:
- `source_owner_type` (`user`, `system_catalog`)
- `source_owner_id` (nullable UUID for user owner references)
- `source_owner_handle` (nullable text for system catalog handles, e.g. `travelflow_examples`)
- `source_origin_kind` (`created`, `shared_copy`, `trip_copy`, `example_copy`, `benchmark`)
2. Backfill from existing source fields and template metadata.
3. Keep old source fields during migration for compatibility, then deprecate after rollout.
4. Expose normalized source metadata in list/read RPCs used by profile and admin surfaces.
5. Add filter support for source groups in profile/my-trips (future UI iteration).

## Migration Strategy
1. Schema migration with nullable columns.
2. Idempotent backfill job for existing trips.
3. Dual-write from upsert paths (`upsert_trip`, app client) while old fields remain.
4. Read preference switched to canonical columns.
5. Cleanup of legacy source fields once dashboards and clients are stable.

## Analytics
Track source attribution behavior and filter usage:
1. `profile__trip_source_filter--select`
2. `profile__trip_source_badge--open_details`
3. `my_trips__trip_source_filter--select`

## Risks and Mitigations
1. Incomplete historical backfill:
- Keep conservative fallback mapping in UI until backfill completion metrics hit threshold.
2. Ambiguous shared-copy ownership:
- Prefer explicit share-owner mapping where share token history exists; mark unresolved rows as `unknown_user_source` in metadata.
3. Breaking old clients:
- Keep legacy source fields available until one full release cycle completes.

## GitHub Issue Draft
### Title
Canonical trip source attribution with system catalog owner model

### Body
Add a canonical source attribution model for trips so UI badges, filters, and reporting can accurately classify origin.

Scope:
- Add canonical source owner/type/origin columns to trips.
- Backfill from existing `sourceKind`, fork metadata, and example template metadata.
- Support a global `system_catalog` owner (e.g. TravelFlow inspirations/examples).
- Expose normalized source metadata in DB read/list RPCs.
- Keep compatibility with existing source fields during rollout.

Acceptance criteria:
- Existing trips are backfilled with deterministic source attribution.
- Example/inspiration-derived trips can be identified without heuristics.
- Shared-copy vs own-copy origin is distinguishable in profile/admin surfaces.
- Regression tests cover backfill mapping + read-path compatibility.
