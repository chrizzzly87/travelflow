import { describe, expect, it } from 'vitest';
import { computeVerticalTransferConnectorAnchors } from '../../utils';

describe('computeVerticalTransferConnectorAnchors', () => {
  it('keeps a visible separation for contiguous city boundaries in vertical mode', () => {
    const anchors = computeVerticalTransferConnectorAnchors(240, 240, 900, {
      cityEdgeInsetPx: 4,
      edgeGapPx: 1.5,
      minSeparationPx: 5,
    });

    expect(anchors.fromY).toBeLessThan(anchors.toY);
    expect(anchors.toY - anchors.fromY).toBeGreaterThanOrEqual(5);
    expect(anchors.fromY).toBeCloseTo(237.5, 3);
    expect(anchors.toY).toBeCloseTo(242.5, 3);
  });

  it('preserves connector ordering for reverse-flow legs', () => {
    const anchors = computeVerticalTransferConnectorAnchors(320, 280, 900, {
      cityEdgeInsetPx: 4,
      edgeGapPx: 1.5,
      minSeparationPx: 5,
    });

    expect(anchors.fromY).toBeGreaterThan(anchors.toY);
    expect(anchors.fromY - anchors.toY).toBeGreaterThanOrEqual(5);
  });

  it('clamps anchors to lane bounds when transfer is near the lane edge', () => {
    const anchors = computeVerticalTransferConnectorAnchors(1, 1, 3, {
      cityEdgeInsetPx: 4,
      edgeGapPx: 1.5,
      minSeparationPx: 5,
    });

    expect(anchors.fromY).toBeGreaterThanOrEqual(0);
    expect(anchors.toY).toBeGreaterThanOrEqual(0);
    expect(anchors.fromY).toBeLessThanOrEqual(3);
    expect(anchors.toY).toBeLessThanOrEqual(3);
    expect(anchors.connectorHeight).toBeGreaterThanOrEqual(4);
  });
});
