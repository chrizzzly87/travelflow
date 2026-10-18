import React, { useMemo, useState } from 'react';
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
        () => (isImageCdnEnabled() && !disableCdn ? buildImageSrcSet(src, srcSetWidths, { format: 'avif', quality: 52 }) : ''),
        [disableCdn, src, srcSetWidths]
    );
    const webpSrcSet = useMemo(
        () => (isImageCdnEnabled() && !disableCdn ? buildImageSrcSet(src, srcSetWidths, { format: 'webp', quality: 60 }) : ''),
        [disableCdn, src, srcSetWidths]
    );
    const imgSrcSet = useMemo(
        () => (disableCdn ? '' : buildImageSrcSet(src, srcSetWidths, { quality: 66 })),
        [disableCdn, src, srcSetWidths]
    );

    const fallbackWidth = srcSetWidths[srcSetWidths.length - 1] || width;
    const resolvedSrc = disableCdn ? src : buildImageCdnUrl(src, { width: fallbackWidth, quality: 66 });
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
                    ref={(node) => {
                        // The image can finish loading before hydration attaches
                        // the onLoad handler (warm CDN cache), so the event never
                        // fires and the image stays at opacity-0 with only the
                        // blurhash showing. Reconcile from the DOM on mount: if
                        // it is already complete, reveal it; if it already failed,
                        // fall back.
                        if (!node) return;
                        if (node.complete) {
                            if (node.naturalWidth > 0) setIsLoaded(true);
                            else { setHasError(true); onError?.(); }
                        }
                    }}
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
                    onError={() => {
                        setHasError(true);
                        onError?.();
                    }}
                />
            </picture>
        </div>
    );
};

/** A different resource gets a fresh load/error lifecycle. */
export const ProgressiveImage: React.FC<ProgressiveImageProps> = props => <ProgressiveImageContent key={props.src} {...props} />;
