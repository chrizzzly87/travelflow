// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import { createMapboxOverlayMarker } from '../../components/maps/mapboxOverlayRuntime';
import {
    MARKER_HOVER_Z_INDEX,
    MARKER_TOOLTIP_HIDDEN_TRANSFORM,
    MARKER_TOOLTIP_SHOWN_TRANSFORM,
} from '../../components/maps/markerTooltip';

class FakeMarker {
    constructor(public readonly options: { element: HTMLElement }) {}
    setLngLat() { return this; }
    addTo() {
        document.body.appendChild(this.options.element);
        return this;
    }
    remove() {
        this.options.element.remove();
        return this;
    }
}

const html = `<div><div data-role="activity-marker-tooltip" style="position:absolute;inset:auto auto 100% 50%;transform:${MARKER_TOOLTIP_HIDDEN_TRANSFORM}">Yonghe Baofu Temple</div></div>`;

describe('map pin tooltips', () => {
    it('sits just above its pin instead of a whole tooltip height away', () => {
        // Regression: the tooltip is anchored with bottom: 100% and was also
        // translated by -100% of its own height, floating it clear of the pin.
        expect(MARKER_TOOLTIP_HIDDEN_TRANSFORM).not.toContain('100%');
        expect(MARKER_TOOLTIP_SHOWN_TRANSFORM).not.toContain('100%');
    });

    it('lifts the hovered pin above its neighbours and puts it back afterwards', () => {
        const handle = createMapboxOverlayMarker({
            map: {} as never,
            mapboxModule: { Marker: FakeMarker } as never,
            position: { lat: 25, lng: 121.5 },
            html,
            zIndex: 230,
            clickable: true,
            markerDomId: 'idea:gmm-a',
        });
        const element = document.querySelector<HTMLElement>('[data-tf-marker-id="idea:gmm-a"]')!;
        const tooltip = element.querySelector<HTMLElement>('[data-role="activity-marker-tooltip"]')!;

        element.dispatchEvent(new MouseEvent('mouseenter'));
        expect(element.style.zIndex).toBe(`${MARKER_HOVER_Z_INDEX}`);
        expect(tooltip.style.opacity).toBe('1');
        expect(tooltip.style.transform).toBe(MARKER_TOOLTIP_SHOWN_TRANSFORM);

        element.dispatchEvent(new MouseEvent('mouseleave'));
        expect(element.style.zIndex).toBe('230');

        // A selection change updates the resting layer; hover still returns to it.
        handle.update({ zIndex: 250 });
        element.dispatchEvent(new MouseEvent('mouseenter'));
        element.dispatchEvent(new MouseEvent('mouseleave'));
        expect(element.style.zIndex).toBe('250');
    });
});
