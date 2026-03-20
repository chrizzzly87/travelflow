import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../../lib/utils';
import {
    ensureRuntimeLocationLoaded,
    getRuntimeLocationSnapshot,
    subscribeRuntimeLocation,
    type RuntimeLocationStoreSnapshot,
} from '../../../services/runtimeLocationService';
import {
    getGlobeRotationForLocation,
    projectGlobeLocation,
    type GlobeLocation,
} from './globeProjection';

interface GlobeCardCopy {
    detail?: string;
    emoji: string;
    id: string;
    title: string;
}

interface GlobePreviewCopy {
    alt: string;
    title: string;
}

interface MarkerConfig {
    id: string;
    location: GlobeLocation;
    size: number;
}

interface ArcConfig {
    from: GlobeLocation;
    id: string;
    to: GlobeLocation;
}

interface OverlayConfig {
    anchorId: string;
    anchorX: number;
    anchorY: number;
    depthBoost?: number;
    id: string;
    minVisibility: number;
    offsetX: number;
    offsetY: number;
    rotateDeg?: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const DEFAULT_ORIGIN_LOCATION: GlobeLocation = [53.5511, 9.9937];

const DESTINATION_MARKERS: MarkerConfig[] = [
    { id: 'paris', location: [48.8566, 2.3522], size: 0.026 },
    { id: 'fiji', location: [-17.7134, 178.065], size: 0.024 },
    { id: 'south-africa', location: [-34.5904, 19.3512], size: 0.024 },
    { id: 'thailand-preview', location: [13.7563, 100.5018], size: 0.012 },
    { id: 'route66-chicago', location: [41.8781, -87.6298], size: 0.011 },
    { id: 'route66-st-louis', location: [38.627, -90.1994], size: 0.0085 },
    { id: 'route66-amarillo', location: [35.2219, -101.8313], size: 0.0085 },
    { id: 'route66-santa-monica', location: [34.0195, -118.4912], size: 0.011 },
];

const ROUTE_66_ARCS: ArcConfig[] = [
    {
        id: 'route66-segment-1',
        from: [41.8781, -87.6298],
        to: [38.627, -90.1994],
    },
    {
        id: 'route66-segment-2',
        from: [38.627, -90.1994],
        to: [35.2219, -101.8313],
    },
    {
        id: 'route66-segment-3',
        from: [35.2219, -101.8313],
        to: [34.0195, -118.4912],
    },
];

const canvasSizeDefaults = {
    width: 960,
    height: 960,
};

const displaySizeDefaults = {
    width: 520,
    height: 520,
};

const globeRenderConfig = {
    markerElevation: 0.018,
    offset: [0, 20] as [number, number],
    scale: 0.92,
};

const globeMaskStyle: React.CSSProperties = {
    WebkitMaskImage: 'radial-gradient(circle at center, black 0%, black 78%, rgba(0,0,0,0.95) 90%, transparent 99%)',
    maskImage: 'radial-gradient(circle at center, black 0%, black 78%, rgba(0,0,0,0.95) 90%, transparent 99%)',
    maskRepeat: 'no-repeat',
    maskSize: '100% 100%',
};

const getRuntimeCoordinates = (snapshot: RuntimeLocationStoreSnapshot): GlobeLocation | null => {
    const { latitude, longitude } = snapshot.location;
    if (!snapshot.available || latitude === null || longitude === null) return null;
    return [latitude, longitude];
};

const buildConnectionArcs = (origin: GlobeLocation): ArcConfig[] => [
    { id: 'origin-paris', from: origin, to: [48.8566, 2.3522] },
    { id: 'origin-fiji', from: origin, to: [-17.7134, 178.065] },
    { id: 'origin-south-africa', from: origin, to: [-34.5904, 19.3512] },
    { id: 'origin-thailand-preview', from: origin, to: [13.7563, 100.5018] },
    { id: 'origin-route66', from: origin, to: [41.8781, -87.6298] },
];

export const FeaturesGlobe: React.FC = () => {
    const { t } = useTranslation('features');
    const initialRuntimeSnapshot = getRuntimeLocationSnapshot();
    const initialOriginLocation = getRuntimeCoordinates(initialRuntimeSnapshot) ?? DEFAULT_ORIGIN_LOCATION;
    const initialRotation = getGlobeRotationForLocation(initialOriginLocation);

    const containerRef = useRef<HTMLDivElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const dragRef = useRef<{ pointerId: number; x: number; y: number } | null>(null);
    const overlayRefs = useRef(new Map<string, HTMLDivElement>());
    const markerConfigsRef = useRef<MarkerConfig[]>([]);
    const arcConfigsRef = useRef<ArcConfig[]>([]);
    const lastOriginRef = useRef<GlobeLocation>(initialOriginLocation);
    const rotationRef = useRef({
        phi: initialRotation.phi,
        theta: initialRotation.theta,
        targetPhi: initialRotation.phi,
        targetTheta: initialRotation.theta,
    });

    const [runtimeLocation, setRuntimeLocation] = useState<RuntimeLocationStoreSnapshot>(initialRuntimeSnapshot);
    const [canvasSize, setCanvasSize] = useState(canvasSizeDefaults);
    const [displaySize, setDisplaySize] = useState(displaySizeDefaults);
    const [isDragging, setIsDragging] = useState(false);
    const [isFallback, setIsFallback] = useState(false);
    const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

    const cardMap = useMemo(() => {
        const cards = t('globe.cards', { returnObjects: true }) as GlobeCardCopy[];
        return new Map(cards.map((card) => [card.id, card]));
    }, [t]);

    const preview = t('globe.preview', { returnObjects: true }) as GlobePreviewCopy;
    const compactLayout = displaySize.width < 560;
    const originLocation = getRuntimeCoordinates(runtimeLocation) ?? DEFAULT_ORIGIN_LOCATION;

    const markerConfigs = useMemo<MarkerConfig[]>(() => ([
        {
            id: 'origin',
            location: originLocation,
            size: 0.0001,
        },
        ...DESTINATION_MARKERS,
    ]), [originLocation]);

    const arcConfigs = useMemo<ArcConfig[]>(() => ([
        ...buildConnectionArcs(originLocation),
        ...ROUTE_66_ARCS,
    ]), [originLocation]);

    markerConfigsRef.current = markerConfigs;
    arcConfigsRef.current = arcConfigs;

    const overlayConfigs = useMemo<OverlayConfig[]>(() => [
        {
            id: 'origin-marker',
            anchorId: 'origin',
            anchorX: 0.5,
            anchorY: 0.5,
            minVisibility: -0.04,
            offsetX: 0,
            offsetY: 0,
        },
        {
            id: 'origin-core',
            anchorId: 'origin',
            anchorX: 0.5,
            anchorY: 0.5,
            depthBoost: 14,
            minVisibility: -0.04,
            offsetX: 0,
            offsetY: 0,
        },
        {
            id: 'paris-panel',
            anchorId: 'paris',
            anchorX: 0.08,
            anchorY: 1,
            minVisibility: 0.03,
            offsetX: compactLayout ? -6 : -10,
            offsetY: compactLayout ? -28 : -34,
        },
        {
            id: 'fiji-panel',
            anchorId: 'fiji',
            anchorX: 0.18,
            anchorY: 0.16,
            minVisibility: 0.02,
            offsetX: compactLayout ? 10 : 14,
            offsetY: compactLayout ? 4 : 8,
        },
        {
            id: 'south-africa-panel',
            anchorId: 'south-africa',
            anchorX: 0,
            anchorY: 0.56,
            minVisibility: -0.02,
            offsetX: compactLayout ? 10 : 14,
            offsetY: compactLayout ? -6 : -10,
        },
        {
            id: 'route66-panel',
            anchorId: 'route66-santa-monica',
            anchorX: 0,
            anchorY: 0.74,
            minVisibility: -0.05,
            offsetX: compactLayout ? 10 : 14,
            offsetY: compactLayout ? -12 : -16,
        },
        {
            id: 'trip-preview',
            anchorId: 'thailand-preview',
            anchorX: 0.66,
            anchorY: 0.16,
            depthBoost: 14,
            minVisibility: -0.1,
            offsetX: compactLayout ? -46 : -54,
            offsetY: compactLayout ? 18 : 24,
            rotateDeg: -5,
        },
    ], [compactLayout]);

    useEffect(() => {
        const unsubscribe = subscribeRuntimeLocation((snapshot) => {
            setRuntimeLocation(snapshot);
        });

        void ensureRuntimeLocationLoaded();

        return unsubscribe;
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;

        if (typeof window.matchMedia !== 'function') {
            setPrefersReducedMotion(false);
            return undefined;
        }

        const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        const updateReducedMotion = () => setPrefersReducedMotion(mediaQuery.matches);
        updateReducedMotion();

        if (typeof mediaQuery.addEventListener === 'function') {
            mediaQuery.addEventListener('change', updateReducedMotion);
            return () => mediaQuery.removeEventListener('change', updateReducedMotion);
        }

        mediaQuery.addListener(updateReducedMotion);
        return () => mediaQuery.removeListener(updateReducedMotion);
    }, []);

    useEffect(() => {
        const node = containerRef.current;
        if (!node) return undefined;

        const updateSize = () => {
            const rect = node.getBoundingClientRect();
            const ratio = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 2);
            const width = Math.max(640, Math.round((rect.width || 480) * ratio));
            const height = Math.max(640, Math.round((rect.height || rect.width || 480) * ratio));
            setDisplaySize({
                width: rect.width || 480,
                height: rect.height || rect.width || 480,
            });
            setCanvasSize({ width, height });
        };

        updateSize();

        if (typeof ResizeObserver === 'undefined') return undefined;
        const observer = new ResizeObserver(() => updateSize());
        observer.observe(node);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        const [latitude, longitude] = originLocation;
        const [previousLatitude, previousLongitude] = lastOriginRef.current;

        if (latitude === previousLatitude && longitude === previousLongitude) return;

        lastOriginRef.current = originLocation;
        const nextRotation = getGlobeRotationForLocation(originLocation);
        rotationRef.current.targetPhi = nextRotation.phi;
        rotationRef.current.targetTheta = nextRotation.theta;
    }, [originLocation]);

    useEffect(() => {
        let isCancelled = false;
        let animationFrameId = 0;
        let globe: { destroy?: () => void; update?: (state: Record<string, unknown>) => void } | undefined;

        const updateOverlays = () => {
            const markerConfigMap = new Map(markerConfigsRef.current.map((marker) => [marker.id, marker]));
            const overlayPadding = compactLayout ? 12 : 18;
            const overlayScale = compactLayout ? 0.92 : 1;

            overlayConfigs.forEach((overlay) => {
                const node = overlayRefs.current.get(overlay.id);
                const marker = markerConfigMap.get(overlay.anchorId);
                if (!node || !marker) return;

                const projected = projectGlobeLocation(marker.location, {
                    width: displaySize.width,
                    height: displaySize.height,
                    phi: rotationRef.current.phi,
                    theta: rotationRef.current.theta,
                    scale: globeRenderConfig.scale,
                    offset: globeRenderConfig.offset,
                    markerElevation: globeRenderConfig.markerElevation,
                });

                const renderedVisibility = clamp((projected.depth - overlay.minVisibility + 0.16) / 0.24, 0, 1);
                const nodeWidth = node.offsetWidth;
                const nodeHeight = node.offsetHeight;
                const unclampedX = projected.x - (nodeWidth * overlay.anchorX) + (overlay.offsetX * overlayScale);
                const unclampedY = projected.y - (nodeHeight * overlay.anchorY) + (overlay.offsetY * overlayScale);
                const x = clamp(unclampedX, overlayPadding, displaySize.width - nodeWidth - overlayPadding);
                const y = clamp(unclampedY, overlayPadding, displaySize.height - nodeHeight - overlayPadding);
                const scale = overlay.id === 'origin-marker'
                    ? 0.96 + (renderedVisibility * 0.08)
                    : overlay.id === 'origin-core'
                        ? 0.98 + (renderedVisibility * 0.04)
                        : 0.92 + (renderedVisibility * 0.08);
                const blur = overlay.id === 'origin-marker'
                    ? (1 - renderedVisibility) * 9
                    : overlay.id === 'origin-core'
                        ? (1 - renderedVisibility) * 2.5
                        : (1 - renderedVisibility) * 15;
                const translateY = overlay.id === 'origin-core' ? (1 - renderedVisibility) * 4 : (1 - renderedVisibility) * 10;

                node.style.opacity = renderedVisibility.toFixed(3);
                node.style.visibility = renderedVisibility < 0.005 ? 'hidden' : 'visible';
                node.style.transform = `translate3d(${x}px, ${y + translateY}px, 0) scale(${scale.toFixed(3)}) rotate(${overlay.rotateDeg ?? 0}deg)`;
                node.style.filter = `blur(${blur.toFixed(2)}px)`;
                node.style.zIndex = overlay.id === 'origin-marker'
                    ? '0'
                    : overlay.id === 'origin-core'
                        ? '26'
                    : `${20 + Math.round((projected.depth + 1) * 12) + (overlay.depthBoost ?? 0)}`;
            });
        };

        const initialize = async () => {
            const canvas = canvasRef.current;
            if (!canvas) return;

            try {
                const hasWebGlContext = Boolean(
                    canvas.getContext('webgl2')
                    || canvas.getContext('webgl')
                    || canvas.getContext('experimental-webgl'),
                );

                if (!hasWebGlContext) {
                    setIsFallback(true);
                    return;
                }

                const cobeModule = await import('cobe');
                if (isCancelled) return;

                const createGlobe = cobeModule.default;
                const ratio = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 2);

                globe = createGlobe(canvas, {
                    devicePixelRatio: ratio,
                    width: canvasSize.width,
                    height: canvasSize.height,
                    phi: rotationRef.current.phi,
                    theta: rotationRef.current.theta,
                    dark: 0,
                    diffuse: 1.3,
                    mapSamples: canvasSize.width > 900 ? 26000 : 19000,
                    mapBrightness: 6.1,
                    mapBaseBrightness: 0.06,
                    baseColor: [0.975, 0.978, 0.986],
                    markerColor: [0.38, 0.31, 0.9],
                    glowColor: [0.995, 0.995, 0.995],
                    arcColor: [0.38, 0.31, 0.9],
                    arcWidth: 0.58,
                    arcHeight: 0.14,
                    markerElevation: globeRenderConfig.markerElevation,
                    scale: globeRenderConfig.scale,
                    offset: globeRenderConfig.offset,
                    opacity: 1,
                    markers: markerConfigsRef.current,
                    arcs: arcConfigsRef.current,
                });

                const animate = () => {
                    const rotation = rotationRef.current;

                    if (!dragRef.current && !prefersReducedMotion) {
                        rotation.targetPhi += 0.00135;
                    }

                    rotation.targetTheta = clamp(rotation.targetTheta, -0.34, 0.34);
                    rotation.phi += (rotation.targetPhi - rotation.phi) * 0.075;
                    rotation.theta += (rotation.targetTheta - rotation.theta) * 0.085;

                    globe?.update?.({
                        phi: rotation.phi,
                        theta: rotation.theta,
                        width: canvasSize.width,
                        height: canvasSize.height,
                        markers: markerConfigsRef.current,
                        arcs: arcConfigsRef.current,
                    });
                    updateOverlays();

                    animationFrameId = requestAnimationFrame(animate);
                };

                animate();
                setIsFallback(false);
            } catch {
                if (!isCancelled) {
                    setIsFallback(true);
                }
            }
        };

        void initialize();

        return () => {
            isCancelled = true;
            cancelAnimationFrame(animationFrameId);
            globe?.destroy?.();
        };
    }, [canvasSize.height, canvasSize.width, compactLayout, displaySize.height, displaySize.width, overlayConfigs, prefersReducedMotion]);

    const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
        dragRef.current = {
            pointerId: event.pointerId,
            x: event.clientX,
            y: event.clientY,
        };
        setIsDragging(true);
        event.currentTarget.setPointerCapture?.(event.pointerId);
    };

    const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
        if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return;

        const deltaX = event.clientX - dragRef.current.x;
        const deltaY = event.clientY - dragRef.current.y;
        dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };

        rotationRef.current.targetPhi += deltaX * 0.0105;
        rotationRef.current.targetTheta = clamp(
            rotationRef.current.targetTheta + deltaY * 0.0065,
            -0.34,
            0.34,
        );
    };

    const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
        if (dragRef.current?.pointerId !== event.pointerId) return;
        dragRef.current = null;
        setIsDragging(false);
        event.currentTarget.releasePointerCapture?.(event.pointerId);
    };

    const parisCard = cardMap.get('paris');
    const fijiCard = cardMap.get('fiji');
    const southAfricaCard = cardMap.get('south-africa');
    const route66Card = cardMap.get('route66');

    return (
        <div
            ref={containerRef}
            role="img"
            aria-label={t('globe.accessibility')}
            className={cn(
                'relative isolate aspect-[1.02/0.98] min-h-[480px] overflow-hidden',
                isDragging ? 'cursor-grabbing' : 'cursor-grab',
            )}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            style={{ touchAction: 'none' }}
        >
            <div className="pointer-events-none absolute inset-0 z-0 [&>*]:invisible [&>*]:opacity-0">
                <div
                    ref={(node) => {
                        if (node) overlayRefs.current.set('origin-marker', node);
                        else overlayRefs.current.delete('origin-marker');
                    }}
                    className="absolute left-0 top-0 transition-[opacity,filter,transform] duration-500 ease-out will-change-transform"
                >
                    <span className="relative block size-10">
                        <span
                            className="absolute inset-[-9px] rounded-full border-2 border-[#f39a3d]/55 animate-ping"
                            style={{ animationDuration: '2.4s' }}
                        />
                        <span
                            className="absolute inset-[-18px] rounded-full border border-[#f39a3d]/38 animate-ping"
                            style={{ animationDelay: '0.55s', animationDuration: '3.1s' }}
                        />
                        <span className="absolute inset-[1px] rounded-full bg-[#f7a454]/28 blur-lg" />
                        <span className="absolute inset-[10px] rounded-full bg-[#f38b2a]/28 blur-sm" />
                    </span>
                </div>
            </div>

            <canvas
                ref={canvasRef}
                className={cn(
                    'absolute inset-0 z-10 size-full select-none transition-opacity duration-500',
                    isFallback ? 'opacity-0' : 'opacity-100',
                )}
                aria-hidden="true"
                style={globeMaskStyle}
            />

            {!isFallback ? (
                <div className="pointer-events-none absolute inset-0 z-20 [&>*]:invisible [&>*]:opacity-0">
                    <div
                        ref={(node) => {
                            if (node) overlayRefs.current.set('origin-core', node);
                            else overlayRefs.current.delete('origin-core');
                        }}
                        className="absolute left-0 top-0 transition-[opacity,filter,transform] duration-500 ease-out will-change-transform"
                    >
                        <span className="relative block size-4">
                            <span className="absolute inset-0 rounded-full border border-white/95 bg-[#f38b2a] shadow-[0_0_0_2px_rgba(255,255,255,0.92),0_0_16px_rgba(243,139,42,0.38)]" />
                        </span>
                    </div>

                    {parisCard ? (
                        <div
                            ref={(node) => {
                                if (node) overlayRefs.current.set('paris-panel', node);
                                else overlayRefs.current.delete('paris-panel');
                            }}
                            className="absolute left-0 top-0 w-[7.6rem] rounded-[12px] border border-[#ddd1ff] bg-[#f7f3ff]/98 px-2.5 py-2 text-slate-800 shadow-[0_14px_22px_rgba(91,79,230,0.1)] transition-[opacity,filter,transform] duration-500 ease-out will-change-transform"
                        >
                            <p className="flex items-start gap-1.5 text-[0.76rem] font-semibold leading-[1.15] text-slate-900">
                                <span className="shrink-0 text-[0.92rem]" aria-hidden="true">{parisCard.emoji}</span>
                                <span>{parisCard.title}</span>
                            </p>
                        </div>
                    ) : null}

                    {fijiCard ? (
                        <div
                            ref={(node) => {
                                if (node) overlayRefs.current.set('fiji-panel', node);
                                else overlayRefs.current.delete('fiji-panel');
                            }}
                            className="absolute left-0 top-0 w-[7.9rem] rounded-[12px] border border-[#cbe9d7] bg-[#eef9f1]/98 px-2.5 py-2 text-slate-800 shadow-[0_14px_22px_rgba(36,116,88,0.1)] transition-[opacity,filter,transform] duration-500 ease-out will-change-transform"
                        >
                            <p className="flex items-start gap-1.5 text-[0.76rem] font-semibold leading-[1.15] text-slate-900">
                                <span className="shrink-0 text-[0.92rem]" aria-hidden="true">{fijiCard.emoji}</span>
                                <span>{fijiCard.title}</span>
                            </p>
                        </div>
                    ) : null}

                    {southAfricaCard ? (
                        <div
                            ref={(node) => {
                                if (node) overlayRefs.current.set('south-africa-panel', node);
                                else overlayRefs.current.delete('south-africa-panel');
                            }}
                            className="absolute left-0 top-0 w-[8.1rem] rounded-[12px] border border-[#cfe8ee] bg-[#eef8fb]/98 px-2.5 py-2 text-slate-800 shadow-[0_14px_22px_rgba(44,116,154,0.1)] transition-[opacity,filter,transform] duration-500 ease-out will-change-transform"
                        >
                            <p className="flex items-start gap-1.5 text-[0.76rem] font-semibold leading-[1.15] text-slate-900">
                                <span className="shrink-0 text-[0.92rem]" aria-hidden="true">{southAfricaCard.emoji}</span>
                                <span>{southAfricaCard.title}</span>
                            </p>
                        </div>
                    ) : null}

                    {route66Card ? (
                        <div
                            ref={(node) => {
                                if (node) overlayRefs.current.set('route66-panel', node);
                                else overlayRefs.current.delete('route66-panel');
                            }}
                            className="absolute left-0 top-0 w-[7.4rem] rounded-[12px] border border-[#f0d5bf] bg-[#fff4e9]/98 px-2.5 py-2 text-slate-800 shadow-[0_14px_22px_rgba(170,96,78,0.1)] transition-[opacity,filter,transform] duration-500 ease-out will-change-transform"
                        >
                            <p className="flex items-start gap-1.5 text-[0.76rem] font-semibold leading-[1.15] text-slate-900">
                                <span className="shrink-0 text-[0.92rem]" aria-hidden="true">{route66Card.emoji}</span>
                                <span>{route66Card.title}</span>
                            </p>
                        </div>
                    ) : null}

                    <div
                        ref={(node) => {
                            if (node) overlayRefs.current.set('trip-preview', node);
                            else overlayRefs.current.delete('trip-preview');
                        }}
                        className="absolute left-0 top-0 w-[9.75rem] border border-slate-200 bg-white px-2.5 py-2.5 shadow-[0_20px_34px_rgba(15,23,42,0.13)] transition-[opacity,filter,transform] duration-500 ease-out will-change-transform"
                        style={{ borderRadius: '14px 14px 18px 18px' }}
                        >
                            <div className="overflow-hidden rounded-[10px] border border-slate-100">
                                <img
                                    src="/images/trip-maps/thailand-islands.png"
                                    alt={preview.alt}
                                    className="h-20 w-full object-cover"
                                    loading="lazy"
                                />
                            </div>
                            <div className="pt-2.5">
                                <p className="text-[0.78rem] font-semibold leading-[1.2] text-slate-900">
                                    {preview.title}
                                </p>
                            </div>
                        </div>
                </div>
            ) : null}

            {isFallback ? (
                <div className="pointer-events-none absolute inset-x-6 bottom-6 rounded-[16px] border border-slate-200 bg-white p-5 shadow-[0_14px_28px_rgba(15,23,42,0.08)]">
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-400">
                        {t('globe.fallbackTitle')}
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">
                        {t('globe.fallbackDescription')}
                    </p>
                </div>
            ) : null}
        </div>
    );
};
