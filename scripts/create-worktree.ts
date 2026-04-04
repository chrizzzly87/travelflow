import {
  createWorktreeAndSyncEnv,
  formatWorktreeEnvSyncSummary,
} from './worktreeEnv.ts';

const main = () => {
  const result = createWorktreeAndSyncEnv(process.argv.slice(2));

  for (const line of formatWorktreeEnvSyncSummary(result)) {
    console.log(line);
  }
};

void main();
