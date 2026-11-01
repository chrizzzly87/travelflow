import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowCounterClockwise, CornersOut, Minus, Moon, Plus, Sun } from '@phosphor-icons/react';

import { Button } from '../../ui/button';
import { showAppToast } from '../../ui/appToast';
import { useTheme } from '../../../contexts/theme/useTheme';
import {
    DEFAULT_CAMERA,
    clampCamera,
    fitCameraToBounds,
    loadCamera,
    panCamera,
    revealScreenRect,
    saveCamera,
    unionRects,
    zoomCameraAround,
    type CanvasCamera,
    type CanvasRect,
} from './canvasCamera';
import { DEFAULT_LAYOUT_OPTIONS, chooseColumnCount, layoutGroups, type GroupSize } from './canvasLayout';
import { CANVAS_SURFACE_ATTRIBUTE } from './canvasFrame';

export interface CanvasGroupDefinition {
    id: string;
    title: string;
    render: () => React.ReactNode;
}

interface ComponentCanvasProps {
    groups: CanvasGroupDefinition[];
}

export const CANVAS_GROUP_HASH_PREFIX = '#canvas-group-';

const KEYBOARD_PAN_STEP = 80;
const KEYBOARD_ZOOM_STEP = 1.2;
const WHEEL_ZOOM_SPEED = 0.01;
const WHEEL_ZOOM_MAX_DELTA = 30;
const SAVE_DELAY_MS = 300;
/** Portalled layers that belong to canvas previews (menus, popovers, dialogs, drawers). */
const PREVIEW_PORTAL_SELECTOR = '[data-radix-popper-content-wrapper], [role="dialog"][data-state], [data-vaul-drawer]';

const isSurface = (target: EventTarget | null): boolean =>
    target instanceof Element && target.hasAttribute(CANVAS_SURFACE_ATTRIBUTE);

const SCROLLABLE_OVERFLOW = /(auto|scroll|overlay)/;

/** Whether some element between `target` and `stop` can still scroll the way the wheel points. */
const canScrollNatively = (target: Element, stop: Element, dx: number, dy: number): boolean => {
    for (let node: Element | null = target; node && node !== stop; node = node.parentElement) {
        const style = window.getComputedStyle(node);
        if (dy !== 0 && SCROLLABLE_OVERFLOW.test(style.overflowY) && node.scrollHeight > node.clientHeight) {
            if (dy < 0 ? node.scrollTop > 0 : node.scrollTop + node.clientHeight < node.scrollHeight - 1) return true;
        }
        if (dx !== 0 && SCROLLABLE_OVERFLOW.test(style.overflowX) && node.scrollWidth > node.clientWidth) {
            const left = Math.abs(node.scrollLeft);
            if (dx < 0 ? left > 0 : left + node.clientWidth < node.scrollWidth - 1) return true;
        }
    }
    return false;
};

interface PointerPoint {
    x: number;
    y: number;
}

/**
 * A pannable, zoomable canvas of component groups.
 *
 * The world layer carries one CSS transform, written at most once per frame.
 * Groups are measured with a ResizeObserver (layout sizes, unaffected by the
 * transform) and placed by `layoutGroups`. Only the camera is persisted.
 */
export const ComponentCanvas: React.FC<ComponentCanvasProps> = ({ groups }) => {
    const { resolvedTheme, toggle: toggleTheme } = useTheme();
    const viewportRef = useRef<HTMLDivElement | null>(null);
    const worldRef = useRef<HTMLDivElement | null>(null);
    const zoomReadoutRef = useRef<HTMLSpanElement | null>(null);

    const [storedCamera] = useState(loadCamera);
    const cameraRef = useRef<CanvasCamera>(storedCamera ?? DEFAULT_CAMERA);
    const frameRef = useRef<number | null>(null);
    const saveTimerRef = useRef<number | null>(null);

    const [rects, setRects] = useState<Record<string, CanvasRect>>({});
    const rectsRef = useRef(rects);
    rectsRef.current = rects;
    const sizesRef = useRef(new Map<string, GroupSize>());
    const assignmentRef = useRef<Record<string, number>>({});
    const columnsRef = useRef<number | null>(null);
    const hasFittedRef = useRef(storedCamera !== null);
    const groupsRef = useRef(groups);
    groupsRef.current = groups;

    // --- Camera ---------------------------------------------------------

    const writeTransform = useCallback(() => {
        frameRef.current = null;
        const world = worldRef.current;
        const viewport = viewportRef.current;
        if (!world || !viewport) return;
        const { x, y, zoom } = cameraRef.current;
        world.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${zoom})`;
        if (zoomReadoutRef.current) zoomReadoutRef.current.textContent = `${Math.round(zoom * 100)}%`;
        // Floating layers re-anchor on ancestor scroll. A camera move is the
        // canvas's scroll, so tell open menus and popovers to follow.
        viewport.dispatchEvent(new Event('scroll'));
    }, []);

    const setCamera = useCallback((next: CanvasCamera) => {
        cameraRef.current = clampCamera(next);
        if (frameRef.current === null) frameRef.current = window.requestAnimationFrame(writeTransform);
        if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = window.setTimeout(() => {
            saveTimerRef.current = null;
            saveCamera(cameraRef.current);
        }, SAVE_DELAY_MS);
    }, [writeTransform]);

    const viewportSize = useCallback(() => {
        const viewport = viewportRef.current;
        return { width: viewport?.clientWidth ?? 0, height: viewport?.clientHeight ?? 0 };
    }, []);

    const fitAll = useCallback(() => {
        const bounds = unionRects(Object.values(rectsRef.current));
        if (bounds) setCamera(fitCameraToBounds(bounds, viewportSize()));
    }, [setCamera, viewportSize]);

    const focusGroup = useCallback((groupId: string) => {
        const rect = rectsRef.current[groupId];
        if (rect) setCamera(fitCameraToBounds(rect, viewportSize(), 64));
    }, [setCamera, viewportSize]);

    const zoomFromCenter = useCallback((factor: number) => {
        const { width, height } = viewportSize();
        setCamera(zoomCameraAround(cameraRef.current, { x: width / 2, y: height / 2 }, factor));
    }, [setCamera, viewportSize]);

    const resetCamera = useCallback(() => setCamera(DEFAULT_CAMERA), [setCamera]);

    useLayoutEffect(() => {
        writeTransform();
    }, [writeTransform]);

    // --- Layout ---------------------------------------------------------

    const runLayout = useCallback(() => {
        const currentGroups = groupsRef.current;
        const sizes: GroupSize[] = [];
        for (const group of currentGroups) {
            const size = sizesRef.current.get(group.id);
            if (!size) return; // Not every group has reported yet.
            sizes.push(size);
        }
        columnsRef.current ??= chooseColumnCount(sizes, DEFAULT_LAYOUT_OPTIONS);
        const result = layoutGroups(sizes, { ...DEFAULT_LAYOUT_OPTIONS, columns: columnsRef.current }, assignmentRef.current);
        assignmentRef.current = result.assignment;
        const previous = rectsRef.current;
        const changed = sizes.some(({ id }) => {
            const a = previous[id];
            const b = result.rects[id];
            return !a || a.x !== b.x || a.y !== b.y || a.width !== b.width || a.height !== b.height;
        });
        if (changed) setRects(result.rects);
    }, []);

    const observerRef = useRef<ResizeObserver | null>(null);
    const groupElementsRef = useRef(new Map<string, HTMLElement>());
    const groupRefCallbacks = useRef(new Map<string, (element: HTMLElement | null) => void>());

    /** One stable ref callback per group, so re-renders never re-observe. */
    const registerGroup = (id: string) => {
        let callback = groupRefCallbacks.current.get(id);
        if (!callback) {
            callback = (element: HTMLElement | null) => {
                const previous = groupElementsRef.current.get(id);
                if (previous) {
                    observerRef.current?.unobserve(previous);
                    groupElementsRef.current.delete(id);
                }
                if (element) {
                    groupElementsRef.current.set(id, element);
                    observerRef.current?.observe(element);
                }
            };
            groupRefCallbacks.current.set(id, callback);
        }
        return callback;
    };

    useLayoutEffect(() => {
        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const element = entry.target as HTMLElement;
                const id = element.dataset.canvasGroupId;
                if (!id) continue;
                // Border-box sizes ignore the world transform, so zoom never
                // feeds back into layout.
                const box = entry.borderBoxSize?.[0];
                sizesRef.current.set(id, {
                    id,
                    width: box ? box.inlineSize : element.offsetWidth,
                    height: box ? box.blockSize : element.offsetHeight,
                });
            }
            // Observer callbacks already arrive at most once per frame, after
            // layout. Placing groups moves them with a transform, which never
            // changes their size, so this cannot loop.
            runLayout();
        });
        observerRef.current = observer;
        for (const element of groupElementsRef.current.values()) observer.observe(element);
        return () => {
            observer.disconnect();
            observerRef.current = null;
        };
    }, [runLayout]);

    useEffect(() => {
        // Drop sizes of groups that left, so layout never waits on them.
        const ids = new Set(groups.map((group) => group.id));
        for (const id of [...sizesRef.current.keys()]) {
            if (!ids.has(id)) sizesRef.current.delete(id);
        }
    }, [groups]);

    const layoutReady = groups.every((group) => rects[group.id]);

    // Fit once, after the first complete layout, when nothing was stored.
    useEffect(() => {
        if (!layoutReady || hasFittedRef.current) return;
        hasFittedRef.current = true;
        const frame = window.requestAnimationFrame(fitAll);
        return () => window.cancelAnimationFrame(frame);
    }, [layoutReady, fitAll]);

    // --- Gestures -------------------------------------------------------

    useEffect(() => {
        const viewport = viewportRef.current;
        const world = worldRef.current;
        if (!viewport || !world) return;

        const pointers = new Map<number, PointerPoint>();
        let pinchBaseline: { mid: PointerPoint; distance: number } | null = null;

        const pinchState = () => {
            const [a, b] = [...pointers.values()];
            return {
                mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
                distance: Math.hypot(a.x - b.x, a.y - b.y),
            };
        };

        const localPoint = (event: { clientX: number; clientY: number }): PointerPoint => {
            const bounds = viewport.getBoundingClientRect();
            return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
        };

        const resetBaseline = () => {
            pinchBaseline = pointers.size === 2 ? pinchState() : null;
        };

        const releasePointer = (pointerId: number) => {
            if (!pointers.delete(pointerId)) return;
            if (viewport.hasPointerCapture(pointerId)) viewport.releasePointerCapture(pointerId);
            resetBaseline();
        };

        const releaseAll = () => {
            for (const pointerId of [...pointers.keys()]) releasePointer(pointerId);
        };

        const onPointerDown = (event: PointerEvent) => {
            const middleButton = event.pointerType === 'mouse' && event.button === 1;
            const primaryOnSurface = event.button === 0 && isSurface(event.target);
            if (!middleButton && !primaryOnSurface) return;
            if (pointers.size >= 2) return;
            event.preventDefault(); // No text selection or autoscroll from a pan.
            pointers.set(event.pointerId, localPoint(event));
            viewport.setPointerCapture(event.pointerId);
            resetBaseline();
        };

        const onPointerMove = (event: PointerEvent) => {
            const previous = pointers.get(event.pointerId);
            if (!previous) return;
            const next = localPoint(event);
            pointers.set(event.pointerId, next);
            if (pointers.size === 1) {
                setCamera(panCamera(cameraRef.current, next.x - previous.x, next.y - previous.y));
                return;
            }
            if (pointers.size === 2 && pinchBaseline) {
                const current = pinchState();
                const factor = pinchBaseline.distance > 0 ? current.distance / pinchBaseline.distance : 1;
                const zoomed = zoomCameraAround(cameraRef.current, current.mid, factor);
                setCamera(panCamera(zoomed, current.mid.x - pinchBaseline.mid.x, current.mid.y - pinchBaseline.mid.y));
                pinchBaseline = current;
            }
        };

        const onPointerEnd = (event: PointerEvent) => releasePointer(event.pointerId);

        // Touch gestures that start on empty canvas are ours: cancelling them
        // keeps the browser from scrolling or page-zooming instead (and from
        // cancelling our pointers). Touches on previews are left alone.
        const onTouchStart = (event: TouchEvent) => {
            const all = [...event.touches];
            if (all.length > 0 && all.every((touch) => isSurface(touch.target))) event.preventDefault();
        };

        const onWheel = (event: WheelEvent) => {
            if (!(event.target instanceof Element)) return;
            const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.clientHeight : 1;
            let dx = event.deltaX * unit;
            let dy = event.deltaY * unit;
            if (event.ctrlKey || event.metaKey) {
                // Trackpad pinch arrives as ctrl+wheel; so does a ctrl+scroll.
                event.preventDefault();
                // A mouse notch is ~100; a trackpad pinch step is a few units.
                // Clamping keeps a notch to one comfortable zoom step.
                const step = Math.max(-WHEEL_ZOOM_MAX_DELTA, Math.min(WHEEL_ZOOM_MAX_DELTA, dy));
                setCamera(zoomCameraAround(cameraRef.current, localPoint(event), Math.exp(-step * WHEEL_ZOOM_SPEED)));
                return;
            }
            if (event.shiftKey && dx === 0) {
                dx = dy;
                dy = 0;
            }
            if (canScrollNatively(event.target, viewport, dx, dy)) return;
            event.preventDefault();
            setCamera(panCamera(cameraRef.current, -dx, -dy));
        };

        // Safari reports trackpad pinch as gesture events, not ctrl+wheel.
        let gestureScale = 1;
        const onGestureStart = (event: Event) => {
            event.preventDefault();
            gestureScale = 1;
        };
        const onGestureChange = (event: Event) => {
            event.preventDefault();
            const gesture = event as Event & { scale: number; clientX: number; clientY: number };
            const factor = gesture.scale / gestureScale;
            gestureScale = gesture.scale;
            setCamera(zoomCameraAround(cameraRef.current, localPoint(gesture), factor));
        };

        // Shortcuts belong to the canvas shell only. A focused preview keeps
        // its own arrows, plus, minus and Space.
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.target !== viewport || event.altKey || event.ctrlKey || event.metaKey) return;
            const step = event.shiftKey ? KEYBOARD_PAN_STEP * 4 : KEYBOARD_PAN_STEP;
            const camera = cameraRef.current;
            switch (event.key) {
                case 'ArrowLeft': setCamera(panCamera(camera, step, 0)); break;
                case 'ArrowRight': setCamera(panCamera(camera, -step, 0)); break;
                case 'ArrowUp': setCamera(panCamera(camera, 0, step)); break;
                case 'ArrowDown': setCamera(panCamera(camera, 0, -step)); break;
                case '+':
                case '=': zoomFromCenter(KEYBOARD_ZOOM_STEP); break;
                case '-':
                case '_': zoomFromCenter(1 / KEYBOARD_ZOOM_STEP); break;
                case '0': resetCamera(); break;
                case '1': fitAll(); break;
                default: return;
            }
            event.preventDefault();
        };

        // Focus moving to an off-screen preview (Tab) brings it into view.
        const onFocusIn = (event: FocusEvent) => {
            if (!(event.target instanceof Element) || event.target === viewport) return;
            const viewportBounds = viewport.getBoundingClientRect();
            const bounds = event.target.getBoundingClientRect();
            const rect = {
                x: bounds.left - viewportBounds.left,
                y: bounds.top - viewportBounds.top,
                width: bounds.width,
                height: bounds.height,
            };
            const next = revealScreenRect(cameraRef.current, rect, viewportSize());
            if (next !== cameraRef.current) setCamera(next);
        };

        // `overflow: clip` already forbids programmatic scrolling; this only
        // undoes a browser that scrolls the viewport anyway.
        const onScroll = () => {
            if (viewport.scrollTop !== 0 || viewport.scrollLeft !== 0) viewport.scrollTo(0, 0);
        };

        const onVisibilityChange = () => {
            if (document.visibilityState === 'hidden') releaseAll();
        };

        const onDocumentClick = (event: MouseEvent) => {
            if (event.defaultPrevented || !(event.target instanceof Element)) return;
            const anchor = event.target.closest('a[href]');
            if (!anchor) return;
            const fromPreview = world.contains(anchor) || anchor.closest(PREVIEW_PORTAL_SELECTOR) !== null;
            if (!fromPreview) return;
            event.preventDefault();
            const href = anchor.getAttribute('href') ?? '';
            if (href.startsWith(CANVAS_GROUP_HASH_PREFIX)) {
                focusGroup(href.slice(CANVAS_GROUP_HASH_PREFIX.length));
                return;
            }
            showAppToast({
                tone: 'info',
                title: 'Link not followed',
                description: `Previews stay on the canvas. This link points to ${href || 'nowhere'}.`,
            });
        };

        viewport.addEventListener('pointerdown', onPointerDown);
        viewport.addEventListener('pointermove', onPointerMove);
        viewport.addEventListener('pointerup', onPointerEnd);
        viewport.addEventListener('pointercancel', onPointerEnd);
        viewport.addEventListener('lostpointercapture', onPointerEnd);
        viewport.addEventListener('touchstart', onTouchStart, { passive: false });
        viewport.addEventListener('wheel', onWheel, { passive: false });
        viewport.addEventListener('gesturestart', onGestureStart);
        viewport.addEventListener('gesturechange', onGestureChange);
        viewport.addEventListener('keydown', onKeyDown);
        viewport.addEventListener('scroll', onScroll);
        world.addEventListener('focusin', onFocusIn);
        window.addEventListener('blur', releaseAll);
        document.addEventListener('visibilitychange', onVisibilityChange);
        document.addEventListener('click', onDocumentClick);

        return () => {
            releaseAll();
            viewport.removeEventListener('pointerdown', onPointerDown);
            viewport.removeEventListener('pointermove', onPointerMove);
            viewport.removeEventListener('pointerup', onPointerEnd);
            viewport.removeEventListener('pointercancel', onPointerEnd);
            viewport.removeEventListener('lostpointercapture', onPointerEnd);
            viewport.removeEventListener('touchstart', onTouchStart);
            viewport.removeEventListener('wheel', onWheel);
            viewport.removeEventListener('gesturestart', onGestureStart);
            viewport.removeEventListener('gesturechange', onGestureChange);
            viewport.removeEventListener('keydown', onKeyDown);
            viewport.removeEventListener('scroll', onScroll);
            world.removeEventListener('focusin', onFocusIn);
            window.removeEventListener('blur', releaseAll);
            document.removeEventListener('visibilitychange', onVisibilityChange);
            document.removeEventListener('click', onDocumentClick);
        };
    }, [setCamera, fitAll, focusGroup, resetCamera, zoomFromCenter, viewportSize]);

    // --- Teardown -------------------------------------------------------

    useEffect(() => {
        const flush = () => {
            if (saveTimerRef.current === null) return;
            window.clearTimeout(saveTimerRef.current);
            saveTimerRef.current = null;
            saveCamera(cameraRef.current);
        };
        window.addEventListener('pagehide', flush);
        return () => {
            window.removeEventListener('pagehide', flush);
            flush();
            if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
            frameRef.current = null;
        };
    }, []);

    const isDark = resolvedTheme === 'dark';

    return (
        <div
            ref={viewportRef}
            {...{ [CANVAS_SURFACE_ATTRIBUTE]: '' }}
            tabIndex={0}
            role="region"
            aria-roledescription="canvas"
            aria-label="Component canvas. Arrow keys pan, plus and minus zoom, 0 resets, 1 fits everything."
            data-testid="component-canvas"
            className="fixed inset-0 overflow-clip bg-background text-foreground outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--ring)]"
        >
            <div
                ref={worldRef}
                {...{ [CANVAS_SURFACE_ATTRIBUTE]: '' }}
                className="absolute start-0 top-0 size-0 origin-top-left will-change-transform"
                style={{ direction: 'ltr' }}
            >
                {groups.map((group) => {
                    const rect = rects[group.id];
                    return (
                        <section
                            key={group.id}
                            ref={registerGroup(group.id)}
                            id={`canvas-group-${group.id}`}
                            data-canvas-group-id={group.id}
                            aria-labelledby={`canvas-group-${group.id}-title`}
                            {...{ [CANVAS_SURFACE_ATTRIBUTE]: '' }}
                            className="absolute left-0 top-0 flex flex-col gap-2"
                            style={{
                                width: DEFAULT_LAYOUT_OPTIONS.columnWidth,
                                transform: rect ? `translate(${rect.x}px, ${rect.y}px)` : undefined,
                                visibility: layoutReady ? undefined : 'hidden',
                            }}
                        >
                            <h2
                                id={`canvas-group-${group.id}-title`}
                                {...{ [CANVAS_SURFACE_ATTRIBUTE]: '' }}
                                className="text-sm font-medium text-muted-foreground"
                            >
                                {group.title}
                            </h2>
                            <div
                                {...{ [CANVAS_SURFACE_ATTRIBUTE]: '' }}
                                className="rounded-2xl border border-dashed border-muted-foreground/25 p-10"
                            >
                                {group.render()}
                            </div>
                        </section>
                    );
                })}
            </div>

            <div
                role="toolbar"
                aria-label="Canvas view"
                className="absolute end-4 top-4 z-10 flex items-center gap-1 rounded-xl border border-border bg-card p-1 shadow-sm dark:shadow-none"
            >
                <Button variant="ghost" size="icon-sm" aria-label="Zoom out" onClick={() => zoomFromCenter(1 / KEYBOARD_ZOOM_STEP)}>
                    <Minus />
                </Button>
                <span ref={zoomReadoutRef} aria-live="off" className="w-12 text-center text-xs tabular-nums text-muted-foreground">
                    {Math.round(cameraRef.current.zoom * 100)}%
                </span>
                <Button variant="ghost" size="icon-sm" aria-label="Zoom in" onClick={() => zoomFromCenter(KEYBOARD_ZOOM_STEP)}>
                    <Plus />
                </Button>
                <span aria-hidden="true" className="mx-1 h-5 w-px bg-border" />
                <Button variant="ghost" size="icon-sm" aria-label="Fit all groups" onClick={fitAll}>
                    <CornersOut />
                </Button>
                <Button variant="ghost" size="icon-sm" aria-label="Reset view" onClick={resetCamera}>
                    <ArrowCounterClockwise />
                </Button>
                <span aria-hidden="true" className="mx-1 h-5 w-px bg-border" />
                <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
                    onClick={toggleTheme}
                >
                    {isDark ? <Sun /> : <Moon />}
                </Button>
            </div>
        </div>
    );
};
