import process from 'node:process';
import { createClient } from '@supabase/supabase-js';
import { loadEnv } from 'vite';
import { sha256Hex } from './travelKnowledgeIngestionUtils';

const BUCKET = 'travel-knowledge-snapshots';

const main = async () => {
  const fileEnv = loadEnv('production', process.cwd(), '');
  const url = process.env.VITE_SUPABASE_URL?.trim() || fileEnv.VITE_SUPABASE_URL?.trim() || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
    || fileEnv.SUPABASE_SERVICE_ROLE_KEY?.trim()
    || '';
  if (!url || !serviceRoleKey) throw new Error('Server-only Supabase credentials are required.');

  const client = createClient(url.replace(/\/+$/, ''), serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: snapshots, error } = await client
    .from('travel_source_snapshots')
    .select('id,checksum,byte_size,storage_object_key')
    .order('retrieved_at', { ascending: true });
  if (error) throw new Error(`Could not load snapshot ledger: ${error.message}`);

  let verifiedBytes = 0;
  const mismatches: Array<{ id: string; objectKey: string; reason: string }> = [];
  for (const snapshot of snapshots ?? []) {
    const { data, error: downloadError } = await client.storage.from(BUCKET).download(snapshot.storage_object_key);
    if (downloadError || !data) {
      mismatches.push({
        id: snapshot.id,
        objectKey: snapshot.storage_object_key,
        reason: downloadError?.message || 'object body missing',
      });
      continue;
    }
    const buffer = Buffer.from(await data.arrayBuffer());
    verifiedBytes += buffer.byteLength;
    if (buffer.byteLength !== Number(snapshot.byte_size)) {
      mismatches.push({
        id: snapshot.id,
        objectKey: snapshot.storage_object_key,
        reason: `byte size ${buffer.byteLength} does not match ledger ${snapshot.byte_size}`,
      });
      continue;
    }
    const checksum = sha256Hex(buffer);
    if (checksum !== snapshot.checksum) {
      mismatches.push({
        id: snapshot.id,
        objectKey: snapshot.storage_object_key,
        reason: `checksum ${checksum} does not match ledger ${snapshot.checksum}`,
      });
    }
  }

  const summary = {
    bucket: BUCKET,
    snapshots: snapshots?.length ?? 0,
    verifiedBytes,
    mismatches,
  };
  console.log(JSON.stringify(summary, null, 2));
  if (mismatches.length) process.exit(1);
};

main().catch((error) => {
  console.error(`[travel-knowledge:verify-snapshots] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
