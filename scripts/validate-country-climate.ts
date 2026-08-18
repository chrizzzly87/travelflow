import countryClimateJson from '../data/countryClimateNormals.json';
import countryTravelDataJson from '../data/countryTravelData.json';
import destinationGuidesJson from '../data/destinationGuides.json';
import {
  type CountryClimateDocument,
  findMissingClimateCoverage,
  validateCountryClimateDocument,
} from '../shared/countryClimateNormals';

interface CountryTravelDocumentShape {
  countries: Array<{ countryCode: string }>;
}

interface DestinationGuideDocumentShape {
  guides: Array<{ kind: string; countryCode?: string }>;
}

const travelDocument = countryTravelDataJson as CountryTravelDocumentShape;
const guideDocument = destinationGuidesJson as DestinationGuideDocumentShape;

const knownCountryCodes = new Set(travelDocument.countries.map((country) => country.countryCode));
const requiredCountryCodes = new Set(
  guideDocument.guides
    .filter((guide) => guide.kind === 'country' && typeof guide.countryCode === 'string')
    .map((guide) => guide.countryCode as string),
);

const document = countryClimateJson as unknown as CountryClimateDocument;

// Structural validation is always fatal.
const errors = validateCountryClimateDocument(document, { knownCountryCodes });

// Coverage is filled in by `pnpm climate:generate`, which is bounded by the Open-Meteo daily
// quota and therefore backfills across several runs. It is a warning while the backfill is in
// progress; set CLIMATE_VALIDATE_STRICT_COVERAGE=1 (and do so once the backfill completes) to
// make an incomplete dataset fail the build.
const strictCoverage = process.env.CLIMATE_VALIDATE_STRICT_COVERAGE === '1';
const missingRequired = findMissingClimateCoverage(document, requiredCountryCodes);
const missingKnown = findMissingClimateCoverage(document, knownCountryCodes);

if (missingRequired.length > 0 && strictCoverage) {
  errors.push(`Missing required country coverage: ${missingRequired.join(', ')}`);
}

if (errors.length > 0) {
  console.error(`Country climate validation failed:\n${errors.map((error) => `  - ${error}`).join('\n')}`);
  process.exitCode = 1;
} else {
  const multiAnchor = document.countries.filter((country) => (country.anchorCount || 1) > 1).length;
  const coveredRequired = requiredCountryCodes.size - missingRequired.length;
  console.log(
    `Country climate validation passed (${document.countries.length}/${knownCountryCodes.size} countries, ` +
      `${document.anchors.length} anchors, ${multiAnchor} multi-anchor, ` +
      `${coveredRequired}/${requiredCountryCodes.size} destination-guide countries).`,
  );

  if (missingRequired.length > 0) {
    console.warn(
      `[climate:validate] destination-guide countries still awaiting backfill (${missingRequired.length}): ` +
        `${missingRequired.join(', ')}\n` +
        '  - Result: warning only (set CLIMATE_VALIDATE_STRICT_COVERAGE=1 to fail on this rule)',
    );
  }
  if (missingKnown.length > 0) {
    console.warn(`[climate:validate] countries without climate data (${missingKnown.length}): ${missingKnown.join(', ')}`);
  }
}
