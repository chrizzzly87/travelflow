import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildFlagpackCss, listFlagSvgFiles, syncFlagpack4x3Assets } from '../../scripts/flagpackSyncUtils.ts';

describe('flagpack sync utilities', () => {
  const tempDirectories: string[] = [];

  const createTempDir = (prefix: string): string => {
    const directory = mkdtempSync(path.join(os.tmpdir(), prefix));
    tempDirectories.push(directory);
    return directory;
  };

  afterEach(() => {
    for (const directory of tempDirectories.splice(0)) {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('lists only valid svg files in deterministic order', () => {
    const sourceDir = createTempDir('flagpack-sync-list-');
    writeFileSync(path.join(sourceDir, 'fr.svg'), '<svg/>');
    writeFileSync(path.join(sourceDir, 'de.SVG'), '<svg/>');
    writeFileSync(path.join(sourceDir, 'README.md'), 'skip');
    writeFileSync(path.join(sourceDir, '.DS_Store'), 'skip');

    expect(listFlagSvgFiles(sourceDir)).toEqual(['de.SVG', 'fr.svg']);
  });

  it('copies changed files and removes stale files from target', () => {
    const sourceDir = createTempDir('flagpack-sync-source-');
    const targetDir = createTempDir('flagpack-sync-target-');

    writeFileSync(path.join(sourceDir, 'de.svg'), '<svg>de-new</svg>');
    writeFileSync(path.join(sourceDir, 'fr.svg'), '<svg>fr</svg>');

    writeFileSync(path.join(targetDir, 'de.svg'), '<svg>de-old</svg>');
    writeFileSync(path.join(targetDir, 'stale.svg'), '<svg>stale</svg>');

    const result = syncFlagpack4x3Assets(sourceDir, targetDir);

    expect(result).toEqual({
      total: 2,
      copied: 2,
      removed: 1,
      files: ['de.svg', 'fr.svg'],
    });

    expect(readFileSync(path.join(targetDir, 'de.svg'), 'utf8')).toBe('<svg>de-new</svg>');
    expect(readFileSync(path.join(targetDir, 'fr.svg'), 'utf8')).toBe('<svg>fr</svg>');
    expect(listFlagSvgFiles(targetDir)).toEqual(['de.svg', 'fr.svg']);
  });

  it('builds css with 4x3 paths only', () => {
    const css = buildFlagpackCss(['fr.svg', 'de.svg', 'fr.svg', 'gb-sct.svg', 'invalid.txt']);

    expect(css).toContain('.de{background-image:url("/flags/4x3/de.svg")}');
    expect(css).toContain('.fr{background-image:url("/flags/4x3/fr.svg")}');
    expect(css).toContain('.gb-sct{background-image:url("/flags/4x3/gb-sct.svg")}');
    expect(css).not.toContain('flags/1x1');
    expect(css.indexOf('.de{background-image')).toBeLessThan(css.indexOf('.fr{background-image'));
  });

  it('creates missing target directories before syncing', () => {
    const sourceRoot = createTempDir('flagpack-sync-create-source-');
    const sourceDir = path.join(sourceRoot, 'flags');
    mkdirSync(sourceDir, { recursive: true });
    writeFileSync(path.join(sourceDir, 'es.svg'), '<svg>es</svg>');

    const targetRoot = createTempDir('flagpack-sync-create-target-');
    const targetDir = path.join(targetRoot, 'nested', 'flags');

    const result = syncFlagpack4x3Assets(sourceDir, targetDir);
    expect(result.total).toBe(1);
    expect(readFileSync(path.join(targetDir, 'es.svg'), 'utf8')).toBe('<svg>es</svg>');
  });
});
