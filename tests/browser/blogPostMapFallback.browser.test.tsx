// @vitest-environment jsdom
import React from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const googleState = vi.hoisted(() => ({
  value: { isLoaded: false, loadError: null as Error | null, disabled: true },
}));

vi.mock('../../components/GoogleMapsLoader', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, useGoogleMaps: () => googleState.value };
});

import { BlogMapCanvas } from '../../pages/BlogPostPage';

const props = {
  mapId: 'map-1',
  config: {
    title: 'Kyoto',
    mapCenter: { lat: 35, lng: 135 },
    mapZoom: 10,
    categories: [],
  },
  activeCategory: { id: 'c1', label: 'Food', spots: [] },
  locale: 'en',
  postSlug: 'kyoto',
  fallbackEmbedSrc: 'https://www.google.com/maps?output=embed&q=Kyoto',
} as unknown as React.ComponentProps<typeof BlogMapCanvas>;

describe('pages/BlogPostPage map canvas', () => {
  afterEach(() => cleanup());

  it('a blog post map uses the embed fallback when Google is disabled', () => {
    googleState.value = { isLoaded: false, loadError: null, disabled: true };
    const { container } = render(<BlogMapCanvas {...props} />);

    const frame = container.querySelector('iframe');
    expect(frame).not.toBeNull();
    expect(frame?.getAttribute('src')).toBe(props.fallbackEmbedSrc);
  });
});
