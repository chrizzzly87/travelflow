import fs from 'node:fs';
import path from 'node:path';

// Server-only credentials. Any value of these that shows up in a VITE_* variable
// or in the built client bundle is a leak: every visitor can read the bundle.
export const SERVER_SECRET_KEYS = [
  'GEMINI_API_KEY',
  'GOOGLE_MAPS_GROUNDING_API_KEY',
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'OPENROUTER_API_KEY',
  'AI_GATEWAY_API_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'PADDLE_API_KEY',
  'PADDLE_WEBHOOK_SECRET',
  'TF_ADMIN_API_KEY',
];

// Client variables that must never be set: Vite inlines every VITE_* value.
export const FORBIDDEN_CLIENT_KEYS = ['VITE_GEMINI_API_KEY'];

const MIN_SECRET_LENGTH = 12;

const readSecretValues = (env) => SERVER_SECRET_KEYS
  .map((key) => ({ key, value: String(env[key] || '').trim() }))
  .filter(({ value }) => value.length >= MIN_SECRET_LENGTH);

export const findClientSecretProblems = (env) => {
  const problems = [];
  for (const key of FORBIDDEN_CLIENT_KEYS) {
    if (String(env[key] || '').trim()) {
      problems.push(`${key} is set. Remove it: VITE_* values ship to every browser. Use GEMINI_API_KEY (server only).`);
    }
  }
  const clientEntries = Object.entries(env).filter(([key]) => key.startsWith('VITE_'));
  for (const { key, value } of readSecretValues(env)) {
    for (const [clientKey, clientValue] of clientEntries) {
      if (String(clientValue || '').trim() === value) {
        problems.push(`${clientKey} holds the same value as ${key}. Use separate keys: the client one is public.`);
      }
    }
  }
  return problems;
};

const listFiles = (dir) => {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    return entry.isDirectory() ? listFiles(fullPath) : [fullPath];
  });
};

const SCANNED_EXTENSIONS = new Set(['.js', '.mjs', '.html', '.json', '.css', '.map', '.txt', '.xml', '.webmanifest']);

export const findSecretsInBundle = (env, distDir) => {
  const secrets = readSecretValues(env);
  if (secrets.length === 0) return [];
  const problems = [];
  for (const file of listFiles(distDir)) {
    if (!SCANNED_EXTENSIONS.has(path.extname(file))) continue;
    const content = fs.readFileSync(file, 'utf8');
    for (const { key } of secrets.filter(({ value }) => content.includes(value))) {
      problems.push(`${key} appears in ${path.relative(distDir, file)}.`);
    }
  }
  return problems;
};
