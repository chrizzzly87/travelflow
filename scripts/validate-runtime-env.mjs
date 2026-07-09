import process from 'node:process';
import { loadEnv } from 'vite';

const fileEnv = loadEnv('production', process.cwd(), '');
const env = { ...fileEnv, ...process.env };

const requiredClientKeys = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
];

const missingKeys = requiredClientKeys.filter((key) => !String(env[key] || '').trim());

if (missingKeys.length > 0) {
  console.error(
    `Production build blocked: missing required client runtime configuration: ${missingKeys.join(', ')}.`,
  );
  process.exit(1);
}

try {
  const supabaseUrl = new URL(String(env.VITE_SUPABASE_URL));
  if (!['http:', 'https:'].includes(supabaseUrl.protocol)) {
    throw new Error('unsupported protocol');
  }
} catch {
  console.error('Production build blocked: VITE_SUPABASE_URL must be a valid HTTP(S) URL.');
  process.exit(1);
}

console.log('Production client runtime configuration is present.');
