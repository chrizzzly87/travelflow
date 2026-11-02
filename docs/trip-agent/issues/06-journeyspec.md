Parent epic: #480

Closed on 2026-11-01. Superseded by spike #626.

PR #444 was closed without merging. It was 300+ commits behind `main` and predated the TanStack Start migration, so `main` has no JourneySpec contract for the Trip Agent to map from. Spike #626 restates JourneySpec against today's app, including how the Trip Agent would read a spec and propose spec-level changes.

If #626 goes ahead, these guarantees from the original scope still apply to any spec-to-agent mapping:

- Map only explicitly allowlisted spec operations into `TripChangeOperationV1`.
- Add round-trip and rejection tests for unsupported operations.
- Preserve the same approval, stale-revision, and atomic-version guarantees.
