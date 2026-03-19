// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RuntimeLocationDebugCard } from '../../components/OnPageDebugger';
import type { RuntimeLocationStoreSnapshot } from '../../services/runtimeLocationService';

const makeSnapshot = (overrides?: Partial<RuntimeLocationStoreSnapshot>): RuntimeLocationStoreSnapshot => ({
  loading: false,
  available: true,
  source: 'netlify-context',
  fetchedAt: '2026-03-19T10:30:00.000Z',
  location: {
    city: 'Berlin',
    countryCode: 'DE',
    countryName: 'Germany',
    subdivisionCode: 'BE',
    subdivisionName: 'Berlin',
    latitude: 52.52,
    longitude: 13.405,
    timezone: 'Europe/Berlin',
    postalCode: '10115',
  },
  ...overrides,
});

describe('components/OnPageDebugger runtime location card', () => {
  it('renders the detected runtime location details and allows a manual refresh', () => {
    const onRefresh = vi.fn();
    render(React.createElement(RuntimeLocationDebugCard, {
      snapshot: makeSnapshot(),
      onRefresh,
    }));

    expect(screen.getByText('Runtime Location')).toBeInTheDocument();
    expect(screen.getByText('Detected')).toBeInTheDocument();
    expect(screen.getByText((_, node) => node?.textContent === 'City: Berlin')).toBeInTheDocument();
    expect(screen.getByText((_, node) => node?.textContent === 'Country: Germany (DE)')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Refresh Runtime Location' }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('renders a clear unavailable state when no geo data exists', () => {
    render(React.createElement(RuntimeLocationDebugCard, {
      snapshot: makeSnapshot({
        available: false,
        source: 'unavailable',
        fetchedAt: null,
        location: {
          city: null,
          countryCode: null,
          countryName: null,
          subdivisionCode: null,
          subdivisionName: null,
          latitude: null,
          longitude: null,
          timezone: null,
          postalCode: null,
        },
      }),
      onRefresh: vi.fn(),
    }));

    expect(screen.getByText('Unavailable')).toBeInTheDocument();
    expect(screen.getByText(/No runtime location is available yet/)).toBeInTheDocument();
  });

  it('renders the loading state while a refresh is in flight', () => {
    render(React.createElement(RuntimeLocationDebugCard, {
      snapshot: makeSnapshot({
        loading: true,
        source: 'netlify-context',
      }),
      onRefresh: vi.fn(),
    }));

    expect(screen.getByText('Loading')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refreshing…' })).toBeDisabled();
  });

  it('renders the error state cleanly', () => {
    render(React.createElement(RuntimeLocationDebugCard, {
      snapshot: makeSnapshot({
        available: false,
        source: 'error',
        location: {
          city: null,
          countryCode: null,
          countryName: null,
          subdivisionCode: null,
          subdivisionName: null,
          latitude: null,
          longitude: null,
          timezone: null,
          postalCode: null,
        },
      }),
      onRefresh: vi.fn(),
    }));

    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.getByText(/Runtime location could not be loaded right now/)).toBeInTheDocument();
  });
});
