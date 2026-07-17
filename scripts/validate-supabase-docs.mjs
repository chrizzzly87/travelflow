import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const sqlPath = path.resolve(process.cwd(), 'docs/supabase.sql');

const requiredPatterns = [
  {
    label: 'admin override commit RPC',
    pattern: /create\s+or\s+replace\s+function\s+public\.admin_override_trip_commit\(/i,
  },
  {
    label: 'admin override commit metadata parameter',
    pattern: /p_metadata\s+jsonb\s+default\s+null/i,
  },
  {
    label: 'admin user change lookup RPC',
    pattern: /create\s+or\s+replace\s+function\s+public\.admin_get_user_change_log\(/i,
  },
  {
    label: 'grant override commit RPC with metadata signature',
    pattern:
      /grant execute on function public\.admin_override_trip_commit\(text,\s*jsonb,\s*jsonb,\s*text,\s*date,\s*boolean,\s*text,\s*jsonb\)\s+to authenticated;/i,
  },
  {
    label: 'grant user change lookup RPC',
    pattern: /grant execute on function public\.admin_get_user_change_log\(uuid\)\s+to authenticated;/i,
  },
  {
    label: 'app runtime settings table',
    pattern: /create\s+table\s+if\s+not\s+exists\s+public\.app_runtime_settings\s*\(/i,
  },
  {
    label: 'app runtime settings RLS',
    pattern: /alter table public\.app_runtime_settings enable row level security;/i,
  },
  {
    label: 'public runtime settings RPC',
    pattern: /create\s+or\s+replace\s+function\s+public\.get_public_runtime_settings\(\)/i,
  },
  {
    label: 'grant public runtime settings RPC',
    pattern: /grant execute on function public\.get_public_runtime_settings\(\)\s+to anon,\s*authenticated;/i,
  },
  {
    label: 'admin runtime settings RPC',
    pattern: /create\s+or\s+replace\s+function\s+public\.admin_update_runtime_settings\(\s*p_planner_beta_open boolean\s*\)/i,
  },
  {
    label: 'grant admin runtime settings RPC',
    pattern: /grant execute on function public\.admin_update_runtime_settings\(boolean\)\s+to authenticated;/i,
  },
  {
    label: 'final public-table RLS sweep',
    pattern: /for r in\s+select tablename\s+from pg_tables\s+where schemaname = 'public'\s+loop\s+execute format\('alter table public\.\%I enable row level security;', r\.tablename\);/is,
  },
];

const travelKnowledgeTables = [
  'travel_sources',
  'travel_dataset_versions',
  'travel_entities',
  'travel_entity_names',
  'travel_entity_facts',
  'travel_tags',
  'travel_entity_tags',
  'travel_templates',
  'travel_template_copy',
  'travel_template_stops',
  'travel_template_legs',
  'travel_template_tags',
  'travel_dataset_payloads',
  'travel_active_datasets',
  'travel_dataset_activations',
];

for (const table of travelKnowledgeTables) {
  requiredPatterns.push(
    {
      label: `${table} table`,
      pattern: new RegExp(`create\\s+table\\s+if\\s+not\\s+exists\\s+public\\.${table}\\s*\\(`, 'i'),
    },
    {
      label: `${table} RLS`,
      pattern: new RegExp(`alter table public\\.${table} enable row level security;`, 'i'),
    },
  );
}

requiredPatterns.push(
  {
    label: 'travel entity suggestions RPC',
    pattern: /create\s+or\s+replace\s+function\s+public\.get_travel_entity_suggestions\(/i,
  },
  {
    label: 'travel entity suggestions public grant',
    pattern: /grant execute on function public\.get_travel_entity_suggestions\(text,\s*text,\s*text\[\],\s*integer\) to anon,\s*authenticated;/i,
  },
  {
    label: 'travel destination pack RPC',
    pattern: /create\s+or\s+replace\s+function\s+public\.get_travel_destination_pack\(/i,
  },
  {
    label: 'travel destination pack public grant',
    pattern: /grant execute on function public\.get_travel_destination_pack\(text,\s*text\) to anon,\s*authenticated;/i,
  },
  {
    label: 'active travel destination pack RPC',
    pattern: /create\s+or\s+replace\s+function\s+public\.get_active_travel_destination_pack\(/i,
  },
  {
    label: 'active travel entity suggestions RPC',
    pattern: /create\s+or\s+replace\s+function\s+public\.get_active_travel_entity_suggestions\(/i,
  },
  {
    label: 'travel artifact staging RPC',
    pattern: /create\s+or\s+replace\s+function\s+public\.admin_stage_travel_dataset_artifact\(/i,
  },
  {
    label: 'travel artifact publish RPC',
    pattern: /create\s+or\s+replace\s+function\s+public\.admin_publish_travel_dataset_artifact\(/i,
  },
  {
    label: 'travel dataset rollback RPC',
    pattern: /create\s+or\s+replace\s+function\s+public\.admin_rollback_travel_dataset\(/i,
  },
);

const fail = (message) => {
  console.error(`[supabase:validate] ${message}`);
  process.exit(1);
};

let sql;
let stats;
try {
  sql = readFileSync(sqlPath, 'utf8');
  stats = statSync(sqlPath);
} catch (error) {
  fail(`Could not read docs/supabase.sql (${error instanceof Error ? error.message : 'unknown error'}).`);
}

const conflictMarkerPattern = /^(<{7}|={7}|>{7})(?:\s.+)?$/m;
if (conflictMarkerPattern.test(sql)) {
  fail('Merge conflict markers detected in docs/supabase.sql.');
}

const lineCount = sql.split('\n').length;
if (lineCount < 3000) {
  fail(`docs/supabase.sql looks truncated (${lineCount} lines).`);
}

if (stats.size < 90_000) {
  fail(`docs/supabase.sql looks unexpectedly small (${stats.size} bytes).`);
}

for (const check of requiredPatterns) {
  if (!check.pattern.test(sql)) {
    fail(`Missing required section: ${check.label}.`);
  }
}

console.log(
  `[supabase:validate] docs/supabase.sql is valid (${lineCount} lines, ${stats.size} bytes).`
);
