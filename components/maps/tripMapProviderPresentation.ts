import type { MapImplementation } from '../../shared/mapRuntime';
import type { MapStyle } from '../../types';
import type { FlightRouteCurveOptions } from './flightRouteGeometry';

export type TripMapCityLabelAnchor = 'right' | 'left' | 'below' | 'above';

export interface TripMapProviderPresentation {
  cityLabels: {
    anchor: TripMapCityLabelAnchor;
    offsetMultiplier: number;
    minOffsetPx: number;
    maxWidthPx: number;
  };
  markers: {
    city: {
      imageBadge: {
        supported: boolean;
        shape: 'circle';
        sizeRatio: number;
        ringWidthPx: number;
      };
    };
  };
  flights: {
    curve: FlightRouteCurveOptions;
    groundShadow: {
      color: string;
      lightOpacity: number;
      darkOpacity: number;
      weightMultiplier: number;
    };
  };
  routes: {
    dark: {
      shadowColor: string;
      shadowOpacity: number;
      shadowWidthBoost: number;
      glowOpacity: number;
      glowWidthBoost: number;
      mainOpacity: number;
    };
  };
}

const GOOGLE_TRIP_MAP_PRESENTATION: TripMapProviderPresentation = {
  cityLabels: {
    anchor: 'above',
    offsetMultiplier: 0.72,
    minOffsetPx: 18,
    maxWidthPx: 180,
  },
  markers: {
    city: {
      imageBadge: {
        supported: true,
        shape: 'circle',
        sizeRatio: 0.56,
        ringWidthPx: 2,
      },
    },
  },
  flights: {
    curve: {
      samples: 24,
      liftRatio: 0.18,
      minLift: 0.22,
      maxLift: 4.4,
    },
    groundShadow: {
      color: 'rgba(15, 23, 42, 0.34)',
      lightOpacity: 0.14,
      darkOpacity: 0.22,
      weightMultiplier: 0.92,
    },
  },
  routes: {
    dark: {
      shadowColor: 'rgba(2, 6, 23, 0.78)',
      shadowOpacity: 0.34,
      shadowWidthBoost: 2.8,
      glowOpacity: 0.12,
      glowWidthBoost: 1.4,
      mainOpacity: 0.94,
    },
  },
};

const MAPBOX_TRIP_MAP_PRESENTATION: TripMapProviderPresentation = {
  cityLabels: {
    anchor: 'above',
    offsetMultiplier: 0.84,
    minOffsetPx: 22,
    maxWidthPx: 196,
  },
  markers: {
    city: {
      imageBadge: {
        supported: true,
        shape: 'circle',
        sizeRatio: 0.62,
        ringWidthPx: 2,
      },
    },
  },
  flights: {
    curve: {
      samples: 28,
      liftRatio: 0.2,
      minLift: 0.28,
      maxLift: 5.1,
    },
    groundShadow: {
      color: 'rgba(15, 23, 42, 0.34)',
      lightOpacity: 0.18,
      darkOpacity: 0.035,
      weightMultiplier: 0.94,
    },
  },
  routes: {
    dark: {
      shadowColor: 'rgba(2, 6, 23, 0.58)',
      shadowOpacity: 0.22,
      shadowWidthBoost: 2.2,
      glowOpacity: 0.1,
      glowWidthBoost: 1.15,
      mainOpacity: 0.97,
    },
  },
};

const isDarkTripMapStyle = (style: MapStyle): boolean => (
  style === 'dark' || style === 'cleanDark'
);

export const getTripMapProviderPresentation = (
  provider: MapImplementation,
): TripMapProviderPresentation => (provider === 'mapbox'
  ? MAPBOX_TRIP_MAP_PRESENTATION
  : GOOGLE_TRIP_MAP_PRESENTATION);

export const resolveTripMapCityLabelAnchor = (
  provider: MapImplementation,
  _city: google.maps.LatLngLiteral,
  _previous?: google.maps.LatLngLiteral | null,
  _next?: google.maps.LatLngLiteral | null,
): TripMapCityLabelAnchor => getTripMapProviderPresentation(provider).cityLabels.anchor;

export const resolveTripMapCityLabelOffsetPx = ({
  provider,
  markerSize,
}: {
  provider: MapImplementation;
  markerSize: number;
}): number => {
  const labelPresentation = getTripMapProviderPresentation(provider).cityLabels;
  return Math.max(
    labelPresentation.minOffsetPx,
    Math.round(markerSize * labelPresentation.offsetMultiplier),
  );
};

export const resolveTripMapFlightCurveOptions = (
  provider: MapImplementation,
): FlightRouteCurveOptions => getTripMapProviderPresentation(provider).flights.curve;

export const resolveTripMapFlightGroundShadowStyle = ({
  provider,
  style,
  baseWeight,
}: {
  provider: MapImplementation;
  style: MapStyle;
  baseWeight: number;
}): {
  color: string;
  opacity: number;
  weight: number;
} => {
  const shadow = getTripMapProviderPresentation(provider).flights.groundShadow;
  return {
    color: shadow.color,
    opacity: isDarkTripMapStyle(style) ? shadow.darkOpacity : shadow.lightOpacity,
    weight: Math.max(1, baseWeight * shadow.weightMultiplier),
  };
};

export const resolveTripMapDarkRoutePresentation = (
  provider: MapImplementation,
): TripMapProviderPresentation['routes']['dark'] => getTripMapProviderPresentation(provider).routes.dark;
