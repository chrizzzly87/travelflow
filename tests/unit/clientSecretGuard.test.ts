import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  findClientSecretProblems,
  findSecretsInBundle,
} from '../../scripts/lib/clientSecretGuard.mjs';

const SECRET = 'AIzaServerOnlyGeminiKey000000000000000';

describe('scripts/lib/clientSecretGuard', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
  });

  const makeDist = (files: Record<string, string>): string => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tf-dist-'));
    tempDirs.push(dir);
    for (const [name, content] of Object.entries(files)) {
      fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
      fs.writeFileSync(path.join(dir, name), content);
    }
    return dir;
  };

  it('blocks VITE_GEMINI_API_KEY, which Vite would inline into the bundle', () => {
    const problems = findClientSecretProblems({ VITE_GEMINI_API_KEY: SECRET });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('VITE_GEMINI_API_KEY');
  });

  // Regression: the live bundle carried the Gemini key because the browser Maps
  // key had the same value.
  it('blocks a client variable that reuses a server secret', () => {
    const problems = findClientSecretProblems({
      GEMINI_API_KEY: SECRET,
      VITE_GOOGLE_MAPS_API_KEY: SECRET,
    });
    expect(problems).toEqual([
      expect.stringContaining('VITE_GOOGLE_MAPS_API_KEY holds the same value as GEMINI_API_KEY'),
    ]);
  });

  it('accepts separate client and server keys', () => {
    expect(findClientSecretProblems({
      GEMINI_API_KEY: SECRET,
      VITE_GOOGLE_MAPS_API_KEY: 'AIzaBrowserMapsKey11111111111111111111',
      VITE_GEMINI_API_KEY: '   ',
    })).toEqual([]);
  });

  it('finds a server secret in built files and names the file, never the value', () => {
    const dist = makeDist({
      'index.html': '<html></html>',
      'assets/index-abc.js': `const env={VITE_X:"${SECRET}"}`,
      'assets/logo.png': SECRET,
    });
    const problems = findSecretsInBundle({ GEMINI_API_KEY: SECRET }, dist);
    expect(problems).toEqual([`GEMINI_API_KEY appears in ${path.join('assets', 'index-abc.js')}.`]);
    expect(problems.join('')).not.toContain(SECRET);
  });

  it('passes a clean bundle and skips short placeholder values', () => {
    const dist = makeDist({ 'assets/index.js': 'console.log("ok")' });
    expect(findSecretsInBundle({ GEMINI_API_KEY: SECRET }, dist)).toEqual([]);
    expect(findSecretsInBundle({ GEMINI_API_KEY: 'x' }, makeDist({ 'a.js': 'x' }))).toEqual([]);
  });
});
