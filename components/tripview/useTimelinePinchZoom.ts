import { useCallback, useRef, type Dispatch, type SetStateAction } from 'react';

interface UseTimelinePinchZoomOptions {
    isMobile: boolean;
    zoomLevel: number;
    clampZoomLevel: (value: number) => number;
    setZoomLevel: Dispatch<SetStateAction<number>>;
}

const getPinchDistance = (touches: React.TouchList): number | null => {
    if (touches.length < 2) return null;
    const deltaX = touches[0].clientX - touches[1].clientX;
    const deltaY = touches[0].clientY - touches[1].clientY;
    return Math.hypot(deltaX, deltaY);
};

export const useTimelinePinchZoom = ({
    isMobile,
    zoomLevel,
    clampZoomLevel,
    setZoomLevel,
}: UseTimelinePinchZoomOptions) => {
    const pinchStartDistanceRef = useRef<number | null>(null);
    const pinchStartZoomRef = useRef<number | null>(null);

    const handleTimelineTouchStart = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
        if (!isMobile || event.touches.length !== 2) return;
        const distance = getPinchDistance(event.touches);
        if (!distance) return;

        pinchStartDistanceRef.current = distance;
        pinchStartZoomRef.current = zoomLevel;
    }, [isMobile, zoomLevel]);

    const handleTimelineTouchMove = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
        if (!isMobile || event.touches.length !== 2) return;

        const startDistance = pinchStartDistanceRef.current;
        const startZoom = pinchStartZoomRef.current;
        if (!startDistance || !startZoom) return;

        const distance = getPinchDistance(event.touches);
        if (!distance) return;

        event.preventDefault();
        const nextZoom = clampZoomLevel(startZoom * (distance / startDistance));
        setZoomLevel((previous) => (Math.abs(previous - nextZoom) < 0.01 ? previous : nextZoom));
    }, [clampZoomLevel, isMobile, setZoomLevel]);

    const handleTimelineTouchEnd = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
        if (event.touches.length >= 2) return;
        pinchStartDistanceRef.current = null;
        pinchStartZoomRef.current = null;
    }, []);

    return {
        handleTimelineTouchStart,
        handleTimelineTouchMove,
        handleTimelineTouchEnd,
    };
};
