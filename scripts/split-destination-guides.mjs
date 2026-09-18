/**
 * Derives the slim country-list slice of `data/destinationGuides.json`.
 *
 * The monolith is ~450 KB minified across 707 guides, and `sourceLinks` (137 KB),
 * `events` (43 KB) and `airports` (26 KB) are prose the list views never render.
 * A single named import from `services/destinationGuideService` pulled all of it
 * into one 442 KB chunk that six page chunks statically depended on — including
 * the festivals page, which reads one field (`slug`), and the countries explorer,
 * which reads nine.
 *
 * `data/destinationGuides.json` stays the source of truth: `import-destination-guides`
 * keeps writing it, `sync-destination-guides` keeps pushing it to Supabase (which is
 * what `/api/destinations` actually serves), and the detail pages keep reading the
 * whole document through `services/destinationGuideService`. Only the list-shaped
 * consumers read this slice. `tests/unit/destinationGuideSplit.test.ts` regenerates
 * it and fails if the checked-in file has drifted.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = path.join(projectRoot, 'data');

const BANNER_KEY = '_generated';
const BANNER = 'Derived from data/destinationGuides.json by scripts/split-destination-guides.mjs — do not edit by hand.';

/**
 * Ordering must match `listDestinationGuides({ kind: 'country' })`: a stable sort
 * by `priorityRank` over document order, with unranked guides last. The slice is
 * emitted pre-sorted so the client accessor only ever slices.
 */
const byPriorityRank = (left, right) => (
  (left.priorityRank || Number.MAX_SAFE_INTEGER) - (right.priorityRank || Number.MAX_SAFE_INTEGER)
);

/**
 * The fields the list-shaped consumers read, and nothing else:
 * `countryExplorerService` needs all nine, `countryRouteService` resolves a name
 * to `countryCode`, `festivalCatalogService` resolves a code to `slug`.
 * `kind` is omitted — every entry here is a country by construction.
 */
const toSummary = (guide) => ({
  id: guide.id,
  name: guide.name,
  slug: guide.slug,
  countryCode: guide.countryCode,
  region: guide.region,
  tags: guide.tags,
  ...(guide.priorityRank === undefined ? {} : { priorityRank: guide.priorityRank }),
  ...(guide.suggestedTripDays === undefined ? {} : { suggestedTripDays: guide.suggestedTripDays }),
  ...(guide.seasonality === undefined ? {} : { seasonality: guide.seasonality }),
});

export const SPLIT_TARGETS = {
  'destinationGuideList.generated.json': (source) => ({
    [BANNER_KEY]: BANNER,
    generatedAt: source.generatedAt,
    countries: source.guides.filter((guide) => guide.kind === 'country').sort(byPriorityRank).map(toSummary),
  }),
};

export function readDestinationGuides() {
  return JSON.parse(fs.readFileSync(path.join(dataDir, 'destinationGuides.json'), 'utf8'));
}

export function renderSplit(filename) {
  const build = SPLIT_TARGETS[filename];
  if (!build) throw new Error(`Unknown split target: ${filename}`);
  // Compact on purpose: regenerated wholesale, never hand-edited.
  return `${JSON.stringify(build(readDestinationGuides()))}\n`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const filename of Object.keys(SPLIT_TARGETS)) {
    const target = path.join(dataDir, filename);
    fs.writeFileSync(target, renderSplit(filename), 'utf8');
    console.log(`Wrote data/${filename} (${Math.round(fs.statSync(target).size / 1024)} KB)`);
  }
}
