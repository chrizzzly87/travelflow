// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { getLastVisitedPath, rememberNavigationPath } from '../../services/navigationContextService';

const setDocumentReferrer = (value: string) => {
  Object.defineProperty(document, 'referrer', {
    configurable: true,
    value,
  });
};

describe('services/navigationContextService', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.history.replaceState({}, '', '/');
    setDocumentReferrer('');
  });

  it('tracks previous path across internal navigation', () => {
    rememberNavigationPath('/features?section=translation');
    rememberNavigationPath('/contact');

    expect(getLastVisitedPath('/contact')).toBe('/features?section=translation');
  });

  it('uses current stored path when current route has not yet been persisted', () => {
    rememberNavigationPath('/pricing');

    expect(getLastVisitedPath('/contact')).toBe('/pricing');
  });

  it('falls back to same-origin referrer only', () => {
    setDocumentReferrer('https://external.example/features?from=outside');
    expect(getLastVisitedPath('/contact')).toBeNull();

    setDocumentReferrer(`${window.location.origin}/features?from=banner`);
    expect(getLastVisitedPath('/contact')).toBe('/features?from=banner');
  });

  it('ignores unsafe persisted paths', () => {
    window.sessionStorage.setItem('tf_navigation_context_v1', JSON.stringify({
      currentPath: 'https://external.example/contact',
      previousPath: '/pricing',
      updatedAt: Date.now(),
    }));

    expect(getLastVisitedPath('/contact')).toBeNull();
  });
});
