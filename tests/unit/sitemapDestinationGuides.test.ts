import { describe, expect, it } from 'vitest';
import { readDestinationGuidePaths } from '../../scripts/generate-sitemap.mjs';

describe('sitemap destination guide URLs', () => {
  it('emits a path for every country guide, including China and Taiwan', async () => {
    const paths = await readDestinationGuidePaths();

    expect(paths).toContain('/inspirations/country/china');
    expect(paths).toContain('/inspirations/country/taiwan');
    expect(paths).toContain('/inspirations/country/thailand');
    expect(paths.filter((entry) => entry.split('/').length === 4)).toHaveLength(52);
  });

  it('emits curated child guide paths and skips airport-derived stubs', async () => {
    const paths = await readDestinationGuidePaths();

    expect(paths).toContain('/inspirations/country/china/beijing');
    expect(paths).toContain('/inspirations/country/taiwan/taipei');
    expect(paths).toContain('/inspirations/country/thailand/phuket');
    // Airport-derived stub without curated content stays out of the sitemap.
    expect(paths).not.toContain('/inspirations/country/china/ezhou');
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('returns an empty list when the guide dataset is unavailable', async () => {
    await expect(readDestinationGuidePaths('/does/not/exist.json')).resolves.toEqual([]);
  });
});
