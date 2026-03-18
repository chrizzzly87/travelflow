import type { MapImplementation } from '../../shared/mapRuntime';

export type TripMapDockMode = 'docked' | 'floating';

export interface TripMapViewportPadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface TripMapProviderTuning {
  fitPadding: {
    baseRatio: number;
    baseMin: number;
    baseMax: number;
    docked: {
      verticalBoost: number;
      horizontalBoost: number;
      verticalMin: number;
      verticalMax: number;
      horizontalMin: number;
      horizontalMax: number;
    };
    floating: {
      verticalBoost: number;
      horizontalBoost: number;
      verticalMin: number;
      verticalMax: number;
      horizontalMin: number;
      horizontalMax: number;
    };
  };
  selection: {
    activityFocusZoom: number;
    cityFocusZoom: number;
    queryFocusZoom: number;
    safeInsetRatio: number;
  };
  markers: {
    activityMinZoom: number;
    tier: {
      lowZoom: number;
      veryLowZoom: number;
      denseRouteCoverage: number;
      extremeDenseRouteCoverage: number;
      microShortEdge: number;
      compactShortEdge: number;
      microVeryLowZoomMaxShortEdge: number;
      compactVeryLowZoomDenseMaxShortEdge: number;
      compactDenseMaxShortEdge: number;
      compactDenseZoomCutoff: number;
    };
    cityZoomProfile: {
      farCircleMaxZoom: number;
      mediumCircleMaxZoom: number;
      nearCircleMaxZoom: number;
      compactPinMaxZoom: number;
      scaleBands: Array<{ minZoom: number; scale: number }>;
    };
    crowding: {
      crowdedGapPx: number;
      veryCrowdedGapPx: number;
      disableCrowdingAtZoom: number;
    };
  };
  intro: {
    camera: {
      center: [number, number];
      zoom: number;
      bearing: number;
      pitch: number;
    };
    minMeaningfulTargetZoom: number;
    minMeaningfulCenterOffsetDegrees: number;
    flyToMinZoom: number;
    delayMs: number;
    durationMs: number;
    settleMs: number;
    curve: number;
    speed: number;
    syncCooldownMs: number;
  };
  resize: {
    debounceMs: number;
    settleMs: number;
    autoFitViewportDeltaPx: number;
  };
}

const GOOGLE_TRIP_MAP_TUNING: TripMapProviderTuning = {
  fitPadding: {
    baseRatio: 0.24,
    baseMin: 112,
    baseMax: 224,
    docked: {
      verticalBoost: 18,
      horizontalBoost: 18,
      verticalMin: 124,
      verticalMax: 268,
      horizontalMin: 112,
      horizontalMax: 244,
    },
    floating: {
      verticalBoost: 36,
      horizontalBoost: 28,
      verticalMin: 124,
      verticalMax: 268,
      horizontalMin: 112,
      horizontalMax: 244,
    },
  },
  selection: {
    activityFocusZoom: 13,
    cityFocusZoom: 10,
    queryFocusZoom: 5,
    safeInsetRatio: 0.28,
  },
  markers: {
    activityMinZoom: 9,
    tier: {
      lowZoom: 6.75,
      veryLowZoom: 5.25,
      denseRouteCoverage: 2.8,
      extremeDenseRouteCoverage: 3.8,
      microShortEdge: 185,
      compactShortEdge: 260,
      microVeryLowZoomMaxShortEdge: 230,
      compactVeryLowZoomDenseMaxShortEdge: 260,
      compactDenseMaxShortEdge: 340,
      compactDenseZoomCutoff: 8.5,
    },
    cityZoomProfile: {
      farCircleMaxZoom: 6.2,
      mediumCircleMaxZoom: 8.2,
      nearCircleMaxZoom: 10.1,
      compactPinMaxZoom: 10.9,
      scaleBands: [
        { minZoom: 13, scale: 1.2 },
        { minZoom: 12, scale: 1.14 },
        { minZoom: 11, scale: 1.1 },
        { minZoom: 10.9, scale: 1.06 },
      ],
    },
    crowding: {
      crowdedGapPx: 13,
      veryCrowdedGapPx: 10,
      disableCrowdingAtZoom: 10,
    },
  },
  intro: {
    camera: {
      center: [2, 20],
      zoom: 0.58,
      bearing: -32,
      pitch: 0,
    },
    minMeaningfulTargetZoom: 3.15,
    minMeaningfulCenterOffsetDegrees: 12,
    flyToMinZoom: 2.8,
    delayMs: 40,
    durationMs: 1350,
    settleMs: 1410,
    curve: 1.25,
    speed: 1.15,
    syncCooldownMs: 260,
  },
  resize: {
    debounceMs: 72,
    settleMs: 180,
    autoFitViewportDeltaPx: 24,
  },
};

const MAPBOX_TRIP_MAP_TUNING: TripMapProviderTuning = {
  fitPadding: {
    baseRatio: 0.28,
    baseMin: 128,
    baseMax: 244,
    docked: {
      verticalBoost: 28,
      horizontalBoost: 26,
      verticalMin: 136,
      verticalMax: 284,
      horizontalMin: 124,
      horizontalMax: 264,
    },
    floating: {
      verticalBoost: 52,
      horizontalBoost: 36,
      verticalMin: 144,
      verticalMax: 308,
      horizontalMin: 132,
      horizontalMax: 288,
    },
  },
  selection: {
    activityFocusZoom: 12.6,
    cityFocusZoom: 9.6,
    queryFocusZoom: 4.7,
    safeInsetRatio: 0.34,
  },
  markers: {
    activityMinZoom: 8.5,
    tier: {
      lowZoom: 7.2,
      veryLowZoom: 5.8,
      denseRouteCoverage: 2.45,
      extremeDenseRouteCoverage: 3.35,
      microShortEdge: 192,
      compactShortEdge: 270,
      microVeryLowZoomMaxShortEdge: 238,
      compactVeryLowZoomDenseMaxShortEdge: 272,
      compactDenseMaxShortEdge: 356,
      compactDenseZoomCutoff: 8.9,
    },
    cityZoomProfile: {
      farCircleMaxZoom: 7.1,
      mediumCircleMaxZoom: 8.9,
      nearCircleMaxZoom: 10.5,
      compactPinMaxZoom: 11.2,
      scaleBands: [
        { minZoom: 12.6, scale: 1.22 },
        { minZoom: 11.8, scale: 1.16 },
        { minZoom: 11.0, scale: 1.1 },
        { minZoom: 10.2, scale: 1.05 },
      ],
    },
    crowding: {
      crowdedGapPx: 14,
      veryCrowdedGapPx: 11,
      disableCrowdingAtZoom: 10.6,
    },
  },
  intro: {
    camera: {
      center: [2, 20],
      zoom: 0.52,
      bearing: -38,
      pitch: 0,
    },
    minMeaningfulTargetZoom: 2.85,
    minMeaningfulCenterOffsetDegrees: 10,
    flyToMinZoom: 3.05,
    delayMs: 120,
    durationMs: 1680,
    settleMs: 1780,
    curve: 1.32,
    speed: 1.08,
    syncCooldownMs: 320,
  },
  resize: {
    debounceMs: 88,
    settleMs: 220,
    autoFitViewportDeltaPx: 28,
  },
};

export const getTripMapProviderTuning = (
  provider: MapImplementation,
): TripMapProviderTuning => (provider === 'mapbox' ? MAPBOX_TRIP_MAP_TUNING : GOOGLE_TRIP_MAP_TUNING);

export const resolveTripMapViewportPadding = ({
  provider,
  mapDockMode,
  mapViewportSize,
}: {
  provider: MapImplementation;
  mapDockMode: TripMapDockMode;
  mapViewportSize: { width: number; height: number } | null;
}): TripMapViewportPadding => {
  const tuning = getTripMapProviderTuning(provider);
  const shortEdge = Math.min(mapViewportSize?.width ?? 0, mapViewportSize?.height ?? 0);
  const basePadding = Math.max(
    tuning.fitPadding.baseMin,
    Math.min(tuning.fitPadding.baseMax, Math.round(shortEdge * tuning.fitPadding.baseRatio) || tuning.fitPadding.baseMin),
  );
  const modeTuning = mapDockMode === 'floating' ? tuning.fitPadding.floating : tuning.fitPadding.docked;
  const verticalPadding = Math.max(
    modeTuning.verticalMin,
    Math.min(modeTuning.verticalMax, basePadding + modeTuning.verticalBoost),
  );
  const horizontalPadding = Math.max(
    modeTuning.horizontalMin,
    Math.min(modeTuning.horizontalMax, basePadding + modeTuning.horizontalBoost),
  );

  return {
    top: verticalPadding,
    right: horizontalPadding,
    bottom: verticalPadding,
    left: horizontalPadding,
  };
};
