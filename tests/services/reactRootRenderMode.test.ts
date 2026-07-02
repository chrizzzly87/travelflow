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

  it('still hydrates prerendered snapshots when personalized browser state exists', () => {
    // Regression guard: bailing out to a client re-render for returning
    // visitors (dismissed banners, auth tokens) tore down the prerendered
    // page into a blank root Suspense fallback until every chunk loaded.
    // Personalized components render their defaults first and reconcile in
    // effects, so hydration must always be used when markup exists.
    window.localStorage.setItem('sb-localhost-auth-token', '{"access_token":"test"}');
    window.sessionStorage.setItem('tf_locale_suggestion_dismissed_session', '1');
    window.sessionStorage.setItem('tf_translation_notice_dismissed_session', '1');
    const root = document.createElement('div');
    root.setAttribute(PRERENDERED_ROOT_ATTRIBUTE, 'true');
    root.innerHTML = '<main>Prerendered marketing snapshot</main>';

    expect(shouldHydrateReactRoot(root)).toBe(true);
  });

  it('mounts fresh (no hydration) when the root has no prerendered markup', () => {
    const root = document.createElement('div');

    expect(shouldHydrateReactRoot(root)).toBe(false);
  });
});
