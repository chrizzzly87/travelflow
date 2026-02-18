# Identity Linking + Account Merge Best Practices (Deferred)

## Status
Open issue (deferred). Not planned for the current release.

## Short Description
Define and implement a safe strategy for linking multiple auth identities (email/password + social providers) to one user account, and for handling existing duplicate users that share the same email.

## Why This Matters
- Admin tooling currently surfaces identity providers, but duplicate accounts can still exist.
- Same email across providers is not always a safe automatic-merge signal.
- Incorrect merges can cause data loss, privilege leaks, or broken login flows.

## Scope To Design (Later)
- Identity-linking rules for new and existing users.
- Duplicate-account detection and review workflow.
- Admin-safe account merge flow (with audit trail and rollback strategy).
- Post-merge data integrity validation.

## Key Decisions We Should Make
1. Trust policy for automatic merge:
- Never auto-merge by email only, or only for verified emails + approved providers?

2. Source of truth for identity ownership:
- Keep Supabase auth user as canonical identity root, with app profile attached.

3. Merge direction strategy:
- Keep oldest account, keep most active account, or manual admin choice.

4. Provider conflict handling:
- What happens if provider identity is already linked to another user.

5. Session + token behavior:
- Re-auth requirements and active session invalidation after merge.

## Security + Compliance Checklist
- Enforce permission gate for all merge/link operations.
- Require explicit admin confirmation for destructive steps.
- Write structured audit logs for every link/unlink/merge action.
- Prevent merge when role/tier mismatch introduces privilege escalation.
- Add dry-run preview before commit.

## Data Migration Considerations
- Move ownership safely for trips, versions, shares, settings, and profile references.
- Preserve timestamps and provenance metadata where possible.
- Recompute derived counters/materialized stats after merge.
- Protect against partial merges using transaction boundaries.

## UX Considerations
- Show clear duplicate signals in admin user drawer.
- Explain why users are flagged as possible duplicates.
- Provide a merge preview with before/after summary.
- Offer explicit “do not suggest merge for this pair” suppression.

## Testing Requirements
- Unit tests for merge eligibility rules.
- Integration tests for data move + identity relinking.
- Permission tests for read-only admin vs write admin.
- Recovery test for interrupted/failed merge operations.

## Open Questions
- Should we allow user self-serve account linking, admin-only linking, or both?
- Should merge be reversible for a limited time window?
- How should we handle localization/account preferences when both accounts differ?

## Suggested Future Deliverables
- `docs/IDENTITY_LINKING_POLICY.md`
- SQL/RPC migrations for merge/link workflows
- Admin UI flow: duplicate review + merge preview + merge commit
- Runbook for support/admin operations
