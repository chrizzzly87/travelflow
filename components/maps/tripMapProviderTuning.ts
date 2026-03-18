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
      extraTop: number;
      extraRight: number;
      extraBottom: number;
      extraLeft: number;
    };
    floating: {
      verticalBoost: number;
      horizontalBoost: number;
      verticalMin: number;
      verticalMax: number;
      horizontalMin: number;
      horizontalMax: number;
      extraTop: number;
      extraRight: number;
      extraBottom: number;
      extraLeft: number;
    };
  };
  selection: {
    activityFocusZoom: number;
    cityFocusZoom: number;
    queryFocusZoom: number;
    safeInsetRatio: number;
    floatingSafeInsetRatio: number;
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
  projection: {
    resting: {
      docked: 'globe' | 'mercator' | null;
      floating: 'globe' | 'mercator' | null;
    };
    globeIntroMinShortEdgePx: number;
    globeIntroMinAreaPx: number;
  };
  resize: {
    debounceMs: number;
    settleMs: number;
    autoFitViewportDeltaPx: number;
    dockModeRefitDelayMs: number;
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
      extraTop: 0,
      extraRight: 0,
      extraBottom: 0,
      extraLeft: 0,
    },
    floating: {
      verticalBoost: 36,
      horizontalBoost: 28,
      verticalMin: 124,
      verticalMax: 268,
      horizontalMin: 112,
      horizontalMax: 244,
      extraTop: 0,
      extraRight: 0,
      extraBottom: 0,
      extraLeft: 0,
    },
  },
  selection: {
    activityFocusZoom: 13,
    cityFocusZoom: 10,
    queryFocusZoom: 5,
    safeInsetRatio: 0.28,
    floatingSafeInsetRatio: 0.24,
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
      bearing: 0,
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
  projection: {
    resting: {
      docked: null,
      floating: null,
    },
    globeIntroMinShortEdgePx: Number.POSITIVE_INFINITY,
    globeIntroMinAreaPx: Number.POSITIVE_INFINITY,
  },
  resize: {
    debounceMs: 72,
    settleMs: 180,
    autoFitViewportDeltaPx: 24,
    dockModeRefitDelayMs: 220,
  },
};

const MAPBOX_TRIP_MAP_TUNING: TripMapProviderTuning = {
  fitPadding: {
    baseRatio: 0.16,
    baseMin: 58,
    baseMax: 156,
    docked: {
      verticalBoost: 18,
      horizontalBoost: 18,
      verticalMin: 86,
      verticalMax: 210,
      horizontalMin: 84,
      horizontalMax: 196,
      extraTop: 18,
      extraRight: 72,
      extraBottom: 30,
      extraLeft: 26,
    },
    floating: {
      verticalBoost: -24,
      horizontalBoost: -22,
      verticalMin: 28,
      verticalMax: 72,
      horizontalMin: 24,
      horizontalMax: 66,
      extraTop: 8,
      extraRight: 20,
      extraBottom: 14,
      extraLeft: 12,
    },
  },
  selection: {
    activityFocusZoom: 12.6,
    cityFocusZoom: 9.6,
    queryFocusZoom: 4.7,
    safeInsetRatio: 0.24,
    floatingSafeInsetRatio: 0.16,
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
      zoom: 0.44,
      bearing: 0,
      pitch: 0,
    },
    minMeaningfulTargetZoom: 2.3,
    minMeaningfulCenterOffsetDegrees: 6,
    flyToMinZoom: 3.05,
    delayMs: 90,
    durationMs: 1480,
    settleMs: 1560,
    curve: 1.28,
    speed: 1.08,
    syncCooldownMs: 320,
  },
  projection: {
    resting: {
      docked: 'mercator',
      floating: 'mercator',
    },
    globeIntroMinShortEdgePx: 420,
    globeIntroMinAreaPx: 240000,
  },
  resize: {
    debounceMs: 88,
    settleMs: 220,
    autoFitViewportDeltaPx: 28,
    dockModeRefitDelayMs: 260,
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
    top: verticalPadding + modeTuning.extraTop,
    right: horizontalPadding + modeTuning.extraRight,
    bottom: verticalPadding + modeTuning.extraBottom,
    left: horizontalPadding + modeTuning.extraLeft,
  };
};

export const resolveTripMapSelectionSafeInsetRatio = ({
  provider,
  mapDockMode,
}: {
  provider: MapImplementation;
  mapDockMode: TripMapDockMode;
}): number => {
  const tuning = getTripMapProviderTuning(provider);
  return mapDockMode === 'floating'
    ? tuning.selection.floatingSafeInsetRatio
    : tuning.selection.safeInsetRatio;
};

export const resolveTripMapRestingProjection = ({
  provider,
  mapDockMode,
}: {
  provider: MapImplementation;
  mapDockMode: TripMapDockMode;
}): 'globe' | 'mercator' | null => {
  const tuning = getTripMapProviderTuning(provider);
  return mapDockMode === 'floating'
    ? tuning.projection.resting.floating
    : tuning.projection.resting.docked;
};

export const shouldUseTripMapGlobeIntro = ({
  provider,
  mapDockMode,
  mapViewportSize,
}: {
  provider: MapImplementation;
  mapDockMode: TripMapDockMode;
  mapViewportSize: { width: number; height: number } | null;
}): boolean => {
  if (provider !== 'mapbox' || mapDockMode !== 'docked') return false;
  const tuning = getTripMapProviderTuning(provider);
  const width = mapViewportSize?.width ?? 0;
  const height = mapViewportSize?.height ?? 0;
  const shortEdge = Math.min(width, height);
  return shortEdge >= tuning.projection.globeIntroMinShortEdgePx
    && (width * height) >= tuning.projection.globeIntroMinAreaPx;
};
