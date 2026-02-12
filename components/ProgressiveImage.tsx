import React, { useMemo, useState } from 'react';
import { decode } from 'blurhash';
import { IMAGE_PLACEHOLDERS } from '../data/imagePlaceholders.generated';
import { buildImageCdnUrl, buildImageSrcSet, isImageCdnEnabled } from '../utils/imageDelivery';

const blurhashDataUrlCache = new Map<string, string>();

const normalizePlaceholderPath = (value: string): string => {
    if (!value) return value;
    try {
        const normalized = new URL(value, window.location.origin);
        return normalized.pathname;
    } catch {
        return value.split('#')[0].split('?')[0];
    }
};

const clampDimension = (value: number): number => {
    const normalized = Number.isFinite(value) ? Math.round(value) : 32;
    return Math.max(1, normalized);
};

const createBlurhashDataUrl = (hash: string, width: number, height: number): string | null => {
    if (!hash) return null;
    const key = `${hash}:${width}x${height}`;
    const cached = blurhashDataUrlCache.get(key);
    if (cached) return cached;
    try {
        const w = clampDimension(Math.min(width, 48));
        const h = clampDimension(Math.min(height, 48));
        const pixels = decode(hash, w, h);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const context = canvas.getContext('2d');
        if (!context) return null;
        const imageData = context.createImageData(w, h);
        imageData.data.set(pixels);
        context.putImageData(imageData, 0, 0);
        const dataUrl = canvas.toDataURL('image/png');
        blurhashDataUrlCache.set(key, dataUrl);
        return dataUrl;
    } catch {
        return null;
    }
};

export interface ProgressiveImageProps {
    src: string;
    alt: string;
    width: number;
    height: number;
    sizes?: string;
    srcSetWidths?: number[];
    placeholderKey?: string;
    loading?: 'eager' | 'lazy';
    fetchPriority?: 'high' | 'low' | 'auto';
    className?: string;
    placeholderBlurhash?: string;
    onError?: () => void;
}

export const ProgressiveImage: React.FC<ProgressiveImageProps> = ({
    src,
    alt,
    width,
    height,
    sizes,
    srcSetWidths = [480, 768, 1024, 1536],
    placeholderKey,
    loading = 'lazy',
    fetchPriority = 'low',
    className,
    placeholderBlurhash,
    onError,
}) => {
    const [isLoaded, setIsLoaded] = useState(false);
    const [hasError, setHasError] = useState(false);

    const normalizedKey = useMemo(
        () => normalizePlaceholderPath(placeholderKey || src),
        [placeholderKey, src]
    );
    const placeholderMeta = IMAGE_PLACEHOLDERS[normalizedKey];
    const blurhashValue = placeholderBlurhash || placeholderMeta?.blurhash || '';
    const placeholderDataUrl = useMemo(() => {
        if (!blurhashValue) return null;
        if (typeof document === 'undefined') return null;
        const sourceWidth = placeholderMeta?.width ?? width;
        const sourceHeight = placeholderMeta?.height ?? height;
        return createBlurhashDataUrl(blurhashValue, sourceWidth, sourceHeight);
    }, [blurhashValue, placeholderMeta?.height, placeholderMeta?.width, width, height]);

    const avifSrcSet = useMemo(
        () => (isImageCdnEnabled() ? buildImageSrcSet(src, srcSetWidths, { format: 'avif', quality: 52 }) : ''),
        [src, srcSetWidths]
    );
    const webpSrcSet = useMemo(
        () => (isImageCdnEnabled() ? buildImageSrcSet(src, srcSetWidths, { format: 'webp', quality: 60 }) : ''),
        [src, srcSetWidths]
    );
    const imgSrcSet = useMemo(
        () => buildImageSrcSet(src, srcSetWidths, { quality: 66 }),
        [src, srcSetWidths]
    );

    const fallbackWidth = srcSetWidths[srcSetWidths.length - 1] || width;
    const resolvedSrc = buildImageCdnUrl(src, { width: fallbackWidth, quality: 66 });
    const fetchPriorityAttr = fetchPriority
        ? ({ fetchpriority: fetchPriority } as { fetchpriority: 'high' | 'low' | 'auto' })
        : undefined;

    return (
        <div className="relative h-full w-full overflow-hidden">
            {placeholderDataUrl && !isLoaded && !hasError && (
                <img
                    src={placeholderDataUrl}
                    alt=""
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 h-full w-full scale-[1.04] object-cover blur-lg"
                />
            )}
            <picture className="absolute inset-0 block h-full w-full">
                {avifSrcSet && <source type="image/avif" srcSet={avifSrcSet} sizes={sizes} />}
                {webpSrcSet && <source type="image/webp" srcSet={webpSrcSet} sizes={sizes} />}
                <img
                    src={resolvedSrc}
                    srcSet={imgSrcSet || undefined}
                    sizes={sizes}
                    alt={alt}
                    loading={loading}
                    decoding="async"
                    {...fetchPriorityAttr}
                    width={width}
                    height={height}
                    className={`${className || 'h-full w-full object-cover'} transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
                    onLoad={() => setIsLoaded(true)}
                    onError={() => {
                        setHasError(true);
                        onError?.();
                    }}
                />
            </picture>
        </div>
    );
};
