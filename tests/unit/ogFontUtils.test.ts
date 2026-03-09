import { describe, expect, it } from 'vitest';
import { buildLocalHeadingFontUrls, buildLocalRtlHeadingFontUrls } from '../../netlify/edge-lib/og-font-utils.ts';

describe('og font utils', () => {
  it('builds local-only font URLs for each supported weight', () => {
    const origin = 'https://travelflowapp.netlify.app';

    const urls400 = buildLocalHeadingFontUrls(origin, 400);
    const urls700 = buildLocalHeadingFontUrls(origin, 700);
    const urls800 = buildLocalHeadingFontUrls(origin, 800);

    for (const urls of [urls400, urls700, urls800]) {
      expect(urls).toHaveLength(2);
      for (const url of urls) {
        expect(url.startsWith(`${origin}/fonts/bricolage-grotesque/`)).toBe(true);
        expect(url.includes('unpkg.com')).toBe(false);
        expect(url.includes('fonts.gstatic.com')).toBe(false);
      }
    }

    expect(urls400[0]).toContain('latin-400-normal.woff');
    expect(urls700[0]).toContain('latin-700-normal.woff');
    expect(urls800[0]).toContain('latin-800-normal.woff');
  });

  it('builds local-only RTL heading font URLs for each supported weight', () => {
    const origin = 'https://travelflowapp.netlify.app';

    const urls400 = buildLocalRtlHeadingFontUrls(origin, 400);
    const urls700 = buildLocalRtlHeadingFontUrls(origin, 700);
    const urls800 = buildLocalRtlHeadingFontUrls(origin, 800);

    for (const urls of [urls400, urls700, urls800]) {
      expect(urls).toHaveLength(1);
      for (const url of urls) {
        expect(url.startsWith(`${origin}/fonts/vazirmatn/`)).toBe(true);
        expect(url.endsWith('.woff')).toBe(true);
      }
    }

    expect(urls400[0]).toContain('arabic-400-normal.woff');
    expect(urls700[0]).toContain('arabic-700-normal.woff');
    expect(urls800[0]).toContain('arabic-800-normal.woff');
  });
});
