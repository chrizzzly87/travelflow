import countryClimateJson from '../data/countryClimateNormals.json';
import countryTravelDataJson from '../data/countryTravelData.json';
import destinationGuidesJson from '../data/destinationGuides.json';
import {
  type CountryClimateDocument,
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
const errors = validateCountryClimateDocument(document, { knownCountryCodes, requiredCountryCodes });

if (errors.length > 0) {
  console.error(`Country climate validation failed:\n${errors.map((error) => `  - ${error}`).join('\n')}`);
  process.exitCode = 1;
} else {
  const coverage = document.countries.length;
  const multiAnchor = document.countries.filter((country) => (country.anchorCount || 1) > 1).length;
  const uncovered = Array.from(knownCountryCodes).filter(
    (code) => !document.countries.some((country) => country.countryCode === code),
  );
  console.log(
    `Country climate validation passed (${coverage}/${knownCountryCodes.size} countries, ` +
      `${document.anchors.length} anchors, ${multiAnchor} multi-anchor countries, ` +
      `${requiredCountryCodes.size} destination-guide countries covered).`,
  );
  if (uncovered.length > 0) {
    console.warn(`Countries without climate data: ${uncovered.sort().join(', ')}`);
  }
}
