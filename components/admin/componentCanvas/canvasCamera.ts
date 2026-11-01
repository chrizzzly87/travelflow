/**
 * Camera maths and persistence for the admin component canvas.
 *
 * A camera maps world space (where the groups live) to screen space:
 * `screen = world * zoom + (x, y)`. Everything here is pure so the gestures in
 * `ComponentCanvas.tsx` stay thin and the edge cases stay testable.
 */
import { readLocalStorageItem, writeLocalStorageItem } from '../../../services/browserStorageService';

export interface CanvasCamera {
    x: number;
    y: number;
    zoom: number;
}

export interface CanvasRect {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface CanvasSize {
    width: number;
    height: number;
}

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 2.5;
/** Keeps a corrupt or runaway pan from parking the world light-years away. */
export const MAX_OFFSET = 200_000;

export const DEFAULT_CAMERA: CanvasCamera = { x: 64, y: 64, zoom: 1 };

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

/** Any non-finite field falls back to the default; finite ones are clamped. */
export const clampCamera = (camera: CanvasCamera): CanvasCamera => ({
    x: Number.isFinite(camera.x) ? clamp(camera.x, -MAX_OFFSET, MAX_OFFSET) : DEFAULT_CAMERA.x,
    y: Number.isFinite(camera.y) ? clamp(camera.y, -MAX_OFFSET, MAX_OFFSET) : DEFAULT_CAMERA.y,
    zoom: Number.isFinite(camera.zoom) && camera.zoom > 0 ? clamp(camera.zoom, MIN_ZOOM, MAX_ZOOM) : DEFAULT_CAMERA.zoom,
});

export const panCamera = (camera: CanvasCamera, dx: number, dy: number): CanvasCamera =>
    clampCamera({ ...camera, x: camera.x + dx, y: camera.y + dy });

/** Zooms by `factor` while the world point under `anchor` (screen space) stays put. */
export const zoomCameraAround = (
    camera: CanvasCamera,
    anchor: { x: number; y: number },
    factor: number,
): CanvasCamera => {
    if (!Number.isFinite(factor) || factor <= 0) return camera;
    const zoom = clamp(camera.zoom * factor, MIN_ZOOM, MAX_ZOOM);
    const applied = zoom / camera.zoom;
    return clampCamera({
        x: anchor.x - (anchor.x - camera.x) * applied,
        y: anchor.y - (anchor.y - camera.y) * applied,
        zoom,
    });
};

/** Frames `bounds` inside the viewport. Never zooms past 100%: fitting is for overview. */
export const fitCameraToBounds = (bounds: CanvasRect, viewport: CanvasSize, padding = 48): CanvasCamera => {
    if (bounds.width <= 0 || bounds.height <= 0 || viewport.width <= 0 || viewport.height <= 0) {
        return DEFAULT_CAMERA;
    }
    const availableWidth = Math.max(1, viewport.width - padding * 2);
    const availableHeight = Math.max(1, viewport.height - padding * 2);
    const zoom = clamp(Math.min(availableWidth / bounds.width, availableHeight / bounds.height, 1), MIN_ZOOM, MAX_ZOOM);
    return clampCamera({
        x: (viewport.width - bounds.width * zoom) / 2 - bounds.x * zoom,
        y: (viewport.height - bounds.height * zoom) / 2 - bounds.y * zoom,
        zoom,
    });
};

/**
 * Smallest pan that brings a screen-space rect fully into view, with `margin`.
 * A rect larger than the viewport aligns its start edge, so a tall group's top
 * shows rather than its middle.
 */
export const revealScreenRect = (
    camera: CanvasCamera,
    rect: CanvasRect,
    viewport: CanvasSize,
    margin = 32,
): CanvasCamera => {
    const shift = (start: number, size: number, viewportSize: number): number => {
        if (size + margin * 2 > viewportSize) return margin - start;
        if (start < margin) return margin - start;
        if (start + size > viewportSize - margin) return viewportSize - margin - (start + size);
        return 0;
    };
    const dx = shift(rect.x, rect.width, viewport.width);
    const dy = shift(rect.y, rect.height, viewport.height);
    if (dx === 0 && dy === 0) return camera;
    return panCamera(camera, dx, dy);
};

/** Union of rects, or null for none. */
export const unionRects = (rects: CanvasRect[]): CanvasRect | null => {
    if (rects.length === 0) return null;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const rect of rects) {
        minX = Math.min(minX, rect.x);
        minY = Math.min(minY, rect.y);
        maxX = Math.max(maxX, rect.x + rect.width);
        maxY = Math.max(maxY, rect.y + rect.height);
    }
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
};

// --- Persistence ---------------------------------------------------------

export const CAMERA_STORAGE_KEY = 'tf_admin_component_canvas_camera';
export const CAMERA_STORAGE_VERSION = 1;
/** A camera is three numbers. Anything much bigger is not ours. */
export const CAMERA_STORAGE_MAX_LENGTH = 512;

interface StoredCameraV1 {
    v: 1;
    camera: CanvasCamera;
}

const isNumberRecord = (value: unknown): value is Record<'x' | 'y' | 'zoom', number> =>
    typeof value === 'object'
    && value !== null
    && typeof (value as Record<string, unknown>).x === 'number'
    && typeof (value as Record<string, unknown>).y === 'number'
    && typeof (value as Record<string, unknown>).zoom === 'number';

/**
 * Reads a stored camera. Returns null — "use the defaults" — for anything
 * missing, oversized, malformed or from an unknown version. Only the camera is
 * ever kept; any other field in the payload is dropped.
 */
export const parseStoredCamera = (raw: string | null): CanvasCamera | null => {
    if (!raw || raw.length > CAMERA_STORAGE_MAX_LENGTH) return null;
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return null;
    }
    if (typeof parsed !== 'object' || parsed === null) return null;
    const payload = parsed as Partial<StoredCameraV1>;
    if (payload.v !== CAMERA_STORAGE_VERSION || !isNumberRecord(payload.camera)) return null;
    const { x, y, zoom } = payload.camera;
    if (![x, y, zoom].every(Number.isFinite)) return null;
    return clampCamera({ x, y, zoom });
};

export const serializeCamera = (camera: CanvasCamera): string => {
    const { x, y, zoom } = clampCamera(camera);
    const payload: StoredCameraV1 = {
        v: CAMERA_STORAGE_VERSION,
        camera: { x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100, zoom: Math.round(zoom * 1000) / 1000 },
    };
    return JSON.stringify(payload);
};

/** Storage may be unavailable or full; both read as "nothing stored". */
export const loadCamera = (): CanvasCamera | null => {
    try {
        return parseStoredCamera(readLocalStorageItem(CAMERA_STORAGE_KEY));
    } catch {
        return null;
    }
};

export const saveCamera = (camera: CanvasCamera): boolean => {
    try {
        return writeLocalStorageItem(CAMERA_STORAGE_KEY, serializeCamera(camera));
    } catch {
        return false;
    }
};
