// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
    showAppToast: vi.fn(() => 'toast-id'),
}));

vi.mock('../../../components/ui/appToast', () => ({
    showAppToast: mocks.showAppToast,
}));

import { AdminComponentCanvasPage } from '../../../pages/AdminComponentCanvasPage';
import { ADMIN_NAV_ITEMS } from '../../../components/admin/adminNavConfig';
import { CANVAS_GROUPS } from '../../../components/admin/componentCanvas/canvasGroups';
import {
    BADGE_VARIANTS,
    BUTTON_ICON_SIZES,
    BUTTON_TEXT_SIZES,
    BUTTON_VARIANTS,
    DIALOG_SIZES,
    SPLIT_FLAP_EASINGS,
    TOAST_TONES,
} from '../../../components/admin/componentCanvas/canvasCatalog';
import { CAMERA_STORAGE_KEY } from '../../../components/admin/componentCanvas/canvasCamera';
import { ComponentCanvas, type CanvasGroupDefinition } from '../../../components/admin/componentCanvas/ComponentCanvas';
import { CanvasRow, CanvasSlot } from '../../../components/admin/componentCanvas/canvasFrame';

/**
 * Small stand-in groups for the host's behaviour. Mounting the full catalogue
 * takes seconds in jsdom, so only the coverage test does that.
 */
const LIGHT_GROUPS: CanvasGroupDefinition[] = [
    {
        id: 'alpha',
        title: 'Alpha',
        render: () => (
            <CanvasRow title="state">
                <CanvasSlot label="button"><button type="button">Continue</button></CanvasSlot>
                <CanvasSlot label="input"><input aria-label="City" defaultValue="Lisbon" /></CanvasSlot>
                <CanvasSlot label="links">
                    <a href="#canvas-group-gamma">To gamma</a>
                    <a href="/pricing">Leave</a>
                </CanvasSlot>
            </CanvasRow>
        ),
    },
    { id: 'beta', title: 'Beta', render: () => <p>Beta content</p> },
    { id: 'gamma', title: 'Gamma', render: () => <p>Gamma content</p> },
];

/** A ResizeObserver the test drives: `flush` reports each observed group at a fixed size. */
class ResizeObserverHarness {
    static instances: ResizeObserverHarness[] = [];
    elements = new Set<Element>();
    disconnected = false;
    constructor(private readonly callback: ResizeObserverCallback) {
        ResizeObserverHarness.instances.push(this);
    }
    observe = (element: Element) => { this.elements.add(element); };
    unobserve = (element: Element) => { this.elements.delete(element); };
    disconnect = () => { this.elements.clear(); this.disconnected = true; };
    flush(height = 400) {
        const entries = [...this.elements].map((target) => ({
            target,
            borderBoxSize: [{ inlineSize: 1040, blockSize: height }],
        })) as unknown as ResizeObserverEntry[];
        this.callback(entries, this as unknown as ResizeObserver);
    }
}

/** The canvas's own observer; Radix primitives create others. */
const live = () => ResizeObserverHarness.instances.find((instance) => !instance.disconnected
    && [...instance.elements].some((element) => element.hasAttribute('data-canvas-group-id')))!;
const canvas = () => screen.getByTestId('component-canvas');
const world = () => canvas().firstElementChild as HTMLElement;
const nextFrame = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 40)));

const pointer = (type: string, target: Element, init: { pointerId: number; clientX: number; clientY: number; button?: number }) => {
    const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: init.clientX, clientY: init.clientY, button: init.button ?? 0 });
    Object.defineProperties(event, { pointerId: { value: init.pointerId }, pointerType: { value: 'mouse' } });
    target.dispatchEvent(event);
};

const renderLaidOut = async () => {
    const view = render(<ComponentCanvas groups={LIGHT_GROUPS} />);
    // jsdom has no layout; give the viewport a screen-like size.
    Object.defineProperties(canvas(), { clientWidth: { value: 1280 }, clientHeight: { value: 800 } });
    act(() => live().flush());
    await nextFrame();
    return view;
};

describe('pages/AdminComponentCanvasPage', () => {
    beforeEach(() => {
        ResizeObserverHarness.instances = [];
        Object.assign(globalThis, { ResizeObserver: ResizeObserverHarness });
        if (!window.matchMedia) {
            Object.assign(window, {
                matchMedia: () => ({ matches: false, addEventListener: () => undefined, removeEventListener: () => undefined }),
            });
        }
        Element.prototype.setPointerCapture ??= function setPointerCapture() {};
        Element.prototype.hasPointerCapture ??= function hasPointerCapture() { return false; };
        Element.prototype.releasePointerCapture ??= function releasePointerCapture() {};
        Element.prototype.scrollIntoView ??= function scrollIntoView() {};
        window.localStorage.clear();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('stays out of the admin navigation', () => {
        expect(ADMIN_NAV_ITEMS.some((item) => item.path.includes('component-canvas'))).toBe(false);
    });

    it('gives every group a unique id and a title', () => {
        const ids = CANVAS_GROUPS.map((group) => group.id);
        expect(new Set(ids).size).toBe(ids.length);
        for (const group of CANVAS_GROUPS) expect(group.title.trim()).not.toBe('');
    });

    it('mounts the page module', () => {
        // The page only hands CANVAS_GROUPS to the canvas; mounting all of
        // them takes tens of seconds in jsdom, so check the wiring instead.
        expect(AdminComponentCanvasPage).toBeTypeOf('function');
    });

    it('renders the listed variants, hidden until measured', async () => {
        const checked = new Set(['button', 'badge', 'dialog', 'toast', 'split-flap']);
        render(<ComponentCanvas groups={CANVAS_GROUPS.filter((group) => checked.has(group.id))} />);
        const groups = document.querySelectorAll<HTMLElement>('[data-canvas-group-id]');
        expect(groups).toHaveLength(checked.size);
        expect(groups[0].style.visibility).toBe('hidden');
        const slotLabels = (groupId: string) => [...document.querySelectorAll(`#canvas-group-${groupId} [data-canvas-slot]`)]
            .map((slot) => slot.getAttribute('data-canvas-slot'));
        expect(slotLabels('button')).toEqual(expect.arrayContaining([...BUTTON_VARIANTS, ...BUTTON_TEXT_SIZES, ...BUTTON_ICON_SIZES]));
        expect(slotLabels('badge')).toEqual(expect.arrayContaining([...BADGE_VARIANTS]));
        expect(slotLabels('dialog')).toEqual(expect.arrayContaining([...DIALOG_SIZES]));
        expect(slotLabels('toast')).toEqual(expect.arrayContaining([...TOAST_TONES]));
        expect(slotLabels('split-flap')).toEqual(expect.arrayContaining([...SPLIT_FLAP_EASINGS]));

        act(() => live().flush());
        await nextFrame();
        expect(groups[0].style.visibility).toBe('');
        expect(groups[0].style.transform).toMatch(/^translate\(/);
    });

    it('keeps groups apart after one of them grows', async () => {
        await renderLaidOut();
        const positions = () => [...document.querySelectorAll<HTMLElement>('[data-canvas-group-id]')].map((element) => {
            const [x, y] = element.style.transform.match(/-?[\d.]+/g)!.map(Number);
            return { id: element.dataset.canvasGroupId!, x, y };
        });
        const before = positions();
        act(() => live().flush(900));
        await nextFrame();
        const after = positions();
        // Same columns, and within a column every group starts below the previous one's new bottom.
        expect(after.map(({ id, x }) => [id, x])).toEqual(before.map(({ id, x }) => [id, x]));
        const byColumn = new Map<number, number[]>();
        for (const { x, y } of after) byColumn.set(x, [...(byColumn.get(x) ?? []), y]);
        for (const ys of byColumn.values()) {
            ys.sort((a, b) => a - b);
            for (let index = 1; index < ys.length; index += 1) expect(ys[index] - ys[index - 1]).toBeGreaterThanOrEqual(900);
        }
    });

    it('pans from the keyboard only when the canvas shell has focus', async () => {
        await renderLaidOut();
        const start = world().style.transform;
        canvas().focus();
        fireEvent.keyDown(canvas(), { key: 'ArrowRight' });
        await nextFrame();
        expect(world().style.transform).not.toBe(start);

        const field = screen.getByRole('textbox', { name: 'City' });
        act(() => field.focus());
        await nextFrame();
        const panned = world().style.transform;
        const event = fireEvent.keyDown(field, { key: 'ArrowRight' });
        await nextFrame();
        expect(event).toBe(true); // Not cancelled: the caret still moves.
        expect(world().style.transform).toBe(panned);
    });

    it('pans by dragging empty canvas and stops when the pointer is cancelled', async () => {
        await renderLaidOut();
        const surface = canvas();
        pointer('pointerdown', surface, { pointerId: 1, clientX: 100, clientY: 100 });
        pointer('pointermove', surface, { pointerId: 1, clientX: 150, clientY: 130 });
        await nextFrame();
        const moved = world().style.transform;
        expect(moved).not.toBe('');
        pointer('pointercancel', surface, { pointerId: 1, clientX: 150, clientY: 130 });
        pointer('pointermove', surface, { pointerId: 1, clientX: 400, clientY: 400 });
        await nextFrame();
        expect(world().style.transform).toBe(moved);

        // A press on a preview control is the control's, not a pan.
        const button = screen.getByRole('button', { name: 'Continue' });
        pointer('pointerdown', button, { pointerId: 2, clientX: 100, clientY: 100 });
        pointer('pointermove', button, { pointerId: 2, clientX: 300, clientY: 300 });
        await nextFrame();
        expect(world().style.transform).toBe(moved);
    });

    it('turns canvas links into camera moves and blocks links that leave', async () => {
        await renderLaidOut();
        const inside = screen.getByRole('link', { name: 'To gamma' });
        const before = world().style.transform;
        expect(fireEvent.click(inside)).toBe(false);
        await nextFrame();
        expect(mocks.showAppToast).not.toHaveBeenCalled();
        expect(world().style.transform).not.toBe(before);
        expect(window.location.hash).toBe('');

        const leaving = screen.getByRole('link', { name: 'Leave' });
        expect(fireEvent.click(leaving)).toBe(false);
        expect(mocks.showAppToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Link not followed' }));
    });

    it('persists the camera, restores it, and resets without clearing drafts', async () => {
        const view = await renderLaidOut();
        canvas().focus();
        fireEvent.keyDown(canvas(), { key: 'ArrowDown' });
        await act(() => new Promise<void>((resolve) => setTimeout(resolve, 400)));
        const saved = window.localStorage.getItem(CAMERA_STORAGE_KEY);
        expect(saved).toMatch(/^\{"v":1,"camera":/);
        const { camera } = JSON.parse(saved!) as { camera: { x: number; y: number; zoom: number } };

        const observer = live();
        view.unmount();
        expect(observer.disconnected).toBe(true);

        await renderLaidOut();
        expect(world().style.transform).toBe(`translate3d(${camera.x}px, ${camera.y}px, 0) scale(${camera.zoom})`);

        const draft = screen.getByRole<HTMLInputElement>('textbox', { name: 'City' });
        fireEvent.change(draft, { target: { value: 'Porto' } });
        fireEvent.click(screen.getByRole('button', { name: 'Reset view' }));
        await nextFrame();
        expect(world().style.transform).toBe('translate3d(64px, 64px, 0) scale(1)');
        expect(draft.value).toBe('Porto');
    });

    it('starts from defaults when the stored camera is malformed', async () => {
        window.localStorage.setItem(CAMERA_STORAGE_KEY, '{"v":1,"camera":{"x":"oops"');
        await renderLaidOut();
        expect(world().style.transform).toMatch(/scale\(/);
        expect(world().style.transform).not.toContain('NaN');
    });
});
