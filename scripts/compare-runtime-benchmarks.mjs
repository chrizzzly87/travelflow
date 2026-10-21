import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const compareBenchmarks = (before, after) => {
  if (before.browser !== after.browser || before.node !== after.node
    || JSON.stringify(before.settings) !== JSON.stringify(after.settings)) {
    throw new Error('Benchmark browser, Node and measurement settings must match');
  }
  if (before.results.length !== after.results.length) throw new Error('Benchmark routes must match');
  return before.results.map((baseline) => {
    const candidate = after.results.find((entry) => entry.route === baseline.route);
    if (!candidate) throw new Error(`Missing benchmark route: ${baseline.route}`);
    const metrics = Object.fromEntries(Object.entries(baseline.median).map(([key, value]) => {
      const next = candidate.median[key];
      if (!Number.isFinite(value) || !Number.isFinite(next)) throw new Error(`Invalid metric: ${key}`);
      return [key, { before: value, after: next, delta: next - value,
        percent: value === 0 ? null : (next - value) / value * 100 }];
    }));
    return { route: baseline.route, metrics };
  });
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const before = JSON.parse(await fs.readFile('perf/runtime/before.json', 'utf8'));
  const after = JSON.parse(await fs.readFile('perf/runtime/after.json', 'utf8'));
  const comparison = compareBenchmarks(before, after);
  await fs.writeFile('perf/runtime/comparison.json', `${JSON.stringify(comparison, null, 2)}\n`);
  console.table(comparison.map(({ route, metrics }) => ({ route,
    'ready before ms': Math.round(metrics.readyMs.before), 'ready after ms': Math.round(metrics.readyMs.after),
    'ready change %': metrics.readyMs.percent.toFixed(1),
    'LCP before ms': Math.round(metrics.lcp.before), 'LCP after ms': Math.round(metrics.lcp.after),
    'JS gzip change B': metrics.jsGzipBytes.delta,
  })));
}
