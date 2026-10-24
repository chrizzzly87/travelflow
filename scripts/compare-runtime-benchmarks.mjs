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
  const beforePath = process.argv.find(arg => arg.startsWith('--before='))?.slice(9) || 'perf/runtime/before.json';
  const afterPath = process.argv.find(arg => arg.startsWith('--after='))?.slice(8) || 'perf/runtime/after.json';
  const outputPath = process.argv.find(arg => arg.startsWith('--output='))?.slice(9) || 'perf/runtime/comparison.json';
  const before = JSON.parse(await fs.readFile(beforePath, 'utf8'));
  const after = JSON.parse(await fs.readFile(afterPath, 'utf8'));
  const comparison = compareBenchmarks(before, after);
  await fs.writeFile(outputPath, `${JSON.stringify(comparison, null, 2)}\n`);
  console.table(comparison.map(({ route, metrics }) => ({ route,
    'ready before ms': Math.round(metrics.readyMs.before), 'ready after ms': Math.round(metrics.readyMs.after),
    'ready change %': metrics.readyMs.percent.toFixed(1),
    'LCP before ms': Math.round(metrics.lcp.before), 'LCP after ms': Math.round(metrics.lcp.after),
    'JS gzip change B': metrics.jsGzipBytes.delta,
  })));
}
