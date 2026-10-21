import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  normalizeAtobeachCountryRecord,
  validateAtobeachSourceDocument,
  type AtobeachCountrySourceDocument,
  type NormalizedAtobeachCountryRecord,
} from '../shared/atobeachCountrySource';

const inputFlagIndex = process.argv.indexOf('--input');
const inputPath = inputFlagIndex >= 0 ? process.argv[inputFlagIndex + 1] : '';
const shouldApply = process.argv.includes('--apply');
const supabaseUrl = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim().replace(/\/$/, '');
const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

if (!inputPath) throw new Error('--input <snapshot.json> is required.');
const document = JSON.parse(await readFile(inputPath, 'utf8')) as AtobeachCountrySourceDocument;
const validationErrors = validateAtobeachSourceDocument(document);
if (validationErrors.length > 0) throw new Error(`Invalid source document:\n${validationErrors.join('\n')}`);
if (!shouldApply) {
  const preview = document.records.map((record) => (
    normalizeAtobeachCountryRecord(record, '00000000-0000-0000-0000-000000000000')
  ));
  const referralRows = preview.flatMap((row) => row.referralRows);
  const remainingTrackingUrls = preview.filter((row) => /[?&](?:utm_|ref=|affiliate=)/i.test(
    JSON.stringify(row.sourceRow.payload),
  )).length;
  console.error(JSON.stringify({
    validatedRecords: document.recordCount,
    normalizedProfiles: preview.length,
    referralRows: referralRows.length,
    remainingTrackingUrls,
    writeApplied: false,
  }));
  console.error('Refusing to write without --apply.');
  process.exit(2);
}
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY are required.');
}

const headers = {
  'content-type': 'application/json',
  apikey: serviceRoleKey,
  authorization: `Bearer ${serviceRoleKey}`,
};

const rest = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: { ...headers, ...init.headers },
  });
  if (!response.ok) throw new Error(`${init.method || 'GET'} ${path}: ${response.status} ${await response.text()}`);
  const responseText = await response.text();
  return responseText ? JSON.parse(responseText) as T : undefined as T;
};

const canonicalize = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalize(item)}`).join(',')}}`;
  }
  return JSON.stringify(value);
};

const hashPayload = (payload: unknown): string => createHash('sha256').update(canonicalize(payload)).digest('hex');

const upsertBatches = async (table: string, rows: Array<Record<string, unknown>>, conflict: string): Promise<void> => {
  for (let index = 0; index < rows.length; index += 50) {
    await rest(`${table}?on_conflict=${encodeURIComponent(conflict)}`, {
      method: 'POST',
      headers: { prefer: 'resolution=merge-duplicates,return=minimal,missing=default' },
      body: JSON.stringify(rows.slice(index, index + 50)),
    });
  }
};

const [run] = await rest<Array<{ id: string }>>('destination_import_runs?select=id', {
  method: 'POST',
  headers: { prefer: 'return=representation,missing=default' },
  body: JSON.stringify({
    provider: document.provider,
    schema_version: document.schemaVersion,
    expected_records: document.recordCount,
    metadata: { listOriginUrl: document.listOriginUrl, generatedAt: document.generatedAt },
  }),
});

try {
  const current = await rest<Array<{ id: string; payload_hash: string }>>(
    'destination_source_records?provider=eq.atobeach&select=id,payload_hash&limit=1000',
  );
  const currentVersions = await rest<Array<{ source_record_id: string; payload_hash: string }>>(
    'destination_source_record_versions?select=source_record_id,payload_hash&limit=1000',
  );
  const currentHashes = new Map(current.map((row) => [row.id, row.payload_hash]));
  const existingVersions = new Set(currentVersions.map((row) => `${row.source_record_id}:${row.payload_hash}`));
  const normalized: NormalizedAtobeachCountryRecord[] = document.records.map((record) => {
    const result = normalizeAtobeachCountryRecord(record, run.id);
    const sanitizedHash = hashPayload(result.sourceRow.payload);
    result.sourceRow.payload_hash = sanitizedHash;
    result.versionRow.payload_hash = sanitizedHash;
    result.profileRow.payload_hash = sanitizedHash;
    return result;
  });
  const changed = normalized.filter((row) => currentHashes.get(String(row.sourceRow.id)) !== row.sourceRow.payload_hash);
  const unchanged = normalized.filter((row) => currentHashes.get(String(row.sourceRow.id)) === row.sourceRow.payload_hash);
  changed.forEach((row) => { row.sourceRow.last_changed_at = row.sourceRow.fetched_at; });

  await upsertBatches('destination_source_records', changed.map((row) => row.sourceRow), 'id');
  await upsertBatches('destination_source_records', unchanged.map((row) => row.sourceRow), 'id');
  const missingVersions = normalized.filter((row) => !existingVersions.has(
    `${row.versionRow.source_record_id}:${row.versionRow.payload_hash}`,
  ));
  await upsertBatches(
    'destination_source_record_versions',
    missingVersions.map((row) => row.versionRow),
    'source_record_id,payload_hash',
  );
  await upsertBatches('destination_country_profiles', normalized.map((row) => row.profileRow), 'country_code');
  const referralRows = normalized.flatMap((row) => row.referralRows);
  await upsertBatches(
    'destination_referral_links',
    referralRows,
    'source_record_id,field_path,canonical_url',
  );
  await rest(
    `destination_referral_links?source_provider=eq.atobeach&last_import_run_id=neq.${run.id}`,
    { method: 'PATCH', headers: { prefer: 'return=minimal' }, body: JSON.stringify({ is_active: false }) },
  );
  await rest(`destination_import_runs?id=eq.${run.id}`, {
    method: 'PATCH',
    headers: { prefer: 'return=minimal' },
    body: JSON.stringify({
      status: 'completed',
      fetched_records: normalized.length,
      changed_records: changed.length,
      unchanged_records: unchanged.length,
      completed_at: new Date().toISOString(),
      metadata: {
        listOriginUrl: document.listOriginUrl,
        generatedAt: document.generatedAt,
        referralRecords: referralRows.length,
      },
    }),
  });
  console.log(JSON.stringify({ importRunId: run.id, records: normalized.length, changed: changed.length, unchanged: unchanged.length, versionsAdded: missingVersions.length, referrals: referralRows.length }));
} catch (error) {
  await rest(`destination_import_runs?id=eq.${run.id}`, {
    method: 'PATCH',
    headers: { prefer: 'return=minimal' },
    body: JSON.stringify({ status: 'failed', completed_at: new Date().toISOString(), error_summary: String(error) }),
  }).catch(() => undefined);
  throw error;
}
