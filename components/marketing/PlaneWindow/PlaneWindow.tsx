import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { buildImageCdnUrl } from '../../../utils/imageDelivery';
import { useWindowShade, SHADE_TRAVEL, FRAME_DIM } from './useWindowShade';
import type { CloudSceneHandle } from './cloudScene';

const PLANE_WINDOW_SRC = '/images/plane-window.png';
const PLANE_WINDOW_IMAGE_WIDTH = 640;
const PLANE_WINDOW_IMAGE_HEIGHT = 938;

const SOFTWARE_RENDERER = /swiftshader|llvmpipe|softwarepipe|basic render|generic renderer/i;

/**
 * Whether it is worth spending a WebGL context and a render loop here.
 *
 * A full-bleed WebGL hero was removed from this app once already for
 * performance (see HeroWebGLBackground). This one is a 320px box on desktop
 * only, but the same caution applies: anything that says "do not animate" or
 * "this machine has no GPU" gets the static layer instead.
 */
const shouldRenderScene = (): boolean => {
    if (typeof window === 'undefined') return false;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    if (!window.matchMedia('(min-width: 1024px)').matches) return false;

    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (connection?.saveData) return false;

    try {
        const probe = document.createElement('canvas');
        const gl = probe.getContext('webgl2') || probe.getContext('webgl');
        if (!gl) return false;
        const info = gl.getExtension('WEBGL_debug_renderer_info');
        if (info) {
            const renderer = String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL) || '');
            if (SOFTWARE_RENDERER.test(renderer)) return false;
        }
        return true;
    } catch {
        return false;
    }
};

/**
 * The window belongs to the homepage hero and nowhere else.
 *
 * This guard lives here, not only in HeroSection, because HeroSection itself has
 * been observed mounting on /features alongside FeaturesPage — the window's
 * ancestor chain there is HeroSection's own <section>, next to the features h1.
 * That is a routing bug worth fixing separately; until it is, the window must
 * not be able to render off the homepage, because the prerenderer snapshots the
 * live DOM and bakes it into that route's HTML, which is why a direct load of
 * /features showed it and a client-side navigation did not.
 *
 * Evaluated on every render rather than memoised: a value captured once at mount
 * stays "home" forever if the component mounted while the app was still on '/'.
 */
const isHomePathname = (): boolean => {
    if (typeof window === 'undefined') return true;
    const segments = (window.location.pathname || '/').split('/').filter(Boolean);
    return segments.length === 0 || (segments.length === 1 && /^[a-z]{2}$/.test(segments[0]));
};

export const PlaneWindow: React.FC = () => {
    const { t } = useTranslation('home');
    const { shade, dragging, isDark, handlers, shadeElRef, frameElRef } = useWindowShade();
    const hostRef = useRef<HTMLDivElement | null>(null);
    const sceneRef = useRef<CloudSceneHandle | null>(null);
    const [sceneReady, setSceneReady] = useState(false);

    const planeWindowSrc = buildImageCdnUrl(PLANE_WINDOW_SRC, {
        width: PLANE_WINDOW_IMAGE_WIDTH,
        format: 'webp',
        quality: 68,
    });

    // Mount the cloud scene. This owns a WebGL context and a rAF loop, which is
    // exactly the kind of external resource an effect is for.
    //
    // Deliberately not gated on IntersectionObserver: the window sits in the
    // hero, above the fold, so an observer buys nothing and adds a real failure
    // mode — browsers do not deliver IO callbacks to a hidden document, so a page
    // restored in a background tab would sit on the static layer forever. The
    // render loop is paused on visibilitychange instead, which gives the same
    // saving without the way to get stuck.
    useEffect(() => {
        if (!hostRef.current || !shouldRenderScene()) return;

        let cancelled = false;
        let handle: CloudSceneHandle | null = null;

        void import('./cloudScene')
            .then(({ createCloudScene }) => {
                if (cancelled || !hostRef.current) return;
                const rect = hostRef.current.getBoundingClientRect();
                handle = createCloudScene(Math.max(rect.width, 1), Math.max(rect.height, 1));
                sceneRef.current = handle;
                handle.canvas.style.cssText = 'display:block;width:100%;height:100%';
                hostRef.current.appendChild(handle.canvas);
                handle.setPaused(document.hidden);
                setSceneReady(true);
            })
            .catch((error) => {
                // The static layer stays, so this is not fatal — but swallowing it
                // entirely once cost real debugging time, so leave a trace.
                if (import.meta.env.DEV) console.warn('[PlaneWindow] cloud scene failed to load', error);
            });

        const onResize = () => {
            const rect = hostRef.current?.getBoundingClientRect();
            if (rect && handle) handle.resize(Math.max(rect.width, 1), Math.max(rect.height, 1));
        };
        const onVisibility = () => handle?.setPaused(document.hidden);

        window.addEventListener('resize', onResize);
        document.addEventListener('visibilitychange', onVisibility);

        return () => {
            cancelled = true;
            window.removeEventListener('resize', onResize);
            document.removeEventListener('visibilitychange', onVisibility);
            handle?.dispose();
            sceneRef.current = null;
        };
    }, []);

    // Nothing to animate behind a closed shade, or in a tab nobody is looking at.
    useEffect(() => {
        sceneRef.current?.setPaused(shade > 0.92 || document.hidden);
    }, [shade]);

    const label = isDark ? t('hero.window.open', 'Open the window shade') : t('hero.window.close', 'Close the window shade');

    if (!isHomePathname()) return null;

    return (
        <div
            className="plane-window-wrapper relative select-none"
            style={{ aspectRatio: '580 / 850' }}
            onContextMenu={(event) => event.preventDefault()}
            onDragStart={(event) => event.preventDefault()}
        >
            {/* Sky + clouds, clipped to the glass. The static gradient is always
                painted; the canvas lays over it when and if the scene mounts, so
                the window never looks empty while the chunk loads. */}
            <div className="plane-window-clouds-mask absolute overflow-hidden">
                <div
                    className="absolute inset-0"
                    style={{ background: 'linear-gradient(to bottom, #5CADF4 0%, #94CCFB 33%, #C8E6FB 45%, #FFFFFF 62%)' }}
                />
                {!sceneReady && <div className="plane-window-static-clouds absolute inset-0" aria-hidden="true" />}
                <div ref={hostRef} className="absolute inset-0" aria-hidden="true" />

                {/* The shade itself. There is no shutter artwork for this window,
                    so it is drawn: a panel the colour of the cabin interior that
                    slides down over the glass. */}
                <div
                    ref={(node) => { shadeElRef.current = node; }}
                    className="plane-window-shade absolute inset-0"
                    aria-hidden="true"
                    style={{
                        transform: `translate3d(0, ${-(1 - shade) * SHADE_TRAVEL * 100}%, 0)`,
                        // No transition while dragging: the shade must track the
                        // finger exactly, not chase it. On release the transition
                        // comes back and eases it home from wherever it was left.
                        transition: dragging ? 'none' : 'transform 460ms cubic-bezier(.22,1,.36,1)',
                    }}
                />
            </div>

            {/* Frame on top, dimming as the cabin darkens. */}
            <img
                src={planeWindowSrc}
                alt={t('hero.window.alt', 'Airplane window')}
                width={PLANE_WINDOW_IMAGE_WIDTH}
                height={PLANE_WINDOW_IMAGE_HEIGHT}
                draggable={false}
                ref={(node) => { frameElRef.current = node; }}
                className="relative z-10 size-full object-contain drop-shadow-xl"
                decoding="async"
                fetchPriority="high"
                style={{
                    filter: `brightness(${1 - shade * FRAME_DIM})`,
                    transition: dragging ? 'none' : 'filter 460ms cubic-bezier(.22,1,.36,1)',
                }}
            />

            {/* The grab target, shaped to the glass. A button so it is reachable
                and announceable; arrow keys move the shade for keyboard users. */}
            <button
                type="button"
                {...handlers}
                aria-pressed={shade > 0.5}
                aria-label={label}
                title={label}
                className="plane-window-grip absolute z-20"
                style={{ cursor: dragging ? 'grabbing' : 'grab', touchAction: 'none' }}
            />
        </div>
    );
};
