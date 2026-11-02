import { describe, expect, it } from 'vitest';
import { compareBenchmarks } from '../../scripts/compare-runtime-benchmarks.mjs';

const report = (readyMs: number, cls = 0) => ({
  browser: 'chromium-test', node: 'v22', settings: { runs: 5 },
  results: [{ route: '/', median: { readyMs, cls } }],
});

describe('runtime benchmark comparisons', () => {
  it('calculates deltas and handles a zero baseline without inventing a percentage', () => {
    expect(compareBenchmarks(report(100), report(90, 0.01))[0].metrics).toEqual({
      readyMs: { before: 100, after: 90, delta: -10, percent: -10 },
      cls: { before: 0, after: 0.01, delta: 0.01, percent: null },
    });
  });
  it('rejects comparisons with different browsers, settings or routes', () => {
    expect(() => compareBenchmarks(report(100), { ...report(90), browser: 'other' })).toThrow('must match');
    expect(() => compareBenchmarks(report(100), { ...report(90), settings: { runs: 1 } })).toThrow('must match');
    expect(() => compareBenchmarks(report(100), { ...report(90), results: [] })).toThrow('routes must match');
    expect(() => compareBenchmarks(report(100), {
      ...report(90), results: [{ route: '/other', median: { readyMs: 90, cls: 0 } }],
    })).toThrow('Missing benchmark route');
  });
});
