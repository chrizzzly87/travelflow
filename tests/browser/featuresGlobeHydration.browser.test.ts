// @vitest-environment jsdom
import React from 'react';
import { renderToString } from 'react-dom/server';
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

describe('FeaturesGlobe native SSR boundary', () => {
  it('renders an empty deterministic globe container during server rendering', () => {
    const html = renderToString(React.createElement(FeaturesGlobe));
    const document = new DOMParser().parseFromString(html, 'text/html');
    const container = document.querySelector('[role="img"]')!;
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
