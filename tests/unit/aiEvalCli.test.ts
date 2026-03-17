import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  appendTsxImport,
  buildPromptfooArgs,
  extractAiEvalPack,
  hasExplicitPromptfooEnvFileArg,
  normalizeRunAiEvalArgs,
  resolveDefaultPromptfooEnvFile,
} from '../../shared/aiEvalCli.ts';

describe('shared/aiEvalCli', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('adds the tsx import flag once', () => {
    expect(appendTsxImport(undefined)).toBe('--import tsx');
    expect(appendTsxImport('--trace-warnings')).toBe('--trace-warnings --import tsx');
    expect(appendTsxImport('--import tsx --trace-warnings')).toBe('--import tsx --trace-warnings');
  });

  it('normalizes pnpm forwarded args by removing standalone separators', () => {
    expect(normalizeRunAiEvalArgs(['--', '--filter-first-n', '1'])).toEqual(['--filter-first-n', '1']);
  });

  it('detects explicit Promptfoo env-file flags', () => {
    expect(hasExplicitPromptfooEnvFileArg(['--env-file', '.env.preview'])).toBe(true);
    expect(hasExplicitPromptfooEnvFileArg(['--env-path=.env.preview'])).toBe(true);
    expect(hasExplicitPromptfooEnvFileArg(['--filter-first-n', '1'])).toBe(false);
  });

  it('extracts the requested eval pack from forwarded args', () => {
    expect(extractAiEvalPack(['--pack', 'security', '--ci'])).toEqual({
      pack: 'security',
      remainingArgs: ['--ci'],
    });
    expect(extractAiEvalPack(['--pack=regression', '--filter-first-n', '1'])).toEqual({
      pack: 'regression',
      remainingArgs: ['--filter-first-n', '1'],
    });
  });

  it('prefers .env.local as the default Promptfoo env file', () => {
    const existing = new Set(['/repo/.env.local', '/repo/.env']);
    const resolved = resolveDefaultPromptfooEnvFile('/repo', (path) => existing.has(path));
    expect(resolved).toBe('/repo/.env.local');
  });

  it('builds promptfoo args with default env loading, ci outputs, and normalized forwarded args', () => {
    const result = buildPromptfooArgs({
      artifactBasename: 'ai-trip-eval',
      rootDir: '/repo',
      promptfooConfigPath: '/repo/promptfoo/promptfooconfig.ts',
      artifactsDir: '/repo/artifacts/promptfoo',
      fileExists: (path) => path === '/repo/.env.local',
      rawArgs: ['--', '--ci', '--filter-first-n', '1'],
    });

    expect(result.isCi).toBe(true);
    expect(result.promptfooArgs).toEqual([
      'exec',
      'promptfoo',
      'eval',
      '-c',
      '/repo/promptfoo/promptfooconfig.ts',
      '--max-concurrency',
      '1',
      '--no-write',
      '--env-file',
      '/repo/.env.local',
      '--filter-first-n',
      '1',
      '--output',
      '/repo/artifacts/promptfoo/ai-trip-eval.json',
      '/repo/artifacts/promptfoo/ai-trip-eval.html',
      '--no-progress-bar',
    ]);
  });

  it('does not inject a default env file when one was explicitly provided', () => {
    const result = buildPromptfooArgs({
      artifactBasename: 'ai-trip-eval',
      rootDir: '/repo',
      promptfooConfigPath: '/repo/promptfoo/promptfooconfig.ts',
      artifactsDir: '/repo/artifacts/promptfoo',
      fileExists: () => true,
      rawArgs: ['--env-file', '.env.preview', '--filter-first-n', '1'],
    });

    expect(result.promptfooArgs).not.toContain('/repo/.env.local');
    expect(result.promptfooArgs).toContain('--env-file');
    expect(result.promptfooArgs).toContain('.env.preview');
  });

  it('allows overriding promptfoo max concurrency via env within safe bounds', () => {
    vi.stubEnv('AI_EVAL_MAX_CONCURRENCY', '3');

    const result = buildPromptfooArgs({
      artifactBasename: 'ai-trip-security-eval',
      rootDir: '/repo',
      promptfooConfigPath: '/repo/promptfoo/promptfooconfig.ts',
      artifactsDir: '/repo/artifacts/promptfoo',
      fileExists: () => false,
      rawArgs: [],
    });

    expect(result.promptfooArgs).toContain('--max-concurrency');
    expect(result.promptfooArgs).toContain('3');
  });

  it('uses the requested artifact basename for ci outputs', () => {
    const result = buildPromptfooArgs({
      artifactBasename: 'ai-trip-security-eval',
      rootDir: '/repo',
      promptfooConfigPath: '/repo/promptfoo/securityPromptfooconfig.ts',
      artifactsDir: '/repo/artifacts/promptfoo',
      fileExists: () => false,
      rawArgs: ['--ci'],
    });

    expect(result.promptfooArgs).toContain('/repo/artifacts/promptfoo/ai-trip-security-eval.json');
    expect(result.promptfooArgs).toContain('/repo/artifacts/promptfoo/ai-trip-security-eval.html');
  });
});
