import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const robots = readFileSync(new URL('../../public/robots.txt', import.meta.url), 'utf8');
const groups = robots.split(/\n\s*\n/).map((group) => group.split('\n')
  .map((line) => line.replace(/#.*/, '').trim()).filter(Boolean));
const rulesFor = (agent: string) => groups.find((lines) => lines.includes(`User-agent: ${agent}`));

// These rules use literal prefixes only. Evaluate longest-match precedence so
// a broad API restriction cannot accidentally swallow a sharing-media exception.
const allowed = (agent: string, path: string) => {
  const rules = (rulesFor(agent) ?? rulesFor('*') ?? [])
    .map((line) => /^(Allow|Disallow):\s*(.+)$/.exec(line))
    .filter((rule) => rule && path.startsWith(rule[2]))
    .sort((a, b) => b![2].length - a![2].length);
  return rules.length === 0 || rules[0]![1] === 'Allow';
};

describe('sharing preview crawler rules', () => {
  it.each([
    '/trip/4fee56dd-a79a-4130-bef0-cc7ffb552ea5',
    '/s/shared-trip',
    '/api/og/trip?trip=taiwan',
    '/api/og/trip-poster.jpg?trip=taiwan',
    '/api/og/trip-video?trip=taiwan&asset=video',
    '/api/og/site?path=/blog/taiwan',
    '/blog/taiwan',
  ])('allows LinkedIn to fetch %s', (path) => {
    expect(allowed('LinkedInBot', path)).toBe(true);
  });

  it.each(['/admin/', '/api/internal/admin/iam', '/api/og/playground'])
  ('keeps unrelated tools blocked for LinkedIn: %s', (path) => {
    expect(allowed('LinkedInBot', path)).toBe(false);
  });

  it.each(['/trip/taiwan', '/s/shared-trip', '/api/og/trip?trip=taiwan', '/admin/'])
  ('preserves the default crawler restriction for %s', (path) => {
    expect(allowed('Googlebot', path)).toBe(false);
  });
});
