// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';

import { createMapboxOverlayMarker } from '../../components/maps/mapboxOverlayRuntime';

const createFakeMapbox = () => {
  const container = document.createElement('div');
  const remove = vi.fn();
  class Marker {
    element: HTMLElement;
    constructor({ element }: { element: HTMLElement }) {
      this.element = element;
    }
    setLngLat() {
      return this;
    }
    addTo() {
      container.appendChild(this.element);
      return this;
    }
    remove() {
      remove();
      this.element.remove();
      return this;
    }
  }
  return { container, remove, mapboxModule: { Marker } };
};

describe('createMapboxOverlayMarker', () => {
  it('removes the marker even while the style is being swapped', () => {
    // During setStyle, getStyle() is unreadable. The handle used to skip
    // marker.remove() then, so every city label of the old map style stayed on
    // screen under the new one: dark chips stacked beneath light ones.
    const { container, remove, mapboxModule } = createFakeMapbox();
    const map = {
      getStyle: () => {
        throw new Error('Style is not done loading');
      },
    };

    const handle = createMapboxOverlayMarker({
      map: map as never,
      mapboxModule: mapboxModule as never,
      position: { lat: 41.9, lng: 12.5 },
      html: '<div>Rome</div>',
      zIndex: 120,
      centerAnchor: true,
    });
    expect(container.textContent).toBe('Rome');

    handle.setMap(null);

    expect(remove).toHaveBeenCalledTimes(1);
    expect(container.childElementCount).toBe(0);
  });
});
