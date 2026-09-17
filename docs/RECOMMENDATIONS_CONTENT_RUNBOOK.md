# Recommendations: where the data lives and how to change it

The operational guide for the place recommendations behind the Ideas deck: where
the rows live, how to maintain them, and how to seed a new country.

## Short version

- Recommendations live in the **Supabase table `public.recommendations`**.
- Maintain them at **`/admin/recommendations`**: add, edit, publish, delete.
- Travellers only ever see rows with `status = 'published'`.
- The repo file `data/recommendations/tw.json` is now a **seed and a fallback**,
  not the source of truth.
- **The migration is not applied by a deploy.** Apply it by hand once, then seed.

## First-time setup

1. Apply `supabase/migrations/20260917090000_recommendations_library.sql`
   following `docs/SUPABASE_RUNBOOK.md`. Nothing works before this.
2. Seed a country, either way round:
   - In the admin: open `/admin/recommendations`, pick the country, press
     **Import bundled**. Rows arrive with the status the dataset carries
     (`in_review` for imported pins), so nothing is public yet.
   - From the terminal, with `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`:

```bash
pnpm tsx scripts/sync-recommendations-to-supabase.ts --country TW --apply
```

   Add `--publish` to publish everything it writes. Without `--apply` it only
   reports what it would do, including how many rows it would overwrite.
3. Publish what you want travellers to see — per row in the admin, or in bulk
   in the SQL editor:

```sql
update public.recommendations
   set status = 'published'
 where country_code = 'TW' and status = 'in_review';
```

## Day-to-day maintenance

Everything happens at `/admin/recommendations`:

- **New** writes a recommendation from scratch. Title and country code are the
  only required fields; the id and slug are derived from them.
- The **Recommendations** box is the bulleted list on the card — one per line,
  the dishes to order, when to go, what to skip.
- **Status** is the visibility switch. `draft` and `in_review` are admin-only,
  `published` is live, `retired` and `rejected` are kept for the record.
- **Import bundled** re-seeds a country from the shipped dataset. It overwrites
  rows with the same id, edits included, so it is a seeding tool rather than a
  sync.

Coordinates are what draw the card's map, so fill in latitude and longitude for
anything you want placed. Leave them empty and the card falls back to the photo
alone.

### Photos

Photos are **referenced, never copied** — that is what keeps us inside the
Google Places terms. Paste a path of the form

```
/api/place-photo?ref=places/<placeId>/photos/<photoId>
```

into **Photo URL** and put the photographer in **Photo credit**. The edge
function resolves the reference at render time so the API key stays server-side.

To refresh photos and price bands for a whole country from Google Places:

```bash
pnpm tsx scripts/enrich-recommendation-photos.ts --country TW --apply
```

That writes the repo dataset, not the table. Re-seed afterwards if you want the
new photos in the database.

How a photo is chosen (`scripts/lib/recommendationPlaceEnrichment.ts`):

- Google's own ordering dominates — its first photo is the representative one.
- Portraits are passed over: a card hero is a wide band, so a tall photo arrives
  as a centre crop of somebody's ceiling.
- A photo attributed to the venue itself outranks the rest, because that is the
  brand or dish shot rather than a diner's snapshot.

If a place's stored `googlePlaceId` came from the geocoder rather than Places it
resolves to nothing; the script re-searches by name and writes the working id
back. Coordinates are never moved — those come from the original pins.

## The files that are still files

| File | What it is |
| --- | --- |
| `data/recommendations/tw.json` | The seed and offline fallback. Generated — do not hand-edit. |
| `data/recommendations/tw.content.json` | Written copy keyed by slug, applied into the dataset before seeding. |
| `shared/recommendationRows.ts` | The table ↔ app mapping, and what validates an editor's input. |
| `services/recommendationsService.ts` | Reads the API, falls back to the file. |

To change the seed rather than the live rows:

1. Edit `data/recommendations/tw.content.json`.
2. `pnpm tsx scripts/apply-recommendation-content.ts --country TW --apply`
3. Re-seed, if the database should take the change too.

## How the app reads it

`/api/recommendations?country=TW` returns published rows, read with the anon key
so row-level security decides what is visible rather than a filter somebody
might forget. The client calls it first and drops to the bundled dataset only
when the endpoint cannot answer — an outage, a preview without environment
variables, a country not yet migrated. An **empty** published list is treated as
a real answer, because falling back there would show ideas an editor
deliberately unpublished.

Admin writes go through `/api/internal/admin/recommendations`, which checks the
caller's admin role with their own token and then writes on the service role.

## What is *not* in this table

A traveller's keeps and skips are per trip, not per library:

- `ITrip.recommendationState` on the trip document — persists for the owner of
  an editable trip, and follows them across devices.
- `tf_trip_recommendations_v1` in that browser's `localStorage`
  (`services/recommendationReactionsStore.ts`) — the fallback that always works,
  including on a shared `?v=` link and on an example trip, where the trip itself
  cannot be written.

Both are read on open and merged; a merge never un-makes a decision. The key is
registered in `lib/legal/cookies.config.ts`, which `pnpm storage:validate`
enforces.

A kept idea is **copied** onto the trip, not referenced. Retiring or deleting a
library row therefore never changes a trip that already planned around it.

## Importing a new source map

`scripts/import-recommendations-kml.ts` takes a Google My Maps KML export,
geocodes every pin, reads the note for activity types, cost and duration, and
writes the dataset. Everything it produces lands `status: 'in_review'`.

Order of operations for a new country: import → enrich photos → write copy →
apply copy → seed the table → publish.
