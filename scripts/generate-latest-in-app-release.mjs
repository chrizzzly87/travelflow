/**
 * Emits the one release the in-app notice can show.
 *
 * `services/releaseNotesService.ts` bundles every file in `content/updates/`
 * through an eager `import.meta.glob` — 204 notes, a 444 KB chunk. The trip view
 * renders `ReleaseNoticeDialog` on every visit, so opening a trip downloaded the
 * whole release history to decide whether one notice was due.
 *
 * The parser here mirrors `releaseNotesService.ts`. That duplication is checked:
 * `tests/unit/latestInAppRelease.test.ts` compares this output against the real
 * service and fails if they disagree or if the checked-in file is stale.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const updatesDir = path.join(projectRoot, 'content', 'updates');

const FRONTMATTER_REGEX = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;
const RELEASE_ITEM_REGEX = /^\s*-\s+\[(x|X| )\]\s+\[([^\]]+)\]\s+(.+)$/;
const ITEM_TYPE_ORDER = { new: 0, improved: 1, fixed: 2, update: 3, internal: 4 };

const stripQuotes = (value) => {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
};

const parseFrontmatter = (raw) => {
  const match = raw.match(FRONTMATTER_REGEX);
  if (!match) return null;
  const fields = {};
  for (const line of match[1].split('\n')) {
    const separator = line.indexOf(':');
    if (separator === -1) continue;
    fields[line.slice(0, separator).trim()] = stripQuotes(line.slice(separator + 1));
  }
  return { fields, body: match[2] };
};

const resolveTypeKey = (typeLabel) => {
  const normalized = typeLabel.trim().toLowerCase();
  if (normalized.includes('new') || normalized.includes('feature')) return 'new';
  if (normalized.includes('improve')) return 'improved';
  if (normalized.includes('fix')) return 'fixed';
  if (normalized.includes('internal') || normalized.includes('infra') || normalized.includes('chore')) return 'internal';
  return 'update';
};

const parseItems = (body) => body
  .replace(/\r\n/g, '\n')
  .split('\n')
  .map((line) => line.match(RELEASE_ITEM_REGEX))
  .filter(Boolean)
  .map((match) => ({
    visibleOnWebsite: match[1].toLowerCase() === 'x',
    typeLabel: match[2].trim(),
    typeKey: resolveTypeKey(match[2]),
    text: match[3].trim(),
  }))
  .map((item, index) => ({ item, index }))
  .sort((a, b) => {
    const order = (ITEM_TYPE_ORDER[a.item.typeKey] ?? 99) - (ITEM_TYPE_ORDER[b.item.typeKey] ?? 99);
    return order !== 0 ? order : a.index - b.index;
  })
  .map(({ item }) => item);

export function buildLatestInAppRelease() {
  const notes = fs.readdirSync(updatesDir)
    .filter((name) => name.endsWith('.md'))
    .map((name) => {
      const sourcePath = `../content/updates/${name}`;
      const parsed = parseFrontmatter(fs.readFileSync(path.join(updatesDir, name), 'utf8'));
      if (!parsed) return null;
      const { fields, body } = parsed;
      const date = fields.date || '';
      const notifyInApp = (fields.notify_in_app ?? 'true').toLowerCase() !== 'false';
      const inAppHours = Number.parseFloat(fields.in_app_hours ?? '');
      return {
        id: fields.id || `${name.replace(/\.md$/, '')}`,
        version: fields.version || '',
        title: fields.title || '',
        date,
        summary: fields.summary || '',
        status: fields.status === 'draft' ? 'draft' : 'published',
        publishedAt: fields.published_at || (date ? `${date}T00:00:00Z` : ''),
        notifyInApp,
        inAppHours: Number.isFinite(inAppHours) ? inAppHours : 24,
        items: parseItems(body),
        sourcePath,
      };
    })
    .filter(Boolean);

  const published = notes
    .filter((note) => note.status === 'published')
    .sort((left, right) => Date.parse(right.publishedAt) - Date.parse(left.publishedAt));

  return published.find((note) => note.notifyInApp) || null;
}

export function renderLatestInAppRelease() {
  return `${JSON.stringify({
    _generated: 'Emitted by scripts/generate-latest-in-app-release.mjs — do not edit by hand.',
    release: buildLatestInAppRelease(),
  }, null, 2)}\n`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const target = path.join(projectRoot, 'data', 'latestInAppRelease.generated.json');
  fs.writeFileSync(target, renderLatestInAppRelease(), 'utf8');
  console.log(`Wrote data/latestInAppRelease.generated.json (${Math.round(fs.statSync(target).size / 1024)} KB)`);
}
