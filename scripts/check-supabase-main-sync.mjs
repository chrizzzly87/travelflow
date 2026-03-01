import { execFileSync } from 'node:child_process';
import process from 'node:process';

const runGit = (args, { allowFailure = false } = {}) => {
  try {
    return execFileSync('git', args, { encoding: 'utf8' }).trim();
  } catch (error) {
    if (allowFailure) return '';
    const message = error instanceof Error ? error.message : 'unknown git error';
    throw new Error(`git ${args.join(' ')} failed: ${message}`);
  }
};

const fail = (message) => {
  console.error(`[supabase:check-main-sync] ${message}`);
  process.exit(1);
};

const shouldFetch = process.argv.includes('--fetch');

try {
  if (shouldFetch) {
    runGit(['fetch', 'origin']);
  }

  const hasOriginMain = runGit(['rev-parse', '--verify', 'origin/main'], { allowFailure: true });
  if (!hasOriginMain) {
    fail('`origin/main` is unavailable. Run `git fetch origin` and retry.');
  }

  const missingCommitList = runGit(
    ['rev-list', 'HEAD..origin/main', '--', 'docs/supabase.sql'],
    { allowFailure: true }
  );
  if (!missingCommitList) {
    console.log('[supabase:check-main-sync] No docs/supabase.sql commits exist on origin/main that are missing from this branch.');
    process.exit(0);
  }

  const missingCommitCount = missingCommitList.split('\n').filter(Boolean).length;
  fail(
    `docs/supabase.sql has ${missingCommitCount} commit(s) on origin/main that are missing from this branch. `
      + 'Merge/rebase main before final merge.'
  );
} catch (error) {
  fail(error instanceof Error ? error.message : 'unknown error');
}
