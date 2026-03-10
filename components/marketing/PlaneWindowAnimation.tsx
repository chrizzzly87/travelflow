import React from 'react';
import { buildImageCdnUrl } from '../../utils/imageDelivery';

const CLOUDS_SRC = '/images/clouds.png';
const PLANE_WINDOW_SRC = '/images/plane-window.png';
const PLANE_WINDOW_IMAGE_WIDTH = 640;
const CLOUDS_IMAGE_WIDTH = 512;

/**
 * Animated plane window with clouds scrolling behind it,
 * simulating an in-flight view.
 */
export const PlaneWindowAnimation: React.FC = () => {
    const cloudImageSrc = buildImageCdnUrl(CLOUDS_SRC, {
        width: CLOUDS_IMAGE_WIDTH,
        format: 'webp',
        quality: 60,
    });
    const planeWindowSrc = buildImageCdnUrl(PLANE_WINDOW_SRC, {
        width: PLANE_WINDOW_IMAGE_WIDTH,
        format: 'webp',
        quality: 68,
    });

    return (
        <div
            className="plane-window-wrapper relative select-none"
            /* Maintain the 580:850 aspect ratio of the window image */
            style={{ aspectRatio: '580 / 850' }}
        >
            {/* Cloud layer — clipped to sit inside the window opening */}
            <div className="plane-window-clouds-mask absolute overflow-hidden">
                <div className="flex h-full animate-clouds-scroll">
                    <img
                        src={cloudImageSrc}
                        alt=""
                        draggable={false}
                        className="h-full w-auto max-w-none shrink-0 object-cover"
                        loading="lazy"
                        decoding="async"
                        fetchPriority="low"
                    />
                    <img
                        src={cloudImageSrc}
                        alt=""
                        draggable={false}
                        className="h-full w-auto max-w-none shrink-0 object-cover"
                        loading="lazy"
                        decoding="async"
                        fetchPriority="low"
                    />
                </div>
            </div>

            {/* Window frame sits on top */}
            <img
                src={planeWindowSrc}
                alt="Airplane window"
                draggable={false}
                className="relative z-10 h-full w-full object-contain drop-shadow-xl"
                loading="lazy"
                decoding="async"
                fetchPriority="low"
            />
        </div>
    );
};
