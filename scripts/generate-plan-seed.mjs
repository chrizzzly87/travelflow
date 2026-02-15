import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const { PLAN_CATALOG, PLAN_ORDER } = await import('../config/planCatalog.ts');

const sqlEscape = (value) => String(value).replace(/'/g, "''");

const toPriceCents = (value) => Math.round(Number(value) * 100);
const DB_UNLIMITED_TRIPS_SENTINEL = 2147483647;

const toMaxTripsSeedValue = (maxActiveTrips) =>
    maxActiveTrips === null ? DB_UNLIMITED_TRIPS_SENTINEL : maxActiveTrips;

const rows = PLAN_ORDER.map((key) => {
    const plan = PLAN_CATALOG[key];
    const entitlements = JSON.stringify(plan.entitlements);
    return `(
  '${sqlEscape(plan.key)}',
  '${sqlEscape(plan.publicName)}',
  ${toPriceCents(plan.monthlyPriceUsd)},
  ${toMaxTripsSeedValue(plan.entitlements.maxActiveTrips)},
  '${sqlEscape(entitlements)}'::jsonb,
  ${plan.sortOrder},
  true
)`;
});

const sql = `-- Generated from config/planCatalog.ts
-- Do not edit manually.

insert into public.plans (
  key,
  name,
  price_cents,
  max_trips,
  entitlements,
  sort_order,
  is_active
)
values
${rows.join(',\n')}
on conflict (key) do update
set
  name = excluded.name,
  price_cents = excluded.price_cents,
  max_trips = excluded.max_trips,
  entitlements = excluded.entitlements,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active;
`;

const outputPath = path.resolve(repoRoot, 'docs/plan-seed.generated.sql');
await fs.writeFile(outputPath, sql, 'utf8');
console.log(`Wrote ${path.relative(repoRoot, outputPath)}`);
