# Google My Maps import and export

Where it lives: the trip details dialog → **Import & export** tab → "Google My Maps"
(`components/tripview/GoogleMyMapsPanel.tsx`). It is deliberately not in the planner.

## Why KML and nothing else

My Maps has no public API. It does have two stable KML doors:

- **Out of My Maps:** `https://www.google.com/maps/d/kml?mid=<id>&forcekml=1` returns plain KML for any
  map shared as "Anyone with the link", with `Access-Control-Allow-Origin: *`, so the browser reads it
  directly — no function, no proxy. A map that is not shared returns Google's sign-in page with a 200,
  so the body (not the status) decides `not_shared`.
- **Into My Maps:** My Maps → create map → Import accepts a KML file. Each KML `Folder` becomes a layer.
  There is no way to write into an existing map, so export is a download.

## Import

`services/googleMyMapsImportService.ts` gets the KML (link, `.kml`, or `.kmz` read with the platform's
`DecompressionStream`), `shared/googleMyMaps.ts` parses and maps it.

- Pins land in the trip's **kept ideas** (`recommendationState.saved`), not on days. A map is a wish list.
  Both homes of kept ideas are written (trip + `recommendationReactionsStore`), like the ideas deck does.
- **Address-only pins are normal.** A layer built from a spreadsheet exports `<address>` and no `<Point>`.
  Positions are looked up with `searchPlaceLocation` (Google Places), biased to the stay named in the
  pin's Area/City column. With no Google location search the pins keep their address only.
- Layer columns (`ExtendedData`) are matched case- and punctuation-insensitively: notes, category, area,
  location, link/PostURL, source. Category → activity types via `mapMyMapsCategoryToActivityTypes`.
- **Ids** are `gmm-<hash(name|address)>` (position only when there is no address), so the same place from a
  link, a KMZ or a TravelFlow export is one idea. `selectNewIdeas` also skips titles already planned as
  activities, since planning an idea removes it from the kept list.
- Lines and polygons are counted and left out.

## Export

`services/tripKmlExportService.ts`: folders `tf-route`, `tf-stops`, `tf-activities`, `tf-day-trips`,
`tf-ideas`, with localized names. Only places with coordinates are written. The importer skips the
`tf-stops` folder, so re-importing an export never turns stops into ideas.

## Ideas on the map and review

Imported ideas arrive with `review: 'pending'` (`shared/tripIdeas.ts`); Save writes `'saved'`, Skip
`'skipped'`. An idea with no `review` predates review: a library idea kept in the deck counts as saved, a
My Maps import (`gmm-` id) as pending, because nobody ever decided on those first imports.

- **Map layer:** a lightbulb toggle next to the activity-pin toggle, shown only when the trip has ideas
  with a position. Off by default, remembered per trip on the device (`tf_trip_idea_layer_v1`), switched
  on automatically after an import. Pins use the activity-pin shape with a dashed ring; to-review pins are
  also faded. Skipped ideas are not drawn. Pins are built in the map's main drawing pass
  (`ItineraryMap`) and attached/detached by a small visibility effect, the same way activity pins are.
- **Review:** clicking a pin opens a card on the map (`components/maps/IdeaMapPopup.tsx`, same popover
  contract as `ActivityMapPopup`) with Save / Skip and map-app links. Save is always the main button; on a saved idea it reads as a pressed
"Saved" and pressing it again returns the idea to review. Saving never creates an activity:
  the place stays a saved idea with a full pin. Save keeps the card open showing "Saved"; Skip closes it. The Kept list offers
  ✓ / ✕ on to-review rows too. Every decision goes through `commitRecommendationState` in `TripView`,
  which writes the trip and commits it to the database — `persist` alone only reaches this browser. Skipped imports stay on the trip with `review: 'skipped'` (listed under
  Skipped, restorable to "to review") so a re-import never brings them back.
- **Export** leaves skipped ideas out.
