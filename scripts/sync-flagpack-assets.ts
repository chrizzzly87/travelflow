import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { buildFlagpackCss, syncFlagpack4x3Assets } from './flagpackSyncUtils.ts';

const ROOT_DIR = process.cwd();
const FLAG_SOURCE_DIR = path.join(ROOT_DIR, 'node_modules', 'flagpack', 'flags', '4x3');
const FLAG_TARGET_DIR = path.join(ROOT_DIR, 'public', 'flags', '4x3');
const FLAG_STYLE_PATH = path.join(ROOT_DIR, 'styles', 'flagpack.css');

const writeIfChanged = (filePath: string, content: string): boolean => {
  if (existsSync(filePath)) {
    const existing = readFileSync(filePath, 'utf8');
    if (existing === content) {
      return false;
    }
  }

  writeFileSync(filePath, content, 'utf8');
  return true;
};

const main = (): void => {
  const result = syncFlagpack4x3Assets(FLAG_SOURCE_DIR, FLAG_TARGET_DIR);

  mkdirSync(path.dirname(FLAG_STYLE_PATH), { recursive: true });
  const cssUpdated = writeIfChanged(FLAG_STYLE_PATH, buildFlagpackCss(result.files));

  process.stdout.write(
    `[flags:sync] total=${result.total} copied=${result.copied} removed=${result.removed} css=${cssUpdated ? 'updated' : 'unchanged'}\n`,
  );
};

try {
  main();
} catch (error) {
  process.stderr.write(`[flags:sync] ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}
