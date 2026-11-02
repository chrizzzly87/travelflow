/**
 * Splits data/countryTravelData.json into the three slices the app actually
 * consumes separately.
 *
 * The monolith is 678 KB — seasons, events and public holidays (313 KB),
 * localized destination names (156 KB) and country search aliases (10 KB) — and
 * a single named import from anywhere pulled all of it into that chunk. The
 * worst case was `MONTH_LABELS`, a 12-string array, costing a page 678 KB.
 *
 * `data/countryTravelData.json` stays the source of truth: the generators
 * (generate-country-climate-normals, generate-country-search-metadata) keep
 * writing it, and the Node-side scripts keep reading it. Only client modules
 * read the slices. `tests/unit/countryTravelDataSplit.test.ts` regenerates them
 * and fails if the checked-in files have drifted.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = path.join(projectRoot, 'data');

const BANNER_KEY = '_generated';
const BANNER = 'Derived from data/countryTravelData.json by scripts/split-country-travel-data.mjs — do not edit by hand.';

export const SPLIT_TARGETS = {
  'countrySeasons.generated.json': (source) => ({
    [BANNER_KEY]: BANNER,
    generatedAt: source.generatedAt,
    monthLegend: source.monthLegend,
    countries: source.countries,
  }),
  'countryLocalizedNames.generated.json': (source) => ({
    [BANNER_KEY]: BANNER,
    ...(source.localizedDestinationNames || { countries: {}, islands: {} }),
  }),
  'countrySearchMetadata.generated.json': (source) => ({
    [BANNER_KEY]: BANNER,
    ...(source.countrySearchMetadata || { countries: {} }),
  }),
};

export function readCountryTravelData() {
  return JSON.parse(fs.readFileSync(path.join(dataDir, 'countryTravelData.json'), 'utf8'));
}

export function renderSplit(filename) {
  const build = SPLIT_TARGETS[filename];
  if (!build) throw new Error(`Unknown split target: ${filename}`);
  // Compact on purpose: these are regenerated wholesale and never hand-edited,
  // so a readable diff buys nothing and costs ~150 KB in the repo.
  return `${JSON.stringify(build(readCountryTravelData()))}\n`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const filename of Object.keys(SPLIT_TARGETS)) {
    const target = path.join(dataDir, filename);
    fs.writeFileSync(target, renderSplit(filename), 'utf8');
    console.log(`Wrote data/${filename} (${Math.round(fs.statSync(target).size / 1024)} KB)`);
  }
}
