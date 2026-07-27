import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { loadEnv } from 'vite';
import type { TravelKnowledgeDataset } from './travelKnowledgeDatasetUtils';
import {
  buildTravelKnowledgeArtifact,
  inspectTravelKnowledgeReviewedChanges,
  type TravelKnowledgeReviewedChange,
} from './travelKnowledgeArtifactUtils';
import { loadTravelKnowledgeReviewedChanges } from './travelKnowledgeReviewClientUtils';

const execFileAsync = promisify(execFile);
const SNAPSHOT_BUCKET = 'travel-knowledge-snapshots';
const WRITE_CONFIRMATION = 'stage_artifact_only';

const loadCredentials = () => {
  const fileEnv = loadEnv('production', process.cwd(), '');
  return {
    url: process.env.VITE_SUPABASE_URL?.trim() || fileEnv.VITE_SUPABASE_URL?.trim() || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
      || fileEnv.SUPABASE_SERVICE_ROLE_KEY?.trim()
      || '',
  };
};

const loadSourceRunIds = async (client: SupabaseClient): Promise<string[]> => {
  const { data, error } = await client
    .from('travel_source_runs')
    .select('id')
    .eq('country_code', 'TH')
    .in('status', ['succeeded', 'partial'])
    .order('started_at', { ascending: true });
  if (error) throw new Error(`Could not load source-run provenance: ${error.message}`);
  return (data ?? []).map((run) => String(run.id));
};

const verifyOrUploadBundle = async (
  client: SupabaseClient,
  objectKey: string,
  body: string,
  artifactChecksum: string,
): Promise<boolean> => {
  const { error } = await client.storage.from(SNAPSHOT_BUCKET).upload(objectKey, body, {
    contentType: 'application/json; charset=utf-8',
    cacheControl: '31536000',
    upsert: false,
  });
  if (!error) return true;
  const { data: existing, error: downloadError } = await client.storage.from(SNAPSHOT_BUCKET).download(objectKey);
  if (downloadError || !existing) throw new Error(`Could not upload artifact bundle: ${error.message}`);
  const parsed = JSON.parse(await existing.text()) as { artifactChecksum?: string };
  if (parsed.artifactChecksum !== artifactChecksum) {
    throw new Error('An object already exists at the artifact key with a different checksum.');
  }
  return false;
};

const main = async () => {
  const persist = process.argv.includes('--persist');
  if (process.argv.includes('--help')) {
    console.log([
      'Usage: pnpm travel-knowledge:stage-artifact -- [--persist]',
      '',
      'Dry-run is the default. Persistence requires:',
      `  TRAVEL_KNOWLEDGE_WRITE_MODE=${WRITE_CONFIRMATION}`,
      '  VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the server environment.',
    ].join('\n'));
    return;
  }
  if (persist && process.env.TRAVEL_KNOWLEDGE_WRITE_MODE !== WRITE_CONFIRMATION) {
    throw new Error(`Persistence requires TRAVEL_KNOWLEDGE_WRITE_MODE=${WRITE_CONFIRMATION}.`);
  }

  const datasetPath = path.resolve(process.cwd(), 'data/travelKnowledge/thailand.v1.json');
  const dataset = JSON.parse(await readFile(datasetPath, 'utf8')) as TravelKnowledgeDataset;
  const { stdout } = await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: process.cwd(), encoding: 'utf8' });
  const repositoryCommit = stdout.trim();
  const credentials = loadCredentials();
  let client: SupabaseClient | null = null;
  let sourceRunIds: string[] = [];
  let reviewedChanges: TravelKnowledgeReviewedChange[] = [];
  if (credentials.url && credentials.serviceRoleKey) {
    client = createClient(credentials.url.replace(/\/+$/, ''), credentials.serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    [sourceRunIds, reviewedChanges] = await Promise.all([
      loadSourceRunIds(client),
      loadTravelKnowledgeReviewedChanges(client),
    ]);
  } else if (persist) {
    throw new Error('Server-only Supabase credentials are required to stage an artifact.');
  }

  const reviewInspection = inspectTravelKnowledgeReviewedChanges(dataset, reviewedChanges);
  if (reviewInspection.unsupported.length > 0) {
    throw new Error(reviewInspection.unsupported.map(({ change, reason }) => `${change.candidateId}: ${reason}`).join('\n'));
  }
  if (reviewInspection.applied.length > 0) {
    throw new Error([
      `${reviewInspection.applied.length} accepted review change(s) are not materialized in the repository dataset.`,
      'Run the reviewed-change materializer and commit the resulting country-pack update before staging.',
    ].join(' '));
  }

  const artifact = buildTravelKnowledgeArtifact({
    dataset,
    repositoryCommit,
    sourceRunIds,
    reviewedChanges: reviewInspection.alreadyMaterialized,
  });
  const summary = {
    mode: persist ? 'persist' : 'dry_run',
    datasetKey: dataset.manifest.datasetKey,
    countryCode: dataset.manifest.countryCode,
    version: dataset.manifest.version,
    repositoryCommit,
    sourceRunCount: sourceRunIds.length,
    reviewedCandidateCount: reviewInspection.alreadyMaterialized.length,
    datasetChecksum: artifact.datasetChecksum,
    packChecksum: artifact.packChecksum,
    seedChecksum: artifact.seedChecksum,
    artifactChecksum: artifact.artifactChecksum,
    storageObjectKey: artifact.storageObjectKey,
    packByteSize: artifact.packByteSize,
  };
  if (!persist) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }
  if (!client) throw new Error('Supabase client is unavailable.');

  const bundleBody = `${JSON.stringify(artifact.bundle, null, 2)}\n`;
  const uploaded = await verifyOrUploadBundle(
    client,
    artifact.storageObjectKey,
    bundleBody,
    artifact.artifactChecksum,
  );
  const sourceSnapshot = dataset.sources.map((source) => ({
    sourceKey: source.sourceKey,
    baseUrl: source.baseUrl,
    licenseKey: source.licenseKey ?? null,
  }));
  const { data, error } = await client.rpc('admin_stage_travel_dataset_artifact', {
    p_dataset_key: dataset.manifest.datasetKey,
    p_country_code: dataset.manifest.countryCode,
    p_version: dataset.manifest.version,
    p_dataset_checksum: artifact.datasetChecksum,
    p_entity_count: artifact.validationReport.counts.entities,
    p_fact_count: artifact.validationReport.counts.facts,
    p_template_count: artifact.validationReport.counts.templates,
    p_source_snapshot: sourceSnapshot,
    p_generated_at: dataset.manifest.generatedAt,
    p_notes: dataset.manifest.notes ?? null,
    p_repository_commit: repositoryCommit,
    p_source_run_ids: sourceRunIds,
    p_review_candidate_ids: reviewInspection.alreadyMaterialized.map((change) => change.candidateId),
    p_review_decision_ids: reviewInspection.alreadyMaterialized.map((change) => change.decisionId),
    p_pack_payload: artifact.packPayload,
    p_template_copy_payload: artifact.templateCopyPayload,
    p_pack_checksum: artifact.packChecksum,
    p_seed_checksum: artifact.seedChecksum,
    p_artifact_checksum: artifact.artifactChecksum,
    p_storage_object_key: artifact.storageObjectKey,
    p_pack_byte_size: artifact.packByteSize,
    p_validation_report: artifact.validationReport,
  });
  if (error) {
    if (uploaded) await client.storage.from(SNAPSHOT_BUCKET).remove([artifact.storageObjectKey]);
    throw new Error(`Could not stage artifact: ${error.message}`);
  }
  console.log(JSON.stringify({ ...summary, uploaded, staged: data }, null, 2));
};

main().catch((error) => {
  console.error(`[travel-knowledge:stage-artifact] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
