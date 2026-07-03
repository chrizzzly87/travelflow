// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';

import { isPrerenderCapture, isPrerenderedDocument } from '../../services/prerenderHydrationState';
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

describe('isPrerenderCapture', () => {
  it('is false on a real client, even a prerendered one (attribute present, no flag)', () => {
    const root = document.createElement('div');
    root.id = 'root';
    root.setAttribute(PRERENDERED_ROOT_ATTRIBUTE, 'true');
    document.body.appendChild(root);
    expect(isPrerenderCapture()).toBe(false);
  });

  it('is true only while the prerender capture flag is set', () => {
    (window as unknown as { __TF_PRERENDER_EAGER__?: boolean }).__TF_PRERENDER_EAGER__ = true;
    expect(isPrerenderCapture()).toBe(true);
  });
});
