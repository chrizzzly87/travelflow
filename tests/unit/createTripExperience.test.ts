import { describe, expect, it } from 'vitest';

import {
  resolveCreateTripExperience,
  resolveCreateTripShapeRollout,
} from '../../config/createTripExperience';

describe('createTripExperience', () => {
  it('keeps both existing creator experiences when rollout is absent or invalid', () => {
    expect(resolveCreateTripShapeRollout(undefined)).toBe('off');
    expect(resolveCreateTripShapeRollout('unexpected')).toBe('off');
    expect(resolveCreateTripExperience('primary', 'off')).toBe('classic');
    expect(resolveCreateTripExperience('wizard', 'off')).toBe('wizard_v3');
  });

  it('can expose the shape planner on the wizard surface without changing the primary creator', () => {
    expect(resolveCreateTripShapeRollout(' WIZARD ')).toBe('wizard');
    expect(resolveCreateTripExperience('primary', 'wizard')).toBe('classic');
    expect(resolveCreateTripExperience('wizard', 'wizard')).toBe('shape_thailand');
  });

  it('can promote the shape planner to both production creator surfaces', () => {
    expect(resolveCreateTripExperience('primary', 'primary')).toBe('shape_thailand');
    expect(resolveCreateTripExperience('wizard', 'primary')).toBe('shape_thailand');
  });
});
