import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(path.resolve(process.cwd(), 'docs/supabase.sql'), 'utf8');
const operationalTables = [
  'travel_source_runs',
  'travel_source_snapshots',
  'travel_change_candidates',
  'travel_review_decisions',
  'travel_dataset_artifacts',
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

  it('makes raw snapshots and review decisions append-only for authenticated admins', () => {
    expect(sql).toContain('"Travel operations admin read"');
    expect(sql).toContain('"Travel operations admin insert"');
    expect(sql).toContain('grant select, insert on table\n  public.travel_source_snapshots,\n  public.travel_review_decisions\nto authenticated;');
  });
});
