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
const FIX_MODE = process.argv.includes('--fix');
// Parallel worktrees each stamp their own release note, so a published_at a few
// minutes ahead of the build machine's clock is ordinary drift, not a mistake.
// It downgrades to a warning inside this window and `--fix` clamps it; a date
// genuinely typed wrong (next month, next year) still fails the build.
const FUTURE_PUBLISHED_AT_GRACE_MS = 24 * 60 * 60 * 1_000;
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

const formatVersion = ({ major, minor, patch }) => `v${major}.${minor}.${patch}`;

/** Matches scripts/next-release-version.mjs: a .0 release opens the next minor. */
const bumpVersionCore = ({ major, minor, patch }) => (
  patch === 0 ? { major, minor: minor + 1, patch: 0 } : { major, minor, patch: patch + 1 }
);

/**
 * The newest timestamp a published release may carry on this machine: now,
 * truncated to the minute, pulled back to 22:59 when now falls in the hour the
 * site renders as the next day in CET.
 */
const latestUsablePublishedAt = (nowMs = Date.now()) => {
  const stamp = new Date(Math.floor(nowMs / 60_000) * 60_000);
  if (stamp.getUTCHours() >= PUBLISHED_AT_MAX_UTC_HOUR_EXCLUSIVE) {
    stamp.setUTCHours(PUBLISHED_AT_MAX_UTC_HOUR_EXCLUSIVE - 1, 59, 0, 0);
  }
  return stamp.toISOString().replace(/\.\d{3}Z$/, 'Z');
};

/** Rewrites one frontmatter key in place, leaving the rest of the file untouched. */
const replaceFrontmatterValue = (raw, key, value) => {
  const normalized = raw.replace(/\r\n/g, '\n');
  const match = normalized.match(FRONTMATTER_REGEX);
  if (!match) return normalized;
  const pattern = new RegExp(`^(\\s*${key}\\s*:).*$`, 'm');
  const block = match[1];
  if (!pattern.test(block)) return normalized;
  return normalized.replace(block, block.replace(pattern, `$1 ${value}`));
};

const validateFile = async (filePath) => {
  const raw = await fs.readFile(filePath, 'utf8');
  const parsed = parseFrontmatter(raw);
  const errors = [];
  const warnings = [];

  if (!parsed) {
    errors.push('missing or invalid frontmatter block');
    return { errors, warnings };
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
      const aheadBy = publishedAtMs - Date.now();
      if (aheadBy > FUTURE_PUBLISHED_AT_GRACE_MS) {
        errors.push(`published_at is more than a day in the future for a published release: ${meta.published_at}`);
      } else {
        warnings.push(`published_at is ahead of this machine's clock by ${Math.ceil(aheadBy / 60_000)} min: ${meta.published_at} (run \`pnpm updates:fix\`)`);
      }
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

  return { errors, warnings };
};

/**
 * Resolves the two collisions that parallel worktrees produce on their own: a
 * published_at stamped slightly ahead of the clock, and a version another
 * branch published first. Both have exactly one correct answer, so `--fix`
 * writes it instead of bouncing the build back at whoever merged second.
 */
const applyAutoFixes = async (files) => {
  const changes = [];
  const ceiling = latestUsablePublishedAt();
  const ceilingMs = Date.parse(ceiling);
  const edited = new Map();
  const entries = [];

  for (const file of files) {
    const raw = await fs.readFile(file, 'utf8');
    const parsed = parseFrontmatter(raw);
    if (!parsed?.meta) continue;
    entries.push({ file, meta: parsed.meta, raw });
  }

  const isPublished = (entry) => String(entry.meta.status || '').trim().toLowerCase() === 'published';
  const label = (entry) => path.relative(process.cwd(), entry.file);

  for (const entry of entries) {
    if (!isPublished(entry)) continue;
    const value = String(entry.meta.published_at || '').trim();
    if (!value || !isValidDateTime(value) || Date.parse(value) <= ceilingMs) continue;
    entry.raw = replaceFrontmatterValue(entry.raw, 'published_at', ceiling);
    entry.meta.published_at = ceiling;
    edited.set(entry.file, entry);
    changes.push(`${label(entry)}: published_at ${value} -> ${ceiling}`);
  }

  const published = entries
    .filter((entry) => (
      isPublished(entry)
      && parseVersionCore(String(entry.meta.version || ''))
      && isValidDateTime(String(entry.meta.published_at || ''))
    ))
    .sort((a, b) => Date.parse(a.meta.published_at) - Date.parse(b.meta.published_at));

  let highest = null;
  for (const entry of published) {
    const current = parseVersionCore(String(entry.meta.version));
    if (highest && compareVersionCore(current, highest) <= 0) {
      const next = bumpVersionCore(highest);
      const nextLabel = formatVersion(next);
      changes.push(`${label(entry)}: version ${String(entry.meta.version).trim()} -> ${nextLabel}`);
      entry.raw = replaceFrontmatterValue(entry.raw, 'version', nextLabel);
      entry.meta.version = nextLabel;
      edited.set(entry.file, entry);
      highest = next;
      continue;
    }
    highest = current;
  }

  for (const entry of edited.values()) {
    await fs.writeFile(entry.file, entry.raw, 'utf8');
  }

  return changes;
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

  if (FIX_MODE) {
    const changes = await applyAutoFixes(files);
    if (changes.length === 0) {
      console.log('[updates:fix] nothing to change');
    } else {
      console.log('[updates:fix] applied:');
      for (const change of changes) {
        console.log(`  - ${change}`);
      }
    }
  }

  for (const file of files) {
    const { errors, warnings } = await validateFile(file);
    const raw = await fs.readFile(file, 'utf8');
    const parsed = parseFrontmatter(raw);
    if (parsed?.meta) {
      parsedByFile.push({
        file,
        meta: parsed.meta,
      });
    }

    const relative = path.relative(process.cwd(), file);

    if (warnings.length > 0) {
      hasWarnings = true;
      console.warn(`\n[updates:validate] ${relative}`);
      for (const warning of warnings) {
        console.warn(`  - ${warning}`);
      }
    }

    if (errors.length === 0) continue;

    hasErrors = true;
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
    console.error('  - Run `pnpm updates:fix` to renumber the later release.');
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
      console.error('  - Run `pnpm updates:fix` to renumber the later release.');
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
