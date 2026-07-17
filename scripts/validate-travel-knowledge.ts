import { readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {
  validateTravelKnowledgeDataset,
  type TravelKnowledgeDataset,
} from './travelKnowledgeDatasetUtils';

const datasetPath = path.resolve(process.cwd(), 'data/travelKnowledge/thailand.v1.json');
const dataset = JSON.parse(readFileSync(datasetPath, 'utf8')) as TravelKnowledgeDataset;
const result = validateTravelKnowledgeDataset(dataset);

if (!result.valid) {
  console.error('[travel-knowledge:validate] Thailand dataset is invalid:');
  result.errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log(
  `[travel-knowledge:validate] Thailand dataset is valid (${result.counts.entities} entities, ${result.counts.facts} facts, ${result.counts.entityTags} tags, ${result.counts.templates} templates, ${result.counts.templateLegs} route legs).`,
);
