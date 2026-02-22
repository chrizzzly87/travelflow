import { describe, expect, it } from 'vitest';
import { buildClassicItineraryPrompt } from '../../services/aiService';

describe('services/aiService buildClassicItineraryPrompt', () => {
  it('adds compact benchmark instructions when promptMode is benchmark_compact', () => {
    const prompt = buildClassicItineraryPrompt('Japan', {
      totalDays: 14,
      promptMode: 'benchmark_compact',
    });

    expect(prompt).toContain('Benchmark compact-output mode');
    expect(prompt).toContain('Prioritize valid complete JSON over extra detail');
  });

  it('does not add compact benchmark instructions for default mode', () => {
    const prompt = buildClassicItineraryPrompt('Japan', {
      totalDays: 14,
      promptMode: 'default',
    });

    expect(prompt).not.toContain('Benchmark compact-output mode');
  });
});
