# Recommendations: where the data lives and how to change it

This is the operational answer for the place recommendations that power the
Ideas deck. The model itself is described in `docs/RECOMMENDATIONS_MODEL_PLAN.md`.

## Short version

- The recommendations are **files in this repository**, not rows in Supabase.
- There is **no admin UI for them yet**. Editing means editing a JSON file and
  opening a pull request.
- **No SQL, no migration** is needed to change, add or remove one.
- What a *traveller* decides (kept and skipped) is not part of this data at all:
  it lives on the trip document plus that browser's own storage.

## The files

| File | What it is | Who writes it |
| --- | --- | --- |
| `data/recommendations/tw.json` | The generated dataset the app loads. 84 Taiwan places. | Scripts. Do not hand-edit. |
| `data/recommendations/tw.content.json` | The written copy: description, `highlights`, cost band, duration — keyed by slug. | **A human. This is the file you edit.** |
| `shared/recommendations.ts` | The types, and the copy from a library row onto a trip. | Code review. |
| `services/recommendationsService.ts` | Lazy-loads the dataset per country and orders the deck. | Code review. |

One file per country, named by lowercase ISO-2 code. Adding a country means
adding `xx.json` and `xx.content.json` and registering the loader in
`services/recommendationsService.ts`.

`tw.json` is around 230 KB and is loaded lazily, only when the deck opens.

## Editing the words on a card

1. Open `data/recommendations/tw.content.json`.
2. Find the entry by its slug (the same slug as in `tw.json`).
3. Change `description`, `highlights`, `costBand` or `typicalDurationMinutes`.
4. Apply it:

```bash
pnpm tsx scripts/apply-recommendation-content.ts --country TW --apply
```

Without `--apply` the script previews and exits non-zero, listing any slug that
has no copy and any slug in the content file that no longer exists.

`highlights` renders as the bulleted **Recommendations** block on the card:
dishes to order, when to go, what to skip. Keep each line to one idea.

The copy is deliberately kept out of `tw.json` so that re-running the import or
the photo pass never overwrites something a person wrote.

## Refreshing photos and price bands

```bash
pnpm tsx scripts/enrich-recommendation-photos.ts --country TW --apply
```

Needs `VITE_GOOGLE_MAPS_API_KEY` in `.env.local`. It fetches each place from
Google Places, picks a photo, fills an empty `costBand` from Google's price
level, and writes the result into `tw.json`.

Photos are **never** copied. The dataset stores the Places photo resource name
and the photographer's attribution; `/api/place-photo` redirects to Google at
render time, which keeps the API key server-side and stays inside the Places
terms.

How a photo is chosen (`scripts/lib/recommendationPlaceEnrichment.ts`):

- Google's own ordering dominates — its first photo is the representative one.
- Portraits are passed over: a card hero is a wide band, so a tall photo arrives
  as a centre crop of somebody's ceiling.
- A photo attributed to the venue itself outranks the rest, because that is the
  brand or dish shot rather than a diner's snapshot.

If a place's stored `googlePlaceId` came from the geocoder rather than Places it
resolves to nothing; the script re-searches by name and writes the working id
back. Coordinates are never moved — those come from the original pins.

To force a specific photo, put the photo resource name into the entry's `image`
in `tw.json` by hand and leave that entry out of the next enrichment run.

## Importing a new source map

`scripts/import-recommendations-kml.ts` takes a Google My Maps KML export,
geocodes every pin, reads the note for activity types, cost and duration, and
writes the dataset. Everything it produces lands `status: 'in_review'`.

Order of operations for a new country: import → enrich photos → write copy →
apply copy.

## What is *not* in these files

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

## Still to come

An admin surface and Supabase tables are phases 3 to 5 of
`docs/RECOMMENDATIONS_MODEL_PLAN.md`. Until then the repository is the source of
truth and a pull request is the edit mechanism.
