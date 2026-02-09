import fs from 'node:fs/promises';
import path from 'node:path';

const BLOG_DIR = path.resolve(process.cwd(), 'content/blog');
const FRONTMATTER_REGEX = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;

const REQUIRED_FIELDS = [
  'slug',
  'title',
  'date',
  'published_at',
  'author',
  'tags',
  'summary',
  'cover_color',
  'reading_time_min',
  'status',
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

  if (meta.published_at && !isValidDateTime(meta.published_at)) {
    errors.push(`invalid published_at datetime: ${meta.published_at}`);
  }

  if (meta.status && !['published', 'draft'].includes(meta.status.trim().toLowerCase())) {
    errors.push(`invalid status (expected published|draft): ${meta.status}`);
  }

  if (meta.reading_time_min) {
    const mins = Number(meta.reading_time_min);
    if (!Number.isFinite(mins) || mins <= 0) {
      errors.push(`invalid reading_time_min (expected positive number): ${meta.reading_time_min}`);
    }
  }

  const bodyContent = body.trim();
  if (bodyContent.length === 0) {
    errors.push('blog post body content is empty');
  }

  return errors;
};

const main = async () => {
  let entries;
  try {
    entries = await fs.readdir(BLOG_DIR, { withFileTypes: true });
  } catch {
    console.log('[blog:validate] No content/blog directory found — skipping');
    return;
  }

  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => path.join(BLOG_DIR, entry.name))
    .sort((a, b) => a.localeCompare(b));

  if (files.length === 0) {
    console.log('[blog:validate] No blog posts found — skipping');
    return;
  }

  let hasErrors = false;
  const slugs = new Map();

  for (const file of files) {
    const errors = await validateFile(file);
    const raw = await fs.readFile(file, 'utf8');
    const parsed = parseFrontmatter(raw);

    if (parsed?.meta?.slug) {
      const slug = String(parsed.meta.slug).trim();
      const list = slugs.get(slug) || [];
      list.push(file);
      slugs.set(slug, list);
    }

    if (errors.length === 0) continue;

    hasErrors = true;
    const relative = path.relative(process.cwd(), file);
    console.error(`\n[blog:validate] ${relative}`);
    for (const error of errors) {
      console.error(`  - ${error}`);
    }
  }

  for (const [slug, matchingFiles] of slugs.entries()) {
    if (matchingFiles.length <= 1) continue;
    hasErrors = true;
    console.error(`\n[blog:validate] duplicate slug detected: ${slug}`);
    for (const file of matchingFiles) {
      console.error(`  - ${path.relative(process.cwd(), file)}`);
    }
  }

  if (hasErrors) {
    process.exit(1);
  }

  console.log(`[blog:validate] validated ${files.length} blog post(s)`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
