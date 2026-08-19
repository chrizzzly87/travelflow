# Destination ingestion runbook

This runbook is the source of truth for refreshing destination source data and curated guides. The detailed source assessment lives in `DESTINATION_DATA_RESEARCH_2026-08-17.md`; the future hierarchy design lives in `DESTINATION_MODEL_V2_PLAN.md`.

## Data layers

| Layer | Purpose | Public |
| --- | --- | --- |
| `destination_source_records` and versions | Auditable source snapshots | No |
| `destination_country_profiles` | Normalized, queryable country facts | Yes |
| `destination_referral_links` | Canonical referral attribution | Yes |
| `destination_guides` | Curated country, city, and island guides | Yes |
| `destination_content_overrides` | Persistent editorial draft/published patches | Published only |
| `destination_import_runs` | Crawl and import operations | No |

## Refresh an authorized source

Run from a configured TravelFlow worktree. If environment files are absent, run `pnpm worktree:sync-env` first.

```bash
uv run --with 'scrapling[fetchers]' python scripts/crawl-atobeach-countries.py --authorized --output /tmp/atobeach-countries.json
pnpm tsx scripts/import-atobeach-country-sources.ts --input /tmp/atobeach-countries.json
pnpm tsx scripts/import-atobeach-country-sources.ts --input /tmp/atobeach-countries.json --apply
```

The preview exits with status 2 by design. Do not apply until totals, failures, referral classification, removed tracking keys, and hashes are credible.

## Refresh curated guides

```bash
pnpm tsx scripts/validate-destination-guides.ts
pnpm tsx scripts/sync-destination-guides.ts --apply
```

Guide imports must not touch `destination_content_overrides`. Editors work against stable target IDs, and the public endpoint deep-merges published patches over the latest imported base record.

## Publishing destination changes is a two-step job

**The public API reads from Supabase, not from the repo.** `netlify/edge-functions/destinations.ts` resolves:

| Response part | Supabase table | Populated by |
| --- | --- | --- |
| the guide itself | `destination_guides` | `scripts/sync-destination-guides.ts` |
| `?include=source-profile` ("Practical destination information") | `destination_country_profiles` | the AtoBeach crawl + `scripts/import-atobeach-country-sources.ts` |

`data/destinationGuides.json` only feeds client rendering and the build. **Regenerating it with `pnpm destinations:import` and merging to `main` does not make a new country available through the API.**

That gap is exactly what happened on 2026-08-19: China and Taiwan guides were generated, merged and rendering client-side, yet `/api/destinations/taiwan` still returned `{"ok":false,"error":"Destination country not found"}` in production because the Supabase sync had never run. In the same check, **every** country returned `sourceProfile: ABSENT` — the crawl had never been imported at all.

### Definition of done when destination coverage changes

1. `pnpm destinations:import` — regenerate `data/destinationGuides.json`
2. `pnpm destinations:validate`
3. `pnpm tsx scripts/sync-destination-guides.ts --apply` — publish guides to Supabase (additive: `merge-duplicates`, never deletes)
4. Refresh source profiles when the source data changed (see "Refresh an authorized source" above)
5. **Verify against the live API, not the page.** A country page returns HTTP 200 and renders from local JSON whether or not Supabase knows about it, so a 200 proves nothing:

```bash
curl -s "https://travelflowapp.netlify.app/api/destinations/<slug>?include=source-profile" | head -c 200
```

Expect a JSON body containing `data`, and `sourceProfile` when the profile exists. An HTML body means you are looking at a deploy without edge functions — see `NETLIFY_FEATURE_BRANCH_DEPLOY.md`.

Both sync scripts require `SUPABASE_SERVICE_ROLE_KEY` and `VITE_SUPABASE_URL` (or `SUPABASE_URL`). They write to the **production** database — treat them as a release step, not a local experiment.

## Verification checklist

- Every source-derived row retains provider, `origin_url`, retrieval time, and source hash.
- Canonical referral URLs contain no known tracking parameters; referral/provider/removed-key metadata remains queryable.
- Raw payloads and import runs are not readable by anonymous clients.
- Draft overrides are admin-only; published overrides appear in public responses.
- Record totals are compared with the last successful run and material changes are explained.
- Country, city, and island pages render on the feature deploy before merge.
- The admin destination list can search/filter records, save a draft, publish it, and reset it.

## Extending the hierarchy

Use stable typed places rather than overloading `city`. The planned hierarchy is `country -> region -> island/city -> district -> neighbourhood`. Islands can contain cities; cities and islands can both contain districts and neighbourhoods. Keep canonical route slugs English-only and store localized labels and aliases separately.
