// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';

import { isPrerenderedDocument } from '../../services/prerenderHydrationState';
import { PRERENDERED_ROOT_ATTRIBUTE } from '../../services/reactRootRenderMode';

const cleanup = () => {
  document.getElementById('root')?.remove();
  delete (window as unknown as { __TF_PRERENDER_EAGER__?: boolean }).__TF_PRERENDER_EAGER__;
};

afterEach(cleanup);

describe('isPrerenderedDocument', () => {
  it('is false for a plain client (SPA-fallback) document', () => {
    const root = document.createElement('div');
    root.id = 'root';
    document.body.appendChild(root);
    expect(isPrerenderedDocument()).toBe(false);
  });

  it('is true when #root carries the prerendered-root attribute (client hydration render)', () => {
    const root = document.createElement('div');
    root.id = 'root';
    root.setAttribute(PRERENDERED_ROOT_ATTRIBUTE, 'true');
    document.body.appendChild(root);
    expect(isPrerenderedDocument()).toBe(true);
  });

  it('is true when the prerender capture flag is set (before the attribute exists)', () => {
    (window as unknown as { __TF_PRERENDER_EAGER__?: boolean }).__TF_PRERENDER_EAGER__ = true;
    const root = document.createElement('div');
    root.id = 'root';
    document.body.appendChild(root);
    expect(isPrerenderedDocument()).toBe(true);
  });
});
