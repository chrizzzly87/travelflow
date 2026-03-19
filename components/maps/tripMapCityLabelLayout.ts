import type { MapImplementation } from '../../shared/mapRuntime';
import type { TripMapCityLabelAnchor } from './tripMapProviderPresentation';
import { getTripMapProviderPresentation } from './tripMapProviderPresentation';

export interface TripMapProjectedCityLabelInput {
  key: string;
  point: {
    x: number;
    y: number;
  };
  name: string;
  subLabel?: string;
}

export interface TripMapProjectedCityLabelLayout {
  anchor: TripMapCityLabelAnchor;
  offsetPx: number;
  compact: boolean;
  tier: number;
}

interface ResolveTripMapProjectedCityLabelLayoutsOptions {
  provider: MapImplementation;
  labels: TripMapProjectedCityLabelInput[];
  baseOffsetPx: number;
  viewport: {
    width: number;
    height: number;
  };
}

interface EstimatedLabelBox {
  width: number;
  height: number;
}

interface LabelRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const LABEL_COLLISION_PADDING_PX = 8;
const LABEL_VIEWPORT_GUTTER_PX = 10;
const MAPBOX_COMPACT_NEIGHBOR_X_PX = 92;
const MAPBOX_COMPACT_NEIGHBOR_Y_PX = 58;
const MAPBOX_ABOVE_TIER_STEP_PX = 18;
const MAPBOX_BELOW_TIER_STEP_PX = 14;
const MAPBOX_MAX_ABOVE_TIERS = 4;
const MAPBOX_MAX_BELOW_TIERS = 2;

const expandRect = (rect: LabelRect, padding: number): LabelRect => ({
  left: rect.left - padding,
  top: rect.top - padding,
  right: rect.right + padding,
  bottom: rect.bottom + padding,
});

const rectsOverlap = (a: LabelRect, b: LabelRect): boolean => !(
  a.right <= b.left
  || a.left >= b.right
  || a.bottom <= b.top
  || a.top >= b.bottom
);

const estimateTripMapCityLabelBox = ({
  name,
  subLabel,
  maxWidthPx,
  compact,
}: {
  name: string;
  subLabel?: string;
  maxWidthPx: number;
  compact: boolean;
}): EstimatedLabelBox => {
  const horizontalPaddingPx = compact ? 18 : 22;
  const nameWidthPx = Math.max(
    72,
    Math.min(maxWidthPx, Math.round(name.length * (compact ? 7.2 : 7.8) + horizontalPaddingPx)),
  );
  const subLabelWidthPx = subLabel
    ? Math.max(
      0,
      Math.min(maxWidthPx, Math.round(subLabel.length * (compact ? 6 : 6.6) + horizontalPaddingPx)),
    )
    : 0;

  return {
    width: Math.max(nameWidthPx, subLabelWidthPx),
    height: subLabel ? (compact ? 34 : 40) : (compact ? 28 : 32),
  };
};

const buildLabelRect = ({
  point,
  anchor,
  offsetPx,
  tier,
  estimatedBox,
}: {
  point: TripMapProjectedCityLabelInput['point'];
  anchor: TripMapCityLabelAnchor;
  offsetPx: number;
  tier: number;
  estimatedBox: EstimatedLabelBox;
}): LabelRect => {
  const tierStepPx = anchor === 'below' ? MAPBOX_BELOW_TIER_STEP_PX : MAPBOX_ABOVE_TIER_STEP_PX;
  const tierOffsetPx = tier * tierStepPx;
  const width = estimatedBox.width;
  const height = estimatedBox.height;
  const centerLeft = point.x - width / 2;

  if (anchor === 'below') {
    const top = point.y + offsetPx + tierOffsetPx;
    return {
      left: centerLeft,
      top,
      right: centerLeft + width,
      bottom: top + height,
    };
  }

  const bottom = point.y - offsetPx - tierOffsetPx;
  return {
    left: centerLeft,
    top: bottom - height,
    right: centerLeft + width,
    bottom,
  };
};

const isRectInsideViewport = (
  rect: LabelRect,
  viewport: ResolveTripMapProjectedCityLabelLayoutsOptions['viewport'],
): boolean => (
  rect.left >= LABEL_VIEWPORT_GUTTER_PX
  && rect.right <= viewport.width - LABEL_VIEWPORT_GUTTER_PX
  && rect.top >= LABEL_VIEWPORT_GUTTER_PX
  && rect.bottom <= viewport.height - LABEL_VIEWPORT_GUTTER_PX
);

const countCollisions = (rect: LabelRect, placedRects: LabelRect[]): number => {
  const padded = expandRect(rect, LABEL_COLLISION_PADDING_PX);
  return placedRects.filter((placedRect) => rectsOverlap(padded, expandRect(placedRect, LABEL_COLLISION_PADDING_PX))).length;
};

const isMapboxLabelCrowded = (
  currentLabel: TripMapProjectedCityLabelInput,
  labels: TripMapProjectedCityLabelInput[],
): boolean => labels.some((candidate) => (
  candidate.key !== currentLabel.key
  && Math.abs(candidate.point.x - currentLabel.point.x) <= MAPBOX_COMPACT_NEIGHBOR_X_PX
  && Math.abs(candidate.point.y - currentLabel.point.y) <= MAPBOX_COMPACT_NEIGHBOR_Y_PX
));

export const resolveTripMapProjectedCityLabelLayouts = ({
  provider,
  labels,
  baseOffsetPx,
  viewport,
}: ResolveTripMapProjectedCityLabelLayoutsOptions): Map<string, TripMapProjectedCityLabelLayout> => {
  const results = new Map<string, TripMapProjectedCityLabelLayout>();
  if (!labels.length) return results;

  if (provider !== 'mapbox') {
    labels.forEach((label) => {
      results.set(label.key, {
        anchor: 'above',
        offsetPx: baseOffsetPx,
        compact: false,
        tier: 0,
      });
    });
    return results;
  }

  const cityLabelPresentation = getTripMapProviderPresentation(provider).cityLabels;
  const defaultMaxWidthPx = cityLabelPresentation.maxWidthPx;
  const compactMaxWidthPx = Math.max(124, Math.round(defaultMaxWidthPx * 0.84));
  const placedRects: LabelRect[] = [];

  const sortedLabels = [...labels].sort((left, right) => (
    left.point.y - right.point.y || left.point.x - right.point.x
  ));

  sortedLabels.forEach((label) => {
    const compact = isMapboxLabelCrowded(label, labels) || label.name.length >= 16;
    const estimatedBox = estimateTripMapCityLabelBox({
      name: label.name,
      subLabel: label.subLabel,
      maxWidthPx: compact ? compactMaxWidthPx : defaultMaxWidthPx,
      compact,
    });

    let bestLayout: TripMapProjectedCityLabelLayout | null = null;
    let bestRect: LabelRect | null = null;
    let bestPenalty = Number.POSITIVE_INFINITY;
    const preferredAnchor: TripMapCityLabelAnchor = label.point.y <= estimatedBox.height + baseOffsetPx + 18
      ? 'below'
      : 'above';

    const tryAnchor = (
      anchor: TripMapCityLabelAnchor,
      stopOnPerfectFit: boolean,
    ): boolean => {
      const maxTier = anchor === 'below' ? MAPBOX_MAX_BELOW_TIERS : MAPBOX_MAX_ABOVE_TIERS;
      for (let tier = 0; tier < maxTier; tier += 1) {
        const offsetPx = baseOffsetPx;
        const rect = buildLabelRect({
          point: label.point,
          anchor,
          offsetPx,
          tier,
          estimatedBox,
        });
        const collisionPenalty = countCollisions(rect, placedRects);
        const viewportPenalty = isRectInsideViewport(rect, viewport) ? 0 : 3;
        const anchorPenalty = anchor === preferredAnchor ? 0 : 1;
        const tierPenalty = tier * 0.35;
        const totalPenalty = collisionPenalty * 4 + viewportPenalty * 3 + anchorPenalty + tierPenalty;

        if (totalPenalty < bestPenalty) {
          bestPenalty = totalPenalty;
          bestLayout = {
            anchor,
            offsetPx: offsetPx + (tier * (anchor === 'below' ? MAPBOX_BELOW_TIER_STEP_PX : MAPBOX_ABOVE_TIER_STEP_PX)),
            compact,
            tier,
          };
          bestRect = rect;
        }

        if (collisionPenalty === 0 && viewportPenalty === 0) {
          return stopOnPerfectFit;
        }
      }
      return false;
    };

    if (tryAnchor(preferredAnchor, true)) {
      placedRects.push(bestRect!);
      results.set(label.key, bestLayout!);
      return;
    }

    const anchorsToTry: TripMapCityLabelAnchor[] = preferredAnchor === 'above'
      ? ['above', 'below']
      : ['below', 'above'];

    anchorsToTry.forEach((anchor) => {
      tryAnchor(anchor, false);
    });

    if (!bestLayout || !bestRect) {
      return;
    }

    placedRects.push(bestRect);
    results.set(label.key, bestLayout);
  });

  return results;
};
