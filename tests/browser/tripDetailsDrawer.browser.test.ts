// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const drawerMocks = vi.hoisted(() => ({
  rootProps: [] as Array<Record<string, unknown>>,
  contentProps: [] as Array<Record<string, unknown>>,
}));

vi.mock('../../components/ui/drawer', () => ({
  Drawer: ({ children, ...props }: Record<string, unknown>) => {
    drawerMocks.rootProps.push(props);
    return React.createElement('div', { 'data-testid': 'drawer-root' }, children);
  },
  DrawerContent: ({ children, ...props }: Record<string, unknown>) => {
    drawerMocks.contentProps.push(props);
    return React.createElement('div', { 'data-testid': 'drawer-content' }, children);
  },
}));

import { TripDetailsDrawer } from '../../components/TripDetailsDrawer';

describe('components/TripDetailsDrawer', () => {
  afterEach(() => {
    cleanup();
    drawerMocks.rootProps = [];
    drawerMocks.contentProps = [];
  });

  it('opens as a non-modal peek drawer with a taller passive preview and no overlay', () => {
    const { rerender } = render(
      React.createElement(TripDetailsDrawer, {
        open: true,
        onOpenChange: vi.fn(),
      }, React.createElement('div', null, 'details')),
    );

    expect(drawerMocks.rootProps.at(-1)?.modal).toBe(false);
    expect(drawerMocks.rootProps.at(-1)?.autoFocus).toBe(false);
    expect(drawerMocks.rootProps.at(-1)?.handleOnly).toBe(true);
    expect(drawerMocks.rootProps.at(-1)?.disablePreventScroll).toBe(true);
    expect(drawerMocks.rootProps.at(-1)?.snapPoints).toEqual(['132px', 0.9]);
    expect(drawerMocks.rootProps.at(-1)?.activeSnapPoint).toBe('132px');
    expect(drawerMocks.contentProps.at(-1)?.hideOverlay).toBe(true);
    expect(String(drawerMocks.contentProps.at(-1)?.className)).toContain('pointer-events-none');
    expect(screen.getByRole('button', { name: 'Expand trip details drawer' })).toBeInTheDocument();

    rerender(
      React.createElement(TripDetailsDrawer, {
        open: false,
        onOpenChange: vi.fn(),
      }, React.createElement('div', null, 'details')),
    );
    rerender(
      React.createElement(TripDetailsDrawer, {
        open: true,
        onOpenChange: vi.fn(),
      }, React.createElement('div', null, 'details')),
    );

    expect(drawerMocks.rootProps.at(-1)?.activeSnapPoint).toBe('132px');
  });
});
