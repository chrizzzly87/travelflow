import fs from 'node:fs/promises';
import path from 'node:path';
import { COOKIE_REGISTRY, type CookieDefinition } from '../lib/legal/cookies.config';

type StorageMedium = 'localStorage' | 'sessionStorage';

interface FileConstDefinition {
  name: string;
  value: string;
  line: number;
}

interface HelperFunctionDefinition {
  name: string;
  wildcardKey: string;
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

interface DynamicAllowlistRule {
  filePattern: RegExp;
  expressionPattern: RegExp;
  reason: string;
}

const ROOT = process.cwd();
const SOURCE_TARGETS = ['App.tsx', 'i18n.ts', 'components', 'pages', 'services', 'config', 'hooks', 'lib'];
const KEY_PREFIXES = ['tf_', 'travelflow_', 'admin.', 'sb-'];
const STORAGE_CALL_PATTERN = /(?:window\.)?(localStorage|sessionStorage)\.(?:getItem|setItem|removeItem)\(\s*([^,)]+)\s*(?:,|\))/g;
const CONST_STRING_PATTERN = /\bconst\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(["'`])([^"'`]+)\2/g;
const HELPER_TEMPLATE_PATTERN = /\bconst\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*\([^)]*\)\s*(?::\s*[^=]+)?=>\s*`([^`]+)`/g;
const DERIVED_KEY_ASSIGNMENT_PATTERN = /\bconst\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*([A-Za-z_$][A-Za-z0-9_$]*)\([^)]*\)\s*;/g;
const CALL_EXPRESSION_PATTERN = /^([A-Za-z_$][A-Za-z0-9_$]*)\([^)]*\)$/;

const DYNAMIC_ALLOWLIST: DynamicAllowlistRule[] = [
  {
    filePattern: /^components\/OnPageDebugger\.tsx$/,
    expressionPattern: /^storageKey$/,
    reason: 'Generic helper wrapper over fixed debug storage constants in the same file.',
  },
  {
    filePattern: /^components\/admin\/adminLocalCache\.ts$/,
    expressionPattern: /^key$/,
    reason: 'Generic admin cache helper; concrete keys are validated at callsites.',
  },
  {
    filePattern: /^pages\/UpdatesPage\.tsx$/,
    expressionPattern: /^storageKey$/,
    reason: 'Generic helper wrapper over fixed key constants in the same file.',
  },
  {
    filePattern: /^services\/authService\.ts$/,
    expressionPattern: /^key$/,
    reason: 'Dynamic key cleanup loop; wildcard Supabase auth keys are registry-tracked.',
  },
];

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

const countOccurrences = (value: string, char: string): number =>
  value.split(char).length - 1;

const rebalanceParentheses = (value: string): string => {
  const openCount = countOccurrences(value, '(');
  const closeCount = countOccurrences(value, ')');
  if (openCount <= closeCount) return value;
  return `${value}${')'.repeat(openCount - closeCount)}`;
};

const normalizeExpression = (raw: string): string =>
  rebalanceParentheses(trimInlineComments(raw.trim()));

const parseStringLiteral = (raw: string): string | null => {
  const trimmed = normalizeExpression(raw);
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

const parseHelperWildcardKey = (
  templateBody: string,
  localConstMap: Map<string, FileConstDefinition>,
): string | null => {
  const fromConstPrefix = templateBody.match(/^\$\{([A-Za-z_$][A-Za-z0-9_$]*)\}\$\{[A-Za-z_$][A-Za-z0-9_$]*\}$/);
  if (fromConstPrefix) {
    const prefixConst = localConstMap.get(fromConstPrefix[1]);
    if (!prefixConst || !hasStorageKeyPrefix(prefixConst.value)) return null;
    return `${prefixConst.value}*`;
  }

  const fromLiteralPrefix = templateBody.match(/^([^$`]+)\$\{[A-Za-z_$][A-Za-z0-9_$]*\}$/);
  if (fromLiteralPrefix) {
    const prefix = fromLiteralPrefix[1];
    if (!hasStorageKeyPrefix(prefix)) return null;
    return `${prefix}*`;
  }

  return null;
};

const findHelperFunctions = (
  content: string,
  localConstMap: Map<string, FileConstDefinition>,
): Map<string, HelperFunctionDefinition> => {
  const helpers = new Map<string, HelperFunctionDefinition>();
  for (const match of content.matchAll(HELPER_TEMPLATE_PATTERN)) {
    const [, helperName, templateBody] = match;
    if (!helperName || !templateBody) continue;
    const wildcardKey = parseHelperWildcardKey(templateBody, localConstMap);
    if (!wildcardKey) continue;
    helpers.set(helperName, {
      name: helperName,
      wildcardKey,
    });
  }
  return helpers;
};

const findDerivedKeyVariables = (
  content: string,
  helperFunctionMap: Map<string, HelperFunctionDefinition>,
): Map<string, string> => {
  const derivedKeyMap = new Map<string, string>();
  for (const match of content.matchAll(DERIVED_KEY_ASSIGNMENT_PATTERN)) {
    const [, variableName, helperName] = match;
    if (!variableName || !helperName) continue;
    const helper = helperFunctionMap.get(helperName);
    if (!helper) continue;
    derivedKeyMap.set(variableName, helper.wildcardKey);
  }
  return derivedKeyMap;
};

const findAllowlistReason = (filePath: string, expression: string): string | null => {
  const rule = DYNAMIC_ALLOWLIST.find(
    (entry) => entry.filePattern.test(filePath) && entry.expressionPattern.test(expression),
  );
  return rule ? rule.reason : null;
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
  const allowlistedDynamic: string[] = [];

  for (const { filePath, content } of files) {
    const relativePath = toRelative(filePath);
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

    const helperFunctionMap = findHelperFunctions(normalizedContent, localConstMap);
    const derivedKeyMap = findDerivedKeyVariables(normalizedContent, helperFunctionMap);

    for (const match of normalizedContent.matchAll(STORAGE_CALL_PATTERN)) {
      const [, storageRaw, argRaw] = match;
      if (!storageRaw || !argRaw) continue;
      const storage = storageRaw as StorageMedium;
      fileStorageUsage.add(storage);
      const sourceLine = toLineNumber(normalizedContent, match.index ?? 0);
      const source = `${relativePath}:${sourceLine}`;
      const expression = normalizeExpression(argRaw);

      const literal = parseStringLiteral(expression);
      if (literal && hasStorageKeyPrefix(literal)) {
        expected.push({ key: literal, storage, source });
        continue;
      }

      if (isIdentifier(expression)) {
        const keyDef = localConstMap.get(expression);
        if (keyDef && hasStorageKeyPrefix(keyDef.value)) {
          const key = keyDef.name.includes('PREFIX') ? `${keyDef.value}*` : keyDef.value;
          expected.push({ key, storage, source });
          continue;
        }
        const derivedKey = derivedKeyMap.get(expression);
        if (derivedKey) {
          expected.push({ key: derivedKey, storage, source });
          continue;
        }
      }

      const callMatch = expression.match(CALL_EXPRESSION_PATTERN);
      if (callMatch) {
        const helperName = callMatch[1];
        const helper = helperFunctionMap.get(helperName);
        if (helper) {
          expected.push({ key: helper.wildcardKey, storage, source });
          continue;
        }
      }

      const allowlistReason = findAllowlistReason(relativePath, expression);
      if (allowlistReason) {
        allowlistedDynamic.push(`${source} -> ${expression} (${allowlistReason})`);
        continue;
      }

      unresolved.push(`${source} -> ${expression}`);
    }

    for (const keyDef of localConstMap.values()) {
      if (!isAutoRegisterConstName(keyDef.name)) continue;
      const storages = inferConstStorage(keyDef.name, fileStorageUsage);
      const key = keyDef.name.includes('PREFIX') ? `${keyDef.value}*` : keyDef.value;
      storages.forEach((storage) => {
        expected.push({
          key,
          storage,
          source: `${relativePath}:${keyDef.line}`,
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

  if (allowlistedDynamic.length > 0) {
    console.log(`[storage:validate] Allowlisted dynamic refs: ${allowlistedDynamic.length}`);
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
