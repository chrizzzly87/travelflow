import fs from 'node:fs/promises';
import path from 'node:path';

const UPDATES_DIR = path.resolve(process.cwd(), 'content/updates');
const FRONTMATTER_REGEX = /^---\n([\s\S]*?)\n---\n?/;

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
  if (!match) return null;

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
  return meta;
};

const parseVersionCore = (version) => {
  const normalized = String(version || '').trim().replace(/^v/i, '');
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

const formatVersion = ({ major, minor, patch }) => `v${major}.${minor}.${patch}`;

const main = async () => {
  const entries = await fs.readdir(UPDATES_DIR, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => path.join(UPDATES_DIR, entry.name));

  const published = [];

  for (const file of files) {
    const raw = await fs.readFile(file, 'utf8');
    const meta = parseFrontmatter(raw);
    if (!meta) continue;
    if (String(meta.status || '').trim().toLowerCase() !== 'published') continue;

    const parsedVersion = parseVersionCore(meta.version);
    if (!parsedVersion) continue;

    published.push({
      file,
      version: meta.version,
      parsedVersion,
      publishedAt: meta.published_at || '',
    });
  }

  if (published.length === 0) {
    console.log('v0.1.0');
    return;
  }

  published.sort((a, b) => {
    const byVersion = compareVersionCore(a.parsedVersion, b.parsedVersion);
    if (byVersion !== 0) return byVersion;
    return Date.parse(a.publishedAt || 0) - Date.parse(b.publishedAt || 0);
  });

  const latest = published[published.length - 1];
  const next = latest.parsedVersion.patch === 0
    ? { major: latest.parsedVersion.major, minor: latest.parsedVersion.minor + 1, patch: 0 }
    : { major: latest.parsedVersion.major, minor: latest.parsedVersion.minor, patch: latest.parsedVersion.patch + 1 };

  const nextVersion = formatVersion(next);
  const latestFile = path.relative(process.cwd(), latest.file);

  console.log(`${nextVersion}  # latest published: ${latest.version} (${latestFile})`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
