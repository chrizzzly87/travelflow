import { decode } from 'blurhash';

const placeholders = new Map<string, string>();
/** Small deterministic SVG: no canvas, DOM dependency or client/server markup difference. */
export function createBlurhashPlaceholder(hash: string): string | null {
    if (!hash) return null;
    const cached = placeholders.get(hash);
    if (cached) return cached;
    try {
        const pixels = decode(hash, 4, 3);
        const rectangles = Array.from({ length: 12 }, (_, index) => {
            const offset = index * 4;
            return `<rect x="${index % 4}" y="${Math.floor(index / 4)}" width="1" height="1" fill="rgb(${pixels[offset]},${pixels[offset + 1]},${pixels[offset + 2]})"/>`;
        }).join('');
        const uri = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 3">${rectangles}</svg>`)}`;
        // Generated assets are finite, but remote previews can provide new hashes.
        if (placeholders.size >= 256) placeholders.delete(placeholders.keys().next().value!);
        placeholders.set(hash, uri);
        return uri;
    } catch { return null; }
}
