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

  it('uses the default mobile drawer behavior with overlay and full-height content', () => {
    render(
      React.createElement(TripDetailsDrawer, {
        open: true,
        expanded: true,
        onOpenChange: vi.fn(),
        onExpandedChange: vi.fn(),
      }, React.createElement('div', null, 'details')),
    );

    expect(drawerMocks.rootProps.at(-1)?.autoFocus).toBe(false);
    expect(drawerMocks.rootProps.at(-1)?.modal).toBeUndefined();
    expect(drawerMocks.rootProps.at(-1)?.handleOnly).toBeUndefined();
    expect(drawerMocks.rootProps.at(-1)?.disablePreventScroll).toBeUndefined();
    expect(drawerMocks.rootProps.at(-1)?.dismissible).toBeUndefined();
    expect(drawerMocks.rootProps.at(-1)?.snapPoints).toBeUndefined();
    expect(drawerMocks.rootProps.at(-1)?.activeSnapPoint).toBeUndefined();
    expect(drawerMocks.contentProps.at(-1)?.hideOverlay).toBeUndefined();
    expect(String(drawerMocks.contentProps.at(-1)?.className)).toContain('h-[min(92vh,780px)]');
  });
});
