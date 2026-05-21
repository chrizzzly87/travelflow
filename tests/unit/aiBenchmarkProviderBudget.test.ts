import { describe, expect, it } from 'vitest';
import { resolveBenchmarkMaxOutputTokens } from '../../netlify/edge-functions/ai-benchmark.ts';

describe('ai-benchmark provider output budgets', () => {
  it('does not force the 60s compact cap onto OpenRouter Gemini 3.5 Flash', () => {
    expect(resolveBenchmarkMaxOutputTokens('openrouter', 'google/gemini-3.5-flash', 60_000)).toBe(8192);
  });

  it('keeps the compact cap for other 60s benchmark providers', () => {
    expect(resolveBenchmarkMaxOutputTokens('openrouter', 'openai/gpt-5.5', 60_000)).toBe(3072);
    expect(resolveBenchmarkMaxOutputTokens('gemini', 'gemini-3.1-flash-lite-preview', 60_000)).toBe(3072);
  });

  it('leaves longer benchmark timeouts on the provider default budget', () => {
    expect(resolveBenchmarkMaxOutputTokens('openrouter', 'google/gemini-3.5-flash', 90_000)).toBeUndefined();
  });
});
