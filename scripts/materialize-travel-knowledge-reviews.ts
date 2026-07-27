import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';
import { loadEnv } from 'vite';
import {
  compileTravelDestinationPack,
  generateTravelKnowledgeSeedSql,
  type TravelKnowledgeDataset,
} from './travelKnowledgeDatasetUtils';
import { materializeTravelKnowledgeReviewedChanges } from './travelKnowledgeArtifactUtils';
import { loadTravelKnowledgeReviewedChanges } from './travelKnowledgeReviewClientUtils';

const WRITE_CONFIRMATION = 'materialize_reviewed_dataset';

const optionValue = (name: string): string => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? '' : '';
};

const main = async () => {
  if (process.argv.includes('--help')) {
    console.log([
      'Usage: pnpm travel-knowledge:materialize-reviews -- --version <version> --generated-at <ISO timestamp> [--write]',
      '',
      'Dry-run is the default. Writing requires:',
      `  TRAVEL_KNOWLEDGE_WRITE_MODE=${WRITE_CONFIRMATION}`,
      '  VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the server environment.',
    ].join('\n'));
    return;
  }
  const version = optionValue('--version').trim();
  const generatedAt = optionValue('--generated-at').trim();
  const write = process.argv.includes('--write');
  if (!version || !generatedAt) throw new Error('--version and --generated-at are required.');
  if (write && process.env.TRAVEL_KNOWLEDGE_WRITE_MODE !== WRITE_CONFIRMATION) {
    throw new Error(`Writing requires TRAVEL_KNOWLEDGE_WRITE_MODE=${WRITE_CONFIRMATION}.`);
  }

  const fileEnv = loadEnv('production', process.cwd(), '');
  const url = process.env.VITE_SUPABASE_URL?.trim() || fileEnv.VITE_SUPABASE_URL?.trim() || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
    || fileEnv.SUPABASE_SERVICE_ROLE_KEY?.trim()
    || '';
  if (!url || !serviceRoleKey) throw new Error('Server-only Supabase credentials are required.');
  const client = createClient(url.replace(/\/+$/, ''), serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const datasetPath = path.resolve(process.cwd(), 'data/travelKnowledge/thailand.v1.json');
  const seedPath = path.resolve(process.cwd(), 'docs/travel-knowledge-thailand.seed.generated.sql');
  const packPath = path.resolve(process.cwd(), 'data/travelKnowledge/thailand.v1.pack.generated.json');
  const copyPath = path.resolve(process.cwd(), 'data/travelKnowledge/thailand.v1.template-copy.generated.json');
  const dataset = JSON.parse(await readFile(datasetPath, 'utf8')) as TravelKnowledgeDataset;
  const reviewedChanges = await loadTravelKnowledgeReviewedChanges(client);
  const result = materializeTravelKnowledgeReviewedChanges(dataset, reviewedChanges, version, generatedAt);
  const nextDatasetJson = `${JSON.stringify(result.dataset, null, 2)}\n`;
  const nextSeedSql = generateTravelKnowledgeSeedSql(result.dataset);
  const nextPackJson = `${JSON.stringify(compileTravelDestinationPack(result.dataset), null, 2)}\n`;
  const nextCopyJson = `${JSON.stringify({
    datasetVersion: result.dataset.manifest.version,
    templates: Object.fromEntries(result.dataset.templates.map((template) => [
      template.templateKey,
      Object.fromEntries(template.copy.map((copy) => [copy.locale, copy])),
    ])),
  }, null, 2)}\n`;
  const summary = {
    mode: write ? 'write' : 'dry_run',
    priorVersion: dataset.manifest.version,
    nextVersion: result.dataset.manifest.version,
    appliedCandidateIds: result.applied.map((change) => change.candidateId),
    alreadyMaterializedCandidateIds: result.alreadyMaterialized.map((change) => change.candidateId),
  };
  if (!write) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }
  await Promise.all([
    writeFile(datasetPath, nextDatasetJson, 'utf8'),
    writeFile(seedPath, nextSeedSql, 'utf8'),
    writeFile(packPath, nextPackJson, 'utf8'),
    writeFile(copyPath, nextCopyJson, 'utf8'),
  ]);
  console.log(JSON.stringify(summary, null, 2));
};

main().catch((error) => {
  console.error(`[travel-knowledge:materialize-reviews] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
