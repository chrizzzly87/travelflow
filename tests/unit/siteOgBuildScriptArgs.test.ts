import { describe, expect, it } from 'vitest';
import { parseSiteOgStaticBuildCliArgs } from '../../scripts/build-site-og-static-images.ts';

describe('site og build script cli args', () => {
  it('parses known filter flags', () => {
    const parsed = parseSiteOgStaticBuildCliArgs([
      '--',
      '--locales=en,de',
      '--include-paths=/,/blog',
      '--include-prefixes=/blog,/de/blog',
      '--exclude-paths=/blog/draft',
      '--exclude-prefixes=/example',
    ]);

    expect(parsed.locales).toEqual(['en', 'de']);
    expect(parsed.includePaths).toEqual(['/', '/blog']);
    expect(parsed.includePrefixes).toEqual(['/blog', '/de/blog']);
    expect(parsed.excludePaths).toEqual(['/blog/draft']);
    expect(parsed.excludePrefixes).toEqual(['/example']);
    expect(parsed.hasFilters).toBe(true);
  });

  it('supports no-filter mode', () => {
    const parsed = parseSiteOgStaticBuildCliArgs([]);
    expect(parsed.hasFilters).toBe(false);
    expect(parsed.locales).toEqual([]);
  });

  it('throws on unknown or value-less flags', () => {
    expect(() => parseSiteOgStaticBuildCliArgs(['--wat=1'])).toThrow('Unknown flag');
    expect(() => parseSiteOgStaticBuildCliArgs(['--locales'])).toThrow('requires a value');
  });
});
