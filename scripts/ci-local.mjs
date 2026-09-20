#!/usr/bin/env node
/**
 * Runs the PR Quality pipeline (.github/workflows/pr-quality.yml) on this
 * machine, in the same order and with the same environment, so a failure is
 * found before the push instead of by email twenty minutes later.
 *
 * Keep the STAGES list below in step with the workflow. If you add a step
 * there, add it here.
 *
 *   pnpm ci:local              every stage
 *   pnpm ci:local --fast       skip the build and the Playwright suite
 *   pnpm ci:local --from=build start at the stage named `build`
 *   pnpm ci:local --only=build run just that stage
 *   pnpm ci:local --list       print the stages and exit
 */
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();

/**
 * CI installs Chromium into a clean runner every time. Locally it is already
 * there, and the download is ~150MB, so it is skipped unless the browser is
 * genuinely missing.
 */
const chromiumMissing = () => {
  const cacheRoot = process.env.PLAYWRIGHT_BROWSERS_PATH
    || path.join(process.env.HOME ?? '', 'Library', 'Caches', 'ms-playwright');
  try {
    return !fs.readdirSync(cacheRoot).some((entry) => entry.startsWith('chromium'));
  } catch {
    return true;
  }
};

const STAGES = [
  { name: 'storage', label: 'Validate storage registry', args: ['storage:validate'] },
  { name: 'toasts', label: 'Validate toast usage conventions', args: ['toasts:validate'] },
  { name: 'tests', label: 'Run core regression tests', args: ['test:core'] },
  {
    name: 'build',
    label: 'Run build gate',
    args: ['build:netlify'],
    slow: true,
    // The workflow passes these so the build does not need real credentials.
    env: {
      VITE_SUPABASE_URL: 'https://ci-placeholder.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'ci-placeholder-anon-key',
    },
  },
  {
    name: 'browser',
    label: 'Install Playwright Chromium',
    command: 'npx',
    args: ['playwright', 'install', '--with-deps', 'chromium'],
    slow: true,
    skipIf: () => (chromiumMissing() ? null : 'Chromium already installed'),
  },
  { name: 'e2e', label: 'Run offline/PWA end-to-end suite', args: ['test:e2e:pwa'], slow: true },
];

const argv = process.argv.slice(2);
const has = (flag) => argv.includes(flag);
const valueOf = (flag) => argv.find((arg) => arg.startsWith(`${flag}=`))?.split('=')[1];

if (has('--list')) {
  STAGES.forEach((stage) => console.log(`${stage.name.padEnd(9)} ${stage.label}`));
  process.exit(0);
}

/**
 * CI pins Node to `.node-version`, which matches Netlify's NODE_VERSION. A
 * different local major is usually harmless and occasionally is the whole
 * reason a run disagrees with CI, so it is said out loud and never enforced --
 * blocking here would just be another gate to work around.
 */
const warnOnNodeMismatch = () => {
  const pinned = fs.readFileSync(path.join(ROOT, '.node-version'), 'utf8').trim();
  const local = process.versions.node.split('.')[0];
  if (local !== pinned.split('.')[0]) {
    console.log(
      `\x1b[33m!\x1b[0m  Node ${process.versions.node} here, ${pinned} in CI and on Netlify.\n`
      + `   Mostly fine. If a result here disagrees with CI, match it first:\n`
      + `     fnm use ${pinned}   (or nvm use ${pinned})\n`,
    );
  }
};

const run = (stage) => {
  const command = stage.command ?? 'pnpm';
  const result = spawnSync(command, stage.args, {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, ...(stage.env ?? {}) },
  });
  return result.status === 0;
};

/**
 * `pnpm build:netlify` re-encodes two blog images and rewrites a couple of
 * generated files every time, so a green run would otherwise leave the worktree
 * dirty and those bytes would ride along in the next `git add -A`.
 *
 * Only files the build itself dirtied are restored: the set of modified tracked
 * files is compared before and after, so edits that were already in progress
 * are never reverted.
 */
const modifiedTrackedFiles = () =>
  new Set(
    execFileSync('git', ['diff', '--name-only'], { cwd: ROOT, encoding: 'utf8' })
      .split('\n')
      .filter(Boolean),
  );

const restoreBuildArtifacts = (before) => {
  const dirtied = [...modifiedTrackedFiles()].filter((file) => !before.has(file));
  if (dirtied.length === 0) return;

  execFileSync('git', ['checkout', '--', ...dirtied], { cwd: ROOT });
  console.log(`\x1b[2m   restored ${dirtied.length} file(s) the build re-encoded\x1b[0m`);
};

const known = STAGES.map((stage) => stage.name);
const from = valueOf('--from');
const only = valueOf('--only');

for (const [flag, value] of [['--from', from], ['--only', only]]) {
  if (value && !known.includes(value)) {
    console.error(`Unknown stage "${value}" for ${flag}. Known: ${known.join(', ')}`);
    process.exit(2);
  }
}

// `--only` names a stage outright, so it wins over `--fast`'s "skip the slow
// ones" -- asking for the build and silently getting nothing is worse than slow.
const selected = only
  ? STAGES.filter((stage) => stage.name === only)
  : STAGES
    .slice(from ? known.indexOf(from) : 0)
    .filter((stage) => !(has('--fast') && stage.slow));

if (selected.length === 0) {
  console.error('Nothing to run: --fast skipped every stage in the selected range.');
  process.exit(2);
}

warnOnNodeMismatch();
console.log(`Running ${selected.length} stage(s) of PR Quality.\n`);

const startedAll = Date.now();
for (const [index, stage] of selected.entries()) {
  const position = `[${index + 1}/${selected.length}]`;
  const skip = stage.skipIf?.();
  if (skip) {
    console.log(`\x1b[2m${position} ${stage.label} — skipped (${skip})\x1b[0m`);
    continue;
  }

  console.log(`\x1b[36m${position} ${stage.label}\x1b[0m`);
  const dirtyBeforeStage = stage.name === 'build' ? modifiedTrackedFiles() : null;
  const started = Date.now();
  const ok = run(stage);
  const seconds = Math.round((Date.now() - started) / 1000);

  if (dirtyBeforeStage) restoreBuildArtifacts(dirtyBeforeStage);

  if (!ok) {
    console.error(
      `\n\x1b[31m✗ ${stage.label} failed after ${seconds}s.\x1b[0m\n`
      + `  CI would stop here too. Fix it, then resume with:\n`
      + `    pnpm ci:local --from=${stage.name}\n`,
    );
    process.exit(1);
  }
  console.log(`\x1b[32m✓\x1b[0m ${stage.label} (${seconds}s)\n`);
}

const total = Math.round((Date.now() - startedAll) / 1000);
console.log(`\x1b[32mPR Quality passed locally in ${Math.floor(total / 60)}m ${total % 60}s.\x1b[0m`);
