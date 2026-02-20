# Admin User Deletion Policy

Last updated: 2026-02-20

## Purpose

Define the operational policy for deleting users in the admin workspace, including when to use soft delete, when hard delete is allowed, and how to preserve trips before a hard delete.

## Deletion Modes

### Soft delete (recommended default)

- Action: set user account status to `deleted`.
- Effect:
  - Keeps auth record and profile row.
  - Keeps all owned trips and related data.
  - Allows support/admin review and restore later.
- Restore path: set account status back to `active`.

### Hard delete (irreversible)

- Action: delete user from Supabase Auth via admin identity API.
- Effect:
  - Permanently removes auth account and profile.
  - Permanently removes all trips owned by that user because ownership is linked with cascade delete.
  - Permanently removes dependent trip records (for example history versions, share links, collaborator links tied to deleted trips).
- Recovery: not supported as a standard workflow.

## Transfer-Before-Delete Flow

For users who still own trips, admins should prefer transfer-before-delete:

1. Open the user in Admin Users drawer.
2. Click `Transfer trips + hard delete`.
3. Enter target user email or UUID.
4. Target user must:
   - exist,
   - be different from source user,
   - have `active` account status.
5. Confirm transfer summary.
6. System reassigns all owned trips (active, archived, expired) to target user.
7. Only if all transfers succeed, system runs hard delete for the source user.

### Failure behavior

- If any trip transfer fails, hard delete is skipped.
- If all transfers succeed but hard delete fails, transferred trips remain with new owner and admin can retry hard delete separately.

## Audit Expectations

- Trip ownership changes are audited through existing trip update audit entries.
- Hard delete action is audited via admin identity edge flow.
- Audit log remains immutable.

## Guardrails

- Use hard delete only when irreversible removal is explicitly intended.
- Prefer soft delete for routine support operations.
- Prefer transfer-before-delete when trip preservation is required.
