import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const PROMPTFOO_ENV_FILE_FLAGS = ['--env-file', '--env-path'] as const;
const AI_EVAL_PACKS = ['regression', 'security'] as const;

export type AiEvalPack = (typeof AI_EVAL_PACKS)[number];

const resolvePromptfooMaxConcurrency = (): string => {
  const rawValue = process.env.AI_EVAL_MAX_CONCURRENCY?.trim() || '';
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed)) return '1';
  return String(Math.max(1, Math.min(4, Math.round(parsed))));
};

export const appendTsxImport = (existingValue: string | undefined): string => {
  const trimmed = (existingValue || '').trim();
  if (trimmed.includes('--import tsx')) {
    return trimmed;
  }
  return trimmed ? `${trimmed} --import tsx` : '--import tsx';
};

export const normalizeRunAiEvalArgs = (args: string[]): string[] => (
  args.filter((arg) => arg !== '--')
);

export const hasExplicitPromptfooEnvFileArg = (args: string[]): boolean => (
  args.some((arg) => (
    PROMPTFOO_ENV_FILE_FLAGS.some((flag) => arg === flag || arg.startsWith(`${flag}=`))
  ))
);

export const resolveDefaultPromptfooEnvFile = (
  rootDir: string,
  fileExists: (path: string) => boolean = existsSync,
): string | null => {
  const candidates = [
    resolve(rootDir, '.env.local'),
    resolve(rootDir, '.env'),
  ];

  return candidates.find((candidate) => fileExists(candidate)) || null;
};

interface BuildPromptfooArgsOptions {
  artifactBasename: string;
  artifactsDir: string;
  fileExists?: (path: string) => boolean;
  promptfooConfigPath: string;
  rawArgs: string[];
  rootDir: string;
}

export const extractAiEvalPack = (
  args: string[],
): { pack: AiEvalPack; remainingArgs: string[] } => {
  let pack: AiEvalPack = 'regression';
  const remainingArgs: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--pack') {
      const nextValue = args[index + 1];
      if (!nextValue || !AI_EVAL_PACKS.includes(nextValue as AiEvalPack)) {
        throw new Error(`Invalid or missing value for --pack. Expected one of: ${AI_EVAL_PACKS.join(', ')}.`);
      }
      pack = nextValue as AiEvalPack;
      index += 1;
      continue;
    }
    if (arg.startsWith('--pack=')) {
      const inlineValue = arg.slice('--pack='.length);
      if (!AI_EVAL_PACKS.includes(inlineValue as AiEvalPack)) {
        throw new Error(`Invalid value for --pack. Expected one of: ${AI_EVAL_PACKS.join(', ')}.`);
      }
      pack = inlineValue as AiEvalPack;
      continue;
    }
    remainingArgs.push(arg);
  }

  return { pack, remainingArgs };
};

export const buildPromptfooArgs = ({
  artifactBasename,
  artifactsDir,
  fileExists,
  promptfooConfigPath,
  rawArgs,
  rootDir,
}: BuildPromptfooArgsOptions): { isCi: boolean; promptfooArgs: string[] } => {
  const normalizedArgs = normalizeRunAiEvalArgs(rawArgs);
  const isCi = normalizedArgs.includes('--ci');
  const forwardedArgs = normalizedArgs.filter((arg) => arg !== '--ci');

  const promptfooArgs = [
    'exec',
    'promptfoo',
    'eval',
    '-c',
    promptfooConfigPath,
    '--max-concurrency',
    resolvePromptfooMaxConcurrency(),
    '--no-write',
  ];

  if (!hasExplicitPromptfooEnvFileArg(forwardedArgs)) {
    const envFile = resolveDefaultPromptfooEnvFile(rootDir, fileExists);
    if (envFile) {
      promptfooArgs.push('--env-file', envFile);
    }
  }

  promptfooArgs.push(...forwardedArgs);

  if (isCi) {
    promptfooArgs.push(
      '--output',
      resolve(artifactsDir, `${artifactBasename}.json`),
      resolve(artifactsDir, `${artifactBasename}.html`),
      '--no-progress-bar',
    );
  }

  return {
    isCi,
    promptfooArgs,
  };
};
