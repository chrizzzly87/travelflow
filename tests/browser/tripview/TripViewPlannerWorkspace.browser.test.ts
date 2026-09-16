// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { TripViewPlannerWorkspace } from '../../../components/tripview/TripViewPlannerWorkspace';

type PlannerProps = React.ComponentProps<typeof TripViewPlannerWorkspace>;

const baseProps = (): PlannerProps => ({
  isPaywallLocked: false,
  isMobile: false,
  trip: {
    id: 'trip-1',
    title: 'Test trip',
    startDate: '2026-05-04',
    items: [
      { id: 'city-a', type: 'city', title: 'Sintra', startDateOffset: 0, duration: 1.5, color: '#16a34a' },
      { id: 'travel-a', type: 'travel', title: 'Train', startDateOffset: 1.5, duration: 0.3, color: '#64748b', transportMode: 'train', departureTime: '11:00' },
      { id: 'city-b', type: 'city', title: 'Porto', startDateOffset: 1.5, duration: 2, color: '#2563eb' },
    ],
    createdAt: 0,
    updatedAt: 0,
  },
  onSelectTimelineItem: vi.fn(),
  onUpdateTimelineItem: vi.fn(),
  onAddTimelineActivity: vi.fn(),
  appLanguage: 'en',
  timelineCanvas: React.createElement('div', { 'data-testid': 'timeline-canvas' }, 'canvas'),
  onTimelineTouchStart: vi.fn(),
  onTimelineTouchMove: vi.fn(),
  onTimelineTouchEnd: vi.fn(),
  onZoomOut: vi.fn(),
  onZoomIn: vi.fn(),
  onTimelineModeChange: vi.fn(),
  onTimelineViewChange: vi.fn(),
  zoomLevel: 1,
  mapDockMode: 'docked',
  onMapDockModeChange: vi.fn(),
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
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
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
    expect(screen.getByRole('status')).toHaveTextContent('×1.0');
    expect(screen.getByLabelText('Zoom in timeline')).toBeInTheDocument();

    const modeGroup = calendarModeButton.parentElement;
    const controlsRoot = modeGroup?.parentElement;
    expect(controlsRoot?.lastElementChild).toBe(modeGroup);
    expect(modeGroup).toHaveClass('gap-1');
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

  it('keeps the timeline controls out of the map layer on mobile until the itinerary panel is open', () => {
    const props = baseProps();
    props.isMobile = true;

    render(React.createElement(TripViewPlannerWorkspace, props));

    // The controls used to float over the map pane, which put the map's own
    // dropdowns underneath them.
    expect(screen.queryByTestId('planner-timeline-controls')).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Full itinerary'));

    expect(screen.getByTestId('planner-timeline-controls')).toBeInTheDocument();
    expect(screen.getByLabelText('Zoom out timeline')).toBeInTheDocument();
    expect(screen.getByLabelText('Zoom in timeline')).toBeInTheDocument();
  });

  it('falls back to a safe zoom label when the incoming zoom level is malformed', () => {
    const props = baseProps();
    props.zoomLevel = undefined as unknown as number;

    render(React.createElement(TripViewPlannerWorkspace, props));

    expect(screen.getByRole('status')).toHaveTextContent('×1.0');
  });

  it('gives the mobile map the full pane behind the day sheet', () => {
    const props = baseProps();
    props.isMobile = true;

    render(React.createElement(TripViewPlannerWorkspace, props));

    const mapPane = screen.getByTestId('planner-mobile-map-pane');
    const sheet = screen.getByTestId('planner-mobile-sheet');

    expect(mapPane.className).toContain('absolute');
    expect(mapPane.className).toContain('inset-x-0');
    expect(mapPane.className).toContain('top-0');
    expect(screen.getByTestId('planner-mobile-day-strip')).toBeInTheDocument();
    expect(sheet).toHaveAttribute('data-snap', 'half');

    // One control: it grows the sheet while there is room, then collapses.
    fireEvent.click(screen.getByTestId('planner-mobile-sheet-toggle'));
    expect(sheet).toHaveAttribute('data-snap', 'full');
    expect(screen.getByLabelText('Collapse day panel')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('planner-mobile-sheet-toggle'));
    expect(sheet).toHaveAttribute('data-snap', 'peek');
    expect(screen.getByLabelText('Expand day panel')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('planner-mobile-sheet-toggle'));
    expect(sheet).toHaveAttribute('data-snap', 'half');
  });

  it('keeps the day strip snapping and drag-scrollable on mobile', () => {
    const props = baseProps();
    props.isMobile = true;

    render(React.createElement(TripViewPlannerWorkspace, props));

    const strip = screen.getByTestId('planner-mobile-day-strip');
    expect(strip.className).toContain('snap-x');
    expect(strip.className).toContain('snap-mandatory');
    expect(strip.className).toContain('overflow-x-auto');
  });

  it('minimizes map into floating mode when toggle is clicked', () => {
    const props = baseProps();
    render(React.createElement(TripViewPlannerWorkspace, props));

    fireEvent.click(screen.getByLabelText('Minimize map preview'));

    expect(props.onMapDockModeChange).toHaveBeenCalledWith('floating');
  });

  it('renders floating map container in floating dock mode', () => {
    const props = baseProps();
    props.mapDockMode = 'floating';
    props.detailsPanelVisible = true;

    render(React.createElement(TripViewPlannerWorkspace, props));

    expect(screen.getByTestId('floating-map-container')).toBeInTheDocument();
    expect(screen.getByTestId('floating-map-drag-handle')).toBeInTheDocument();
    expect(screen.getByTestId('planner-timeline-pane')).toBeInTheDocument();
    expect(screen.getByTestId('planner-timeline-controls').className).toContain('z-[30]');
    expect(screen.getByLabelText('Maximize map preview')).toBeInTheDocument();
    expect(screen.getByLabelText('Resize details panel')).toBeInTheDocument();
  });

  it('renders a dedicated floating map drag handle control', () => {
    const props = baseProps();
    props.mapDockMode = 'floating';
    props.detailsPanelVisible = true;

    render(React.createElement(TripViewPlannerWorkspace, props));

    const floatingMap = screen.getByTestId('floating-map-container');
    const dragHandle = screen.getByTestId('floating-map-drag-handle');
    const resizeHandle = screen.getByTestId('floating-map-resize-handle');
    const orientationToggle = screen.getByTestId('floating-map-orientation-toggle');

    expect(floatingMap).toBeInTheDocument();
    expect(dragHandle).toHaveAttribute('aria-label', 'Move floating map preview');
    expect(dragHandle).toHaveAttribute('data-floating-map-control', 'true');
    expect(resizeHandle).toHaveAttribute('aria-label', 'Use compact floating map size');
    expect(orientationToggle).toHaveAttribute('aria-label', 'Switch floating map preview to landscape');
  });

  it('keeps the map component mounted while toggling dock mode', () => {
    const mounts = vi.fn();
    const unmounts = vi.fn();
    const PersistentMap: React.FC = () => {
      React.useEffect(() => {
        mounts();
        return () => {
          unmounts();
        };
      }, []);
      return React.createElement('div', { 'data-testid': 'map-component' }, 'map');
    };

    const initialProps = {
      ...baseProps(),
      isMapBootstrapEnabled: true,
      ItineraryMapComponent: PersistentMap,
    };

    const { rerender } = render(React.createElement(TripViewPlannerWorkspace, initialProps));
    expect(mounts).toHaveBeenCalledTimes(1);

    rerender(React.createElement(TripViewPlannerWorkspace, {
      ...initialProps,
      mapDockMode: 'floating',
    }));
    rerender(React.createElement(TripViewPlannerWorkspace, {
      ...initialProps,
      mapDockMode: 'docked',
    }));

    expect(mounts).toHaveBeenCalledTimes(1);
    expect(unmounts).toHaveBeenCalledTimes(0);
  });

  it('remounts the map component when the trip id changes so a new trip starts clean', () => {
    const mounts = vi.fn();
    const unmounts = vi.fn();
    const PersistentMap: React.FC = () => {
      React.useEffect(() => {
        mounts();
        return () => {
          unmounts();
        };
      }, []);
      return React.createElement('div', { 'data-testid': 'map-component' }, 'map');
    };

    const initialProps = {
      ...baseProps(),
      isMapBootstrapEnabled: true,
      ItineraryMapComponent: PersistentMap,
    };

    const { rerender } = render(React.createElement(TripViewPlannerWorkspace, initialProps));
    expect(mounts).toHaveBeenCalledTimes(1);
    expect(unmounts).toHaveBeenCalledTimes(0);

    rerender(React.createElement(TripViewPlannerWorkspace, {
      ...initialProps,
      tripId: 'trip-2',
    }));

    expect(mounts).toHaveBeenCalledTimes(2);
    expect(unmounts).toHaveBeenCalledTimes(1);
  });

  it('does not apply a default view transition name when none is provided', () => {
    const capturedViewTransitionNames: Array<string | undefined> = [];
    const props = baseProps();
    props.isMapBootstrapEnabled = true;
    props.mapViewTransitionName = null;
    props.ItineraryMapComponent = ({ viewTransitionName }: { viewTransitionName?: string }) => {
      capturedViewTransitionNames.push(viewTransitionName);
      return React.createElement('div', { 'data-testid': 'map-component' }, 'map');
    };

    render(React.createElement(TripViewPlannerWorkspace, props));

    expect(capturedViewTransitionNames.at(-1)).toBeUndefined();
  });

  it('forwards activity marker selection callbacks from map overlays', () => {
    const props = baseProps();
    props.isMapBootstrapEnabled = true;
    props.onMapActivitySelect = vi.fn();
    props.ItineraryMapComponent = ({
      onActivityMarkerSelect,
    }: {
      onActivityMarkerSelect?: (activityId: string) => void;
    }) => React.createElement(
      'button',
      {
        type: 'button',
        'data-testid': 'map-activity-select',
        onClick: () => onActivityMarkerSelect?.('activity-42'),
      },
      'select activity',
    );

    render(React.createElement(TripViewPlannerWorkspace, props));
    fireEvent.click(screen.getByTestId('map-activity-select'));

    expect(props.onMapActivitySelect).toHaveBeenCalledWith('activity-42');
  });

  it('uses fused top grab-handle styling with uniform floating border thickness', () => {
    const props = baseProps();
    props.mapDockMode = 'floating';

    render(React.createElement(TripViewPlannerWorkspace, props));

    const floatingMap = screen.getByTestId('floating-map-container');
    const dragHandle = screen.getByTestId('floating-map-drag-handle');
    const gripBar = dragHandle.querySelector('span:not(.sr-only)');

    expect(floatingMap).toHaveClass('border-[4px]');
    expect(floatingMap).not.toHaveClass('border-t-[10px]');
    expect(dragHandle).toHaveClass('rounded-t-none');
    expect(dragHandle).toHaveClass('rounded-b-full');
    expect(dragHandle).toHaveClass('border-t-0');
    expect(gripBar).toHaveClass('group-hover:bg-accent-500');
  });

  it('uses a calendar icon for the day-by-day view', () => {
    const props = baseProps();
    props.isMobile = true;

    render(React.createElement(TripViewPlannerWorkspace, props));

    const dayViewButton = screen.getByLabelText('Day by day');
    expect(dayViewButton.querySelector('.lucide-calendar-days')).toBeTruthy();
  });

  it('opens the transport picker for a leg and writes the chosen mode', () => {
    const props = baseProps();
    props.isMobile = true;

    render(React.createElement(TripViewPlannerWorkspace, props));

    // Day 2 is the half-day handover between the two stays.
    fireEvent.click(screen.getAllByRole('tab')[1]);
    fireEvent.click(screen.getByTestId('mobile-day-transport-edit'));

    expect(screen.getByTestId('mobile-transport-modal')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Plane' }));

    expect(props.onUpdateTimelineItem).toHaveBeenCalledWith('travel-a', expect.objectContaining({
      type: 'travel',
      transportMode: 'plane',
    }));
  });

  it('keeps a transport node of its own for a move that happens inside one day', () => {
    const props = baseProps();
    props.isMobile = true;

    render(React.createElement(TripViewPlannerWorkspace, props));

    const transferNodes = screen.getAllByTestId('planner-mobile-transfer-node');
    expect(transferNodes).toHaveLength(1);

    // It sits before the day the traveller lands in, between the two bubbles.
    const stripChildren = Array.from(screen.getByTestId('planner-mobile-day-strip').children);
    const nodeColumn = transferNodes[0].closest('div.shrink-0');
    expect(stripChildren.indexOf(nodeColumn as Element)).toBe(1);
  });

  it('opens the transport picker straight from the strip node', () => {
    const props = baseProps();
    props.isMobile = true;

    render(React.createElement(TripViewPlannerWorkspace, props));
    fireEvent.click(screen.getByTestId('planner-mobile-transfer-node'));

    expect(screen.getByTestId('mobile-transport-modal')).toBeInTheDocument();
    expect(props.onSelectTimelineItem).toHaveBeenCalledWith('travel-a');

    fireEvent.click(screen.getByRole('button', { name: 'Bus' }));
    expect(props.onUpdateTimelineItem).toHaveBeenCalledWith('travel-a', expect.objectContaining({
      transportMode: 'bus',
    }));
  });

  it('leaves the transport node selecting only when the trip cannot be edited', () => {
    const props = baseProps();
    props.isMobile = true;
    props.onUpdateTimelineItem = undefined;

    render(React.createElement(TripViewPlannerWorkspace, props));
    fireEvent.click(screen.getByTestId('planner-mobile-transfer-node'));

    expect(screen.queryByTestId('mobile-transport-modal')).not.toBeInTheDocument();
    expect(props.onSelectTimelineItem).toHaveBeenCalledWith('travel-a');
  });

  it('paints the day ring over an opaque interior so the strip line cannot cross it', () => {
    const props = baseProps();
    props.isMobile = true;

    render(React.createElement(TripViewPlannerWorkspace, props));

    // An unselected plain day: one ring colour, white inside. The interior
    // layer is what hides the connecting line, which used to run straight
    // through the ring's gap.
    const plainDay = screen.getAllByRole('tab')[2];
    expect(plainDay.style.background).toContain('rgb(255, 255, 255)) padding-box');
    expect(plainDay.style.background).toContain('rgb(37, 99, 235)) border-box');
    expect(plainDay.style.borderColor).toBe('transparent');
  });

  it('splits the ring across every stay a day touches', () => {
    const props = baseProps();
    props.isMobile = true;

    render(React.createElement(TripViewPlannerWorkspace, props));

    // Day 2 holds both stays, so its ring runs from one colour to the other.
    const handoverDay = screen.getAllByRole('tab')[1];
    expect(handoverDay.style.background).toContain('to right');
    expect(handoverDay.style.background).toContain('rgb(22, 163, 74) 0% 50%');
    expect(handoverDay.style.background).toContain('rgb(37, 99, 235) 50% 100%');

    // Selecting a day fills its interior; the ring keeps both stays.
    fireEvent.click(handoverDay);
    const selected = screen.getAllByRole('tab')[1];
    expect(selected.style.background).toContain('rgb(37, 99, 235) 50% 100%');
    // The interior is the stay's colour now, not white.
    expect(selected.style.background).toContain('rgb(37, 99, 235), rgb(37, 99, 235)) padding-box');
  });

  it('offers a quick way to add an activity to the shown day', () => {
    const props = baseProps();
    props.isMobile = true;

    render(React.createElement(TripViewPlannerWorkspace, props));
    fireEvent.click(screen.getByTestId('mobile-day-add-activity'));

    expect(props.onAddTimelineActivity).toHaveBeenCalledWith(0);
  });

  it('hides the editing affordances when the trip cannot be edited', () => {
    const props = baseProps();
    props.isMobile = true;
    props.onUpdateTimelineItem = undefined;
    props.onAddTimelineActivity = undefined;

    render(React.createElement(TripViewPlannerWorkspace, props));

    expect(screen.queryByTestId('mobile-day-transport-edit')).not.toBeInTheDocument();
    expect(screen.queryByTestId('mobile-day-add-activity')).not.toBeInTheDocument();
  });

  it('stays on the tapped day when selecting it also selects its city', () => {
    const props = baseProps();
    props.isMobile = true;
    // Porto starts mid-day 1 and runs to day 3, so a tap on its last day must
    // survive the selection that same tap produces.
    const { rerender } = render(React.createElement(TripViewPlannerWorkspace, props));

    const tabs = screen.getAllByRole('tab');
    fireEvent.click(tabs[3]);

    expect(props.onSelectTimelineItem).toHaveBeenCalledWith('city-b', { isCity: true });
    expect(screen.getAllByRole('tab')[3]).toHaveAttribute('aria-selected', 'true');

    // The selection then arrives back as a prop, the way TripView feeds it.
    rerender(React.createElement(TripViewPlannerWorkspace, { ...props, selectedItemId: 'city-b' }));

    // Day 3 is where the traveller tapped; day 1 is where that city first appears.
    expect(screen.getAllByRole('tab')[3]).toHaveAttribute('aria-selected', 'true');
    expect(screen.getAllByRole('tab')[1]).toHaveAttribute('aria-selected', 'false');
  });

  it('moves to the day holding a selection made outside the strip', () => {
    const props = baseProps();
    props.isMobile = true;

    const { rerender } = render(React.createElement(TripViewPlannerWorkspace, props));
    expect(screen.getAllByRole('tab')[0]).toHaveAttribute('aria-selected', 'true');

    rerender(React.createElement(TripViewPlannerWorkspace, { ...props, selectedItemId: 'city-b' }));

    // Porto first appears on the handover day, which is day 1.
    expect(screen.getAllByRole('tab')[1]).toHaveAttribute('aria-selected', 'true');
  });

  it('turns off double-tap zoom on the sheet and the day strip', () => {
    const props = baseProps();
    props.isMobile = true;

    render(React.createElement(TripViewPlannerWorkspace, props));

    expect(screen.getByTestId('planner-mobile-sheet').className).toContain('touch-manipulation');
    expect(screen.getByTestId('planner-mobile-day-strip').className).toContain('touch-manipulation');
  });
});
