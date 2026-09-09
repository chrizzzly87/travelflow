import { useEffect, useState, type RefObject } from 'react';

/**
 * Tracks where a map marker currently sits, in map-container pixels.
 *
 * Rather than reimplementing the projection math for each basemap, this reads
 * the marker element the map already renders (`data-tf-marker-id`), so the same
 * hook works for the Google overlay markers and the Mapbox ones. The position
 * is sampled on an animation frame while a callout is open — panning and
 * zooming move the marker continuously, and there is no single event that fires
 * for every frame of that on both providers.
 */

export interface MapMarkerAnchor {
  x: number;
  /** Top edge of the marker, for a callout placed above it. */
  top: number;
  /** Bottom edge of the marker, for a callout flipped below it. */
  bottom: number;
}

export interface MapMarkerAnchorState {
  anchor: MapMarkerAnchor | null;
  containerSize: { width: number; height: number };
}

const EMPTY_SIZE = { width: 0, height: 0 };

export const useMapMarkerAnchor = (
  containerRef: RefObject<HTMLElement | null>,
  markerDomId: string | null,
): MapMarkerAnchorState => {
  const [state, setState] = useState<MapMarkerAnchorState>({ anchor: null, containerSize: EMPTY_SIZE });

  useEffect(() => {
    if (!markerDomId) {
      setState({ anchor: null, containerSize: EMPTY_SIZE });
      return;
    }

    let frame = 0;
    let cancelled = false;

    const sample = () => {
      if (cancelled) return;
      const container = containerRef.current;
      const marker = container?.querySelector(`[data-tf-marker-id="${CSS.escape(markerDomId)}"]`);
      if (!container || !(marker instanceof HTMLElement)) {
        setState((current) => (current.anchor === null ? current : { ...current, anchor: null }));
        frame = requestAnimationFrame(sample);
        return;
      }

      const containerRect = container.getBoundingClientRect();
      const markerRect = marker.getBoundingClientRect();
      const next: MapMarkerAnchorState = {
        anchor: {
          x: Math.round(markerRect.left - containerRect.left + markerRect.width / 2),
          top: Math.round(markerRect.top - containerRect.top),
          bottom: Math.round(markerRect.bottom - containerRect.top),
        },
        containerSize: {
          width: Math.round(containerRect.width),
          height: Math.round(containerRect.height),
        },
      };

      setState((current) => (
        current.anchor
          && current.anchor.x === next.anchor!.x
          && current.anchor.top === next.anchor!.top
          && current.anchor.bottom === next.anchor!.bottom
          && current.containerSize.width === next.containerSize.width
          && current.containerSize.height === next.containerSize.height
          ? current
          : next
      ));
      frame = requestAnimationFrame(sample);
    };

    frame = requestAnimationFrame(sample);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [containerRef, markerDomId]);

  return state;
};
