# Travel knowledge deployment runbook

Status: schema and Thailand v5 seed applied and verified in production on 2026-07-17.

This runbook deploys the additive travel-knowledge schema and Thailand v5 dataset without deleting or replacing existing TravelFlow tables.

## Production deployment record

The target was verified as the TravelFlow Supabase project before every mutation. HabitFlow uses a different project and was not touched.

Applied migrations:

- `20260717071342 backup_public_before_travel_knowledge_20260717t071235z`
- `20260717071510 add_travel_knowledge_foundation`
- `20260717071632 seed_travel_knowledge_thailand_v5`
- `20260717074656 add_travel_knowledge_operations`
- `20260717074708 register_travel_knowledge_sources_v1`

Only the isolated 751-line travel-knowledge section of `docs/supabase.sql` was applied, followed by the exact generated Thailand seed. The rest of the documented schema was not replayed.

Final verification:

- all 35 pre-existing public tables remain present
- 12 additive travel-knowledge tables have RLS enabled and explicit policies
- the published Thailand v5 pack contains 84 entities, 244 facts, 405 entity tags, 15 templates, and 16 route legs
- an anonymous database-role insert probe was denied with `42501` and left zero rows
- an anonymous PostgREST RPC returned HTTP 200 with country `TH`, locale `en`, version `2026.07.17-v5`, 84 entities, and 15 templates
- five admin-only operational tables now quarantine source runs, snapshots, candidates, review decisions, and dataset artifacts from the public projection
- 13 sources have explicit ingestion modes, automation gates, license-review dates, storage policies, and LLM-processing rules; two individually licensed source families remain blocked from automation
- RLS is enabled on all five operational tables, anonymous table reads are revoked, and the public pack RPC does not reference operational history
- final database size was 242 MB

## Sources of truth

- Additive schema and policies: `docs/supabase.sql`
- Generated Thailand seed: `docs/travel-knowledge-thailand.seed.generated.sql`
- Repository dataset: `data/travelKnowledge/thailand.v1.json`
- Compiled bundled fallback: `data/travelKnowledge/thailand.v1.pack.generated.json`

Run before applying anything:

```bash
pnpm supabase:validate
pnpm travel-knowledge:check
pnpm supabase:check-main-sync --fetch
```

## Required access

Use one of these approved paths:

1. Supabase Dashboard SQL Editor access; or
2. a direct database URL/password for `psql`; or
3. a Supabase personal access token plus a linked CLI project and database password.

The anon key and service-role key are application credentials. They do not authorize schema DDL and must not be treated as a database backup or migration credential.

## Verified pre-change backup

Because the free Supabase tier did not provide a managed snapshot, the migration created a private logical backup schema before applying DDL:

- backup schema: `tf_bak_20260717t071235z`
- 35 tables and 204,227 rows copied under repeatable-read
- zero row-count mismatches
- zero content-checksum mismatches
- 90 public function definitions captured
- per-table columns, constraints, indexes, policies, triggers, and privileges captured
- `public`, `anon`, and `authenticated` have no usage permission on the backup schema
- external non-secret manifest: `/Users/chrizzzly/.codex/backups/travelflow/travelflow-supabase-pre-travel-knowledge-20260717T071235Z.manifest.json`
- manifest SHA-256: `7bfcd3ef4ab30df5f634b7ae542b43b3e6af49e4352817a741f306c22ffc84dd`

This protects against mistakes in the additive migration. It is not a substitute for an independent physical database backup. Keep the private schema until the feature has completed its rollout and a separate retention decision is approved.

## Apply or update

The SQL is designed to be additive and idempotent. For a new environment, apply the isolated travel-knowledge schema first, then the generated seed. Do not replay unrelated sections of `docs/supabase.sql` merely to install this feature.

```bash
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f docs/supabase.sql
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f docs/travel-knowledge-thailand.seed.generated.sql
```

For the Dashboard path, extract and run only the travel-knowledge section of `docs/supabase.sql`, then run the complete generated seed. Stop immediately on the first error; do not drop existing objects to make the script pass.

## Verify

Expected Thailand v5 counts:

```sql
select dataset_key, version, entity_count, fact_count, template_count
from public.travel_dataset_versions
where dataset_key = 'thailand-core';

select entity_type, count(*)
from public.travel_entities
where dataset_version = '2026.07.17-v5'
group by entity_type
order by entity_type;

select count(*) as fact_count
from public.travel_entity_facts fact
join public.travel_entities entity on entity.id = fact.entity_id
where entity.dataset_version = '2026.07.17-v5';

select count(*) as tag_count
from public.travel_entity_tags tag
join public.travel_entities entity on entity.id = tag.entity_id
where entity.dataset_version = '2026.07.17-v5';

select count(*) as template_count
from public.travel_templates
where dataset_version = '2026.07.17-v5';

select count(*) as route_leg_count
from public.travel_template_legs leg
join public.travel_templates template on template.id = leg.template_id
where template.dataset_version = '2026.07.17-v5';
```

The repository validator expects:

- 84 entities: 1 country, 6 regions, 15 cities, 30 neighborhoods, and 32 POIs
- 244 facts
- 405 tags
- 15 templates
- 16 route legs

Also verify that the public read RPC returns the published pack and that an anonymous client cannot write any travel-knowledge row.

## Activate remote reads

The remote flag is enabled only for the `codex/journey-spec-thailand-foundation` Netlify branch while the feature is tested. Production remains on the bundled fallback. After branch QA and copy sign-off, enable:

```env
VITE_TRAVEL_KNOWLEDGE_REMOTE_ENABLED=true
```

Deploy this flag separately from the schema change. The read service remains version-aware and can fall back to the bundled Thailand pack when the network or remote dataset is unavailable.

## Advisor follow-ups

No travel-specific missing-RLS, missing-policy, or mutable-function-search-path security issue remains. The security advisor reports the intentional anonymous public-read policies.

The operations migration added the five previously missing foreign-key indexes and changed travel admin policies to use init-plan-safe auth expressions. Supabase no longer reports those two finding classes for the travel tables.

Before the published travel tables receive material authenticated read volume, address this remaining performance finding in a separate policy migration:

- duplicate permissive `SELECT` policies for the `authenticated` role

Fresh unused-index notices are expected while the operational tables are empty and should be reassessed after representative traffic rather than removed immediately. The security advisor reports only the intentional anonymous public-read warnings for the published projection; no operational table is included in those warnings.

## Rollback without deletion

Do not drop the new tables or delete Thailand data as the first rollback action.

1. Set `VITE_TRAVEL_KNOWLEDGE_REMOTE_ENABLED=false`.
2. Redeploy the application so all reads use the bundled pack.
3. Leave the additive schema and seeded rows in place while investigating.
4. Restore the database dump only if an unrelated pre-existing object was unexpectedly changed and the impact has been reviewed.
