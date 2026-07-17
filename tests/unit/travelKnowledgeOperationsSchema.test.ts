import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(path.resolve(process.cwd(), 'docs/supabase.sql'), 'utf8');
const activationCli = readFileSync(
  path.resolve(process.cwd(), 'scripts/activate-travel-knowledge-artifact.ts'),
  'utf8',
);
const operationalTables = [
  'travel_source_runs',
  'travel_source_snapshots',
  'travel_change_candidates',
  'travel_review_decisions',
  'travel_dataset_artifacts',
  'travel_dataset_payloads',
  'travel_active_datasets',
  'travel_dataset_activations',
];

describe('travel knowledge operations schema', () => {
  it('defines every operational history table with RLS', () => {
    for (const table of operationalTables) {
      expect(sql).toContain(`create table if not exists public.${table}`);
      expect(sql).toContain(`alter table public.${table} enable row level security;`);
    }
  });

  it('keeps operational history out of anonymous grants and the public pack RPC', () => {
    const revokeStart = sql.indexOf('revoke all on table\n  public.travel_source_runs');
    const publicGrantStart = sql.indexOf('grant select on table\n  public.travel_sources', revokeStart);
    const operationsAccessBlock = sql.slice(revokeStart, publicGrantStart);
    expect(revokeStart).toBeGreaterThan(-1);
    expect(operationsAccessBlock).toContain('from public, anon, authenticated;');
    expect(operationsAccessBlock).toContain('to service_role;');

    const packFunctionStart = sql.indexOf('create or replace function public.get_travel_destination_pack');
    const packFunctionEnd = sql.indexOf('grant execute on function public.get_travel_destination_pack', packFunctionStart);
    const packFunction = sql.slice(packFunctionStart, packFunctionEnd);
    for (const table of operationalTables) expect(packFunction).not.toContain(table);
  });

  it('keeps raw snapshots append-only and review decisions atomic', () => {
    expect(sql).toContain('"Travel operations admin read"');
    expect(sql).toContain('"Travel operations admin insert"');
    expect(sql).toContain('grant select, insert on table\n  public.travel_source_snapshots\nto authenticated;');
    expect(sql).toContain('grant select on table\n  public.travel_review_decisions\nto authenticated;');
    expect(sql).not.toContain('grant select, insert on table\n  public.travel_review_decisions');
    expect(sql).toContain('create or replace function public.admin_review_travel_knowledge_candidate');
    expect(sql).toContain("if v_candidate.status not in ('new', 'needs_review') then");
    expect(sql).toContain("when p_decision in ('accept', 'accept_with_edit') then 'accepted'");
    expect(sql).toContain('for update;');
  });

  it('exposes admin-only review reads without publishing candidate data', () => {
    expect(sql).toContain('create or replace function public.admin_list_travel_knowledge_candidates');
    expect(sql).toContain('create or replace function public.admin_get_travel_knowledge_review_summary');
    expect(sql).toContain('or not public.is_admin(v_uid) then');
    expect(sql).toContain('revoke all on function public.admin_list_travel_knowledge_candidates');
    expect(sql).toContain('grant execute on function public.admin_review_travel_knowledge_candidate');
    const listFunctionStart = sql.indexOf('create or replace function public.admin_list_travel_knowledge_candidates');
    const summaryFunctionStart = sql.indexOf('create or replace function public.admin_get_travel_knowledge_review_summary');
    const reviewFunctionStart = sql.indexOf('create or replace function public.admin_review_travel_knowledge_candidate');
    expect(sql.slice(listFunctionStart, summaryFunctionStart)).toContain('security invoker');
    expect(sql.slice(summaryFunctionStart, reviewFunctionStart)).toContain('security invoker');
    expect(sql.slice(reviewFunctionStart, sql.indexOf('revoke all on function', reviewFunctionStart))).toContain('security definer');
  });

  it('creates a conflict-checked private snapshot bucket with defense-in-depth denial', () => {
    expect(sql).toContain("values ('travel-knowledge-snapshots', 'travel-knowledge-snapshots', false, 52428800)");
    expect(sql).toContain("raise exception 'Conflicting travel-knowledge-snapshots bucket configuration'");
    expect(sql).toContain('create policy "Travel knowledge bucket deny non-service access"');
    expect(sql).toContain('create policy "Travel knowledge objects deny non-service access"');
    expect(sql).not.toContain('bucket_id = \'travel-knowledge-snapshots\'');
  });

  it('stages immutable payloads and switches active versions atomically', () => {
    expect(sql).toContain('create or replace function public.admin_stage_travel_dataset_artifact');
    expect(sql).toContain('create or replace function public.admin_publish_travel_dataset_artifact');
    expect(sql).toContain('create or replace function public.admin_rollback_travel_dataset');
    expect(sql).toContain("perform pg_advisory_xact_lock(hashtextextended('travel-dataset:'");
    expect(sql).toContain("set status = 'superseded', superseded_at = v_activated_at");
    expect(sql).toContain("set status = 'rolled_back', rolled_back_at = v_activated_at");
    expect(sql).toContain('where previous_payload.dataset_version_id = v_previous.dataset_version_id;');
    expect(sql).toContain('where current_payload.dataset_version_id = v_current.dataset_version_id;');
    expect(sql).toContain("action in ('publish', 'rollback')");
    expect(sql).toContain('on conflict on constraint travel_active_datasets_pkey do update');
    expect(sql).toContain('revoke insert, update, delete on table public.travel_dataset_versions from authenticated;');
  });

  it('disambiguates the artifact dataset relationship before activation', () => {
    expect(activationCli).toContain(
      'travel_dataset_versions!travel_dataset_artifacts_dataset_version_id_fkey!inner',
    );
  });

  it('serves only the active immutable payload with normalized-table fallback', () => {
    const activePackStart = sql.indexOf('create or replace function public.get_active_travel_destination_pack');
    const activeSearchStart = sql.indexOf('create or replace function public.get_active_travel_entity_suggestions');
    const activePackFunction = sql.slice(activePackStart, activeSearchStart);
    expect(activePackStart).toBeGreaterThan(-1);
    expect(activePackFunction).toContain('security invoker');
    expect(activePackFunction).toContain('public.travel_active_datasets');
    expect(activePackFunction).toContain('public.travel_dataset_payloads');
    expect(activePackFunction).toContain('public.get_travel_destination_pack(p_country_code, p_locale)');
    const activeSearchFunction = sql.slice(activeSearchStart, sql.indexOf('revoke all on function', activeSearchStart));
    expect(activeSearchFunction).toContain('public.get_travel_entity_suggestions(');
    expect(activeSearchFunction).toContain('where not exists (select 1 from active_entities)');
    expect(sql).toContain('grant execute on function public.get_active_travel_destination_pack');
  });

  it('projects bounded planning contexts from the public active pack without exposing operations data', () => {
    const contextStart = sql.indexOf('create or replace function public.get_active_travel_planning_context');
    const contextEnd = sql.indexOf('revoke all on function public.get_active_travel_destination_pack', contextStart);
    const contextFunction = sql.slice(contextStart, contextEnd);

    expect(contextStart).toBeGreaterThan(-1);
    expect(contextFunction).toContain('security invoker');
    expect(contextFunction).toContain("'retrieverVersion', 'structured-pack-v2'");
    expect(contextFunction).toContain('public.get_active_travel_destination_pack');
    expect(contextFunction).toContain('requested.neighborhood_limit');
    expect(contextFunction).toContain('requested.poi_limit');
    expect(contextFunction).not.toContain('travel_source_snapshots');
    expect(contextFunction).not.toContain('travel_change_candidates');
    expect(sql).toContain('grant execute on function public.get_active_travel_planning_context');
  });
});
