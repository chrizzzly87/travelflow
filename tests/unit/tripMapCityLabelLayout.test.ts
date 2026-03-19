import { describe, expect, it } from 'vitest';

import { resolveTripMapProjectedCityLabelLayouts } from '../../components/maps/tripMapCityLabelLayout';

describe('components/maps/tripMapCityLabelLayout', () => {
  it('keeps Google labels on the stable shared above placement', () => {
    const layouts = resolveTripMapProjectedCityLabelLayouts({
      provider: 'google',
      baseOffsetPx: 24,
      viewport: { width: 960, height: 640 },
      labels: [
        {
          key: 'bangkok',
          point: { x: 400, y: 280 },
          name: 'Bangkok',
        },
      ],
    });

    expect(layouts.get('bangkok')).toEqual({
      anchor: 'above',
      offsetPx: 24,
      compact: false,
      tier: 0,
    });
  });

  it('stacks crowded Mapbox labels upward instead of leaving them at the same offset', () => {
    const layouts = resolveTripMapProjectedCityLabelLayouts({
      provider: 'mapbox',
      baseOffsetPx: 24,
      viewport: { width: 960, height: 640 },
      labels: [
        {
          key: 'vientiane',
          point: { x: 420, y: 300 },
          name: 'Vientiane',
        },
        {
          key: 'anouvong',
          point: { x: 442, y: 308 },
          name: 'Anouvong',
        },
      ],
    });

    expect(layouts.get('vientiane')).toMatchObject({
      anchor: 'above',
      compact: true,
      tier: 0,
    });
    expect(layouts.get('anouvong')).toMatchObject({
      anchor: 'above',
      compact: true,
    });
    expect((layouts.get('anouvong')?.offsetPx ?? 0)).toBeGreaterThan(layouts.get('vientiane')?.offsetPx ?? 0);
  });

  it('keeps crowded Mapbox labels above the marker when there is still vertical room', () => {
    const layouts = resolveTripMapProjectedCityLabelLayouts({
      provider: 'mapbox',
      baseOffsetPx: 24,
      viewport: { width: 960, height: 640 },
      labels: [
        {
          key: 'bangkok',
          point: { x: 420, y: 320 },
          name: 'Bangkok',
        },
        {
          key: 'siem-reap',
          point: { x: 430, y: 324 },
          name: 'Siem Reap',
        },
      ],
    });

    expect(layouts.get('bangkok')).toMatchObject({ anchor: 'above' });
    expect(layouts.get('siem-reap')).toMatchObject({ anchor: 'above' });
  });

  it('flips Mapbox labels below the marker when the label would clip against the top viewport edge', () => {
    const layouts = resolveTripMapProjectedCityLabelLayouts({
      provider: 'mapbox',
      baseOffsetPx: 24,
      viewport: { width: 960, height: 640 },
      labels: [
        {
          key: 'hanoi',
          point: { x: 440, y: 18 },
          name: 'Hanoi',
          subLabel: 'START',
        },
      ],
    });

    expect(layouts.get('hanoi')).toMatchObject({
      anchor: 'below',
      compact: false,
      tier: 0,
      offsetPx: 24,
    });
  });

  it('hides the least important crowded Mapbox label when a dense cluster cannot be laid out cleanly', () => {
    const layouts = resolveTripMapProjectedCityLabelLayouts({
      provider: 'mapbox',
      baseOffsetPx: 24,
      viewport: { width: 960, height: 640 },
      labels: [
        {
          key: 'bangkok',
          point: { x: 420, y: 320 },
          name: 'Bangkok',
          subLabel: 'START • END',
        },
        {
          key: 'siem-reap',
          point: { x: 424, y: 322 },
          name: 'Siem Reap',
        },
        {
          key: 'phnom-penh',
          point: { x: 428, y: 324 },
          name: 'Phnom Penh',
        },
        {
          key: 'ho-chi-minh-city',
          point: { x: 432, y: 326 },
          name: 'Ho Chi Minh City',
        },
      ],
    });

    expect(layouts.get('bangkok')?.hidden).not.toBe(true);
    expect(layouts.get('siem-reap')?.hidden).not.toBe(true);
    const hiddenLabels = ['phnom-penh', 'ho-chi-minh-city'].filter((key) => layouts.get(key)?.hidden === true);
    expect(hiddenLabels.length).toBeGreaterThanOrEqual(1);
  });
});
