import { create } from 'fontkit';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

interface OutlineGlyph { path: { toSVG(): string } }
interface OutlinePosition { xAdvance: number; xOffset: number; yOffset: number }
interface OutlineFont {
  unitsPerEm: number;
  hasGlyphForCodePoint(point: number): boolean;
  layout(text: string): { glyphs: OutlineGlyph[]; positions: OutlinePosition[] };
}
export interface VideoOutlineFonts { normal: OutlineFont; bold: OutlineFont; heavy: OutlineFont; fallback: OutlineFont[] }
let fontsPromise: Promise<VideoOutlineFonts> | undefined;

export const loadVideoOutlineFonts = (): Promise<VideoOutlineFonts> => {
  if (!fontsPromise) {
    fontsPromise = (async () => {
      const root = join(process.cwd(), 'public/fonts');
      const load = async (path: string) => create(await readFile(join(root, path))) as unknown as OutlineFont;
      const [normal, bold, heavy] = await Promise.all([400, 700, 800].map(weight => load(`bricolage-grotesque/bricolage-grotesque-latin-${weight}-normal.woff`)));
      const fallbackPaths = ['bricolage-grotesque/bricolage-grotesque-latin-ext-700-normal.woff'];
      for (const directory of ['noto-fallback', 'vazirmatn']) {
        for (const file of (await readdir(join(root, directory))).sort()) {
          if (/\.woff2?$/.test(file)) fallbackPaths.push(`${directory}/${file}`);
        }
      }
      const fallback = await Promise.all(fallbackPaths.map(load));
      return { normal, bold, heavy, fallback };
    })().catch(error => { fontsPromise = undefined; throw error; });
  }
  return fontsPromise;
};

const decode = (text: string) => text.replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&quot;', '"').replaceAll('&#39;', "'").replaceAll('&amp;', '&');
const decimal = (value: number) => Number(value.toFixed(3));

// Outlines make glyphs independent of Fontconfig, Pango, and installed Lambda fonts.
// Each generated text element is shaped once and reused across every video frame.
export const outlineVideoSvgText = (svg: string, fonts: VideoOutlineFonts, cache = new Map<string, string>()): string =>
  svg.replace(/<text\b([^>]*)>([\s\S]*?)<\/text>/g, (element, attributes: string, encoded: string) => {
    const previous = cache.get(element);
    if (previous) return previous;
    const attrs = Object.fromEntries(Array.from(attributes.matchAll(/([\w-]+)="([^"]*)"/g), match => [match[1], match[2]]));
    const size = Number(attrs['font-size'] || 16);
    const weight = Number(attrs['font-weight'] || 400);
    const preferred = weight >= 800 ? fonts.heavy : weight >= 600 ? fonts.bold : fonts.normal;
    const runs: { font: OutlineFont; text: string }[] = [];
    for (const character of decode(encoded)) {
      const point = character.codePointAt(0)!;
      const font = preferred.hasGlyphForCodePoint(point) ? preferred : fonts.fallback.find(candidate => candidate.hasGlyphForCodePoint(point)) || preferred;
      const last = runs[runs.length - 1];
      if (last?.font === font) last.text += character;
      else runs.push({ font, text: character });
    }
    const shaped = runs.map(run => ({ font: run.font, layout: run.font.layout(run.text), scale: size / run.font.unitsPerEm }));
    const width = shaped.reduce((sum, run) => sum + run.layout.positions.reduce((advance, position) => advance + position.xAdvance * run.scale, 0), 0);
    const stretch = attrs.textLength && width > 0 ? Number(attrs.textLength) / width : 1;
    let cursor = Number(attrs.x || 0) - (attrs['text-anchor'] === 'middle' ? width * stretch / 2 : 0);
    const baseline = Number(attrs.y || 0);
    const paths: string[] = [];
    for (const run of shaped) {
      run.layout.glyphs.forEach((glyph, index) => {
        const position = run.layout.positions[index];
        const x = cursor + position.xOffset * run.scale * stretch;
        const y = baseline - position.yOffset * run.scale;
        paths.push(`<path d="${glyph.path.toSVG()}" transform="translate(${decimal(x)} ${decimal(y)}) scale(${decimal(run.scale * stretch)} ${decimal(-run.scale)})" vector-effect="non-scaling-stroke"/>`);
        cursor += position.xAdvance * run.scale * stretch;
      });
    }
    const presentation = Object.entries(attrs).filter(([key]) => !['x', 'y', 'font-size', 'font-weight', 'text-anchor', 'textLength', 'lengthAdjust'].includes(key)).map(([key, value]) => `${key}="${value}"`).join(' ');
    const output = `<g ${presentation}>${paths.join('')}</g>`;
    cache.set(element, output);
    return output;
  });
