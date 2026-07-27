import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {
  compileTravelDestinationPack,
  generateTravelKnowledgeSeedSql,
  type TravelKnowledgeDataset,
} from './travelKnowledgeDatasetUtils';

const datasetPath = path.resolve(process.cwd(), 'data/travelKnowledge/thailand.v1.json');
const outputPath = path.resolve(process.cwd(), 'docs/travel-knowledge-thailand.seed.generated.sql');
const packOutputPath = path.resolve(process.cwd(), 'data/travelKnowledge/thailand.v1.pack.generated.json');
const templateCopyOutputPath = path.resolve(process.cwd(), 'data/travelKnowledge/thailand.v1.template-copy.generated.json');
const dataset = JSON.parse(readFileSync(datasetPath, 'utf8')) as TravelKnowledgeDataset;
const sql = generateTravelKnowledgeSeedSql(dataset);
const packJson = `${JSON.stringify(compileTravelDestinationPack(dataset), null, 2)}\n`;
const templateCopyJson = `${JSON.stringify({
  datasetVersion: dataset.manifest.version,
  templates: Object.fromEntries(dataset.templates.map((template) => [
    template.templateKey,
    Object.fromEntries(template.copy.map((copy) => [copy.locale, copy])),
  ])),
}, null, 2)}\n`;

if (process.argv.includes('--check')) {
  let existingSql = '';
  let existingPack = '';
  let existingTemplateCopy = '';
  try {
    existingSql = readFileSync(outputPath, 'utf8');
    existingPack = readFileSync(packOutputPath, 'utf8');
    existingTemplateCopy = readFileSync(templateCopyOutputPath, 'utf8');
  } catch {
    console.error('[travel-knowledge:check-seed] Generated Thailand seed, destination pack, or template copy catalog is missing.');
    process.exit(1);
  }
  if (existingSql !== sql || existingPack !== packJson || existingTemplateCopy !== templateCopyJson) {
    console.error('[travel-knowledge:check-seed] Generated Thailand artifacts are stale. Run pnpm travel-knowledge:generate-seed.');
    process.exit(1);
  }
  console.log('[travel-knowledge:check-seed] Generated Thailand seed and destination pack are in sync.');
  process.exit(0);
}

writeFileSync(outputPath, sql, 'utf8');
writeFileSync(packOutputPath, packJson, 'utf8');
writeFileSync(templateCopyOutputPath, templateCopyJson, 'utf8');
console.log(
  `[travel-knowledge:generate-seed] Wrote ${path.relative(process.cwd(), outputPath)}, ${path.relative(process.cwd(), packOutputPath)}, and ${path.relative(process.cwd(), templateCopyOutputPath)}.`,
);
