import fs from 'node:fs/promises';
import path from 'node:path';

const UPDATES_DIR = path.resolve(process.cwd(), 'content/updates');
const FRONTMATTER_REGEX = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;
const ITEM_REGEX = /^\s*-\s+\[(x|X| )\]\s+\[[^\]]+\]\s+.+$/;

const REQUIRED_FIELDS = [
  'id',
  'version',
  'title',
  'date',
  'published_at',
  'status',
  'notify_in_app',
  'in_app_hours',
  'summary',
];

const stripQuotes = (value) => {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
};

const parseFrontmatter = (raw) => {
  const normalized = raw.replace(/\r\n/g, '\n');
  const match = normalized.match(FRONTMATTER_REGEX);
  if (!match) {
    return null;
  }

  const meta = {};
  for (const line of match[1].split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf(':');
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim().toLowerCase();
    const value = stripQuotes(trimmed.slice(separator + 1));
    meta[key] = value;
  }

  return { meta, body: match[2] };
};

const isValidDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`));
const isValidDateTime = (value) => Number.isFinite(Date.parse(value));
const isValidVersion = (value) => /^v?\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(value);
const PUBLISHED_AT_MAX_UTC_HOUR_EXCLUSIVE = 23;
const STRICT_CANONICAL_VERSION_SEQUENCE = process.env.UPDATES_VALIDATE_STRICT_CANONICAL === '1';
const parseVersionCore = (version) => {
  const normalized = version.trim().replace(/^v/i, '');
  const core = normalized.split(/[-+]/)[0];
  const [majorRaw, minorRaw, patchRaw] = core.split('.');
  const major = Number(majorRaw);
  const minor = Number(minorRaw);
  const patch = Number(patchRaw);

  if (!Number.isInteger(major) || !Number.isInteger(minor) || !Number.isInteger(patch)) {
    return null;
  }

  return { major, minor, patch };
};

const compareVersionCore = (a, b) => {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  return a.patch - b.patch;
};

const canonicalPublishedVersionForIndex = (index) => `v0.${index}.0`;

const validateFile = async (filePath) => {
  const raw = await fs.readFile(filePath, 'utf8');
  const parsed = parseFrontmatter(raw);
  const errors = [];

  if (!parsed) {
    errors.push('missing or invalid frontmatter block');
    return errors;
  }

  const { meta, body } = parsed;

  for (const field of REQUIRED_FIELDS) {
    if (!(field in meta) || String(meta[field]).trim().length === 0) {
      errors.push(`missing required field: ${field}`);
    }
  }

  if (meta.date && !isValidDate(meta.date)) {
    errors.push(`invalid date format (expected YYYY-MM-DD): ${meta.date}`);
  }

  if (meta.version && !isValidVersion(meta.version)) {
    errors.push(`invalid version format (expected semver): ${meta.version}`);
  }

  if (meta.published_at && !isValidDateTime(meta.published_at)) {
    errors.push(`invalid published_at datetime: ${meta.published_at}`);
  }
  if (meta.published_at && isValidDateTime(meta.published_at)) {
    const publishedAtDate = new Date(meta.published_at);
    const publishedAtMs = publishedAtDate.getTime();
    const status = (meta.status || '').trim().toLowerCase();

    if (publishedAtDate.getUTCHours() >= PUBLISHED_AT_MAX_UTC_HOUR_EXCLUSIVE) {
      errors.push(`published_at must be before 23:00 UTC: ${meta.published_at}`);
    }

    if (status === 'published' && publishedAtMs > Date.now() + 60_000) {
      errors.push(`published_at cannot be in the future for published releases: ${meta.published_at}`);
    }
  }

  if (meta.status && !['published', 'draft'].includes(meta.status.trim().toLowerCase())) {
    errors.push(`invalid status (expected published|draft): ${meta.status}`);
  }

  if (meta.notify_in_app && !['true', 'false', 'yes', 'no', '1', '0'].includes(meta.notify_in_app.trim().toLowerCase())) {
    errors.push(`invalid notify_in_app (expected true|false): ${meta.notify_in_app}`);
  }

  if (meta.in_app_hours) {
    const hours = Number(meta.in_app_hours);
    if (!Number.isFinite(hours) || hours <= 0) {
      errors.push(`invalid in_app_hours (expected positive number): ${meta.in_app_hours}`);
    }
  }

  const itemLines = body
    .split(/\r?\n/)
    .filter((line) => line.trim().startsWith('- '));

  if (itemLines.length === 0) {
    errors.push('at least one release item is required');
  }

  for (const line of itemLines) {
    if (!ITEM_REGEX.test(line)) {
      errors.push(`invalid release item format: ${line.trim()}`);
    }
  }

  return errors;
};

const main = async () => {
  const entries = await fs.readdir(UPDATES_DIR, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => path.join(UPDATES_DIR, entry.name))
    .sort((a, b) => a.localeCompare(b));

  if (files.length === 0) {
    console.error('No markdown files found in content/updates');
    process.exit(1);
  }

  let hasErrors = false;
  let hasWarnings = false;
  const parsedByFile = [];

  for (const file of files) {
    const errors = await validateFile(file);
    const raw = await fs.readFile(file, 'utf8');
    const parsed = parseFrontmatter(raw);
    if (parsed?.meta) {
      parsedByFile.push({
        file,
        meta: parsed.meta,
      });
    }
    if (errors.length === 0) continue;

    hasErrors = true;
    const relative = path.relative(process.cwd(), file);
    console.error(`\n[updates:validate] ${relative}`);
    for (const error of errors) {
      console.error(`  - ${error}`);
    }
  }

  const publishedVersionToFiles = new Map();
  for (const entry of parsedByFile) {
    const status = String(entry.meta.status || '').trim().toLowerCase();
    if (status !== 'published') continue;
    const version = String(entry.meta.version || '').trim();
    if (!version) continue;
    const list = publishedVersionToFiles.get(version) || [];
    list.push(entry.file);
    publishedVersionToFiles.set(version, list);
  }

  for (const [version, matchingFiles] of publishedVersionToFiles.entries()) {
    if (matchingFiles.length <= 1) continue;
    hasErrors = true;
    console.error(`\n[updates:validate] duplicate published version detected: ${version}`);
    for (const file of matchingFiles) {
      console.error(`  - ${path.relative(process.cwd(), file)}`);
    }
  }

  const publishedReleases = parsedByFile
    .filter((entry) => String(entry.meta.status || '').trim().toLowerCase() === 'published')
    .map((entry) => ({
      file: entry.file,
      version: String(entry.meta.version || '').trim(),
      publishedAt: String(entry.meta.published_at || '').trim(),
    }))
    .filter((entry) => entry.version && entry.publishedAt)
    .sort((a, b) => Date.parse(a.publishedAt) - Date.parse(b.publishedAt));

  for (let i = 1; i < publishedReleases.length; i += 1) {
    const prev = publishedReleases[i - 1];
    const curr = publishedReleases[i];
    const prevVersion = parseVersionCore(prev.version);
    const currVersion = parseVersionCore(curr.version);
    if (!prevVersion || !currVersion) continue;

    if (compareVersionCore(currVersion, prevVersion) <= 0) {
      hasErrors = true;
      console.error('\n[updates:validate] published versions must strictly increase over time');
      console.error(`  - Older: ${path.relative(process.cwd(), prev.file)} (${prev.version} @ ${prev.publishedAt})`);
      console.error(`  - Newer: ${path.relative(process.cwd(), curr.file)} (${curr.version} @ ${curr.publishedAt})`);
    }
  }

  for (let i = 0; i < publishedReleases.length; i += 1) {
    const release = publishedReleases[i];
    const expectedVersion = canonicalPublishedVersionForIndex(i + 1);
    if (release.version === expectedVersion) continue;

    const log = STRICT_CANONICAL_VERSION_SEQUENCE ? console.error : console.warn;
    if (STRICT_CANONICAL_VERSION_SEQUENCE) {
      hasErrors = true;
    } else {
      hasWarnings = true;
    }
    log('\n[updates:validate] published versions should be canonical and gapless by published_at timestamp');
    log(`  - File: ${path.relative(process.cwd(), release.file)} (${release.publishedAt})`);
    log(`  - Found: ${release.version}`);
    log(`  - Expected: ${expectedVersion}`);
    if (!STRICT_CANONICAL_VERSION_SEQUENCE) {
      log('  - Result: warning only (set UPDATES_VALIDATE_STRICT_CANONICAL=1 to fail on this rule)');
    }
  }

  if (hasErrors) {
    process.exit(1);
  }

  if (hasWarnings) {
    console.warn('[updates:validate] completed with warnings');
  }
  console.log(`[updates:validate] validated ${files.length} update file(s)`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
