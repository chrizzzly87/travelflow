export type ImageCdnFormat = 'avif' | 'webp' | 'jpeg' | 'png' | 'blurhash';
export type ImageCdnFit = 'cover' | 'contain' | 'fill' | 'inside' | 'outside';

export interface ImageCdnParams {
    width?: number;
    height?: number;
    quality?: number;
    format?: ImageCdnFormat;
    fit?: ImageCdnFit;
    position?: string;
}

const NETLIFY_IMAGE_ENDPOINT = '/.netlify/images';

const toPositiveInt = (value?: number): number | null => {
    if (!Number.isFinite(value)) return null;
    const normalized = Math.round(Number(value));
    return normalized > 0 ? normalized : null;
};

const normalizeWidths = (widths: number[]): number[] => {
    const unique = new Set<number>();
    widths.forEach((width) => {
        const normalized = toPositiveInt(width);
        if (normalized) unique.add(normalized);
    });
    return Array.from(unique).sort((a, b) => a - b);
};

export const isImageCdnEnabled = (): boolean => import.meta.env.PROD;

export const buildImageCdnUrl = (sourceUrl: string, params: ImageCdnParams = {}): string => {
    if (!sourceUrl) return sourceUrl;
    if (!isImageCdnEnabled()) return sourceUrl;
    if (sourceUrl.startsWith(`${NETLIFY_IMAGE_ENDPOINT}?`)) return sourceUrl;

    const searchParams = new URLSearchParams();
    searchParams.set('url', sourceUrl);

    const width = toPositiveInt(params.width);
    const height = toPositiveInt(params.height);
    const quality = toPositiveInt(params.quality);

    if (width) searchParams.set('w', String(width));
    if (height) searchParams.set('h', String(height));
    if (quality) searchParams.set('q', String(quality));
    if (params.format) searchParams.set('fm', params.format);
    if (params.fit) searchParams.set('fit', params.fit);
    if (params.position) searchParams.set('position', params.position);

    return `${NETLIFY_IMAGE_ENDPOINT}?${searchParams.toString()}`;
};

export const buildImageSrcSet = (
    sourceUrl: string,
    widths: number[],
    params: Omit<ImageCdnParams, 'width'> = {}
): string => {
    if (!sourceUrl) return '';
    const normalizedWidths = normalizeWidths(widths);
    if (normalizedWidths.length === 0) return '';

    return normalizedWidths
        .map((width) => `${buildImageCdnUrl(sourceUrl, { ...params, width })} ${width}w`)
        .join(', ');
};

export const buildBlurhashEndpointUrl = (sourceUrl: string): string => {
    return buildImageCdnUrl(sourceUrl, { format: 'blurhash' });
};
