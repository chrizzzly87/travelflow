Parent epic: #480

Blocked by PR #444. Do not import or copy unmerged code.

## Scope after #444 lands

- [ ] Review the merged JourneySpec contract.
- [ ] Map only explicitly allowlisted JourneySpec proposal operations into `TripChangeOperationV1`.
- [ ] Add round-trip and rejection tests for unsupported operations.
- [ ] Preserve the same approval, stale-revision, and atomic-version guarantees.
