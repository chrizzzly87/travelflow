# Trip Collections and Default Folders (Follow-up)

## Status
Open issue (follow-up). Not in the current deletion/archive implementation scope.

Related follow-up: `docs/open-issues/trip-source-attribution-system-owner.md`

## Objective
Let users organize trips into collections/folders for easier retrieval and sharing context.

## Default Collections (System)
1. Own Trips
2. Shared Trips
3. Liked Trips

## User-Defined Collections
- Users can create custom collections (for example: `Japan Inspirations`).
- Users can rename and reorder custom collections.
- Users can move trips between collections and optionally copy a trip into multiple collections.

## Functional Scope
1. Collection CRUD for authenticated users.
2. Assign/unassign trip-to-collection links.
3. Batch operations from profile/my-trips surfaces:
- Move selected trips to a collection.
- Remove selected trips from a collection.
4. Filtering and sorting by collection in profile/my-trips UI.
5. Collection visibility controls:
- Private (default).
- Public (optional, for profile exposure).

## Data Model Proposal
1. `trip_collections`
- `id` (uuid PK)
- `owner_id` (uuid FK auth.users)
- `name` (text)
- `kind` (text enum: `system`, `custom`)
- `slug` (text, owner-scoped)
- `is_public` (boolean)
- `position` (integer)
- `created_at`, `updated_at`

2. `trip_collection_items`
- `collection_id` (uuid FK)
- `trip_id` (text FK trips.id)
- `owner_id` (uuid FK auth.users)
- `added_at`
- Unique `(collection_id, trip_id)`

## Migration and Compatibility
1. Backfill all existing owned trips into `Own Trips` for each user.
2. Backfill shared-access trips into `Shared Trips`.
3. Backfill favorited trips into `Liked Trips`.
4. Keep current trip list behavior as fallback until collection queries are fully rolled out.

## UX and Interaction Notes
1. Profile page:
- Collection switcher with default collections pinned first.
- Multi-select + move to collection action.
2. My Trips panel:
- Collection filter and quick move action.
3. Keyboard support:
- Keep batch actions accessible with keyboard and dialog confirmations.

## Analytics
Track collection lifecycle and usage:
1. `profile__collection--create`
2. `profile__collection--rename`
3. `profile__collection--delete`
4. `profile__collection_assign--single`
5. `profile__collection_assign--batch`
6. `my_trips__collection_filter--select`

## Rollout Plan
1. Phase 1: Data model + system collections only (read-only display).
2. Phase 2: Custom collection CRUD + assignment.
3. Phase 3: Batch move + filter/sort integration in profile/my-trips.
4. Phase 4: Public collection visibility and profile exposure controls.

## Risks and Mitigations
1. Cross-collection duplication confusion:
- Decide whether membership is single-collection or multi-collection per trip before implementation.
2. Performance on large trip sets:
- Add pagination and indexed joins from the first migration.
3. Permission leakage for shared trips:
- Enforce owner/collaborator checks on every collection mutation.

## GitHub Issue Draft
### Title
Trip Collections/Folders: default buckets + user-defined organization

### Body
Introduce trip collections so users can organize plans into default and custom folders.

Scope:
- Add system collections: Own Trips, Shared Trips, Liked Trips.
- Add custom collections (create/rename/reorder/delete).
- Support assigning/unassigning trips to collections.
- Add batch move actions from Profile and My Trips.
- Add collection filtering/sorting in Profile and My Trips.
- Add analytics for collection creation, assignment, and filtering.

Out of scope for first delivery:
- Hard-delete/restore policy changes.
- Public social discovery surfaces for collections beyond optional visibility toggles.

Acceptance criteria:
- Existing trips are backfilled into default collections.
- Users can create and manage custom collections without data loss.
- Batch operations are keyboard-accessible and confirmation-gated.
- Permissions prevent unauthorized collection changes on shared trips.
- Regression tests cover collection CRUD + assignment + filtering flows.
