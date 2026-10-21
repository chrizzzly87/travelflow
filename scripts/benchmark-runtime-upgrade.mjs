/** One command builds and measures a detached baseline and the current checkout. */
import { spawnSync, execFileSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const root = process.cwd();
const base = process.argv.find((arg) => arg.startsWith('--base='))?.slice(7);
if (!base) throw new Error('Pass --base=<commit-or-ref> to select the comparison baseline');
const revision = execFileSync('git', ['rev-parse', '--verify', `${base}^{commit}`], { encoding: 'utf8' }).trim();
const directory = await mkdtemp(path.join(tmpdir(), 'tf-runtime-benchmark-'));
const baseline = path.join(directory, 'baseline');
const run = (command, args, cwd = root, env = {}) => {
  const result = spawnSync(command, args, { cwd,
    env: { ...process.env, NODE_OPTIONS: process.env.NODE_OPTIONS || '--max-old-space-size=4096', ...env },
    stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed (${result.status})`);
};
let attached = false;
try {
  run('git', ['worktree', 'add', '--detach', baseline, revision]);
  attached = true;
  run('pnpm', ['install', '--frozen-lockfile'], baseline);
  run('pnpm', ['worktree:sync-env'], baseline);
  run('pnpm', ['ci:local', '--only=build'], baseline);
  run(process.execPath, ['scripts/benchmark-runtime.mjs', '--label=before'], root, {
    RUNTIME_DIST_DIR: path.join(baseline, 'dist'), RUNTIME_SOURCE_DIR: baseline,
  });
  run('pnpm', ['ci:local', '--only=build']);
  run(process.execPath, ['scripts/benchmark-runtime.mjs', '--label=after']);
  run(process.execPath, ['scripts/compare-runtime-benchmarks.mjs']);
} finally {
  if (attached) run('git', ['worktree', 'remove', '--force', baseline]);
  await rm(directory, { recursive: true, force: true });
}
