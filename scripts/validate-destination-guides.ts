import destinationGuidesJson from '../data/destinationGuides.json';
import {
  type DestinationGuideDocument,
  validateDestinationGuideDocument,
} from '../shared/destinationGuides';

const errors = validateDestinationGuideDocument(destinationGuidesJson as DestinationGuideDocument);

if (errors.length > 0) {
  console.error(`Destination guide validation failed:\n${errors.join('\n')}`);
  process.exitCode = 1;
} else {
  const document = destinationGuidesJson as DestinationGuideDocument;
  const countryCount = document.guides.filter((guide) => guide.kind === 'country').length;
  const childCount = document.guides.length - countryCount;
  console.log(`Destination guide validation passed (${countryCount} countries, ${childCount} city/island guides).`);
}
