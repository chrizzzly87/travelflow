import { readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { encode } from 'blurhash';

interface ImagePlaceholderEntry {
    blurhash: string;
    width: number;
    height: number;
}

const ROOT_DIR = process.cwd();
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const OUTPUT_FILE = path.join(ROOT_DIR, 'data', 'imagePlaceholders.generated.ts');

const BLOG_DIR = path.join(PUBLIC_DIR, 'images', 'blog');
const INSPIRATIONS_DIR = path.join(PUBLIC_DIR, 'images', 'inspirations');
const TRIP_MAPS_DIR = path.join(PUBLIC_DIR, 'images', 'trip-maps');

const toPosixPath = (value: string): string => value.split(path.sep).join('/');

const listFiles = (dir: string, matcher: (fileName: string) => boolean): string[] => {
    try {
        return readdirSync(dir)
            .filter((fileName) => matcher(fileName))
            .map((fileName) => path.join(dir, fileName))
            .filter((absPath) => statSync(absPath).isFile());
    } catch {
        return [];
    }
};

const isBlogBaseImage = (fileName: string): boolean => /-(card|header)\.webp$/i.test(fileName);
const isInspirationBaseImage = (fileName: string): boolean => /\.webp$/i.test(fileName) && !/-\d+\.webp$/i.test(fileName);
const isTripMapImage = (fileName: string): boolean => /\.png$/i.test(fileName);

const toPublicPath = (absolutePath: string): string => {
    const relative = path.relative(PUBLIC_DIR, absolutePath);
    return `/${toPosixPath(relative)}`;
};

const buildBlurhashEntry = async (absolutePath: string): Promise<ImagePlaceholderEntry | null> => {
    const image = sharp(absolutePath, { failOnError: false }).rotate();
    const metadata = await image.metadata();
    if (!metadata.width || !metadata.height) return null;

    const { data, info } = await image
        .ensureAlpha()
        .resize(32, 32, { fit: 'inside' })
        .raw()
        .toBuffer({ resolveWithObject: true });

    const blurhash = encode(new Uint8ClampedArray(data), info.width, info.height, 4, 3);
    return {
        blurhash,
        width: metadata.width,
        height: metadata.height,
    };
};

const buildOutputSource = (entries: Record<string, ImagePlaceholderEntry>): string => {
    const lines = Object.entries(entries)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, value]) => `    ${JSON.stringify(key)}: { blurhash: ${JSON.stringify(value.blurhash)}, width: ${value.width}, height: ${value.height} },`);

    return [
        'export interface ImagePlaceholderEntry {',
        '    blurhash: string;',
        '    width: number;',
        '    height: number;',
        '}',
        '',
        'export const IMAGE_PLACEHOLDERS: Record<string, ImagePlaceholderEntry> = {',
        ...lines,
        '};',
        '',
    ].join('\n');
};

const main = async () => {
    const files = [
        ...listFiles(BLOG_DIR, isBlogBaseImage),
        ...listFiles(INSPIRATIONS_DIR, isInspirationBaseImage),
        ...listFiles(TRIP_MAPS_DIR, isTripMapImage),
    ];

    const entries: Record<string, ImagePlaceholderEntry> = {};
    for (const filePath of files) {
        const publicPath = toPublicPath(filePath);
        try {
            const entry = await buildBlurhashEntry(filePath);
            if (!entry) continue;
            entries[publicPath] = entry;
        } catch (error) {
            process.stderr.write(`[image-placeholders] Skipping ${publicPath}: ${error instanceof Error ? error.message : String(error)}\n`);
        }
    }

    writeFileSync(OUTPUT_FILE, buildOutputSource(entries), 'utf8');
    process.stdout.write(`[image-placeholders] Wrote ${Object.keys(entries).length} placeholder entries to ${toPosixPath(path.relative(ROOT_DIR, OUTPUT_FILE))}\n`);
};

void main().catch((error) => {
    process.stderr.write(`[image-placeholders] ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
});
