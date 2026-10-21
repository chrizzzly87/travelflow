import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { loadVideoOutlineFonts, outlineVideoSvgText } from '../../netlify/lib/trip-video-font-outlines';

describe('serverless video text rendering', () => {
  it('uses bundled glyph paths for titles and markers without relying on installed fonts', async () => {
    const fonts = await loadVideoOutlineFonts();
    const cache = new Map<string, string>();
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="500" height="120"><text x="20" y="60" font-size="40" font-weight="800" fill="#111827">Taipei &amp; Tainan</text><text x="20" y="100" font-size="20" fill="#111827">Тайвань · أكتوبر</text></svg>';
    const output = outlineVideoSvgText(svg, fonts, cache);
    expect(output).not.toContain('<text');
    expect(output).toContain('<path d="M');
    expect(output).toContain('fill="#111827"');
    expect(cache.size).toBe(2);
    expect(outlineVideoSvgText(svg, fonts, cache)).toBe(output);
    const { data } = await sharp(Buffer.from(output)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    // Visible text pixels prove this works even when no OS font can render SVG text.
    expect(Array.from(data).filter((value, index) => index % 4 === 3 && value > 0).length).toBeGreaterThan(1000);
  });
});
