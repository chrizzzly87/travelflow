import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  buildGitWorktreeAddArgs,
  buildWorktreeEnvCopyPlan,
  executeWorktreeEnvCopyPlan,
  parseCreateWorktreeArgs,
  resolvePrimaryCheckoutRootFromCommonDir,
} from '../../scripts/worktreeEnv.ts';

const tempDirs: string[] = [];

const makeTempDir = (label: string): string => {
  const dir = mkdtempSync(join(tmpdir(), `${label}-`));
  tempDirs.push(dir);
  return dir;
};

describe('scripts/worktreeEnv', () => {
  afterEach(() => {
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (!dir) continue;
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('resolves the primary checkout from the shared git dir', () => {
    expect(resolvePrimaryCheckoutRootFromCommonDir('/repo/.git')).toBe('/repo');
  });

  it('copies only env files that exist in the source checkout', () => {
    const sourceRoot = makeTempDir('worktree-env-source');
    const targetRoot = makeTempDir('worktree-env-target');

    writeFileSync(join(sourceRoot, '.env.local'), 'API_KEY=test-key\n', 'utf8');

    const plan = buildWorktreeEnvCopyPlan(sourceRoot, targetRoot);
    const executed = executeWorktreeEnvCopyPlan(plan);

    expect(executed).toEqual([
      expect.objectContaining({ name: '.env', status: 'missing-source' }),
      expect.objectContaining({ name: '.env.local', status: 'copied' }),
    ]);
    expect(readFileSync(join(targetRoot, '.env.local'), 'utf8')).toBe('API_KEY=test-key\n');
  });

  it('skips existing target files when overwrite is disabled', () => {
    const sourceRoot = makeTempDir('worktree-env-source');
    const targetRoot = makeTempDir('worktree-env-target');

    writeFileSync(join(sourceRoot, '.env.local'), 'API_KEY=source\n', 'utf8');
    writeFileSync(join(targetRoot, '.env.local'), 'API_KEY=target\n', 'utf8');

    const plan = buildWorktreeEnvCopyPlan(sourceRoot, targetRoot, false);
    const executed = executeWorktreeEnvCopyPlan(plan);

    expect(executed[1]).toEqual(expect.objectContaining({
      name: '.env.local',
      status: 'existing-target',
    }));
    expect(readFileSync(join(targetRoot, '.env.local'), 'utf8')).toBe('API_KEY=target\n');
  });

  it('parses common worktree wrapper arguments and builds git args', () => {
    const parsed = parseCreateWorktreeArgs([
      '../travelflow-test',
      '--branch',
      'codex/test-branch',
      '--ref',
      'main',
      '--force',
      '--no-checkout',
    ]);

    expect(parsed).toEqual({
      path: '../travelflow-test',
      ref: 'main',
      branch: 'codex/test-branch',
      force: true,
      detach: false,
      noCheckout: true,
    });
    expect(buildGitWorktreeAddArgs(parsed)).toEqual([
      'worktree',
      'add',
      '--force',
      '--no-checkout',
      '-b',
      'codex/test-branch',
      '../travelflow-test',
      'main',
    ]);
  });

  it('supports positional refs and rejects invalid argument combinations', () => {
    expect(parseCreateWorktreeArgs(['../travelflow-test', 'main'])).toEqual({
      path: '../travelflow-test',
      ref: 'main',
      branch: undefined,
      force: false,
      detach: false,
      noCheckout: false,
    });

    expect(() => parseCreateWorktreeArgs(['../travelflow-test', '--branch', 'codex/test', '--detach']))
      .toThrow('Cannot combine --detach with --branch.');
  });
});
