import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(new URL('../../docs/supabase.sql', import.meta.url), 'utf8');

describe('trip upsert concurrency schema', () => {
  it('serializes both active upsert overloads before checking whether a trip exists', () => {
    const functionStarts = [
      ...sql.matchAll(/create or replace function public\.upsert_trip\(/g),
    ].map((match) => match.index);
    const lockStatement = "perform pg_advisory_xact_lock(hashtextextended('trip-upsert:' || coalesce(p_id, ''), 0));";

    expect(functionStarts.length).toBeGreaterThanOrEqual(2);

    for (const functionStart of functionStarts.slice(-2)) {
      const functionEnd = sql.indexOf('\n$$;', functionStart);
      const functionSql = sql.slice(functionStart, functionEnd);

      expect(functionEnd).toBeGreaterThan(functionStart);
      expect(functionSql).toContain(lockStatement);
      expect(functionSql.indexOf(lockStatement)).toBeLessThan(
        functionSql.indexOf('if exists (select 1 from public.trips t where t.id = p_id) then'),
      );
    }
  });
});
