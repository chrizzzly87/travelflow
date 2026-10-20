import React, { useCallback, useMemo, useRef, useState } from 'react';
import { createBlurhashPlaceholder } from './images/blurhashPlaceholder';
import { useHydrated } from '../hooks/useHydrated';
import { IMAGE_PLACEHOLDERS } from '../data/imagePlaceholders.generated';
import { buildImageCdnUrl, buildImageSrcSet, isImageCdnEnabled } from '../utils/imageDelivery';
import { cn } from '../lib/utils';

const normalizePlaceholderPath = (value: string): string => {
    try { return new URL(value, 'https://travelflow.invalid').pathname; }
    catch { return value.split('#')[0].split('?')[0]; }
};

export interface ProgressiveImageProps {
    src: string;
    alt: string;
    width?: number;
    height?: number;
    sizes?: string;
    srcSetWidths?: number[];
    placeholderKey?: string;
    loading?: 'eager' | 'lazy';
    fetchPriority?: 'high' | 'low' | 'auto';
    className?: string;
    placeholderBlurhash?: string;
    onError?: () => void;
    disableCdn?: boolean;
    skipFade?: boolean;
}

const ProgressiveImageContent: React.FC<ProgressiveImageProps> = ({
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
    disableCdn = false,
    skipFade = false,
}) => {
    const hydrated = useHydrated();
    const [isLoaded, setIsLoaded] = useState(false);
    const [hasError, setHasError] = useState(false);
    const [useOriginal, setUseOriginal] = useState(false);
    const handledErrors = useRef(new Set<string>());
    const deliverOriginal = disableCdn || useOriginal;

    const normalizedKey = useMemo(
        () => normalizePlaceholderPath(placeholderKey || src),
        [placeholderKey, src]
    );
    const placeholderMeta = IMAGE_PLACEHOLDERS[normalizedKey];
    const resolvedWidth = width ?? placeholderMeta?.width ?? 1536;
    const resolvedHeight = height ?? placeholderMeta?.height ?? 1024;
    const blurhashValue = placeholderBlurhash || placeholderMeta?.blurhash || '';
    const placeholderDataUrl = useMemo(() => createBlurhashPlaceholder(blurhashValue), [blurhashValue]);

    const avifSrcSet = useMemo(
        () => (isImageCdnEnabled() && !deliverOriginal ? buildImageSrcSet(src, srcSetWidths, { format: 'avif', quality: 52 }) : ''),
        [deliverOriginal, src, srcSetWidths]
    );
    const webpSrcSet = useMemo(
        () => (isImageCdnEnabled() && !deliverOriginal ? buildImageSrcSet(src, srcSetWidths, { format: 'webp', quality: 60 }) : ''),
        [deliverOriginal, src, srcSetWidths]
    );
    const imgSrcSet = useMemo(
        () => (deliverOriginal ? '' : buildImageSrcSet(src, srcSetWidths, { quality: 66 })),
        [deliverOriginal, src, srcSetWidths]
    );

    const fallbackWidth = srcSetWidths[srcSetWidths.length - 1] || width;
    const resolvedSrc = deliverOriginal ? src : buildImageCdnUrl(src, { width: fallbackWidth, quality: 66 });
    const attempt = deliverOriginal ? 'original' : 'cdn';
    const canRetryOriginal = !deliverOriginal && resolvedSrc !== src;
    const handleImageError = useCallback(() => {
        // Cache reconciliation and the error event can describe the same failed
        // request. Each attempt may advance the lifecycle only once.
        if (handledErrors.current.has(attempt)) return;
        handledErrors.current.add(attempt);
        setIsLoaded(false);
        if (canRetryOriginal) {
            setUseOriginal(true);
            return;
        }
        setHasError(true);
        onError?.();
    }, [attempt, canRetryOriginal, onError]);
    const reconcileImage = useCallback((node: HTMLImageElement | null) => {
        // Hydration may attach after the native load/error event already fired.
        if (!node?.complete) return;
        if (node.naturalWidth > 0) setIsLoaded(true);
        else handleImageError();
    }, [handleImageError]);
    const fetchPriorityAttr = fetchPriority
        ? ({ fetchpriority: fetchPriority } as { fetchpriority: 'high' | 'low' | 'auto' })
        : undefined;

    return (
        <div className="relative size-full overflow-hidden">
            {placeholderDataUrl && !isLoaded && !hasError && (
                <img
                    src={placeholderDataUrl}
                    alt=""
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 size-full scale-[1.04] object-cover blur-lg"
                />
            )}
            <picture className="absolute inset-0 block size-full">
                {avifSrcSet && <source type="image/avif" srcSet={avifSrcSet} sizes={sizes} />}
                {webpSrcSet && <source type="image/webp" srcSet={webpSrcSet} sizes={sizes} />}
                <img
                    key={attempt}
                    ref={reconcileImage}
                    src={resolvedSrc}
                    srcSet={imgSrcSet || undefined}
                    sizes={sizes}
                    alt={alt}
                    loading={loading}
                    decoding="async"
                    {...fetchPriorityAttr}
                    width={resolvedWidth}
                    height={resolvedHeight}
                    className={cn(
                        className || 'size-full object-cover',
                        'outline outline-1 -outline-offset-1 outline-black/10 transition-opacity duration-300 motion-reduce:transition-none dark:outline-white/10',
                        !hydrated || isLoaded || skipFade ? 'opacity-100' : 'opacity-0',
                    )}
                    onLoad={() => setIsLoaded(true)}
                    onError={handleImageError}
                />
            </picture>
        </div>
    );
};

/** A different resource gets a fresh load/error lifecycle. */
export const ProgressiveImage: React.FC<ProgressiveImageProps> = props => <ProgressiveImageContent key={props.src} {...props} />;
