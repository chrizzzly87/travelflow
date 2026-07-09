import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const projectRoot = path.resolve(import.meta.dirname, '../..');

describe('production client runtime environment guard', () => {
  it('runs before both local production and Netlify builds', () => {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'),
    ) as { scripts?: Record<string, string> };

    expect(packageJson.scripts?.build).toContain('runtime-env:validate');
    expect(packageJson.scripts?.['build:netlify']).toContain('runtime-env:validate');
  });

  it('keeps the interactive login route out of static prerendering', () => {
    const prerenderScript = fs.readFileSync(
      path.join(projectRoot, 'scripts/prerender-routes.mjs'),
      'utf8',
    );

    expect(prerenderScript).not.toContain("{ path: '/login'");
  });
});
