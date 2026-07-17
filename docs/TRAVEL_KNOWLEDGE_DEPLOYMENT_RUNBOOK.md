# Travel knowledge deployment runbook

Status: schema and Thailand seed are ready; production DDL is not yet applied.

This runbook deploys the additive travel-knowledge schema and Thailand v5 dataset without deleting or replacing existing TravelFlow tables.

## Current production probe

On 2026-07-17, the configured Supabase project returned `PGRST205` for each of these tables:

- `travel_sources`
- `travel_dataset_versions`
- `travel_entities`
- `travel_entity_names`
- `travel_entity_facts`
- `travel_tags`
- `travel_entity_tags`
- `travel_templates`
- `travel_template_copy`
- `travel_template_stops`
- `travel_template_legs`

That response means the travel-knowledge schema is not present in the PostgREST schema cache. There are therefore no existing travel-knowledge rows to preserve before the first deployment. The rest of the production database remains out of scope and must not be modified or reset.

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

## Backup before the first apply

Even though the new tables do not exist yet, take a public-schema backup before changing production:

```bash
pg_dump "$SUPABASE_DB_URL" \
  --schema=public \
  --format=custom \
  --file="output/backups/travelflow-public-before-travel-knowledge-$(date -u +%Y%m%dT%H%M%SZ).dump"
```

Confirm the dump exists and is non-empty before continuing. Store it outside the repository after verification.

## Apply

The SQL is designed to be additive and idempotent. Apply the schema first, then the generated seed:

```bash
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f docs/supabase.sql
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f docs/travel-knowledge-thailand.seed.generated.sql
```

For the Dashboard path, run the complete contents of those files in the same order. Stop immediately on the first error; do not drop existing objects to make the script pass.

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

Keep the app on its bundled, versioned fallback until all counts and policies pass. Then enable:

```env
VITE_TRAVEL_KNOWLEDGE_REMOTE_ENABLED=true
```

Deploy this flag separately from the schema change. The read service remains version-aware and can fall back to the bundled Thailand pack when the network or remote dataset is unavailable.

## Rollback without deletion

Do not drop the new tables or delete Thailand data as the first rollback action.

1. Set `VITE_TRAVEL_KNOWLEDGE_REMOTE_ENABLED=false`.
2. Redeploy the application so all reads use the bundled pack.
3. Leave the additive schema and seeded rows in place while investigating.
4. Restore the database dump only if an unrelated pre-existing object was unexpectedly changed and the impact has been reviewed.
