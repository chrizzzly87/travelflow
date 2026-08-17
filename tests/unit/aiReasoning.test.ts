import { describe, expect, it } from 'vitest';
import { resolveSupportedReasoningEffort } from '../../shared/aiReasoning';

describe('resolveSupportedReasoningEffort', () => {
  it('keeps an effort directly supported by the model', () => {
    expect(resolveSupportedReasoningEffort('low', ['low', 'high'])).toBe('low');
  });

  it('uses the closest lower effort on an equal-distance tie', () => {
    expect(resolveSupportedReasoningEffort('medium', ['low', 'high'])).toBe('low');
  });

  it('uses the lowest available effort for a mandatory reasoning model', () => {
    expect(resolveSupportedReasoningEffort('low', ['high', 'xhigh'], true)).toBe('high');
  });

  it('does not try to disable mandatory reasoning', () => {
    expect(resolveSupportedReasoningEffort('none', ['low', 'high'], true)).toBeUndefined();
  });
});
