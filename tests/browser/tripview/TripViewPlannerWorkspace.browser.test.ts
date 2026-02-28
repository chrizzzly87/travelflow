// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

import { TripViewPlannerWorkspace } from '../../../components/tripview/TripViewPlannerWorkspace';

type PlannerProps = React.ComponentProps<typeof TripViewPlannerWorkspace>;

const baseProps = (): PlannerProps => ({
  isPaywallLocked: false,
  isMobile: false,
  isMobileMapExpanded: false,
  onCloseMobileMap: vi.fn(),
  onToggleMobileMapExpanded: vi.fn(),
  timelineCanvas: React.createElement('div', { 'data-testid': 'timeline-canvas' }, 'canvas'),
  onTimelineTouchStart: vi.fn(),
  onTimelineTouchMove: vi.fn(),
  onTimelineTouchEnd: vi.fn(),
  onZoomOut: vi.fn(),
  onZoomIn: vi.fn(),
  onTimelineModeChange: vi.fn(),
  onTimelineViewChange: vi.fn(),
  timelineMode: 'calendar',
  timelineView: 'horizontal',
  mapViewportRef: { current: null },
  isMapBootstrapEnabled: false,
  ItineraryMapComponent: () => React.createElement('div', { 'data-testid': 'map-component' }),
  mapLoadingFallback: React.createElement('div', null, 'loading-map'),
  mapDeferredFallback: React.createElement('div', { 'data-testid': 'map-deferred-fallback' }, 'deferred-map'),
  displayItems: [],
  selectedItemId: null,
  layoutMode: 'horizontal',
  effectiveLayoutMode: 'horizontal',
  onLayoutModeChange: vi.fn(),
  mapStyle: 'standard',
  onMapStyleChange: vi.fn(),
  routeMode: 'simple',
  onRouteModeChange: vi.fn(),
  showCityNames: true,
  onShowCityNamesChange: vi.fn(),
  mapColorMode: 'trip',
  onMapColorModeChange: vi.fn(),
  initialMapFocusQuery: undefined,
  onRouteMetrics: vi.fn(),
  onRouteStatus: vi.fn(),
  tripId: 'trip-1',
  mapViewTransitionName: null,
  sidebarWidth: 520,
  detailsWidth: 420,
  timelineHeight: 320,
  detailsPanelVisible: false,
  detailsPanelContent: React.createElement('div', null, 'details'),
  verticalLayoutTimelineRef: { current: null },
  onStartResizing: vi.fn(),
  onSidebarResizeKeyDown: vi.fn(),
  onDetailsResizeKeyDown: vi.fn(),
  onTimelineResizeKeyDown: vi.fn(),
});

describe('components/tripview/TripViewPlannerWorkspace', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders calendar controls in calendar mode', () => {
    render(React.createElement(TripViewPlannerWorkspace, baseProps()));

    const calendarModeButton = screen.getByLabelText('Calendar view');
    const listModeButton = screen.getByLabelText('Timeline list view');
    expect(calendarModeButton).toBeInTheDocument();
    expect(listModeButton).toBeInTheDocument();
    expect(screen.getByLabelText('Horizontal timeline direction')).toBeInTheDocument();
    expect(screen.getByLabelText('Vertical timeline direction')).toBeInTheDocument();
    expect(screen.getByLabelText('Zoom out timeline')).toBeInTheDocument();
    expect(screen.getByLabelText('Zoom in timeline')).toBeInTheDocument();

    const modeGroup = calendarModeButton.parentElement;
    const controlsRoot = modeGroup?.parentElement;
    expect(controlsRoot?.lastElementChild).toBe(modeGroup);
  });

  it('hides calendar-only controls in timeline list mode', () => {
    const props = baseProps();
    props.timelineMode = 'timeline';

    render(React.createElement(TripViewPlannerWorkspace, props));

    expect(screen.getByLabelText('Calendar view')).toBeInTheDocument();
    expect(screen.getByLabelText('Timeline list view')).toBeInTheDocument();
    expect(screen.queryByLabelText('Horizontal timeline direction')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Vertical timeline direction')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Zoom out timeline')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Zoom in timeline')).not.toBeInTheDocument();
  });
});
