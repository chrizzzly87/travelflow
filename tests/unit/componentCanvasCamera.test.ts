import { describe, expect, it, vi } from 'vitest';

import {
    CAMERA_STORAGE_MAX_LENGTH,
    DEFAULT_CAMERA,
    MAX_OFFSET,
    MAX_ZOOM,
    MIN_ZOOM,
    clampCamera,
    fitCameraToBounds,
    loadCamera,
    parseStoredCamera,
    revealScreenRect,
    saveCamera,
    serializeCamera,
    unionRects,
    zoomCameraAround,
} from '../../components/admin/componentCanvas/canvasCamera';
import * as storage from '../../services/browserStorageService';

const toScreen = (camera: { x: number; y: number; zoom: number }, point: { x: number; y: number }) => ({
    x: point.x * camera.zoom + camera.x,
    y: point.y * camera.zoom + camera.y,
});

describe('canvasCamera', () => {
    it('clamps zoom and offsets and replaces non-finite values', () => {
        expect(clampCamera({ x: 1e9, y: -1e9, zoom: 99 })).toEqual({ x: MAX_OFFSET, y: -MAX_OFFSET, zoom: MAX_ZOOM });
        expect(clampCamera({ x: 0, y: 0, zoom: 0.0001 }).zoom).toBe(MIN_ZOOM);
        expect(clampCamera({ x: Number.NaN, y: Infinity, zoom: -1 })).toEqual(DEFAULT_CAMERA);
    });

    it('keeps the world point under the anchor fixed while zooming', () => {
        const camera = { x: 40, y: -20, zoom: 0.8 };
        const anchor = { x: 300, y: 200 };
        const worldPoint = { x: (anchor.x - camera.x) / camera.zoom, y: (anchor.y - camera.y) / camera.zoom };
        const zoomed = zoomCameraAround(camera, anchor, 1.5);
        const after = toScreen(zoomed, worldPoint);
        expect(after.x).toBeCloseTo(anchor.x);
        expect(after.y).toBeCloseTo(anchor.y);
        expect(zoomed.zoom).toBeCloseTo(1.2);
    });

    it('ignores invalid zoom factors and stops at the zoom limits', () => {
        const camera = { x: 0, y: 0, zoom: 1 };
        expect(zoomCameraAround(camera, { x: 0, y: 0 }, Number.NaN)).toBe(camera);
        expect(zoomCameraAround(camera, { x: 0, y: 0 }, 0)).toBe(camera);
        expect(zoomCameraAround(camera, { x: 0, y: 0 }, 1000).zoom).toBe(MAX_ZOOM);
    });

    it('fits bounds inside the viewport without zooming past 100%', () => {
        const fitted = fitCameraToBounds({ x: 0, y: 0, width: 4000, height: 2000 }, { width: 1000, height: 800 }, 50);
        expect(fitted.zoom).toBeCloseTo(0.225);
        const topLeft = toScreen(fitted, { x: 0, y: 0 });
        const bottomRight = toScreen(fitted, { x: 4000, y: 2000 });
        expect(topLeft.x).toBeGreaterThanOrEqual(50 - 0.01);
        expect(bottomRight.x).toBeLessThanOrEqual(950 + 0.01);
        expect(topLeft.y).toBeGreaterThanOrEqual(0);
        expect(bottomRight.y).toBeLessThanOrEqual(800);

        expect(fitCameraToBounds({ x: 0, y: 0, width: 10, height: 10 }, { width: 1000, height: 800 }).zoom).toBe(1);
        expect(fitCameraToBounds({ x: 0, y: 0, width: 0, height: 0 }, { width: 1000, height: 800 })).toEqual(DEFAULT_CAMERA);
    });

    it('pans just enough to reveal an off-screen rect and leaves a visible one alone', () => {
        const camera = { x: 0, y: 0, zoom: 1 };
        const viewport = { width: 800, height: 600 };
        expect(revealScreenRect(camera, { x: 100, y: 100, width: 50, height: 20 }, viewport)).toBe(camera);
        const revealed = revealScreenRect(camera, { x: 1000, y: 700, width: 100, height: 40 }, viewport, 32);
        expect(revealed).toEqual({ x: 800 - 32 - 1100, y: 600 - 32 - 740, zoom: 1 });
        // Taller than the viewport: align the top edge.
        const tall = revealScreenRect(camera, { x: 10, y: -500, width: 100, height: 2000 }, viewport, 32);
        expect(tall.y).toBe(532);
    });

    it('unions rects', () => {
        expect(unionRects([])).toBeNull();
        expect(unionRects([{ x: 0, y: 10, width: 5, height: 5 }, { x: -3, y: 0, width: 2, height: 2 }])).toEqual({ x: -3, y: 0, width: 8, height: 15 });
    });

    describe('persistence', () => {
        it('round-trips a camera', () => {
            expect(parseStoredCamera(serializeCamera({ x: 12.345, y: -6, zoom: 0.5 }))).toEqual({ x: 12.35, y: -6, zoom: 0.5 });
        });

        it.each([
            ['missing', null],
            ['empty', ''],
            ['not JSON', '{"v":1,'],
            ['unknown version', '{"v":2,"camera":{"x":1,"y":2,"zoom":1}}'],
            ['legacy unversioned shape', '{"x":1,"y":2,"scale":1}'],
            ['wrong types', '{"v":1,"camera":{"x":"1","y":2,"zoom":1}}'],
            ['array', '[1,2,3]'],
            ['oversized', `{"v":1,"camera":{"x":1,"y":2,"zoom":1},"pad":"${'x'.repeat(CAMERA_STORAGE_MAX_LENGTH)}"}`],
        ])('falls back to defaults for %s data', (_label, raw) => {
            expect(parseStoredCamera(raw)).toBeNull();
        });

        it('keeps only the camera and clamps it', () => {
            expect(parseStoredCamera('{"v":1,"camera":{"x":1,"y":2,"zoom":40},"groups":{"button":{"x":5}}}')).toEqual({ x: 1, y: 2, zoom: MAX_ZOOM });
        });

        it('treats unavailable storage as nothing stored and reports failed writes', () => {
            vi.spyOn(storage, 'readLocalStorageItem').mockImplementation(() => { throw new Error('SecurityError'); });
            vi.spyOn(storage, 'writeLocalStorageItem').mockImplementation(() => { throw new Error('QuotaExceededError'); });
            expect(loadCamera()).toBeNull();
            expect(saveCamera({ x: 0, y: 0, zoom: 1 })).toBe(false);
        });
    });
});
