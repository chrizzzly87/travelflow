import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {
  generateTravelKnowledgeSourceRegistrySeedSql,
  type TravelKnowledgeSourceRegistry,
} from './travelKnowledgeSourceRegistryUtils';

const registryPath = path.resolve(process.cwd(), 'data/travelKnowledge/source-registry.v1.json');
const outputPath = path.resolve(process.cwd(), 'docs/travel-knowledge-source-registry.seed.generated.sql');
const registry = JSON.parse(readFileSync(registryPath, 'utf8')) as TravelKnowledgeSourceRegistry;
const generatedSql = generateTravelKnowledgeSourceRegistrySeedSql(registry);
const checkOnly = process.argv.includes('--check');

if (checkOnly) {
  if (!existsSync(outputPath)) {
    console.error('[travel-knowledge:check-source-registry] Generated source-registry seed is missing.');
    process.exit(1);
  }
  if (readFileSync(outputPath, 'utf8') !== generatedSql) {
    console.error('[travel-knowledge:check-source-registry] Generated source-registry seed is stale. Run pnpm travel-knowledge:generate-source-registry.');
    process.exit(1);
  }
  console.log('[travel-knowledge:check-source-registry] Generated source-registry seed is in sync.');
  process.exit(0);
}

writeFileSync(outputPath, generatedSql);
console.log(`[travel-knowledge:generate-source-registry] Wrote ${path.relative(process.cwd(), outputPath)}.`);
