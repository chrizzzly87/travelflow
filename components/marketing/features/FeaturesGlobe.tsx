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
    color?: [number, number, number];
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

const getGlobeRenderConfig = (displayWidth: number) => {
    const phoneLayout = displayWidth < 440;
    const compactLayout = displayWidth < 560;

    return {
        markerElevation: phoneLayout ? 0.0105 : compactLayout ? 0.0115 : 0.013,
        offset: [0, phoneLayout ? 10 : compactLayout ? 14 : 18] as [number, number],
        scale: phoneLayout ? 0.78 : compactLayout ? 0.82 : 0.86,
        arcWidth: phoneLayout ? 0.42 : compactLayout ? 0.46 : 0.5,
        arcHeight: phoneLayout ? 0.23 : compactLayout ? 0.27 : 0.3,
    };
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
    const phoneLayout = displaySize.width < 440;
    const compactLayout = displaySize.width < 560;
    const globeRenderConfig = useMemo(() => getGlobeRenderConfig(displaySize.width), [displaySize.width]);
    const originLocation = getRuntimeCoordinates(runtimeLocation) ?? DEFAULT_ORIGIN_LOCATION;

    const markerConfigs = useMemo<MarkerConfig[]>(() => ([
        {
            id: 'origin',
            location: originLocation,
            size: phoneLayout ? 0.024 : 0.028,
            color: [0.952, 0.552, 0.157],
        },
        ...DESTINATION_MARKERS,
    ]), [originLocation, phoneLayout]);

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
            id: 'paris-panel',
            anchorId: 'paris',
            anchorX: 0.02,
            anchorY: 1,
            minVisibility: 0.03,
            offsetX: phoneLayout ? 6 : compactLayout ? 10 : 14,
            offsetY: phoneLayout ? -24 : compactLayout ? -30 : -36,
        },
        {
            id: 'fiji-panel',
            anchorId: 'fiji',
            anchorX: 0.18,
            anchorY: 0.16,
            minVisibility: 0.02,
            offsetX: phoneLayout ? 7 : compactLayout ? 10 : 14,
            offsetY: phoneLayout ? 2 : compactLayout ? 4 : 8,
        },
        {
            id: 'south-africa-panel',
            anchorId: 'south-africa',
            anchorX: 0,
            anchorY: 0.56,
            minVisibility: -0.02,
            offsetX: phoneLayout ? 7 : compactLayout ? 10 : 14,
            offsetY: phoneLayout ? -3 : compactLayout ? -6 : -10,
        },
        {
            id: 'route66-panel',
            anchorId: 'route66-santa-monica',
            anchorX: 0,
            anchorY: 0.74,
            minVisibility: -0.05,
            offsetX: phoneLayout ? 7 : compactLayout ? 10 : 14,
            offsetY: phoneLayout ? -8 : compactLayout ? -12 : -16,
        },
        {
            id: 'trip-preview',
            anchorId: 'thailand-preview',
            anchorX: 0.66,
            anchorY: 0.16,
            depthBoost: 14,
            minVisibility: -0.1,
            offsetX: phoneLayout ? -40 : compactLayout ? -46 : -54,
            offsetY: phoneLayout ? 12 : compactLayout ? 18 : 24,
            rotateDeg: -5,
        },
    ], [compactLayout, phoneLayout]);

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
            const displayWidth = Math.max(280, rect.width || 480);
            const displayHeight = Math.max(320, rect.height || rect.width || 480);
            const width = Math.max(640, Math.round(displayWidth * ratio));
            const height = Math.max(640, Math.round(displayHeight * ratio));
            setDisplaySize({
                width: displayWidth,
                height: displayHeight,
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
            const markerConfigMap = new Map<string, MarkerConfig>(
                markerConfigsRef.current.map((marker) => [marker.id, marker] as const),
            );
            const overlayPadding = phoneLayout ? 8 : compactLayout ? 12 : 18;
            const overlayScale = phoneLayout ? 0.84 : compactLayout ? 0.92 : 1;

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
                    ? 0.92 + (renderedVisibility * 0.08)
                    : 0.9 + (renderedVisibility * 0.08);
                const blur = overlay.id === 'origin-marker'
                    ? (1 - renderedVisibility) * 6
                    : (1 - renderedVisibility) * 12;
                const translateY = overlay.id === 'origin-marker' ? (1 - renderedVisibility) * 2 : (1 - renderedVisibility) * 8;

                node.style.opacity = renderedVisibility.toFixed(3);
                node.style.transform = `translate3d(${x}px, ${y + translateY}px, 0) scale(${scale.toFixed(3)}) rotate(${overlay.rotateDeg ?? 0}deg)`;
                node.style.transformOrigin = '';
                node.style.filter = `blur(${blur.toFixed(2)}px)`;
                node.style.zIndex = overlay.id === 'origin-marker'
                    ? '0'
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
                    arcWidth: globeRenderConfig.arcWidth,
                    arcHeight: globeRenderConfig.arcHeight,
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
    }, [canvasSize.height, canvasSize.width, compactLayout, displaySize.height, displaySize.width, globeRenderConfig.arcHeight, globeRenderConfig.arcWidth, globeRenderConfig.markerElevation, globeRenderConfig.offset, globeRenderConfig.scale, overlayConfigs, phoneLayout, prefersReducedMotion]);

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
                'relative isolate mx-auto h-[min(88vw,24rem)] w-full max-w-[34rem] overflow-visible sm:h-[28rem] lg:mx-0 lg:ml-auto lg:h-[34rem]',
                isDragging ? 'cursor-grabbing' : 'cursor-grab',
            )}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            style={{ touchAction: 'none' }}
        >
            <div className="pointer-events-none absolute inset-0 z-20">
                <div
                    ref={(node) => {
                        if (node) overlayRefs.current.set('origin-marker', node);
                        else overlayRefs.current.delete('origin-marker');
                    }}
                    className="absolute left-0 top-0 will-change-transform"
                >
                    <span className="relative block size-11">
                        <span
                            className="absolute inset-[-8px] rounded-full border-2 border-[#f39a3d]/65 animate-ping"
                            style={{ animationDuration: '1.8s' }}
                        />
                        <span
                            className="absolute inset-[-18px] rounded-full border border-[#f39a3d]/42 animate-ping"
                            style={{ animationDelay: '0.28s', animationDuration: '2.4s' }}
                        />
                        <span className="absolute inset-[-2px] rounded-full bg-[#f7a454]/28 blur-lg" />
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
            />

            {!isFallback ? (
                <div className="pointer-events-none absolute inset-0 z-20">
                    {parisCard ? (
                        <div
                            ref={(node) => {
                                if (node) overlayRefs.current.set('paris-panel', node);
                                else overlayRefs.current.delete('paris-panel');
                            }}
                            className="absolute left-0 top-0 w-[6.8rem] rounded-[11px] border border-[#ddd1ff] bg-[#f7f3ff]/96 px-2 py-1.5 text-slate-800 will-change-transform sm:w-[7.1rem]"
                        >
                            <p className="flex items-start gap-1.5 text-[0.67rem] font-semibold leading-[1.15] text-slate-900 sm:text-[0.7rem]">
                                <span className="shrink-0 text-[0.82rem] leading-none" aria-hidden="true">{parisCard.emoji}</span>
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
                            className="absolute left-0 top-0 w-[6.9rem] rounded-[11px] border border-[#cbe9d7] bg-[#eef9f1]/96 px-2 py-1.5 text-slate-800 will-change-transform sm:w-[7.2rem]"
                        >
                            <p className="flex items-start gap-1.5 text-[0.67rem] font-semibold leading-[1.15] text-slate-900 sm:text-[0.7rem]">
                                <span className="shrink-0 text-[0.82rem] leading-none" aria-hidden="true">{fijiCard.emoji}</span>
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
                            className="absolute left-0 top-0 w-[7.1rem] rounded-[11px] border border-[#cfe8ee] bg-[#eef8fb]/96 px-2 py-1.5 text-slate-800 will-change-transform sm:w-[7.5rem]"
                        >
                            <p className="flex items-start gap-1.5 text-[0.67rem] font-semibold leading-[1.15] text-slate-900 sm:text-[0.7rem]">
                                <span className="shrink-0 text-[0.82rem] leading-none" aria-hidden="true">{southAfricaCard.emoji}</span>
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
                            className="absolute left-0 top-0 w-[6.8rem] rounded-[11px] border border-[#f0d5bf] bg-[#fff4e9]/96 px-2 py-1.5 text-slate-800 will-change-transform sm:w-[7.1rem]"
                        >
                            <p className="flex items-start gap-1.5 text-[0.67rem] font-semibold leading-[1.15] text-slate-900 sm:text-[0.7rem]">
                                <span className="shrink-0 text-[0.82rem] leading-none" aria-hidden="true">{route66Card.emoji}</span>
                                <span>{route66Card.title}</span>
                            </p>
                        </div>
                    ) : null}

                    <div
                        ref={(node) => {
                            if (node) overlayRefs.current.set('trip-preview', node);
                            else overlayRefs.current.delete('trip-preview');
                        }}
                        className="absolute left-0 top-0 w-[8.45rem] border border-slate-200 bg-white px-2 py-2 shadow-[0_20px_34px_rgba(15,23,42,0.13)] will-change-transform sm:w-[9rem]"
                        style={{ borderRadius: '14px 14px 18px 18px' }}
                        >
                            <div className="overflow-hidden rounded-[10px] border border-slate-100">
                                <img
                                    src="/images/trip-maps/thailand-islands.png"
                                    alt={preview.alt}
                                    className="h-16 w-full object-cover sm:h-18"
                                    loading="lazy"
                                />
                            </div>
                            <div className="pt-2">
                                <p className="text-[0.68rem] font-semibold leading-[1.15] text-slate-900 sm:text-[0.72rem]">
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
