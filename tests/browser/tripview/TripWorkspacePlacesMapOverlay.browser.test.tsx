// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

import { TripWorkspacePlacesMapOverlay } from '../../../components/tripview/workspace/TripWorkspacePlacesMapOverlay';
import { getTripWorkspaceCityGuideById } from '../../../components/tripview/workspace/tripWorkspaceDemoData';

describe('components/tripview/workspace/TripWorkspacePlacesMapOverlay', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders a compact legend instead of floating map labels', () => {
    const city = getTripWorkspaceCityGuideById('bangkok');

    expect(city).not.toBeNull();

    render(
      <div className="relative h-[360px] w-[640px]">
        <TripWorkspacePlacesMapOverlay
          city={city!}
          activeLayer={null}
          visibleNeighborhoods={city!.neighborhoods}
          visibleStays={city!.savedStays}
        />
      </div>,
    );

    expect(screen.getByText('Districts on map')).toBeInTheDocument();
    expect(screen.getByText('Stay anchors')).toBeInTheDocument();
    expect(screen.getAllByText('Sathorn')).toHaveLength(1);
    expect(screen.queryByText('Polished base')).not.toBeInTheDocument();
    expect(screen.getByText('Songkran window')).toBeInTheDocument();
  });

  it('filters the overlay legend to the active layer context', () => {
    const city = getTripWorkspaceCityGuideById('bangkok');

    expect(city).not.toBeNull();

    const activeLayer = city!.mapLayers[0];
    const visibleNeighborhoods = city!.neighborhoods.filter((neighborhood) => activeLayer.neighborhoodNames.includes(neighborhood.name));
    const visibleStays = city!.savedStays.filter((stay) => activeLayer.stayAreas.includes(stay.area));

    render(
      <div className="relative h-[360px] w-[640px]">
        <TripWorkspacePlacesMapOverlay
          city={city!}
          activeLayer={activeLayer}
          visibleNeighborhoods={visibleNeighborhoods}
          visibleStays={visibleStays}
        />
      </div>,
    );

    expect(screen.getByText('Arrival flow')).toBeInTheDocument();
    expect(screen.getByText('Arrival hinge')).toBeInTheDocument();
    expect(screen.getByText('Ari')).toBeInTheDocument();
    expect(screen.queryByText('Talat Noi')).not.toBeInTheDocument();
    expect(screen.getByText(/1 stay anchor active in this layer/i)).toBeInTheDocument();
  });
});
