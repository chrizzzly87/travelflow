import { describe, expect, it } from 'vitest';
import { buildClassicItineraryPrompt, buildWizardItineraryPrompt } from '../../services/aiService';

describe('services/aiService buildClassicItineraryPrompt', () => {
  it('adds compact benchmark instructions when promptMode is benchmark_compact', () => {
    const prompt = buildClassicItineraryPrompt('Japan', {
      totalDays: 14,
      promptMode: 'benchmark_compact',
    });

    expect(prompt).toContain('Benchmark compact-output mode');
    expect(prompt).toContain('Prioritize valid complete JSON over extra detail');
    expect(prompt).toContain('city.description must stay under 500 characters total');
    expect(prompt).toContain('travelSegments.description short and practical (hard max 60 characters)');
    expect(prompt).toContain('activities.description must be a single short sentence (hard max 90 characters');
    expect(prompt).toContain('Use - [ ] checkboxes with exactly 1 bullet per heading');
    expect(prompt).not.toContain('### Must See (3-4 items)');
  });

  it('does not add compact benchmark instructions for default mode', () => {
    const prompt = buildClassicItineraryPrompt('Japan', {
      totalDays: 14,
      promptMode: 'default',
    });

    expect(prompt).not.toContain('Benchmark compact-output mode');
  });

  it('includes traveler, route, timing, and transport preference signals', () => {
    const prompt = buildClassicItineraryPrompt('Japan, South Korea', {
      totalDays: 14,
      dateInputMode: 'flex',
      flexWeeks: 2,
      flexWindow: 'shoulder',
      destinationOrder: ['Japan', 'South Korea'],
      startDestination: 'Japan',
      routeLock: true,
      travelerType: 'family',
      travelerDetails: {
        familyAdults: 2,
        familyChildren: 1,
        familyBabies: 0,
      },
      tripStyleTags: ['culture', 'food'],
      transportPreferences: ['bus', 'train'],
      hasTransportOverride: true,
      notes: 'Avoid overnight transfers',
    });

    expect(prompt).toContain('Destination order is fixed. Follow this order exactly: Japan -> South Korea');
    expect(prompt).toContain('Dates are flexible and the target trip length is about 2 week(s)');
    expect(prompt).toContain('Preferred seasonal window: shoulder');
    expect(prompt).toContain('Traveler setup: family');
    expect(prompt).toContain('Because children or babies are traveling, avoid long overnight buses');
    expect(prompt).toContain('Trip style signals: culture, food');
    expect(prompt).toContain('Preferred transport modes: bus, train');
    expect(prompt).toContain('Additional traveler notes: Avoid overnight transfers.');
    expect(prompt).not.toContain('This appears to be an LGBTQ+ couple');
  });
});

describe('services/aiService buildWizardItineraryPrompt', () => {
  it('carries shared preference signals and strict JSON rules into the wizard prompt', () => {
    const prompt = buildWizardItineraryPrompt({
      countries: ['Portugal'],
      totalDays: 10,
      budget: 'High',
      pace: 'Balanced',
      interests: ['coffee', 'architecture'],
      travelerType: 'couple',
      travelerDetails: {
        coupleTravelerA: 'male',
        coupleTravelerB: 'male',
        coupleOccasion: 'anniversary',
      },
      tripStyleTags: ['food'],
      tripVibeTags: ['culture'],
      transportPreferences: ['train'],
      hasTransportOverride: true,
      specificCities: 'Lisbon, Porto',
      routeLock: true,
      destinationOrder: ['Portugal'],
      promptMode: 'default',
    });

    expect(prompt).toContain('Budget level: High.');
    expect(prompt).toContain('Travel pace: Balanced.');
    expect(prompt).toContain('Focus on these interests: coffee, architecture.');
    expect(prompt).toContain('Traveler setup: couple');
    expect(prompt).toContain('This appears to be an LGBTQ+ couple');
    expect(prompt).toContain('Trip style signals: food');
    expect(prompt).toContain('Trip vibe and activity signals: culture');
    expect(prompt).toContain('Preferred transport modes: train');
    expect(prompt).toContain('Specific requested cities or stops: Lisbon, Porto');
    expect(prompt).toContain('Output contract requirements (must be strictly followed):');
    expect(prompt).toContain('legal, social, or safety constraints for this traveler profile');
  });
});
