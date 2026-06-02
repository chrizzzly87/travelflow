// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  trackEvent: vi.fn(),
  showAppToast: vi.fn(() => 'toast-id'),
}));

vi.mock('../../../components/admin/AdminShell', () => ({
  AdminShell: ({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) => (
    React.createElement(
      'div',
      null,
      React.createElement('h1', null, title),
      description ? React.createElement('p', null, description) : null,
      children,
    )
  ),
}));

vi.mock('../../../services/analyticsService', () => ({
  trackEvent: mocks.trackEvent,
  getAnalyticsDebugAttributes: () => ({}),
}));

vi.mock('../../../components/ui/appToast', () => ({
  showAppToast: mocks.showAppToast,
}));

vi.mock('cobe', () => ({
  default: vi.fn(() => ({
    update: vi.fn(),
    destroy: vi.fn(),
  })),
}));

import { AdminComponentPlaygroundPage } from '../../../pages/AdminComponentPlaygroundPage';
import { ADMIN_NAV_ITEMS } from '../../../components/admin/adminNavConfig';

describe('pages/AdminComponentPlaygroundPage', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    document.head.innerHTML = '';
    class ResizeObserverMock {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    }
    Object.assign(globalThis, { ResizeObserver: ResizeObserverMock });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: vi.fn(async () => undefined),
      },
    });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as CanvasRenderingContext2D);
  });

  it('marks the hidden playground noindex and keeps it out of admin navigation', () => {
    render(React.createElement(AdminComponentPlaygroundPage));

    expect(screen.getByRole('heading', { name: 'Component Playground' })).toBeInTheDocument();
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex,nofollow,noarchive');
    expect(ADMIN_NAV_ITEMS.some((item) => item.path === '/admin/component-playground')).toBe(false);
    expect(mocks.trackEvent).toHaveBeenCalledWith('admin__component_playground--open');
  });

  it('copies exact component settings after slider controls change', async () => {
    render(React.createElement(AdminComponentPlaygroundPage));

    const scaleSlider = screen.getByRole('slider', { name: 'Globe scale' });
    scaleSlider.focus();
    fireEvent.keyDown(scaleSlider, { key: 'ArrowRight' });
    expect(screen.getByRole('slider', { name: 'Globe scale' })).toBe(scaleSlider);
    fireEvent.keyDown(scaleSlider, { key: 'ArrowRight' });
    expect(screen.getByRole('slider', { name: 'Globe scale' })).toBe(scaleSlider);
    fireEvent.click(screen.getByRole('button', { name: 'Copy globe settings' }));

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining('globeSettings'));
    });
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining('scale'));
    expect(mocks.showAppToast).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Settings copied',
    }));
  });
});
