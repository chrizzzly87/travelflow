import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const libModule = require('../../netlify/plugins/site-og-build-cache/lib.js') as {
  SITE_OG_STATIC_DIR_RELATIVE: string;
  countGeneratedSiteOgPngs: (cwd?: string) => number;
  createSiteOgBuildCachePlugin: (deps?: {
    countPngs?: () => number;
    restoreCache?: (utils: { cache: { restore: (input: string) => Promise<void> } }) => Promise<void>;
    saveCache?: (utils: { cache: { save: (input: string) => Promise<void> } }) => Promise<void>;
    log?: (message: string) => void;
  }) => {
    onPreBuild: (input: { utils: { cache: { restore: (input: string) => Promise<void> } } }) => Promise<void>;
    onSuccess: (input: { utils: { cache: { save: (input: string) => Promise<void> } } }) => Promise<void>;
  };
  resolveSiteOgStaticDirectory: (cwd?: string) => string;
};

describe('site-og-build-cache plugin internals', () => {
  it('logs restore when cached png assets become available after restore', async () => {
    const logs: string[] = [];
    const countPngs = vi
      .fn<() => number>()
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(18);

    const restoreCache = vi.fn(async () => {});
    const saveCache = vi.fn(async () => {});

    const plugin = libModule.createSiteOgBuildCachePlugin({
      countPngs,
      restoreCache,
      saveCache,
      log: (message) => logs.push(message),
    });

    await plugin.onPreBuild({
      utils: {
        cache: {
          restore: async () => {},
        },
      },
    });

    expect(restoreCache).toHaveBeenCalledTimes(1);
    expect(logs.some((message) => message.includes('restored'))).toBe(true);
  });

  it('skips cache save when no static og assets exist', async () => {
    const logs: string[] = [];
    const saveCache = vi.fn(async () => {});

    const plugin = libModule.createSiteOgBuildCachePlugin({
      countPngs: () => 0,
      saveCache,
      log: (message) => logs.push(message),
    });

    await plugin.onSuccess({
      utils: {
        cache: {
          save: async () => {},
        },
      },
    });

    expect(saveCache).not.toHaveBeenCalled();
    expect(logs.some((message) => message.includes('skipping cache save'))).toBe(true);
  });

  it('saves cache when static og assets are present', async () => {
    const logs: string[] = [];
    const saveCache = vi.fn(async () => {});

    const plugin = libModule.createSiteOgBuildCachePlugin({
      countPngs: () => 42,
      saveCache,
      log: (message) => logs.push(message),
    });

    await plugin.onSuccess({
      utils: {
        cache: {
          save: async () => {},
        },
      },
    });

    expect(saveCache).toHaveBeenCalledTimes(1);
    expect(logs.some((message) => message.includes('saved'))).toBe(true);
  });
});

describe('site-og-build-cache filesystem helpers', () => {
  const tempDirectories: string[] = [];

  afterEach(() => {
    for (const dirPath of tempDirectories.splice(0)) {
      rmSync(dirPath, { recursive: true, force: true });
    }
  });

  it('returns zero when output directory does not exist', () => {
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'site-og-cache-test-missing-'));
    tempDirectories.push(tempRoot);

    expect(libModule.countGeneratedSiteOgPngs(tempRoot)).toBe(0);
  });

  it('counts only png files in generated output directory', () => {
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'site-og-cache-test-count-'));
    tempDirectories.push(tempRoot);

    const outputDir = libModule.resolveSiteOgStaticDirectory(tempRoot);
    mkdirSync(outputDir, { recursive: true });

    writeFileSync(path.join(outputDir, 'root-a.png'), 'a');
    writeFileSync(path.join(outputDir, 'root-b.PNG'), 'b');
    writeFileSync(path.join(outputDir, 'manifest.json'), '{}');
    writeFileSync(path.join(outputDir, 'notes.txt'), 'n');

    expect(libModule.countGeneratedSiteOgPngs(tempRoot)).toBe(2);
    expect(libModule.SITE_OG_STATIC_DIR_RELATIVE).toBe('public/images/og/site/generated');
  });
});
