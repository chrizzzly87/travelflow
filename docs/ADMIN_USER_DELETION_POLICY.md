# Admin User Deletion Policy

Last updated: 2026-10-24

## Purpose

Define the operational policy for deleting users in the admin workspace, including when to use soft delete, when hard delete is allowed, and how to preserve trips before a hard delete.

## Deletion Modes

### Soft delete (recommended default)

- Action: set user account status to `deleted`.
- Where: **Soft delete** in the footer of the user's details sheet, **Soft-delete user** in the row's `…` menu, or **Soft delete** in the bulk-action bar that appears when rows are selected. The success toast offers **Undo**.
- Effect:
  - Keeps auth record and profile row.
  - Keeps all owned trips and related data.
  - Allows support/admin review and restore later.
- Restore path: **Restore user** in the details sheet footer or the row's `…` menu (or set account status back to `active` under **Profile & access**). Soft-deleted rows cannot be selected for bulk actions.

### Hard delete (irreversible)

- Action: delete user from Supabase Auth via admin identity API.
- Where: **Hard delete** (destructive, last button) in the details sheet footer, or **Hard delete** in the bulk-action bar. It is disabled for soft-deleted users: restore first.
- Effect:
  - Permanently removes auth account and profile.
  - Permanently removes all trips owned by that user because ownership is linked with cascade delete.
  - Permanently removes dependent trip records (for example history versions, share links, collaborator links tied to deleted trips).
  - If hard delete is blocked by historical references, system runs a cleanup pass (clear nullable references and remove remaining owned-trip links) and retries once.
- Recovery: not supported as a standard workflow.

## Transfer-Before-Delete Flow

For users who still own trips, admins should prefer transfer-before-delete:

1. Open the user's details sheet on **Users** (`/admin/users`, or the deep link `/admin/users?user=<id>&drawer=user`).
2. Click `Transfer trips + hard delete` in the sheet footer (shown only while the user owns trips).
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
- Bulk hard delete returns per-user failure reasons above the table and keeps only the failed rows selected, so support can retry just those.

## Audit Expectations

- Trip ownership changes are audited through existing trip update audit entries.
- Hard delete action is audited via admin identity edge flow.
- Audit log remains immutable.

## Guardrails

- Use hard delete only when irreversible removal is explicitly intended.
- Prefer soft delete for routine support operations.
- Prefer transfer-before-delete when trip preservation is required.
