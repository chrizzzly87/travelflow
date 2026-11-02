import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  ACTIVITY_MAX_DURATION_HOURS,
  ACTIVITY_MIN_DURATION_HOURS,
  activityDurationDaysToHours,
  clampActivityDurationHours,
  formatActivityDuration,
} from '../../components/detailsPanelUtils';

describe('activity duration editing helpers', () => {
  it('converts fractional day durations into editable hours', () => {
    expect(activityDurationDaysToHours(1)).toBe(24);
    expect(activityDurationDaysToHours(0.125)).toBe(3);
    expect(activityDurationDaysToHours(1 / 48)).toBe(0.5);
  });

  it('clamps hour input to the supported range', () => {
    expect(clampActivityDurationHours(0)).toBe(ACTIVITY_MIN_DURATION_HOURS);
    expect(clampActivityDurationHours(-4)).toBe(ACTIVITY_MIN_DURATION_HOURS);
    expect(clampActivityDurationHours(Number.NaN)).toBe(ACTIVITY_MIN_DURATION_HOURS);
    expect(clampActivityDurationHours(3)).toBe(3);
    expect(clampActivityDurationHours(ACTIVITY_MAX_DURATION_HOURS + 100)).toBe(ACTIVITY_MAX_DURATION_HOURS);
  });

  it('labels sub-day activities in hours and longer ones in days', () => {
    expect(formatActivityDuration(0.125)).toBe('3 hours');
    expect(formatActivityDuration(1 / 24)).toBe('1 hour');
    expect(formatActivityDuration(1)).toBe('1 day');
    expect(formatActivityDuration(2.5)).toBe('2.5 days');
  });

  it('never renders a negative or non-finite duration', () => {
    expect(formatActivityDuration(-1)).toBe('0 hours');
    expect(formatActivityDuration(Number.NaN)).toBe('0 hours');
  });
});

describe('components/DetailsPanel activity editing wiring', () => {
  const source = readFileSync(
    path.resolve(process.cwd(), 'components/DetailsPanel.tsx'),
    'utf8'
  );

  it('offers duration editing for activities, not only for cities', () => {
    expect(source).toContain("{(isCity || isActivity) && (");
    expect(source).toContain('openDurationEditor');
    expect(source).toContain("isSchedulableDraftType(displayItem.type)");
  });

  it('offers a location editor for activities', () => {
    expect(source).toContain('openActivityLocationEditor');
    expect(source).toContain('handleApplyActivityLocationEdit');
    expect(source).toContain('searchPlaceSuggestions');
  });
});
