import fs from 'node:fs/promises';
import path from 'node:path';
import { COOKIE_REGISTRY, type CookieDefinition } from '../lib/legal/cookies.config';

type StorageMedium = 'localStorage' | 'sessionStorage';

interface FileConstDefinition {
  name: string;
  value: string;
  line: number;
}

interface ExpectedStorageKey {
  key: string;
  storage: StorageMedium;
  source: string;
}

interface RegistryEntry {
  name: string;
  storage: CookieDefinition['storage'];
}

const ROOT = process.cwd();
const SOURCE_TARGETS = ['App.tsx', 'i18n.ts', 'components', 'pages', 'services', 'config', 'hooks', 'lib'];
const KEY_PREFIXES = ['tf_', 'travelflow_', 'admin.', 'sb-'];
const STORAGE_CALL_PATTERN = /(?:window\.)?(localStorage|sessionStorage)\.(?:getItem|setItem|removeItem)\(\s*([^,)]+)\s*(?:,|\))/g;
const CONST_STRING_PATTERN = /\bconst\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(["'`])([^"'`]+)\2/g;

const isTsSourceFile = (filePath: string): boolean =>
  /\.(ts|tsx)$/.test(filePath) && !/(\.test\.|\.spec\.)/.test(filePath);

const hasStorageKeyPrefix = (value: string): boolean =>
  KEY_PREFIXES.some((prefix) => value.startsWith(prefix));

const normalizeLineEnding = (content: string): string =>
  content.replace(/\r\n/g, '\n');

const toLineNumber = (content: string, index: number): number =>
  normalizeLineEnding(content).slice(0, index).split('\n').length;

const trimInlineComments = (value: string): string =>
  value.replace(/\/\/.*$/, '').trim();

const parseStringLiteral = (raw: string): string | null => {
  const trimmed = trimInlineComments(raw.trim());
  if ((trimmed.startsWith("'") && trimmed.endsWith("'")) || (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
    return trimmed.slice(1, -1);
  }
  if (trimmed.startsWith('`') && trimmed.endsWith('`') && !trimmed.includes('${')) {
    return trimmed.slice(1, -1);
  }
  return null;
};

const isIdentifier = (raw: string): boolean => /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(raw.trim());

const toRegistryEntries = (): RegistryEntry[] => [
  ...COOKIE_REGISTRY.essential,
  ...COOKIE_REGISTRY.analytics,
  ...COOKIE_REGISTRY.marketing,
].map((entry) => ({
  name: entry.name,
  storage: entry.storage ?? 'cookie',
}));

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const wildcardToRegExp = (value: string): RegExp =>
  new RegExp(`^${value.split('*').map(escapeRegExp).join('.*')}$`);

const toRelative = (filePath: string): string => path.relative(ROOT, filePath);

const isStorageIdentifierConstName = (name: string): boolean =>
  name.includes('KEY') || name.includes('PREFIX');

const isAutoRegisterConstName = (name: string): boolean =>
  name.includes('STORAGE') || name.includes('CACHE') || name.includes('PREFIX');

const inferConstStorage = (
  constName: string,
  fileStorageUsage: Set<StorageMedium>,
): StorageMedium[] => {
  if (constName.includes('SESSION')) return ['sessionStorage'];
  if (constName.includes('LOCAL')) return ['localStorage'];
  if (fileStorageUsage.size > 0) return [...fileStorageUsage];
  return ['localStorage'];
};

const readFileIfExists = async (target: string): Promise<Array<{ filePath: string; content: string }>> => {
  const absolute = path.resolve(ROOT, target);
  let stat;
  try {
    stat = await fs.stat(absolute);
  } catch {
    return [];
  }

  if (stat.isFile()) {
    if (!isTsSourceFile(absolute)) return [];
    const content = await fs.readFile(absolute, 'utf8');
    return [{ filePath: absolute, content }];
  }

  if (!stat.isDirectory()) return [];

  const collected: Array<{ filePath: string; content: string }> = [];
  const entries = await fs.readdir(absolute, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(absolute, entry.name);
    if (entry.isDirectory()) {
      const nested = await readFileIfExists(path.relative(ROOT, entryPath));
      collected.push(...nested);
      continue;
    }
    if (!entry.isFile() || !isTsSourceFile(entryPath)) continue;
    const content = await fs.readFile(entryPath, 'utf8');
    collected.push({ filePath: entryPath, content });
  }
  return collected;
};

const collectSourceFiles = async (): Promise<Array<{ filePath: string; content: string }>> => {
  const buckets = await Promise.all(SOURCE_TARGETS.map((target) => readFileIfExists(target)));
  return buckets.flat();
};

const main = async () => {
  const files = await collectSourceFiles();
  const registryEntries = toRegistryEntries();
  const expected: ExpectedStorageKey[] = [];
  const unresolved: string[] = [];

  for (const { filePath, content } of files) {
    const localConstMap = new Map<string, FileConstDefinition>();
    const fileStorageUsage = new Set<StorageMedium>();
    const normalizedContent = normalizeLineEnding(content);

    for (const match of normalizedContent.matchAll(CONST_STRING_PATTERN)) {
      const [, name, , value] = match;
      if (!name || !value) continue;
      if (!hasStorageKeyPrefix(value)) continue;
      if (!isStorageIdentifierConstName(name)) continue;
      localConstMap.set(name, {
        name,
        value,
        line: toLineNumber(normalizedContent, match.index ?? 0),
      });
    }

    for (const match of normalizedContent.matchAll(STORAGE_CALL_PATTERN)) {
      const [, storageRaw, argRaw] = match;
      if (!storageRaw || !argRaw) continue;
      const storage = storageRaw as StorageMedium;
      fileStorageUsage.add(storage);
      const sourceLine = toLineNumber(normalizedContent, match.index ?? 0);
      const source = `${toRelative(filePath)}:${sourceLine}`;
      const literal = parseStringLiteral(argRaw);
      if (literal && hasStorageKeyPrefix(literal)) {
        expected.push({ key: literal, storage, source });
        continue;
      }
      if (isIdentifier(argRaw)) {
        const keyDef = localConstMap.get(argRaw.trim());
        if (keyDef && hasStorageKeyPrefix(keyDef.value)) {
          const key = keyDef.name.includes('PREFIX') ? `${keyDef.value}*` : keyDef.value;
          expected.push({ key, storage, source });
          continue;
        }
      }
      unresolved.push(`${source} -> ${trimInlineComments(argRaw.trim())}`);
    }

    for (const keyDef of localConstMap.values()) {
      if (!isAutoRegisterConstName(keyDef.name)) continue;
      const storages = inferConstStorage(keyDef.name, fileStorageUsage);
      const key = keyDef.name.includes('PREFIX') ? `${keyDef.value}*` : keyDef.value;
      storages.forEach((storage) => {
        expected.push({
          key,
          storage,
          source: `${toRelative(filePath)}:${keyDef.line}`,
        });
      });
    }
  }

  const dedupedExpected = new Map<string, ExpectedStorageKey>();
  expected.forEach((entry) => {
    dedupedExpected.set(`${entry.storage}:${entry.key}`, entry);
  });

  const missing: string[] = [];
  for (const entry of dedupedExpected.values()) {
    const hasMatch = registryEntries.some((registryEntry) => {
      if (registryEntry.storage !== entry.storage) return false;
      if (entry.key.includes('*')) return registryEntry.name === entry.key;
      return wildcardToRegExp(registryEntry.name).test(entry.key);
    });
    if (!hasMatch) {
      missing.push(`${entry.storage}:${entry.key} (source: ${entry.source})`);
    }
  }

  if (missing.length > 0) {
    console.error('[storage:validate] Missing storage registry entries:');
    missing.forEach((item) => console.error(`- ${item}`));
  }

  if (unresolved.length > 0) {
    console.warn('[storage:validate] Unresolved dynamic storage references (manual review recommended):');
    unresolved.forEach((item) => console.warn(`- ${item}`));
  }

  if (missing.length > 0) {
    process.exit(1);
  }

  console.log(
    `[storage:validate] OK (${dedupedExpected.size} expected keys matched against ${registryEntries.length} registry entries)`,
  );
};

void main().catch((error) => {
  console.error('[storage:validate] Failed:', error);
  process.exit(1);
});
