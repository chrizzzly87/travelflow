# Travel knowledge deployment runbook

Status: schema, Thailand v12 source-backed fast-path dataset, immutable artifact, provenance guards, and atomic active pointer applied and verified in production on 2026-07-18.

This runbook deploys the additive travel-knowledge schema and versioned Thailand datasets without deleting or replacing existing TravelFlow tables. Thailand v11 remains the verified immediate rollback target for the active v12 release; earlier artifacts are also retained.

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
- `20260718052939 compact_initial_travel_planning_poi_facts`
- `20260718061531 serialize_concurrent_trip_upserts`
- `20260718061621 serialize_legacy_concurrent_trip_upserts`
- `20260718072555 backup_travel_knowledge_post_v9_20260718t072025z`
- `20260718074101 guard_travel_dataset_provenance_v10`
- `20260718084324 backup_travel_knowledge_pre_v11_20260718t084050z`

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

### Thailand v8 and v9 rich-activity activations

Thailand v8 expanded the activity contract from eight to fourteen rich POIs. Thailand v9 then completed the structured fields for every POI referenced directly by a route template, including Bridge over the River Khwae, Promthep Cape, Mu Ko Ang Thong, and Koh Larn. Both releases used the same immutable stage-and-publish workflow; neither rewrote an existing artifact.

Active v9 release:

- repository commit: `84fd03f4684aea7d837d9335f9d21b74b4404f68`
- dataset version: `cbc907fd-1bdb-4ccc-a6fc-271d58dd590a`
- payload: `4d8a33a1-6ce0-48fa-b4d5-62278bf59ee5`
- artifact: `4528a314-e8be-4aeb-b344-7e3c5d555e25`
- activation: `7467a7eb-8332-493b-ab80-cb01810ec930` at `2026-07-18T06:03:23.950335Z`
- dataset checksum: `c2b1581f6832babd6706586f0aa5d524bf617f682e24bc5410df2f1705d730f1`
- pack checksum: `04d1a56505f05cb4bb4b47a257a60354aef618191ef8e1ebbd9eb6ed3207a662`
- seed checksum: `011e312211436442c84acfe51ed3883d2080d048bbd71838f2a84347f27ee6e9`
- artifact checksum: `b89a429279f5bd122a3d2c46295597500b23285f4a1189236eb96a6dd60b1a75`
- active payload: 614,947 bytes; 84 entities, 427 facts, 420 entity tags, 15 templates, and 16 route legs
- activity coverage: 32 POIs, 18 rich, 0 usable, 14 starter, 62% average coverage
- anonymous single-country circuit context: 93,060 compact JSON bytes, below the 100 KB guardrail
- targeted route contexts: 18,329–29,598 bytes for Pattaya, Samui, Phuket, and Kanchanaburi, with each route-critical POI and its structured facts present
- immediate rollback target: v8 artifact `5fa21ca0-bbd7-494a-b113-3199448683cd`; its dataset, payload, and checksum-addressable bundle remain retained

The v9 activation switched only the country pointer and wrote activation-ledger row `7467a7eb-8332-493b-ab80-cb01810ec930`. Existing advisor findings remained unchanged because the release was content-only and introduced no schema or policy changes.

### Thailand v10 catalogue and provenance activation

Thailand v10 enriches four more high-value POIs, adds a coverage-prioritized admin queue, and hardens the publication boundary. The staged manifest, facts, and route legs must no longer claim timestamps later than the pack generation time. The published immutable payload is now the only public active-pack source; legacy normalized tables and their old read RPCs are no longer an anonymous fallback.

- repository commit: `b0eacc2d624054dd83cf4b1ac0537355c6bcb3a5`
- dataset version: `8acec18c-3dbc-4a33-8db8-e4493ef21867`
- payload: `23a2bec2-ffc5-47ae-9234-8b66cb6f888e`
- artifact: `38122ce8-4187-433f-b0c3-f94dcccdb46e`
- activation: `7089d1fd-5787-47b9-a256-ed577f47c6a4` at `2026-07-18T07:46:25.913793Z`
- dataset checksum: `0d30648a8daec0cc41b180189dd4a5cd9d58f1fc4a4b3923b4dab936b6a779fb`
- pack checksum: `cdb466d24f6b76b1b8ef5b9ab1dada179470f6cafcfd909e7a295884ceba05b0`
- seed checksum: `14f4bc290231f205dac76fe1e0721d50a0503b08430d72745bbf4968a0e9444a`
- artifact checksum: `59eb8f12f751d7b4d8f475de250e22e7b495f2c3bade1489f83f210caf22e0b3`
- active payload: 646,551 bytes; 84 entities, 464 facts, 420 entity tags, 15 templates, and 16 route legs
- activity coverage: 32 POIs, 22 rich, 0 usable, 10 starter, 73% average coverage
- anonymous city context: 34,458 compact JSON bytes, 11 selected entities, 3 templates
- anonymous initial single-country circuit context: 93,516 compact JSON bytes, 30 selected entities, 3 templates
- anonymous selected deep heritage context: 92,956 compact JSON bytes, 26 selected entities, 1 template
- immediate rollback target: v9 artifact `4528a314-e8be-4aeb-b344-7e3c5d555e25`; its superseded dataset, retired payload, and checksum-addressable bundle remain retained

The v10 publish passed staged count, checksum, timestamp, private-object, source-run, and review-candidate checks before activation. Both representative planning contexts stayed below the 100 KB guardrail. The schema migration removed direct public, anonymous, and authenticated access to all twelve legacy normalized travel tables and their legacy read RPCs while preserving the public active-pack and suggestion projections.

### Thailand v11 complete activity-catalogue activation

Thailand v11 completes the rich structured contract for all 32 Thailand activity POIs. The full immutable catalogue retains source-backed hours or operating context, pricing, booking guidance, weather and effort, access and facilities, audience fit, practical notes, freshness, and per-field provenance. The comparison and selected-route RPCs still project only route-relevant fields so the richer catalogue does not turn trip creation back into a large prompt.

- repository commit: `57b71adb3ce530e84ec368d19e35c9fe6377bb7d`
- dataset version: `9f25f4d9-3c00-4902-b574-d7f7c81a714c`
- payload: `07c58f48-820a-461e-b913-462f63cdce7f`
- artifact: `f6a9a4c5-3274-4ff0-a319-c3afbd21f312`
- activation: `af4809f6-3dfd-4b7c-82b2-6da7a93ad818` at `2026-07-18T08:44:53.784058Z`
- dataset checksum: `fa904d7d53f100e32132b97bb94678972effc80758243c207bc97f48b0325adf`
- pack checksum: `facf4a6b00ec0d7f600a8a21fdeaec33b274037ecb55400437a3e0796cb1b73b`
- seed checksum: `4bb4f95f469da9501bfff34ec46ad2471dd475ebff5b43d05885ff52def82b08`
- artifact checksum: `5dde5fd858dc504d8a35946447cec1beaed8e2833ff9ed5bf3fd1730a41d6f20`
- active payload: 740,547 bytes; 84 entities, 571 facts, 420 entity tags, 15 templates, and 16 route legs
- activity coverage: 32 POIs, 32 rich, 0 usable, 0 starter, 99% average coverage; remaining gaps are optional or honestly inapplicable
- anonymous production-budget circuit comparison context: 94,153 compact JSON bytes, 30 selected entities, 3 templates
- anonymous selected heritage-route context: 95,932 compact JSON bytes, 26 selected entities, 1 template
- anonymous active-pack read: version `2026.07.18-v11`, 84 entities, 15 templates
- public mutation posture: anonymous callers cannot select or mutate artifact tables and cannot execute the publication RPC
- immediate rollback target: v10 artifact `38122ce8-4187-433f-b0c3-f94dcccdb46e`; its superseded dataset, retired payload, and checksum-addressable bundle remain retained

The v11 release is content-only. It used the existing staged-artifact validation and atomic publish transaction after the new private checkpoint was independently checksum-verified. Both production retrieval budgets remain below 100 KB even though the complete catalogue gained 107 sourced facts.

### Thailand v12 complete city-template coverage activation

Thailand v12 adds twelve city-break concepts so every one of the fifteen supported Thailand cities has a directly selectable zero-AI route. It composes only existing reviewed entities and facts, keeps the 32 rich activity profiles unchanged, and leaves the optional personalization request outside the deterministic route reveal.

- repository commit: `627577693843133ebb61852af5854d337426c251`
- dataset version: `0b98a5ed-b3ec-4da3-b2e5-8d517c1fe16a`
- payload: `910f0b87-e37b-4d78-9894-2e8153d369b2`
- artifact: `026b9500-899b-46e1-beda-4def58fadfd3`
- activation: `340f3d38-22f8-4240-97c9-a1e9856f8ff2` at `2026-07-18T10:15:40.934727Z`
- dataset checksum: `d905245108edb07295322d71e96fa5e80e7d1bbfac55663f43aebdfcf5d6c5a4`
- pack checksum: `7db5cc296448d435b68d27d4daf66e209f7ef480a0a3398ef81c57dbf9a45d71`
- seed checksum: `2d2678362be79637ab653a0f43955a2ab9a2672a8bd01bdebf40d10e856e7d9a`
- artifact checksum: `ab6b41441f79d14ef39e65dd9a5ab67c6641801b74a0659db42828eb72f7e908`
- active payload: 771,893 bytes; 84 entities, 571 facts, 420 entity tags, 27 templates, and 16 route legs
- live Chiang Rai city-break context: 53,148 bytes, 17 selected entities, 3 templates, with **Chiang Rai in three colors** ranked first
- live Krabi city-break context: 48,356 bytes, 16 selected entities, 3 templates, with **Krabi between cliffs and sea** ranked first
- immediate rollback target: v11 artifact `f6a9a4c5-3274-4ff0-a319-c3afbd21f312`; its retired payload and checksum-addressable private bundle remain retained

The v12 activation changed only immutable content and the atomic active pointer. The live pointer, published payload, activation ledger, representative planning contexts, and retained v11 rollback artifact were verified through the TravelFlow Supabase project after publication.

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

Immediately before the v10 provenance and access migration, a fourth private travel-only checkpoint captured the complete post-v9 state:

- backup schema: `tf_bak_tk_20260718t072025z`
- 20 `public.travel_*` tables and 1,138 rows copied under repeatable-read
- zero row-count or deterministic JSON-row checksum mismatches across 20/20 copied tables
- function, policy, grant, trigger, constraint, index, default-privilege, and private Storage metadata captured
- the private snapshot bucket contained 10 objects and retained its two restrictive policies
- `public`, `anon`, and `authenticated` have no access to the backup schema; `service_role` has read access
- source tables were unchanged after the checkpoint verification completed

Immediately before the v11 artifact was staged, a fifth private checkpoint captured the active v10 state through the Supabase connector:

- backup schema: `tf_bak_tk_20260718t084050z`
- migration: `20260718084324 backup_travel_knowledge_pre_v11_20260718t084050z`
- 20 `public.travel_*` tables and 1,142 rows copied in one migration transaction
- zero row-count or deterministic JSON-row checksum mismatches across 20/20 copied tables
- 13 relevant function definitions plus policy, grant, trigger, constraint, index, default-privilege, and private Storage metadata captured
- the private snapshot bucket contained 11 objects and retained its two restrictive policies
- all 29 checkpoint tables have RLS enabled with no public policies
- `public`, `anon`, and `authenticated` have no usage permission on the backup schema; `service_role` has read-only table access
- active v10 artifact `38122ce8-4187-433f-b0c3-f94dcccdb46e` was recorded before the v11 write

## Apply or update

The SQL is designed to be additive and idempotent. For a new environment, apply the isolated travel-knowledge schema first, then the generated seed. Do not replay unrelated sections of `docs/supabase.sql` merely to install this feature.

```bash
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f docs/supabase.sql
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f docs/travel-knowledge-thailand.seed.generated.sql
```

For the Dashboard path, extract and run only the travel-knowledge section of `docs/supabase.sql`, then run the complete generated seed. Stop immediately on the first error; do not drop existing objects to make the script pass.

## Verify

Expected active Thailand v12 counts:

```sql
select
  active.country_code,
  dataset.version,
  dataset.status as dataset_status,
  artifact.status as artifact_status,
  payload.status as payload_status,
  jsonb_array_length(payload.pack_payload -> 'entities') as entity_count,
  (payload.pack_payload #>> '{dataset,factCount}')::integer as fact_count,
  jsonb_array_length(payload.pack_payload -> 'templates') as template_count,
  payload.pack_byte_size
from public.travel_active_datasets active
join public.travel_dataset_versions dataset on dataset.id = active.dataset_version_id
join public.travel_dataset_artifacts artifact on artifact.id = active.artifact_id
join public.travel_dataset_payloads payload
  on payload.dataset_version_id = active.dataset_version_id
 and payload.locale = 'en'
where active.country_code = 'TH';

select public.get_active_travel_destination_pack('TH', 'en') #>> '{dataset,version}' as active_version;
```

The repository validator expects:

- 84 entities: 1 country, 6 regions, 15 cities, 30 neighborhoods, and 32 POIs
- 571 facts
- 420 tags
- 27 templates
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

No travel-serving advisor error, missing-RLS issue, missing-policy issue, or mutable-function-search-path issue remains after v12. Direct public, anonymous, and authenticated grants on the legacy normalized travel tables remain revoked; external reads go through the current immutable active payload projections. The two restrictive Storage denial policies remain defense-in-depth denials, not grants, and their predicates explicitly exclude the snapshot bucket.

The operations migration added the five previously missing foreign-key indexes and changed travel admin policies to use init-plan-safe auth expressions. Supabase no longer reports those two finding classes for the travel tables.

Before the legacy normalized travel tables receive material authenticated read volume again, address this remaining performance finding in a separate policy migration:

- 14 duplicate permissive-policy warnings across legacy normalized travel tables

Fresh unused-index notices are expected while the operational tables are empty and should be reassessed after representative traffic rather than removed immediately. The security advisor reports only the intentional anonymous public-read warnings for the published projection; no operational table is included in those warnings.

The four guarded admin write RPCs for staging, publishing, rollback, and review intentionally remain authenticated `SECURITY DEFINER` functions. Public and anonymous execution is revoked; each has an empty `search_path`, disables caller RLS only inside the guarded transaction, and repeats an admin-or-service-role authorization check. Supabase therefore reports four expected authenticated-definer warnings. Public pack and entity-suggestion RPCs remain `SECURITY INVOKER`. The foreign-key indexes reported immediately after the activation migration were added before rollout.

The advisor also reports anonymous-sign-in warnings whose matched text is stored policy metadata inside private backup schemas. Those are snapshot false positives rather than enabled authentication behavior. The v11 checkpoint additionally produces informational `RLS enabled, no policy` notices by design: its schema is unavailable to public, anonymous, and authenticated roles, and the immutable tables intentionally have no public policies. Older private checkpoint schemas still produce generic disabled-RLS findings even though direct privilege checks confirm that anonymous and authenticated roles cannot use those schemas. Do not alter retained recovery checkpoints automatically; decide separately whether to enable RLS or retire each checkpoint after its retention window. Backup snapshot tables intentionally have no primary keys and account for most informational performance notices; they are recovery copies, not query-serving application tables.

The admin review write RPC intentionally remains an authenticated `SECURITY DEFINER` function because direct decision-table inserts are revoked and decision plus candidate status must commit atomically. It has an empty `search_path`, explicit authenticated-only execution, non-null/non-anonymous identity checks, and an internal admin-role check. The candidate-list and review-summary RPCs use `SECURITY INVOKER` so reads continue through table grants and RLS.

## Rollback without deletion

Do not drop the new tables or delete Thailand data as the first rollback action.

1. Set `VITE_TRAVEL_KNOWLEDGE_REMOTE_ENABLED=false` and redeploy so all reads use the bundled pack while investigating.
2. For a prior published artifact, dry-run `pnpm travel-knowledge:activate-artifact -- --rollback <artifact-id> --country TH --reason <reason>`.
3. Execute only after verifying the target checksum, using `TRAVEL_KNOWLEDGE_WRITE_MODE=activate_artifact_only` and `--execute`.
4. Leave the additive schema and immutable artifacts in place; rollback switches the pointer and writes a ledger row without deleting data.
5. Restore the private backup only if an unrelated pre-existing object was unexpectedly changed and the impact has been reviewed.
