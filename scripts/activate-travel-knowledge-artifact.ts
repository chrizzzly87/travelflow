import process from 'node:process';
import { createClient } from '@supabase/supabase-js';
import { loadEnv } from 'vite';

const WRITE_CONFIRMATION = 'activate_artifact_only';

interface CliOptions {
  action: 'publish' | 'rollback';
  artifactId: string;
  countryCode: string;
  reason: string;
  execute: boolean;
}

const parseOptions = (args: string[]): CliOptions => {
  let action: CliOptions['action'] | null = null;
  let artifactId = '';
  let countryCode = 'TH';
  let reason = '';
  let execute = false;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--') continue;
    if (argument === '--publish') {
      action = 'publish';
      artifactId = args[index += 1] ?? '';
    } else if (argument === '--rollback') {
      action = 'rollback';
      artifactId = args[index += 1] ?? '';
    } else if (argument === '--country') countryCode = (args[index += 1] ?? '').toUpperCase();
    else if (argument === '--reason') reason = args[index += 1] ?? '';
    else if (argument === '--execute') execute = true;
    else if (argument === '--help') {
      console.log([
        'Usage:',
        '  pnpm travel-knowledge:activate-artifact -- --publish <artifact-id> --reason <reason> [--execute]',
        '  pnpm travel-knowledge:activate-artifact -- --rollback <artifact-id> --country TH --reason <reason> [--execute]',
        '',
        'Dry-run is the default. Execution requires:',
        `  TRAVEL_KNOWLEDGE_WRITE_MODE=${WRITE_CONFIRMATION}`,
        '  VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the server environment.',
      ].join('\n'));
      process.exit(0);
    } else throw new Error(`Unknown argument: ${argument}`);
  }
  if (!action || !/^[0-9a-f-]{36}$/i.test(artifactId)) throw new Error('A publish or rollback artifact UUID is required.');
  if (!reason.trim()) throw new Error('A human-readable activation reason is required.');
  if (!/^[A-Z]{2}$/.test(countryCode)) throw new Error('Country code must be ISO alpha-2.');
  return { action, artifactId, countryCode, reason: reason.trim(), execute };
};

const main = async () => {
  const options = parseOptions(process.argv.slice(2));
  if (options.execute && process.env.TRAVEL_KNOWLEDGE_WRITE_MODE !== WRITE_CONFIRMATION) {
    throw new Error(`Execution requires TRAVEL_KNOWLEDGE_WRITE_MODE=${WRITE_CONFIRMATION}.`);
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

  const { data: artifact, error: artifactError } = await client
    .from('travel_dataset_artifacts')
    .select('id,status,dataset_version_id,repository_commit,artifact_checksum,storage_object_key,travel_dataset_versions!travel_dataset_artifacts_dataset_version_id_fkey!inner(country_code,version,status)')
    .eq('id', options.artifactId)
    .maybeSingle();
  if (artifactError) throw new Error(`Could not inspect artifact: ${artifactError.message}`);
  if (!artifact) throw new Error('Artifact does not exist.');
  const preview = { action: options.action, execute: options.execute, reason: options.reason, artifact };
  if (!options.execute) {
    console.log(JSON.stringify(preview, null, 2));
    return;
  }

  const rpc = options.action === 'publish'
    ? client.rpc('admin_publish_travel_dataset_artifact', {
        p_artifact_id: options.artifactId,
        p_reason: options.reason,
      })
    : client.rpc('admin_rollback_travel_dataset', {
        p_country_code: options.countryCode,
        p_target_artifact_id: options.artifactId,
        p_reason: options.reason,
      });
  const { data, error } = await rpc;
  if (error) throw new Error(`Could not ${options.action} artifact: ${error.message}`);
  console.log(JSON.stringify({ ...preview, result: data }, null, 2));
};

main().catch((error) => {
  console.error(`[travel-knowledge:activate-artifact] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
