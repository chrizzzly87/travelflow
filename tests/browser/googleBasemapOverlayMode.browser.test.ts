// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';

import { createGoogleBasemapOverlayController } from '../../components/maps/googleBasemapOverlayMode';

describe('components/maps/googleBasemapOverlayMode', () => {
  const originalGoogle = window.google;

  afterEach(() => {
    window.google = originalGoogle;
  });

  it('hides only the Google base pane while keeping the map surface transparent for mixed runtimes', () => {
    const mapDiv = document.createElement('div');
    const gmStyleRoot = document.createElement('div');
    gmStyleRoot.className = 'gm-style';
    mapDiv.appendChild(gmStyleRoot);
    const mapPane = document.createElement('div');

    class FakeOverlayView {
      onAdd = () => {};
      onRemove = () => {};
      draw = () => {};

      getPanes() {
        return { mapPane } as google.maps.MapPanes;
      }

      setMap(map: unknown) {
        if (map) {
          this.onAdd();
          return;
        }
        this.onRemove();
      }
    }

    window.google = {
      maps: {
        OverlayView: FakeOverlayView,
      },
    } as typeof window.google;

    const controller = createGoogleBasemapOverlayController({
      getDiv: () => mapDiv,
    } as google.maps.Map);

    expect(controller).not.toBeNull();

    controller?.apply(true);
    expect(mapDiv.style.backgroundColor).toBe('transparent');
    expect(gmStyleRoot.style.backgroundColor).toBe('transparent');
    expect(mapPane.style.opacity).toBe('0');
    expect(mapPane.style.visibility).toBe('hidden');

    controller?.apply(false);
    expect(mapPane.style.opacity).toBe('');
    expect(mapPane.style.visibility).toBe('');

    controller?.destroy();
    expect(mapDiv.style.backgroundColor).toBe('');
    expect(gmStyleRoot.style.backgroundColor).toBe('');
  });
});
