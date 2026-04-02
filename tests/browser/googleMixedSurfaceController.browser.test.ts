// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import { __testing__ } from '../../components/maps/googleMixedSurfaceController';

describe('components/maps/googleMixedSurfaceController', () => {
  it('makes Google placeholder surfaces transparent and hides Google-only chrome in mixed mode', () => {
    const mapDiv = document.createElement('div');
    Object.defineProperty(mapDiv, 'getBoundingClientRect', {
      value: () => ({ width: 640, height: 480 }),
    });

    const wrapper = document.createElement('div');
    wrapper.style.backgroundColor = 'rgb(229, 227, 223)';
    Object.defineProperty(wrapper, 'getBoundingClientRect', {
      value: () => ({ width: 640, height: 480 }),
    });

    const gmStyleRoot = document.createElement('div');
    gmStyleRoot.className = 'gm-style';
    Object.defineProperty(gmStyleRoot, 'getBoundingClientRect', {
      value: () => ({ width: 640, height: 480 }),
    });

    const attribution = document.createElement('div');
    attribution.className = 'gm-style-cc';

    mapDiv.append(wrapper);
    wrapper.append(gmStyleRoot, attribution);

    __testing__.applyMixedGoogleSurfaceMode(mapDiv, true);

    expect(wrapper.style.backgroundColor).toBe('transparent');
    expect(gmStyleRoot.style.backgroundColor).toBe('transparent');
    expect(attribution.style.display).toBe('none');

    __testing__.applyMixedGoogleSurfaceMode(mapDiv, false);

    expect(wrapper.style.backgroundColor).toBe('');
    expect(gmStyleRoot.style.backgroundColor).toBe('');
    expect(attribution.style.display).toBe('');
  });
});
