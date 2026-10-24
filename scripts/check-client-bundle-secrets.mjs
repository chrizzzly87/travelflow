import process from 'node:process';
import path from 'node:path';
import { loadEnv } from 'vite';
import { findSecretsInBundle } from './lib/clientSecretGuard.mjs';

const fileEnv = loadEnv('production', process.cwd(), '');
const env = { ...fileEnv, ...process.env };
const problems = findSecretsInBundle(env, path.resolve(process.cwd(), 'dist'));

if (problems.length > 0) {
  console.error(`Build blocked: server secrets found in the client bundle.\n- ${problems.join('\n- ')}`);
  process.exit(1);
}

console.log('Client bundle contains no server secrets.');
