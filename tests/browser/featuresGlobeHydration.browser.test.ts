// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FeaturesGlobe } from '../../components/marketing/features/FeaturesGlobe';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { returnObjects?: boolean }) => {
      if (!options?.returnObjects) return key;
      if (key === 'globe.cards') {
        return [
          { id: 'paris', emoji: '🥐', title: 'Paris weekend' },
          { id: 'fiji', emoji: '🌊', title: 'Fiji island hop' },
          { id: 'south-africa', emoji: '🦁', title: 'Cape route' },
          { id: 'route66', emoji: '🛣️', title: 'Route 66' },
        ];
      }
      if (key === 'globe.preview') return { alt: 'Trip preview', title: 'Thailand islands' };
      return [];
    },
    i18n: { language: 'en', resolvedLanguage: 'en' },
  }),
}));

vi.mock('../../contexts/theme/useTheme', () => ({
  useTheme: () => ({ resolvedTheme: 'light' }),
}));

vi.mock('../../services/runtimeLocationService', () => ({
  ensureRuntimeLocationLoaded: () => Promise.resolve(),
  getRuntimeLocationSnapshot: () => ({ available: false, location: { latitude: null, longitude: null } }),
  subscribeRuntimeLocation: () => () => {},
}));

const globeContainer = () => screen.getByRole('img', { name: 'globe.accessibility' });

describe('FeaturesGlobe prerender capture', () => {
  afterEach(() => {
    delete (window as unknown as { __TF_PRERENDER_EAGER__?: boolean }).__TF_PRERENDER_EAGER__;
  });

  // /features is prerendered, and preact/compat's hydrate() does not patch
  // attributes on DOM it reuses. If the capture bakes in the WebGL-dependent
  // markup (the prerender browser has no WebGL, so it captured the fallback
  // card), the client hydrates its own render against the wrong nodes and the
  // corrections are dropped: the canvas keeps `opacity-0` and the overlay layer
  // keeps the fallback card's `inset-x-6 bottom-6` classes, which parks the
  // Paris panel below the globe and hides the rest. The capture must therefore
  // stay empty — exactly what the client renders on its first pass.
  it('renders an empty container while the prerender script is capturing', () => {
    (window as unknown as { __TF_PRERENDER_EAGER__?: boolean }).__TF_PRERENDER_EAGER__ = true;

    render(React.createElement(FeaturesGlobe));

    const container = globeContainer();
    expect(container.children.length).toBe(0);
    expect(container.querySelector('canvas')).toBeNull();
  });

  it('fills the container on a real client once mounted', () => {
    render(React.createElement(FeaturesGlobe));

    const container = globeContainer();
    expect(container.children.length).toBeGreaterThan(0);
    expect(container.querySelector('canvas')).not.toBeNull();
  });
});
