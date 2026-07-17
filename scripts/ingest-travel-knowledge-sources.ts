import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { loadEnv } from 'vite';
import datasetJson from '../data/travelKnowledge/thailand.v1.json';
import registryJson from '../data/travelKnowledge/source-registry.v1.json';
import type { TravelKnowledgeDataset } from './travelKnowledgeDatasetUtils';
import {
  buildGeoNamesCandidateDrafts,
  buildWikidataCandidateDrafts,
  buildWikidataSparqlQuery,
  matchGeoNamesEntities,
  parseGeoNamesCountryInfo,
  parseGeoNamesDump,
  parseWikidataIdentities,
  sha256Hex,
  type GeoNamesEntityMatch,
  type TravelKnowledgeChangeCandidateDraft,
} from './travelKnowledgeIngestionUtils';
import type {
  TravelKnowledgeSourceRegistry,
  TravelKnowledgeSourceRegistryEntry,
} from './travelKnowledgeSourceRegistryUtils';

const execFileAsync = promisify(execFile);
const SNAPSHOT_BUCKET = 'travel-knowledge-snapshots';
const COUNTRY_CODE = 'TH';
const MAX_WIKIDATA_IDENTITIES = 50;
const WRITE_CONFIRMATION = 'review_candidates_only';
const USER_AGENT = 'TravelFlowTravelKnowledge/0.1 (+https://github.com/chrizzzly87/travelflow)';
const dataset = datasetJson as TravelKnowledgeDataset;
const registry = registryJson as TravelKnowledgeSourceRegistry;

type SourceChoice = 'geonames' | 'wikidata' | 'all';

interface CliOptions {
  persist: boolean;
  verbose: boolean;
  source: SourceChoice;
  countryCode: string;
}

interface SourceRun {
  id: string;
  sourceId: string;
  sourceKey: string;
}

interface LatestSnapshot {
  id: string;
  checksum: string;
  etag: string | null;
  lastModified: string | null;
  storageObjectKey: string;
}

interface RawResource {
  sourceUrl: string;
  requestUrl: string;
  fileName: string;
  accept: string;
  fallbackContentType: string;
  datasetId: string;
  metadata?: Record<string, unknown>;
}

interface FetchedResource extends RawResource {
  buffer: Buffer;
  checksum: string;
  contentType: string;
  etag: string | null;
  lastModified: string | null;
  retrievedAt: string;
  httpStatus: number;
  notModified: boolean;
  previousSnapshotId: string | null;
}

interface PersistedResource extends FetchedResource {
  snapshotId: string | null;
  storageObjectKey: string | null;
}

interface IngestionSummary {
  mode: 'dry_run' | 'persist';
  countryCode: string;
  sources: Array<{
    sourceKey: string;
    runId: string;
    status: 'succeeded' | 'partial';
    fetchedResources: number;
    unchangedResources: number;
    rawItems: number;
    candidatesGenerated: number;
    candidatesPersisted: number;
    warnings: string[];
    candidatePreview?: Array<Pick<
      TravelKnowledgeChangeCandidateDraft,
      'targetKey' | 'fieldPath' | 'proposedValue' | 'confidence' | 'validationFindings' | 'metadata'
    >>;
  }>;
}

const parseCliOptions = (args: string[]): CliOptions => {
  let source: SourceChoice = 'all';
  let countryCode = COUNTRY_CODE;
  let persist = false;
  let verbose = false;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--') continue;
    if (argument === '--persist') persist = true;
    else if (argument === '--verbose') verbose = true;
    else if (argument === '--source') source = (args[index += 1] || '') as SourceChoice;
    else if (argument === '--country') countryCode = (args[index += 1] || '').toUpperCase();
    else if (argument === '--help') {
      console.log([
        'Usage: pnpm travel-knowledge:ingest -- [--source all|geonames|wikidata] [--country TH] [--verbose] [--persist]',
        '',
        'Dry-run is the default. Persistent runs require:',
        `  TRAVEL_KNOWLEDGE_WRITE_MODE=${WRITE_CONFIRMATION}`,
        '  VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the server environment.',
      ].join('\n'));
      process.exit(0);
    } else throw new Error(`Unknown argument: ${argument}`);
  }
  if (!['all', 'geonames', 'wikidata'].includes(source)) throw new Error(`Unsupported source: ${source}`);
  if (countryCode !== COUNTRY_CODE) throw new Error('The first ingestion slice is intentionally limited to Thailand (TH).');
  return { persist, verbose, source, countryCode };
};

const sleep = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const retryDelayMs = (response: Response | null, attempt: number): number => {
  const retryAfter = response?.headers.get('retry-after')?.trim();
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.min(30_000, Math.max(1_000, seconds * 1_000));
    const dateMs = Date.parse(retryAfter);
    if (Number.isFinite(dateMs)) return Math.min(30_000, Math.max(1_000, dateMs - Date.now()));
  }
  return Math.min(12_000, 750 * 2 ** attempt);
};

const fetchWithRetry = async (
  resource: RawResource,
  previous: LatestSnapshot | null,
): Promise<Response> => {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    let response: Response | null = null;
    try {
      const headers = new Headers({
        Accept: resource.accept,
        'Accept-Encoding': 'gzip, deflate',
        'User-Agent': process.env.TRAVEL_KNOWLEDGE_USER_AGENT?.trim() || USER_AGENT,
      });
      if (previous?.etag) headers.set('If-None-Match', previous.etag);
      if (previous?.lastModified) headers.set('If-Modified-Since', previous.lastModified);
      response = await fetch(resource.requestUrl, {
        headers,
        redirect: 'follow',
        signal: AbortSignal.timeout(45_000),
      });
      if (response.ok || response.status === 304) return response;
      if (response.status !== 429 && response.status < 500) {
        throw new Error(`${resource.datasetId} returned HTTP ${response.status}.`);
      }
      lastError = new Error(`${resource.datasetId} returned retryable HTTP ${response.status}.`);
    } catch (error) {
      lastError = error;
    }
    if (attempt < 2) await sleep(retryDelayMs(response, attempt));
  }
  throw lastError instanceof Error ? lastError : new Error(`Failed to fetch ${resource.datasetId}.`);
};

const unzipGeoNamesDump = async (buffer: Buffer): Promise<string> => {
  const directory = await mkdtemp(path.join(tmpdir(), 'travelflow-geonames-'));
  const archivePath = path.join(directory, 'TH.zip');
  try {
    await writeFile(archivePath, buffer);
    const result = await execFileAsync('unzip', ['-p', archivePath, 'TH.txt'], {
      encoding: 'utf8',
      maxBuffer: 128 * 1024 * 1024,
    });
    return result.stdout;
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
};

class Persistence {
  private readonly client: SupabaseClient;

  constructor(url: string, serviceRoleKey: string) {
    this.client = createClient(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  async startRun(source: TravelKnowledgeSourceRegistryEntry, countryCode: string): Promise<SourceRun> {
    const { data: sourceRow, error: sourceError } = await this.client
      .from('travel_sources')
      .select('id,source_key')
      .eq('source_key', source.sourceKey)
      .single();
    if (sourceError || !sourceRow) throw new Error(`Could not resolve source ${source.sourceKey}: ${sourceError?.message || 'not found'}`);
    const configurationHash = sha256Hex(JSON.stringify({
      sourceKey: source.sourceKey,
      countryCode,
      ingestionMode: source.ingestionMode,
      fetcherVersion: 'identity-v1',
    }));
    const termsFingerprint = sha256Hex(JSON.stringify({
      termsUrl: source.termsUrl ?? null,
      licenseKey: source.licenseKey ?? null,
      licenseReviewedAt: source.licenseReviewedAt,
    }));
    const { data: run, error } = await this.client
      .from('travel_source_runs')
      .insert({
        source_id: sourceRow.id,
        country_code: countryCode,
        run_kind: 'fetch',
        status: 'running',
        started_at: new Date().toISOString(),
        fetcher_version: 'identity-v1',
        configuration_hash: configurationHash,
        terms_fingerprint: termsFingerprint,
        metadata: { writeMode: WRITE_CONFIRMATION, snapshotBucket: SNAPSHOT_BUCKET },
      })
      .select('id')
      .single();
    if (error || !run) throw new Error(`Could not start ${source.sourceKey} run: ${error?.message || 'no row returned'}`);
    return { id: run.id, sourceId: sourceRow.id, sourceKey: source.sourceKey };
  }

  async latestSnapshot(sourceId: string, sourceUrl: string): Promise<LatestSnapshot | null> {
    const { data, error } = await this.client
      .from('travel_source_snapshots')
      .select('id,checksum,etag,last_modified,storage_object_key,travel_source_runs!inner(source_id)')
      .eq('source_url', sourceUrl)
      .eq('travel_source_runs.source_id', sourceId)
      .order('retrieved_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`Could not look up prior snapshot: ${error.message}`);
    if (!data) return null;
    return {
      id: data.id,
      checksum: data.checksum,
      etag: data.etag,
      lastModified: data.last_modified,
      storageObjectKey: data.storage_object_key,
    };
  }

  async downloadSnapshot(objectKey: string): Promise<Buffer> {
    const { data, error } = await this.client.storage.from(SNAPSHOT_BUCKET).download(objectKey);
    if (error || !data) throw new Error(`Could not download unchanged snapshot ${objectKey}: ${error?.message || 'missing body'}`);
    return Buffer.from(await data.arrayBuffer());
  }

  async persistSnapshot(
    run: SourceRun,
    source: TravelKnowledgeSourceRegistryEntry,
    resource: FetchedResource,
  ): Promise<{ snapshotId: string; storageObjectKey: string }> {
    const date = new Date(resource.retrievedAt);
    const storageObjectKey = [
      run.sourceKey,
      COUNTRY_CODE,
      String(date.getUTCFullYear()),
      String(date.getUTCMonth() + 1).padStart(2, '0'),
      run.id,
      resource.fileName,
    ].join('/');
    const { error: uploadError } = await this.client.storage
      .from(SNAPSHOT_BUCKET)
      .upload(storageObjectKey, resource.buffer, {
        cacheControl: '0',
        contentType: resource.contentType,
        upsert: false,
      });
    if (uploadError) throw new Error(`Snapshot upload failed for ${storageObjectKey}: ${uploadError.message}`);
    const { data: snapshot, error } = await this.client
      .from('travel_source_snapshots')
      .insert({
        source_run_id: run.id,
        source_url: resource.sourceUrl,
        dataset_id: resource.datasetId,
        retrieved_at: resource.retrievedAt,
        etag: resource.etag,
        last_modified: resource.lastModified,
        checksum: resource.checksum,
        content_type: resource.contentType,
        byte_size: resource.buffer.byteLength,
        storage_object_key: storageObjectKey,
        license_key: source.licenseKey ?? null,
        terms_url: source.termsUrl ?? null,
        metadata: resource.metadata ?? {},
      })
      .select('id')
      .single();
    if (error || !snapshot) {
      throw new Error(`Snapshot metadata insert failed for ${storageObjectKey}; the immutable object may require reconciliation: ${error?.message || 'no row returned'}`);
    }
    return { snapshotId: snapshot.id, storageObjectKey };
  }

  async persistCandidates(
    snapshotId: string,
    drafts: TravelKnowledgeChangeCandidateDraft[],
  ): Promise<number> {
    if (!drafts.length) return 0;
    const targetKeys = [...new Set(drafts.map((draft) => draft.targetKey))];
    const { data: entityRows, error: entityError } = await this.client
      .from('travel_entities')
      .select('id,canonical_slug')
      .in('canonical_slug', targetKeys);
    if (entityError) throw new Error(`Could not resolve candidate entities: ${entityError.message}`);
    const entityIds = new Map((entityRows ?? []).map((row) => [row.canonical_slug, row.id]));

    const { data: openRows, error: openError } = await this.client
      .from('travel_change_candidates')
      .select('target_key,field_path,proposed_value')
      .eq('country_code', COUNTRY_CODE)
      .in('status', ['new', 'needs_review'])
      .in('target_key', targetKeys);
    if (openError) throw new Error(`Could not check open candidates: ${openError.message}`);
    const openCandidateKeys = new Set((openRows ?? []).map((row) => (
      `${row.target_key}\u0000${row.field_path}\u0000${JSON.stringify(row.proposed_value)}`
    )));
    const rows = drafts.flatMap((draft) => {
      const entityId = entityIds.get(draft.targetKey);
      if (!entityId) throw new Error(`Published entity ${draft.targetKey} was not found.`);
      const candidateKey = `${draft.targetKey}\u0000${draft.fieldPath}\u0000${JSON.stringify(draft.proposedValue)}`;
      if (openCandidateKeys.has(candidateKey)) return [];
      openCandidateKeys.add(candidateKey);
      return [{
        source_snapshot_id: snapshotId,
        country_code: draft.countryCode,
        target_kind: draft.targetKind,
        target_key: draft.targetKey,
        target_entity_id: entityId,
        field_path: draft.fieldPath,
        change_kind: draft.changeKind,
        previous_value: draft.previousValue,
        proposed_value: draft.proposedValue,
        extraction_method: draft.extractionMethod,
        confidence: draft.confidence,
        severity: draft.severity,
        validation_findings: draft.validationFindings,
        status: 'needs_review',
        metadata: draft.metadata,
      }];
    });
    if (!rows.length) return 0;
    const { error } = await this.client.from('travel_change_candidates').insert(rows);
    if (error) throw new Error(`Could not insert review candidates: ${error.message}`);
    return rows.length;
  }

  async finishRun(
    run: SourceRun,
    input: {
      status: 'succeeded' | 'partial' | 'failed';
      rawItemCount: number;
      candidateCount: number;
      warningCount: number;
      errorCount: number;
      httpSummary: Record<string, unknown>;
      errorMessage?: string;
    },
  ): Promise<void> {
    const { error } = await this.client
      .from('travel_source_runs')
      .update({
        status: input.status,
        finished_at: new Date().toISOString(),
        raw_item_count: input.rawItemCount,
        candidate_count: input.candidateCount,
        warning_count: input.warningCount,
        error_count: input.errorCount,
        http_summary: input.httpSummary,
        metadata: {
          writeMode: WRITE_CONFIRMATION,
          snapshotBucket: SNAPSHOT_BUCKET,
          ...(input.errorMessage ? { errorMessage: input.errorMessage.slice(0, 800) } : {}),
        },
      })
      .eq('id', run.id);
    if (error) throw new Error(`Could not finish ${run.sourceKey} run: ${error.message}`);
  }
}

const fetchResource = async (
  resource: RawResource,
  run: SourceRun | null,
  persistence: Persistence | null,
): Promise<FetchedResource> => {
  const previous = run && persistence ? await persistence.latestSnapshot(run.sourceId, resource.sourceUrl) : null;
  const response = await fetchWithRetry(resource, previous);
  const httpNotModified = response.status === 304;
  const buffer = httpNotModified && previous && persistence
    ? await persistence.downloadSnapshot(previous.storageObjectKey)
    : Buffer.from(await response.arrayBuffer());
  const checksum = sha256Hex(buffer);
  const notModified = httpNotModified || Boolean(previous && previous.checksum === checksum);
  return {
    ...resource,
    buffer,
    checksum,
    contentType: (response.headers.get('content-type') || resource.fallbackContentType).split(';')[0]!.trim(),
    etag: response.headers.get('etag') ?? previous?.etag ?? null,
    lastModified: response.headers.get('last-modified') ?? previous?.lastModified ?? null,
    retrievedAt: new Date().toISOString(),
    httpStatus: response.status,
    notModified,
    previousSnapshotId: previous?.id ?? null,
  };
};

const persistResource = async (
  resource: FetchedResource,
  run: SourceRun | null,
  source: TravelKnowledgeSourceRegistryEntry,
  persistence: Persistence | null,
): Promise<PersistedResource> => {
  if (!run || !persistence || resource.notModified) {
    return {
      ...resource,
      snapshotId: resource.notModified ? resource.previousSnapshotId : null,
      storageObjectKey: null,
    };
  }
  const persisted = await persistence.persistSnapshot(run, source, resource);
  return { ...resource, ...persisted };
};

const sourceByKey = (sourceKey: string): TravelKnowledgeSourceRegistryEntry => {
  const source = registry.sources.find((entry) => entry.sourceKey === sourceKey);
  if (!source) throw new Error(`Source registry entry ${sourceKey} is missing.`);
  if (!source.commercialUseAllowed || !source.redistributionAllowed || source.rawStoragePolicy !== 'private_snapshot') {
    throw new Error(`Source ${sourceKey} is not approved for private automated snapshots.`);
  }
  if (!['active', 'planned'].includes(source.automationStatus)) {
    throw new Error(`Source ${sourceKey} automation is ${source.automationStatus}.`);
  }
  return source;
};

const getPersistence = (options: CliOptions): Persistence | null => {
  const fileEnv = loadEnv('production', process.cwd(), '');
  for (const [key, value] of Object.entries(fileEnv)) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
  if (!options.persist) return null;
  if (process.env.TRAVEL_KNOWLEDGE_WRITE_MODE !== WRITE_CONFIRMATION) {
    throw new Error(`Persistent ingestion requires TRAVEL_KNOWLEDGE_WRITE_MODE=${WRITE_CONFIRMATION}.`);
  }
  const url = process.env.VITE_SUPABASE_URL?.trim().replace(/\/+$/, '') || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || '';
  if (!url || !serviceRoleKey) throw new Error('Persistent ingestion requires server-only Supabase credentials.');
  return new Persistence(url, serviceRoleKey);
};

const runGeoNames = async (
  options: CliOptions,
  persistence: Persistence | null,
): Promise<{
  matches: GeoNamesEntityMatch[];
  summary: IngestionSummary['sources'][number];
}> => {
  const source = sourceByKey('geonames');
  const run = persistence ? await persistence.startRun(source, options.countryCode) : {
    id: randomUUID(),
    sourceId: 'dry-run',
    sourceKey: source.sourceKey,
  };
  try {
    const dump = await persistResource(await fetchResource({
      sourceUrl: 'https://download.geonames.org/export/dump/TH.zip',
      requestUrl: 'https://download.geonames.org/export/dump/TH.zip',
      fileName: 'TH.zip',
      accept: 'application/zip, application/octet-stream;q=0.9',
      fallbackContentType: 'application/zip',
      datasetId: 'geonames-country-dump-TH',
      metadata: { format: 'GeoNames tab-delimited country dump', countryCode: options.countryCode },
    }, run, persistence), run, source, persistence);
    const countryInfo = await persistResource(await fetchResource({
      sourceUrl: 'https://download.geonames.org/export/dump/countryInfo.txt',
      requestUrl: 'https://download.geonames.org/export/dump/countryInfo.txt',
      fileName: 'countryInfo.txt',
      accept: 'text/plain',
      fallbackContentType: 'text/plain',
      datasetId: 'geonames-country-info',
      metadata: { format: 'GeoNames countryInfo.txt', countryCode: options.countryCode },
    }, run, persistence), run, source, persistence);
    const records = parseGeoNamesDump(await unzipGeoNamesDump(dump.buffer), options.countryCode);
    const countryRecord = parseGeoNamesCountryInfo(countryInfo.buffer.toString('utf8'), options.countryCode);
    const eligibleEntities = dataset.entities.filter((entity) => (
      entity.countryCode === options.countryCode && ['country', 'city'].includes(entity.entityType)
    ));
    const { matches, unmatchedEntitySlugs } = matchGeoNamesEntities(eligibleEntities, records, countryRecord);
    const allDrafts = buildGeoNamesCandidateDrafts(matches);
    const countryDrafts = allDrafts.filter((draft) => draft.targetKey === 'thailand');
    const placeDrafts = allDrafts.filter((draft) => draft.targetKey !== 'thailand');
    let candidatesPersisted = 0;
    if (!dump.notModified && dump.snapshotId && persistence) {
      candidatesPersisted += await persistence.persistCandidates(dump.snapshotId, placeDrafts);
    }
    if (!countryInfo.notModified && countryInfo.snapshotId && persistence) {
      candidatesPersisted += await persistence.persistCandidates(countryInfo.snapshotId, countryDrafts);
    }
    const warnings = unmatchedEntitySlugs.map((slug) => `No deterministic GeoNames identity match for ${slug}.`);
    const status = warnings.length ? 'partial' as const : 'succeeded' as const;
    const httpSummary = {
      resources: [dump, countryInfo].map((resource) => ({
        datasetId: resource.datasetId,
        status: resource.httpStatus,
        notModified: resource.notModified,
        byteSize: resource.buffer.byteLength,
        checksum: resource.checksum,
      })),
    };
    if (persistence) await persistence.finishRun(run, {
      status,
      rawItemCount: records.length + (countryRecord ? 1 : 0),
      candidateCount: candidatesPersisted,
      warningCount: warnings.length,
      errorCount: 0,
      httpSummary,
    });
    return {
      matches,
      summary: {
        sourceKey: source.sourceKey,
        runId: run.id,
        status,
        fetchedResources: [dump, countryInfo].filter((resource) => !resource.notModified).length,
        unchangedResources: [dump, countryInfo].filter((resource) => resource.notModified).length,
        rawItems: records.length + (countryRecord ? 1 : 0),
        candidatesGenerated: allDrafts.length,
        candidatesPersisted,
        warnings,
        ...(options.verbose ? {
          candidatePreview: allDrafts.map((draft) => ({
            targetKey: draft.targetKey,
            fieldPath: draft.fieldPath,
            proposedValue: draft.proposedValue,
            confidence: draft.confidence,
            validationFindings: draft.validationFindings,
            metadata: draft.metadata,
          })),
        } : {}),
      },
    };
  } catch (error) {
    if (persistence) await persistence.finishRun(run, {
      status: 'failed',
      rawItemCount: 0,
      candidateCount: 0,
      warningCount: 0,
      errorCount: 1,
      httpSummary: {},
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
};

const runWikidata = async (
  options: CliOptions,
  matches: GeoNamesEntityMatch[],
  persistence: Persistence | null,
): Promise<IngestionSummary['sources'][number]> => {
  const source = sourceByKey('wikidata');
  const run = persistence ? await persistence.startRun(source, options.countryCode) : {
    id: randomUUID(),
    sourceId: 'dry-run',
    sourceKey: source.sourceKey,
  };
  try {
    const geonameIds = matches.map((match) => match.record.geonameId).slice(0, MAX_WIKIDATA_IDENTITIES);
    const query = buildWikidataSparqlQuery(geonameIds);
    const sparqlRequestUrl = `https://query.wikidata.org/sparql?query=${encodeURIComponent(query)}&format=json`;
    const sparql = await persistResource(await fetchResource({
      sourceUrl: 'https://query.wikidata.org/sparql',
      requestUrl: sparqlRequestUrl,
      fileName: 'geonames-identities.sparql.json',
      accept: 'application/sparql-results+json, application/json;q=0.9',
      fallbackContentType: 'application/sparql-results+json',
      datasetId: 'wikidata-geonames-identities',
      metadata: { querySha256: sha256Hex(query), geonameIds },
    }, run, persistence), run, source, persistence);
    const sparqlPayload = JSON.parse(sparql.buffer.toString('utf8')) as unknown;
    const preliminaryIdentities = parseWikidataIdentities(sparqlPayload, {});
    const wikidataIds = preliminaryIdentities.map((identity) => identity.wikidataId);
    if (!wikidataIds.length) throw new Error('Wikidata returned no identities for the matched GeoNames ids.');
    const entityRequestUrl = new URL('https://www.wikidata.org/w/api.php');
    entityRequestUrl.searchParams.set('action', 'wbgetentities');
    entityRequestUrl.searchParams.set('format', 'json');
    entityRequestUrl.searchParams.set('formatversion', '2');
    entityRequestUrl.searchParams.set('ids', wikidataIds.join('|'));
    entityRequestUrl.searchParams.set('props', 'labels');
    entityRequestUrl.searchParams.set('languages', 'en|th');
    entityRequestUrl.searchParams.set('maxlag', '5');
    const entityData = await persistResource(await fetchResource({
      sourceUrl: 'https://www.wikidata.org/w/api.php',
      requestUrl: entityRequestUrl.toString(),
      fileName: 'entities.json',
      accept: 'application/json',
      fallbackContentType: 'application/json',
      datasetId: 'wikidata-entity-batch',
      metadata: { wikidataIds },
    }, run, persistence), run, source, persistence);
    const entityPayload = JSON.parse(entityData.buffer.toString('utf8')) as unknown;
    const identities = parseWikidataIdentities(sparqlPayload, entityPayload);
    const drafts = buildWikidataCandidateDrafts(matches, identities).map((draft) => ({
      ...draft,
      metadata: {
        ...draft.metadata,
        supportingSnapshotIds: entityData.snapshotId ? [entityData.snapshotId] : [],
      },
    }));
    let candidatesPersisted = 0;
    if (!sparql.notModified && sparql.snapshotId && persistence) {
      candidatesPersisted = await persistence.persistCandidates(sparql.snapshotId, drafts);
    }
    const matchedIds = new Set(identities.map((identity) => identity.geonameId));
    const unmatched = geonameIds.filter((id) => !matchedIds.has(id));
    const warnings = unmatched.map((id) => `No unique Wikidata item for GeoNames id ${id}.`);
    const status = warnings.length ? 'partial' as const : 'succeeded' as const;
    const resources = [sparql, entityData];
    const httpSummary = {
      resources: resources.map((resource) => ({
        datasetId: resource.datasetId,
        status: resource.httpStatus,
        notModified: resource.notModified,
        byteSize: resource.buffer.byteLength,
        checksum: resource.checksum,
      })),
    };
    if (persistence) await persistence.finishRun(run, {
      status,
      rawItemCount: identities.length,
      candidateCount: candidatesPersisted,
      warningCount: warnings.length,
      errorCount: 0,
      httpSummary,
    });
    return {
      sourceKey: source.sourceKey,
      runId: run.id,
      status,
      fetchedResources: resources.filter((resource) => !resource.notModified).length,
      unchangedResources: resources.filter((resource) => resource.notModified).length,
      rawItems: identities.length,
      candidatesGenerated: drafts.length,
      candidatesPersisted,
      warnings,
      ...(options.verbose ? {
        candidatePreview: drafts.map((draft) => ({
          targetKey: draft.targetKey,
          fieldPath: draft.fieldPath,
          proposedValue: draft.proposedValue,
          confidence: draft.confidence,
          validationFindings: draft.validationFindings,
          metadata: draft.metadata,
        })),
      } : {}),
    };
  } catch (error) {
    if (persistence) await persistence.finishRun(run, {
      status: 'failed',
      rawItemCount: 0,
      candidateCount: 0,
      warningCount: 0,
      errorCount: 1,
      httpSummary: {},
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
};

const main = async () => {
  const options = parseCliOptions(process.argv.slice(2));
  const persistence = getPersistence(options);
  const summary: IngestionSummary = {
    mode: options.persist ? 'persist' : 'dry_run',
    countryCode: options.countryCode,
    sources: [],
  };

  const geoNames = await runGeoNames(options, options.source === 'wikidata' ? null : persistence);
  if (options.source !== 'wikidata') summary.sources.push(geoNames.summary);
  if (options.source !== 'geonames') {
    summary.sources.push(await runWikidata(options, geoNames.matches, persistence));
  }

  console.log(JSON.stringify(summary, null, 2));
};

main().catch((error) => {
  console.error(`[travel-knowledge:ingest] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
