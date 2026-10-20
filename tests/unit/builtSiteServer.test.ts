import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { resolveBuiltPath } from '../../scripts/serve-built-site.mjs';

let root: string;
beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'tf-built-site-'));
  await mkdir(path.join(root, 'features'));
  await writeFile(path.join(root, 'index.html'), 'Homepage');
  await writeFile(path.join(root, 'features/index.html'), 'Features');
  await writeFile(path.join(root, 'spa.html'), 'Clean app shell');
});
afterEach(() => rm(root, { recursive: true, force: true }));

describe('production preview routing', () => {
  it('serves prerendered routes and the clean app shell for trip deep links', async () => {
    expect(await resolveBuiltPath('/', root)).toBe(path.join(root, 'index.html'));
    expect(await resolveBuiltPath('/features', root)).toBe(path.join(root, 'features/index.html'));
    expect(await resolveBuiltPath('/trip/example-id', root)).toBe(path.join(root, 'spa.html'));
    expect(await resolveBuiltPath('/create-trip/wizard', root)).toBe(path.join(root, 'spa.html'));
  });

  it('serves flat native prerenders for either incoming slash spelling before considering the offline shell', async () => {
    await rm(path.join(root, 'features'), { recursive: true });
    await writeFile(path.join(root, 'features.html'), 'Flat native document');
    expect(await resolveBuiltPath('/features', root)).toBe(path.join(root, 'features.html'));
    expect(await resolveBuiltPath('/features/', root)).toBe(path.join(root, 'features.html'));
    expect(await resolveBuiltPath('/spa.html', root)).toBe(path.join(root, 'spa.html'));
    expect(await resolveBuiltPath('/assets/missing.js/', root)).toBeNull();
    expect(await resolveBuiltPath('/api/runtime/location/', root)).toBeNull();
  });

  it('returns missing assets and APIs as 404s instead of successful HTML', async () => {
    expect(await resolveBuiltPath('/assets/missing.js', root)).toBeNull();
    expect(await resolveBuiltPath('/api/runtime/location', root)).toBeNull();
    expect(await resolveBuiltPath('/%invalid', root)).toBeNull();
  });
});
