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
    expect(prompt).toContain('city.description must stay under 700 characters total');
    expect(prompt).toContain('travelSegments.description short and practical (hard max 60 characters)');
    expect(prompt).toContain('activities.description must be a single short sentence (hard max 120 characters');
  });

  it('does not add compact benchmark instructions for default mode', () => {
    const prompt = buildClassicItineraryPrompt('Japan', {
      totalDays: 14,
      promptMode: 'default',
    });

    expect(prompt).not.toContain('Benchmark compact-output mode');
  });
});
