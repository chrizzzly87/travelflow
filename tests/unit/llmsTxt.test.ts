import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildLlmsFullTxt, buildLlmsTxt } from '../../shared/llmsTxt';
import { TRIP_DRAFT_EXAMPLE_REQUEST } from '../../shared/tripDrafts';

const read = (path: string) => readFileSync(new URL(`../../public/${path}`, import.meta.url), 'utf8');

describe('llms.txt', () => {
  it('matches the generator (run pnpm llms:generate after changing the trip-draft contract)', () => {
    expect(read('llms.txt')).toBe(buildLlmsTxt());
    expect(read('llms-full.txt')).toBe(buildLlmsFullTxt());
  });

  it('follows the llmstxt.org shape: H1, summary quote, link sections', () => {
    const text = buildLlmsTxt();
    expect(text.startsWith('# TravelFlow\n\n> ')).toBe(true);
    expect(text).toMatch(/^## Optional$/m);
    expect(text).toContain('/api/mcp');
  });

  it('tells assistants not to use the in-house generator', () => {
    expect(buildLlmsTxt()).toContain('does not run any AI');
    expect(buildLlmsTxt()).toContain('do not use TravelFlow\'s own trip generator');
  });

  it('embeds the same example the API validates', () => {
    expect(buildLlmsFullTxt()).toContain(JSON.stringify(TRIP_DRAFT_EXAMPLE_REQUEST, null, 2));
  });

  it('robots.txt lets assistants read the schema but keeps drafts out of search', () => {
    const robots = read('robots.txt');
    expect(robots).toContain('Allow: /api/trip-drafts/schema');
    expect(robots).toContain('Disallow: /draft/');
  });
});
