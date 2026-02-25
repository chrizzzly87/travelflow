import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';

const DEFAULT_MAP_BOOTSTRAP_DELAY_MS = 900;
const DEFAULT_MAP_BOOTSTRAP_MAX_WAIT_MS = 4000;
const DEFAULT_MAP_BOOTSTRAP_INTERSECTION_THRESHOLD = 0.01;

interface UseDeferredMapBootstrapOptions {
    viewMode: 'planner' | 'print';
    effectiveLayoutMode: 'vertical' | 'horizontal';
    isMobile: boolean;
    isMobileMapExpanded: boolean;
    bootstrapDelayMs?: number;
    bootstrapMaxWaitMs?: number;
    intersectionThreshold?: number;
}

interface UseDeferredMapBootstrapResult {
    mapViewportRef: MutableRefObject<HTMLDivElement | null>;
    isMapBootstrapEnabled: boolean;
    enableMapBootstrap: () => void;
}

export const useDeferredMapBootstrap = ({
    viewMode,
    effectiveLayoutMode,
    isMobile,
    isMobileMapExpanded,
    bootstrapDelayMs = DEFAULT_MAP_BOOTSTRAP_DELAY_MS,
    bootstrapMaxWaitMs = DEFAULT_MAP_BOOTSTRAP_MAX_WAIT_MS,
    intersectionThreshold = DEFAULT_MAP_BOOTSTRAP_INTERSECTION_THRESHOLD,
}: UseDeferredMapBootstrapOptions): UseDeferredMapBootstrapResult => {
    const [isMapBootstrapEnabled, setIsMapBootstrapEnabled] = useState(false);
    const [isMapViewportVisible, setIsMapViewportVisible] = useState(false);
    const [hasMapBootstrapDelayElapsed, setHasMapBootstrapDelayElapsed] = useState(false);
    const mapViewportRef = useRef<HTMLDivElement | null>(null);

    const enableMapBootstrap = useCallback(() => {
        setIsMapBootstrapEnabled(true);
    }, []);

    useEffect(() => {
        if (isMapBootstrapEnabled || hasMapBootstrapDelayElapsed || typeof window === 'undefined') return;
        const timer = window.setTimeout(() => {
            setHasMapBootstrapDelayElapsed(true);
        }, bootstrapDelayMs);
        return () => window.clearTimeout(timer);
    }, [bootstrapDelayMs, hasMapBootstrapDelayElapsed, isMapBootstrapEnabled]);

    useEffect(() => {
        if (isMapBootstrapEnabled) return;
        if (hasMapBootstrapDelayElapsed && isMapViewportVisible) {
            setIsMapBootstrapEnabled(true);
        }
    }, [hasMapBootstrapDelayElapsed, isMapBootstrapEnabled, isMapViewportVisible]);

    useEffect(() => {
        if (isMapBootstrapEnabled || typeof window === 'undefined') return;
        const forceEnableTimer = window.setTimeout(() => {
            setIsMapBootstrapEnabled(true);
        }, bootstrapMaxWaitMs);
        return () => window.clearTimeout(forceEnableTimer);
    }, [bootstrapMaxWaitMs, isMapBootstrapEnabled]);

    useEffect(() => {
        if (isMapBootstrapEnabled || typeof window === 'undefined') return;
        const interactionEvents: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'touchstart'];
        const handleInteraction = () => setIsMapBootstrapEnabled(true);
        interactionEvents.forEach((eventName) => {
            window.addEventListener(eventName, handleInteraction);
        });
        return () => {
            interactionEvents.forEach((eventName) => {
                window.removeEventListener(eventName, handleInteraction);
            });
        };
    }, [isMapBootstrapEnabled]);

    useEffect(() => {
        if (isMapBootstrapEnabled || typeof window === 'undefined' || viewMode !== 'planner') return;
        const mapContainer = mapViewportRef.current;
        if (!mapContainer) return;
        if (typeof window.IntersectionObserver !== 'function') {
            setIsMapViewportVisible(true);
            return;
        }

        const observer = new window.IntersectionObserver(
            (entries) => {
                const mapIsVisible = entries.some((entry) => entry.isIntersecting || entry.intersectionRatio > 0);
                if (mapIsVisible) {
                    setIsMapViewportVisible(true);
                    observer.disconnect();
                }
            },
            { threshold: intersectionThreshold }
        );

        observer.observe(mapContainer);
        return () => observer.disconnect();
    }, [
        effectiveLayoutMode,
        intersectionThreshold,
        isMapBootstrapEnabled,
        isMobile,
        isMobileMapExpanded,
        viewMode,
    ]);

    return {
        mapViewportRef,
        isMapBootstrapEnabled,
        enableMapBootstrap,
    };
};
