import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';

export const WORKTREE_ENV_FILES = ['.env', '.env.local'] as const;

export type WorktreeEnvFileName = (typeof WORKTREE_ENV_FILES)[number];
export type WorktreeEnvPlanStatus =
  | 'pending'
  | 'copied'
  | 'missing-source'
  | 'same-path'
  | 'existing-target';

export interface WorktreeEnvPlanItem {
  name: WorktreeEnvFileName;
  sourcePath: string;
  targetPath: string;
  status: WorktreeEnvPlanStatus;
}

export interface RunWorktreeEnvSyncOptions {
  cwd?: string;
  sourceRoot?: string;
  targetRoot?: string;
  overwrite?: boolean;
  dryRun?: boolean;
}

export interface RunWorktreeEnvSyncResult {
  sourceRoot: string;
  targetRoot: string;
  plan: WorktreeEnvPlanItem[];
}

const resolveGitOutputPath = (cwd: string, value: string): string => (
  isAbsolute(value) ? value : resolve(cwd, value)
);

const trimGitOutput = (value: string): string => value.trim();

export const resolvePrimaryCheckoutRootFromCommonDir = (commonDir: string): string => resolve(commonDir, '..');

export const getActiveWorktreeRoot = (cwd = process.cwd()): string => trimGitOutput(
  execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd, encoding: 'utf8' }),
);

export const getGitCommonDir = (cwd = process.cwd()): string => {
  const output = trimGitOutput(execFileSync('git', ['rev-parse', '--git-common-dir'], { cwd, encoding: 'utf8' }));
  return resolveGitOutputPath(cwd, output);
};

export const buildWorktreeEnvCopyPlan = (
  sourceRoot: string,
  targetRoot: string,
  overwrite = true,
): WorktreeEnvPlanItem[] => WORKTREE_ENV_FILES.map((name) => {
  const sourcePath = resolve(sourceRoot, name);
  const targetPath = resolve(targetRoot, name);

  if (!existsSync(sourcePath)) {
    return { name, sourcePath, targetPath, status: 'missing-source' };
  }

  if (sourcePath === targetPath) {
    return { name, sourcePath, targetPath, status: 'same-path' };
  }

  if (!overwrite && existsSync(targetPath)) {
    return { name, sourcePath, targetPath, status: 'existing-target' };
  }

  return { name, sourcePath, targetPath, status: 'pending' };
});

export const executeWorktreeEnvCopyPlan = (
  plan: WorktreeEnvPlanItem[],
  dryRun = false,
): WorktreeEnvPlanItem[] => plan.map((item) => {
  if (item.status !== 'pending') return item;

  if (!dryRun) {
    mkdirSync(dirname(item.targetPath), { recursive: true });
    copyFileSync(item.sourcePath, item.targetPath);
    chmodSync(item.targetPath, statSync(item.sourcePath).mode & 0o777);
  }

  return {
    ...item,
    status: 'copied',
  };
});

export const runWorktreeEnvSync = ({
  cwd = process.cwd(),
  sourceRoot,
  targetRoot,
  overwrite = true,
  dryRun = false,
}: RunWorktreeEnvSyncOptions = {}): RunWorktreeEnvSyncResult => {
  const resolvedTargetRoot = targetRoot ? resolve(cwd, targetRoot) : getActiveWorktreeRoot(cwd);
  const resolvedSourceRoot = sourceRoot
    ? resolve(cwd, sourceRoot)
    : resolvePrimaryCheckoutRootFromCommonDir(getGitCommonDir(cwd));
  const plan = buildWorktreeEnvCopyPlan(resolvedSourceRoot, resolvedTargetRoot, overwrite);

  return {
    sourceRoot: resolvedSourceRoot,
    targetRoot: resolvedTargetRoot,
    plan: executeWorktreeEnvCopyPlan(plan, dryRun),
  };
};

export interface ParsedCreateWorktreeArgs {
  path: string;
  ref?: string;
  branch?: string;
  force: boolean;
  detach: boolean;
  noCheckout: boolean;
}

export const parseCreateWorktreeArgs = (args: string[]): ParsedCreateWorktreeArgs => {
  const positionals: string[] = [];
  let branch: string | undefined;
  let ref: string | undefined;
  let force = false;
  let detach = false;
  let noCheckout = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--') continue;
    if (arg === '--force' || arg === '-f') {
      force = true;
      continue;
    }
    if (arg === '--detach') {
      detach = true;
      continue;
    }
    if (arg === '--no-checkout') {
      noCheckout = true;
      continue;
    }
    if (arg === '--branch' || arg === '-b') {
      const value = args[index + 1];
      if (!value) throw new Error('Missing branch name after --branch.');
      branch = value;
      index += 1;
      continue;
    }
    if (arg.startsWith('--branch=')) {
      branch = arg.slice('--branch='.length);
      continue;
    }
    if (arg === '--ref') {
      const value = args[index + 1];
      if (!value) throw new Error('Missing ref after --ref.');
      ref = value;
      index += 1;
      continue;
    }
    if (arg.startsWith('--ref=')) {
      ref = arg.slice('--ref='.length);
      continue;
    }
    if (arg.startsWith('-')) {
      throw new Error(`Unsupported worktree option: ${arg}`);
    }

    positionals.push(arg);
  }

  if (positionals.length === 0) {
    throw new Error('Usage: pnpm worktree:new <path> [ref] [--branch <name>] [--force] [--detach] [--no-checkout]');
  }

  if (positionals.length > 2) {
    throw new Error('Too many positional arguments. Expected <path> and optional [ref].');
  }

  if (!ref && positionals[1]) {
    ref = positionals[1];
  }

  if (detach && branch) {
    throw new Error('Cannot combine --detach with --branch.');
  }

  return {
    path: positionals[0],
    ref,
    branch,
    force,
    detach,
    noCheckout,
  };
};

export const buildGitWorktreeAddArgs = (parsed: ParsedCreateWorktreeArgs): string[] => {
  const gitArgs = ['worktree', 'add'];

  if (parsed.force) gitArgs.push('--force');
  if (parsed.detach) gitArgs.push('--detach');
  if (parsed.noCheckout) gitArgs.push('--no-checkout');
  if (parsed.branch) gitArgs.push('-b', parsed.branch);

  gitArgs.push(parsed.path);

  if (parsed.ref) gitArgs.push(parsed.ref);

  return gitArgs;
};

export const formatWorktreeEnvSyncSummary = (result: RunWorktreeEnvSyncResult): string[] => {
  const lines = [
    `Source root: ${result.sourceRoot}`,
    `Target root: ${result.targetRoot}`,
  ];

  for (const item of result.plan) {
    if (item.status === 'copied') {
      lines.push(`Copied ${item.name}`);
      continue;
    }
    if (item.status === 'missing-source') {
      lines.push(`Skipped ${item.name} (missing in source checkout)`);
      continue;
    }
    if (item.status === 'same-path') {
      lines.push(`Skipped ${item.name} (already using the primary checkout)`);
      continue;
    }
    if (item.status === 'existing-target') {
      lines.push(`Skipped ${item.name} (target already exists)`);
    }
  }

  return lines;
};

export const createWorktreeAndSyncEnv = (args: string[], cwd = process.cwd()): RunWorktreeEnvSyncResult => {
  const parsed = parseCreateWorktreeArgs(args);
  const gitArgs = buildGitWorktreeAddArgs(parsed);
  const command = spawnSync('git', gitArgs, {
    cwd,
    stdio: 'inherit',
    shell: false,
  });

  if (command.status !== 0) {
    throw new Error(`git ${gitArgs.join(' ')} failed with exit code ${command.status ?? 1}`);
  }

  return runWorktreeEnvSync({
    cwd,
    targetRoot: resolve(cwd, parsed.path),
  });
};
