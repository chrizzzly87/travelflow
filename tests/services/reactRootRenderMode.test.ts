// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';

import { PRERENDERED_ROOT_ATTRIBUTE, shouldHydrateReactRoot } from '../../services/reactRootRenderMode';

describe('reactRootRenderMode', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('hydrates non-empty roots that are not static prerender snapshots', () => {
    const root = document.createElement('div');
    root.innerHTML = '<main>SSR-compatible content</main>';

    expect(shouldHydrateReactRoot(root)).toBe(true);
  });

  it('hydrates browser-prerendered snapshots for clean visitors', () => {
    const root = document.createElement('div');
    root.setAttribute(PRERENDERED_ROOT_ATTRIBUTE, 'true');
    root.innerHTML = '<main>Prerendered marketing snapshot</main>';

    expect(shouldHydrateReactRoot(root)).toBe(true);
  });

  it('mounts browser-prerendered snapshots when top banner state is personalized', () => {
    window.localStorage.setItem('tf_early_access_dismissed', '1');
    const root = document.createElement('div');
    root.setAttribute(PRERENDERED_ROOT_ATTRIBUTE, 'true');
    root.innerHTML = '<main>Prerendered marketing snapshot</main>';

    expect(shouldHydrateReactRoot(root)).toBe(false);
  });

  it('mounts browser-prerendered snapshots when auth state is present', () => {
    window.localStorage.setItem('sb-localhost-auth-token', '{"access_token":"test"}');
    const root = document.createElement('div');
    root.setAttribute(PRERENDERED_ROOT_ATTRIBUTE, 'true');
    root.innerHTML = '<main>Prerendered marketing snapshot</main>';

    expect(shouldHydrateReactRoot(root)).toBe(false);
  });

  it('mounts browser-prerendered snapshots when session banner state is personalized', () => {
    window.sessionStorage.setItem('tf_translation_notice_dismissed_session', '1');
    const root = document.createElement('div');
    root.setAttribute(PRERENDERED_ROOT_ATTRIBUTE, 'true');
    root.innerHTML = '<main>Prerendered marketing snapshot</main>';

    expect(shouldHydrateReactRoot(root)).toBe(false);
  });

  it('mounts empty roots normally', () => {
    const root = document.createElement('div');

    expect(shouldHydrateReactRoot(root)).toBe(false);
  });
});
