# Travel knowledge deployment runbook

Status: schema, Thailand v7 source-backed fast-path dataset, immutable artifact, and atomic active pointer applied and verified in production on 2026-07-17.

This runbook deploys the additive travel-knowledge schema and versioned Thailand datasets without deleting or replacing existing TravelFlow tables. Thailand v6 remains the verified immediate rollback target for the active v7 release; v5 is also retained.

## Production deployment record

The target was verified as the TravelFlow Supabase project before every mutation. HabitFlow uses a different project and was not touched.

Applied migrations:

- `20260717071342 backup_public_before_travel_knowledge_20260717t071235z`
- `20260717071510 add_travel_knowledge_foundation`
- `20260717071632 seed_travel_knowledge_thailand_v5`
- `20260717074656 add_travel_knowledge_operations`
- `20260717074708 register_travel_knowledge_sources_v1`
- `20260717081752 add_private_travel_knowledge_snapshot_bucket`
- `20260717082244 activate_geonames_wikidata_ingestion_v1`
- `20260717085205 backup_travel_knowledge_before_admin_review_20260717t085112z`
- `20260717085505 add_travel_knowledge_admin_review`
- `20260717085716 harden_travel_knowledge_review_reads`
- `20260717091246 backup_travel_knowledge_before_atomic_publish_20260717t091156z`
- `20260717092846 add_travel_knowledge_atomic_artifact_publish`
- `20260717093321 add_active_travel_suggestion_fallback`
- `20260717093516 fix_travel_dataset_activation_column_resolution`
- `20260717093707 index_travel_dataset_artifact_foreign_keys`
- `20260717131934 add_travel_planning_context_rpc`
- `20260717140854 update_travel_knowledge_source_registry_v2`
- `20260717141224 fix_travel_dataset_payload_column_resolution`
- `20260717160009 compact_travel_planning_context_v2`
- `20260717160441 preserve_travel_planning_summary_sources_v2`

The initial foundation applied only the isolated travel-knowledge section of `docs/supabase.sql`, followed by the exact generated Thailand seed. Later operations and private-bucket migrations were also narrow and additive; the rest of the documented schema was not replayed.

Foundation and v5 baseline verification:

- all 35 pre-existing public tables remain present
- 20 additive travel-knowledge tables have RLS enabled and explicit policies
- the published Thailand v5 pack contains 84 entities, 244 facts, 405 entity tags, 15 templates, and 16 route legs
- an anonymous database-role insert probe was denied with `42501` and left zero rows
- an anonymous PostgREST RPC returned HTTP 200 with country `TH`, locale `en`, version `2026.07.17-v5`, 84 entities, and 15 templates
- five admin-only operational tables now quarantine source runs, snapshots, candidates, review decisions, and dataset artifacts from the public projection
- 13 sources have explicit ingestion modes, automation gates, license-review dates, storage policies, and LLM-processing rules; two individually licensed source families remain blocked from automation
- RLS is enabled on all five operational tables, anonymous table reads are revoked, and the public pack RPC does not reference operational history
- final database size was 242 MB

The first active identity ingestion completed after the bucket migration:

- GeoNames run `0e7c56d8-b552-4b37-9b9e-2b052d9d650e`: succeeded, 264,778 raw rows examined, 16 review candidates, zero warnings/errors
- Wikidata run `ba167796-386a-44d3-8253-f48157eb562d`: succeeded, 16 unique identities, 16 review candidates, zero warnings/errors
- four initial immutable objects and ledger rows had identical aggregate size: 11,021,238 bytes
- object downloads matched all four recorded byte sizes and SHA-256 checksums
- all 32 external-ID candidates remained `needs_review`
- a repeat run reused unchanged content and created zero duplicate candidates
- Thailand remained at 84 published entities and 15 published templates
- an anonymous Storage client saw zero objects, could not resolve the private bucket, and could not upload the probe object
- a fresh 17-table travel-only backup captured 1,112 rows with zero count or checksum mismatches before the review migration
- three admin review RPCs are available only to authenticated callers and reject non-admin sessions internally
- the two read RPCs use caller/RLS permissions; only the atomic write RPC uses fixed-search-path elevated execution
- authenticated direct inserts into `travel_review_decisions` are revoked, while admin read remains available
- all 32 candidates remain `needs_review`, the review ledger remains empty, and published Thailand counts were unchanged after deployment verification
- one immutable 445,767-byte Thailand v5 payload and artifact are published, with one active-country pointer and one activation-ledger row
- the active payload checksum is `14da2b73ac605b86a5535da6e17e3e288a714b4570350e888979dc020a418142`; its source dataset checksum remains `8fa5070d25447f66e48705382ef23b4fefaa52ab2f672d3436a00cd367f0782e`
- an anonymous active-pack read returned 84 entities, 244 facts, 15 templates, and localized German template copy; active city/neighborhood suggestions returned Bangkok and Bangkok Riverside

### Thailand v6 fast-path activation

Thailand v6 was staged and published as an immutable artifact after the v5 baseline and backup were reverified. The first publish attempt found an ambiguous `dataset_version_id` predicate while retiring the previous payload. PostgreSQL rolled the entire transaction back: v5 stayed active, v6 stayed staged, and no activation-ledger row was written. Migration `20260717141224` qualified both publish and rollback predicates; the retry then completed atomically.

- dataset version: `9caea559-ee2c-4410-98c5-5e5d13cb0bab`
- payload: `f3520eca-edbe-4a6b-a067-bc131b44f50a`
- artifact: `664097c5-baab-486c-9abf-9c448a79a4be`
- activation: `d7a0c10e-1df3-4f68-9456-852e0cf5a2b9` at `2026-07-17T14:13:06.096669Z`
- dataset checksum: `c6915040ab5453d9cb88f7b8fbb5e325d53b30b001efdcc6f0d0c6d649cca10e`
- pack checksum: `62e7baa7c69bf3663f28a07766ec5ba57c78e3de5acd63c1eeeacbdc4d9ae6fd`
- artifact checksum: `90290e907d800bbfad5ec5e4cf33890027c46cf481b378a9e133e35c48a045cc`
- active counts: 84 entities, 277 facts, 405 tags, 15 templates, and 16 route legs
- anonymous active-pack read: version `2026.07.17-v6`, 84 entities, 15 templates
- anonymous structured city-break context: `structured-pack-v1`, 38,396 bytes, 9 compact entities, 3 templates, 98.8 ms warm median across five samples
- activation ledger: two Thailand entries, covering the initial v5 publish and v6 publish
- v5 rollback target: artifact `e2ba3eda-43f6-473f-924d-ece8a721c744`, dataset `8e015658-aae7-5a67-9d92-9eb0c026200f`; both the private bundle and validated payload remain retained

The private backup `tf_bak_tk_20260717t091156z` was independently rechecked immediately before the v6 writes: 17/17 tables, 1,112 rows, and zero count or checksum mismatches. Anonymous callers can execute only the public read projections; they cannot call artifact mutation RPCs or write the operational tables. No new blocking advisor finding was introduced. The remaining duplicate authenticated read-policy warning is a low-priority cleanup item.

### Thailand v7 activity-knowledge activation

Thailand v7 extends the same immutable artifact and atomic-pointer workflow with category-aware activity profiles, richer operational facts, and explicit coverage gaps. The planning RPC was compacted separately so the route generator retrieves only route-relevant fields while the admin catalogue and trip activity detail retain the complete record.

- repository commit: `a8b303548e72f4111be9808ac222b2291d687733`
- dataset version: `0a0a3396-f7b5-481a-9607-2665aee0074f`
- payload: `3337cda1-26ca-4dc0-9c1b-9b9185902773`
- artifact: `5edc0857-984f-445a-ae35-439bf81929b9`
- activation: `6e882791-e629-4591-ae46-3f52b4f546ad` at `2026-07-17T16:08:39.262525Z`
- dataset checksum: `1f938c858155e7240f52489a94b536bc8c421eadc9438a5ab83638e07f99d2ce`
- pack checksum: `c49f7330329695e50cf520f85a5557be12d51b6ba68b764be8382a2f2c22d45f`
- artifact checksum: `5a3ab7d35cb0da914cdf04affe6183e9241dafecda9a04fb48a337be1ad17b8f`
- active payload: 524,236 bytes; 84 entities, 321 facts, 420 entity tags, 15 templates, and 16 route legs
- activity coverage: 32 POIs, 8 rich, 0 usable, 24 starter, 36% average coverage
- anonymous city-break context: `structured-pack-v2`, 31,187 compact JSON bytes, 9 selected entities, 3 templates
- anonymous hub-and-day-trips context: 66,247 compact JSON bytes, 19 selected entities, 3 templates
- anonymous single-country-circuit context: 94,542 compact JSON bytes, 30 selected entities, 3 templates
- warm anonymous city-break RPC median: 68.9 ms across five post-warmup samples
- public RPC posture: `SECURITY INVOKER`, fixed empty `search_path`, anonymous and authenticated execute grants
- activation ledger: three Thailand entries covering v5, v6, and v7
- immediate rollback target: v6 artifact `664097c5-baab-486c-9abf-9c448a79a4be`; the superseded artifact and payload remain retained and checksum-addressable

The v7 activation changed only the active dataset pointer and activation ledger after staging the immutable payload. The pre-existing private backups remain verified; no destructive restore or table rewrite was required.

## Sources of truth

- Additive schema and policies: `docs/supabase.sql`
- Generated Thailand seed: `docs/travel-knowledge-thailand.seed.generated.sql`
- Generated source registry seed: `docs/travel-knowledge-source-registry.seed.generated.sql`
- Repository dataset: `data/travelKnowledge/thailand.v1.json`
- Compiled bundled fallback: `data/travelKnowledge/thailand.v1.pack.generated.json`
- Source registry: `data/travelKnowledge/source-registry.v1.json`

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

Before deploying the admin review workflow, a second travel-only checkpoint captured the operations tables that did not exist in the original baseline:

- backup schema: `tf_bak_tk_20260717t085112z`
- 17 `public.travel_*` tables and 1,112 rows copied under repeatable-read
- zero row-count or deterministic JSON-row checksum mismatches
- 17/17 backup tables recomputed successfully from copied rows
- `public`, `anon`, and `authenticated` have no usage permission on the backup schema
- external non-secret manifest: `/Users/chrizzzly/.codex/backups/travelflow/travelflow-supabase-travel-knowledge-pre-admin-review-20260717T085112Z.manifest.json`
- manifest SHA-256: `d66057c78c1677c3b6be3bc9b0630019cbfe1fc10eadf348816813a88ffc66d3`

Before deploying the atomic artifact workflow, a third travel-only checkpoint was created and independently recomputed through the Supabase connector:

- backup schema: `tf_bak_tk_20260717t091156z`
- 17 `public.travel_*` tables and 1,112 rows copied under repeatable-read
- zero row-count or deterministic JSON-row checksum mismatches across 17/17 copied tables
- five travel-function definitions and complete per-table catalog metadata captured
- `public`, `anon`, and `authenticated` have no usage permission on the backup schema; `service_role` has read access
- external non-secret manifest: `/Users/chrizzzly/.codex/backups/travelflow/travelflow-supabase-travel-knowledge-pre-atomic-publish-20260717T091156Z.manifest.json`
- manifest SHA-256: `ed4f2056d404b363e50cd5f829ae4132ab291bc24d4c54c9501a1a20c0ee3e69`

## Apply or update

The SQL is designed to be additive and idempotent. For a new environment, apply the isolated travel-knowledge schema first, then the generated seed. Do not replay unrelated sections of `docs/supabase.sql` merely to install this feature.

```bash
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f docs/supabase.sql
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f docs/travel-knowledge-thailand.seed.generated.sql
```

For the Dashboard path, extract and run only the travel-knowledge section of `docs/supabase.sql`, then run the complete generated seed. Stop immediately on the first error; do not drop existing objects to make the script pass.

## Verify

Expected active Thailand v7 counts:

```sql
select dataset_key, version, entity_count, fact_count, template_count
from public.travel_dataset_versions
where dataset_key = 'thailand-core';

select entity_type, count(*)
from public.travel_entities
where dataset_version = '2026.07.17-v7'
group by entity_type
order by entity_type;

select count(*) as fact_count
from public.travel_entity_facts fact
join public.travel_entities entity on entity.id = fact.entity_id
where entity.dataset_version = '2026.07.17-v7';

select count(*) as tag_count
from public.travel_entity_tags tag
join public.travel_entities entity on entity.id = tag.entity_id
where entity.dataset_version = '2026.07.17-v7';

select count(*) as template_count
from public.travel_templates
where dataset_version = '2026.07.17-v7';

select count(*) as route_leg_count
from public.travel_template_legs leg
join public.travel_templates template on template.id = leg.template_id
where template.dataset_version = '2026.07.17-v7';
```

The repository validator expects:

- 84 entities: 1 country, 6 regions, 15 cities, 30 neighborhoods, and 32 POIs
- 321 facts
- 420 tags
- 15 templates
- 16 route legs

Also verify that the public read RPC returns the published pack and that an anonymous client cannot write any travel-knowledge row.

For source ingestion, first run without persistence and inspect every proposed identity:

```bash
pnpm travel-knowledge:ingest -- --source all --country TH --verbose
```

After license, target-project, and dry-run review, the server-side operator may persist snapshots and candidates:

```bash
TRAVEL_KNOWLEDGE_WRITE_MODE=review_candidates_only \
  pnpm travel-knowledge:ingest -- --source all --country TH --persist
pnpm travel-knowledge:verify-snapshots
```

The persist command does not publish candidates. It may insert only source runs, immutable snapshot ledger rows, immutable Storage objects, and `needs_review` candidates. Published rows change only through the separate reviewed artifact/publish workflow.

After accepted decisions are materialized into a new repository dataset version and committed, build and stage the deterministic artifact. Both commands are dry-run by default:

```bash
pnpm travel-knowledge:stage-artifact
TRAVEL_KNOWLEDGE_WRITE_MODE=stage_artifact_only \
  pnpm travel-knowledge:stage-artifact -- --persist

pnpm travel-knowledge:activate-artifact -- \
  --publish <artifact-id> --reason "Reviewed country-pack release"
TRAVEL_KNOWLEDGE_WRITE_MODE=activate_artifact_only \
  pnpm travel-knowledge:activate-artifact -- \
  --publish <artifact-id> --reason "Reviewed country-pack release" --execute
```

The stage command refuses accepted decisions that are not already materialized in the repository. The publish RPC validates the staged payload and checksum, takes a country-level advisory lock, switches the active pointer, and writes the activation ledger in one transaction.

## Activate remote reads

The remote flag is enabled only for the `codex/journey-spec-thailand-foundation` Netlify branch while the feature is tested. Production remains on the bundled fallback. After branch QA and copy sign-off, enable:

```env
VITE_TRAVEL_KNOWLEDGE_REMOTE_ENABLED=true
```

Deploy this flag separately from the schema change. The read service remains version-aware and can fall back to the bundled Thailand pack when the network or remote dataset is unavailable.

## Advisor follow-ups

No travel-specific missing-RLS, missing-policy, or mutable-function-search-path security issue remains. The security advisor reports the intentional anonymous public-read policies. It also identifies the two restrictive Storage denial policies as policies applying to `public`; those policies are defense-in-depth denials, not grants, and their predicates explicitly exclude the snapshot bucket.

The operations migration added the five previously missing foreign-key indexes and changed travel admin policies to use init-plan-safe auth expressions. Supabase no longer reports those two finding classes for the travel tables.

Before the published travel tables receive material authenticated read volume, address this remaining performance finding in a separate policy migration:

- duplicate permissive `SELECT` policies for the `authenticated` role

Fresh unused-index notices are expected while the operational tables are empty and should be reassessed after representative traffic rather than removed immediately. The security advisor reports only the intentional anonymous public-read warnings for the published projection; no operational table is included in those warnings.

The three artifact mutation RPCs intentionally remain authenticated `SECURITY DEFINER` functions. Public and anonymous execution is revoked; each has an empty `search_path`, disables caller RLS only inside the guarded transaction, and repeats an admin-or-service-role authorization check. Supabase therefore reports the expected authenticated-definer warnings. Public pack and entity-suggestion RPCs remain `SECURITY INVOKER`. The foreign-key indexes reported immediately after the activation migration were added before rollout.

The admin review write RPC intentionally remains an authenticated `SECURITY DEFINER` function because direct decision-table inserts are revoked and decision plus candidate status must commit atomically. It has an empty `search_path`, explicit authenticated-only execution, non-null/non-anonymous identity checks, and an internal admin-role check. The candidate-list and review-summary RPCs use `SECURITY INVOKER` so reads continue through table grants and RLS.

## Rollback without deletion

Do not drop the new tables or delete Thailand data as the first rollback action.

1. Set `VITE_TRAVEL_KNOWLEDGE_REMOTE_ENABLED=false` and redeploy so all reads use the bundled pack while investigating.
2. For a prior published artifact, dry-run `pnpm travel-knowledge:activate-artifact -- --rollback <artifact-id> --country TH --reason <reason>`.
3. Execute only after verifying the target checksum, using `TRAVEL_KNOWLEDGE_WRITE_MODE=activate_artifact_only` and `--execute`.
4. Leave the additive schema and immutable artifacts in place; rollback switches the pointer and writes a ledger row without deleting data.
5. Restore the private backup only if an unrelated pre-existing object was unexpectedly changed and the impact has been reviewed.
