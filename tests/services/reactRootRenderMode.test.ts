// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';

import { PRERENDERED_ROOT_ATTRIBUTE, shouldHydrateReactRoot } from '../../services/reactRootRenderMode';

describe('reactRootRenderMode', () => {
  it('hydrates non-empty roots that are not static prerender snapshots', () => {
    const root = document.createElement('div');
    root.innerHTML = '<main>SSR-compatible content</main>';

    expect(shouldHydrateReactRoot(root)).toBe(true);
  });

  it('still hydrates browser-prerendered snapshots', () => {
    const root = document.createElement('div');
    root.setAttribute(PRERENDERED_ROOT_ATTRIBUTE, 'true');
    root.innerHTML = '<main>Prerendered marketing snapshot</main>';

    expect(shouldHydrateReactRoot(root)).toBe(true);
  });

  it('mounts empty roots normally', () => {
    const root = document.createElement('div');

    expect(shouldHydrateReactRoot(root)).toBe(false);
  });

});
