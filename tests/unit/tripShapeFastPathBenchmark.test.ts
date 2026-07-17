import { describe, expect, it } from 'vitest';
import {
  parseTripShapeBenchmarkArgs,
  percentile,
  summarizeDurations,
} from '../../scripts/benchmark-trip-shape-fast-path';

describe('trip-shape fast-path benchmark utilities', () => {
  it('uses nearest-rank percentiles without mutating input samples', () => {
    const samples = [4, 1, 3, 2];

    expect(percentile(samples, 0.5)).toBe(2);
    expect(percentile(samples, 0.95)).toBe(4);
    expect(samples).toEqual([4, 1, 3, 2]);
  });

  it('summarizes measured durations', () => {
    expect(summarizeDurations([1, 2, 3, 4])).toEqual({
      samples: 4,
      min: 1,
      p50: 2,
      p95: 4,
      max: 4,
      mean: 2.5,
    });
  });

  it('parses benchmark iteration and guardrail options', () => {
    expect(parseTripShapeBenchmarkArgs(['--iterations=120', '--warmup', '12', '--skip-budgets']))
      .toEqual({ iterations: 120, warmupIterations: 12, enforceBudgets: false });
    expect(() => parseTripShapeBenchmarkArgs(['--iterations', '0']))
      .toThrow('--iterations must be an integer between 10 and 10000.');
  });
});
