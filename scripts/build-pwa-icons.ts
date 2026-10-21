import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

/**
 * Render the PWA install icons from the brand mark.
 *
 * iOS home-screen icons are not transparent-friendly and never masked, so every
 * variant is rendered onto the solid brand indigo rather than left transparent.
 */

const projectRoot = path.resolve(import.meta.dirname, '..');
const sourceSvgPath = path.join(projectRoot, 'public', 'brand-plane.svg');
const outputDir = path.join(projectRoot, 'public', 'icons');

const BRAND_BACKGROUND = '#4f46e5';

interface IconSpec {
  fileName: string;
  size: number;
  /** Fraction of the canvas the plane occupies. */
  glyphScale: number;
  /** Corner rounding as a fraction of the canvas; 0 renders a full square. */
  cornerRadius: number;
}

// `any` icons are shown as drawn, so they get the rounded-square treatment that
// matches the in-app logo frame. The `maskable` icon is cropped by the platform
// to whatever shape it likes, so it fills the canvas edge to edge and keeps the
// glyph inside the 80% safe zone.
const ICONS: IconSpec[] = [
  { fileName: 'icon-192.png', size: 192, glyphScale: 0.58, cornerRadius: 0.22 },
  { fileName: 'icon-512.png', size: 512, glyphScale: 0.58, cornerRadius: 0.22 },
  { fileName: 'icon-512-maskable.png', size: 512, glyphScale: 0.44, cornerRadius: 0 },
];

const buildBackground = (spec: IconSpec): Buffer => {
  const radius = Math.round(spec.size * spec.cornerRadius);
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${spec.size}" height="${spec.size}">`
    + `<rect width="${spec.size}" height="${spec.size}" rx="${radius}" ry="${radius}" `
    + `fill="${BRAND_BACKGROUND}"/></svg>`
  );
};

const renderIcon = async (spec: IconSpec, sourceSvg: Buffer): Promise<void> => {
  const glyphSize = Math.round(spec.size * spec.glyphScale);
  const glyph = await sharp(sourceSvg, { density: 512 })
    .resize(glyphSize, glyphSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  const offset = Math.round((spec.size - glyphSize) / 2);

  await sharp(buildBackground(spec))
    .composite([{ input: glyph, top: offset, left: offset }])
    .png({ compressionLevel: 9 })
    .toFile(path.join(outputDir, spec.fileName));
};

const main = async (): Promise<void> => {
  if (!fs.existsSync(sourceSvgPath)) {
    console.error(`ERROR: ${sourceSvgPath} not found.`);
    process.exit(1);
  }

  fs.mkdirSync(outputDir, { recursive: true });
  const sourceSvg = fs.readFileSync(sourceSvgPath);

  for (const spec of ICONS) {
    await renderIcon(spec, sourceSvg);
    console.log(`Rendered public/icons/${spec.fileName} (${spec.size}x${spec.size})`);
  }
};

void main();
