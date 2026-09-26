import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// A chunk from a previous deploy used to fall through to the SPA fallback and
// come back as 200 HTML with the immutable /assets/* cache header — a stale tab
// then cached an HTML page under a .js URL for a year. Missing assets must 404,
// and that rule only works while it sits above the catch-all rewrite.
describe('netlify.toml asset fallback', () => {
  const toml = readFileSync(path.resolve(__dirname, '../../netlify.toml'), 'utf8');
  const redirects = toml
    .split('[[redirects]]')
    .slice(1)
    .map((block) => ({
      from: /^\s*from\s*=\s*"([^"]+)"/m.exec(block)?.[1],
      status: Number(/^\s*status\s*=\s*(\d+)/m.exec(block)?.[1]),
      forced: /^\s*force\s*=\s*true/m.test(block),
    }));

  it('answers missing /assets/* with a 404 before the SPA fallback', () => {
    const assetRule = redirects.findIndex((rule) => rule.from === '/assets/*');
    const spaRule = redirects.findIndex((rule) => rule.from === '/*');

    expect(assetRule).toBeGreaterThanOrEqual(0);
    expect(redirects[assetRule].status).toBe(404);
    // Forced would 404 every asset, including the ones that exist.
    expect(redirects[assetRule].forced).toBe(false);
    expect(assetRule).toBeLessThan(spaRule);
  });
});
