import destinationGuidesJson from '../data/destinationGuides.json';
import type { DestinationGuideDocument } from '../shared/destinationGuides';

const document = destinationGuidesJson as DestinationGuideDocument;
const shouldApply = process.argv.includes('--apply');
const supabaseUrl = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim().replace(/\/$/, '');
const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

if (!shouldApply) {
  console.error('Refusing to write destination guides without --apply.');
  process.exit(2);
}
if (!supabaseUrl || !serviceRoleKey) {
  console.error('SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY are required.');
  process.exit(2);
}

const rows = document.guides.map((guide) => ({
  id: guide.id,
  slug: guide.slug,
  kind: guide.kind,
  country_code: guide.countryCode,
  parent_id: guide.parentSlug ? `country:${guide.parentSlug}` : null,
  name: guide.name,
  region: guide.region,
  priority_rank: guide.priorityRank || null,
  source_updated_at: guide.sourceUpdatedAt,
  reviewed_at: guide.reviewedAt,
  payload: guide,
}));

for (let index = 0; index < rows.length; index += 100) {
  const batch = rows.slice(index, index + 100);
  const response = await fetch(`${supabaseUrl}/rest/v1/destination_guides?on_conflict=id`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(batch),
  });
  if (!response.ok) {
    throw new Error(`Destination guide sync failed at row ${index}: ${response.status} ${await response.text()}`);
  }
}

console.log(`Synced ${rows.length} destination guides without deleting existing rows.`);

