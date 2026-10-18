import fs from 'node:fs';
import { getExampleTemplateMiniCalendar, TRIP_TEMPLATES } from '../data/exampleTripTemplates';
const previews = Object.fromEntries(Object.keys(TRIP_TEMPLATES).map(id => [id, getExampleTemplateMiniCalendar(id)]));
fs.writeFileSync('data/exampleTripPreviews.generated.ts', `// Generated lightweight marketing previews. Full itinerary data belongs to trip routes.\nimport type { ExampleTemplateMiniCalendar } from './exampleTripTemplates';\nexport const exampleTripPreviews: Record<string, ExampleTemplateMiniCalendar | null> = ${JSON.stringify(previews)};\n`);
