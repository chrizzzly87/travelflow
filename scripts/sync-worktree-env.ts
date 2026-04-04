import { formatWorktreeEnvSyncSummary, runWorktreeEnvSync } from './worktreeEnv.ts';

interface ParsedSyncArgs {
  sourceRoot?: string;
  targetRoot?: string;
  overwrite: boolean;
  dryRun: boolean;
}

const parseSyncArgs = (args: string[]): ParsedSyncArgs => {
  let sourceRoot: string | undefined;
  let targetRoot: string | undefined;
  let overwrite = true;
  let dryRun = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--') continue;
    if (arg === '--dry-run') {
      dryRun = true;
      continue;
    }
    if (arg === '--no-overwrite') {
      overwrite = false;
      continue;
    }
    if (arg === '--source') {
      const value = args[index + 1];
      if (!value) throw new Error('Missing path after --source.');
      sourceRoot = value;
      index += 1;
      continue;
    }
    if (arg.startsWith('--source=')) {
      sourceRoot = arg.slice('--source='.length);
      continue;
    }
    if (arg === '--target') {
      const value = args[index + 1];
      if (!value) throw new Error('Missing path after --target.');
      targetRoot = value;
      index += 1;
      continue;
    }
    if (arg.startsWith('--target=')) {
      targetRoot = arg.slice('--target='.length);
      continue;
    }
    throw new Error(`Unsupported option: ${arg}`);
  }

  return {
    sourceRoot,
    targetRoot,
    overwrite,
    dryRun,
  };
};

const main = () => {
  const parsed = parseSyncArgs(process.argv.slice(2));
  const result = runWorktreeEnvSync(parsed);

  for (const line of formatWorktreeEnvSyncSummary(result)) {
    console.log(line);
  }

  if (parsed.dryRun) {
    console.log('Dry run only, no files were written.');
  }
};

void main();
