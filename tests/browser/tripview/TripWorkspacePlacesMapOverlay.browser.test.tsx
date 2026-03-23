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

  it('renders a compact legend with numbered neighborhood markers instead of repeated floating labels', () => {
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
    expect(screen.getAllByLabelText(/Neighborhood marker /i)).toHaveLength(city!.neighborhoods.length);
    expect(screen.getAllByLabelText(/Stay anchor /i)).toHaveLength(city!.savedStays.length);
    expect(screen.getAllByText('Sathorn')).toHaveLength(1);
    expect(screen.queryByText('Polished base')).not.toBeInTheDocument();
  });

  it('filters the overlay legend and markers to the active layer context', () => {
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
    expect(screen.getAllByLabelText(/Neighborhood marker /i)).toHaveLength(visibleNeighborhoods.length);
    expect(screen.getAllByLabelText(/Stay anchor /i)).toHaveLength(visibleStays.length);
  });
});
