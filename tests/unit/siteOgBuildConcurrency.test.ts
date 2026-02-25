import { describe, expect, it } from 'vitest';
import { resolveDenoRenderConcurrency } from '../../scripts/build-site-og-static-images.ts';

describe('site og build deno concurrency', () => {
  it('uses default when no env override is set', () => {
    expect(resolveDenoRenderConcurrency({} as NodeJS.ProcessEnv)).toBe(4);
  });

  it('clamps override into safe range', () => {
    expect(resolveDenoRenderConcurrency({ SITE_OG_STATIC_DENO_CONCURRENCY: '0' } as NodeJS.ProcessEnv)).toBe(1);
    expect(resolveDenoRenderConcurrency({ SITE_OG_STATIC_DENO_CONCURRENCY: '3' } as NodeJS.ProcessEnv)).toBe(3);
    expect(resolveDenoRenderConcurrency({ SITE_OG_STATIC_DENO_CONCURRENCY: '20' } as NodeJS.ProcessEnv)).toBe(8);
  });

  it('falls back to default on invalid override', () => {
    expect(resolveDenoRenderConcurrency({ SITE_OG_STATIC_DENO_CONCURRENCY: 'wat' } as NodeJS.ProcessEnv)).toBe(4);
  });
});
