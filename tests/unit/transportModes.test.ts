import { describe, expect, it } from 'vitest';
import {
  TRANSPORT_MODE_UI_ORDER,
  TRANSPORT_MODE_VALUES,
  buildTransportModePromptGuidance,
  normalizeTransportMode,
  parseTransportMode,
} from '../../shared/transportModes';

describe('shared/transportModes', () => {
  it('exposes stable mode lists', () => {
    expect(TRANSPORT_MODE_VALUES).toContain('plane');
    expect(TRANSPORT_MODE_VALUES).toContain('na');
    expect(TRANSPORT_MODE_UI_ORDER[0]).toBe('na');
  });

  it('parses aliases and normalized forms', () => {
    expect(parseTransportMode('flight')).toMatchObject({ mode: 'plane', recognized: true });
    expect(parseTransportMode('subway')).toMatchObject({ mode: 'train', recognized: true });
    expect(parseTransportMode('motor-bike')).toMatchObject({ mode: 'motorcycle', recognized: true });
    expect(parseTransportMode('n/a')).toMatchObject({ mode: 'na', recognized: true });
    expect(parseTransportMode('')).toMatchObject({ mode: 'na', recognized: false });
  });

  it('falls back unknown inputs to na', () => {
    expect(parseTransportMode('teleport')).toMatchObject({ mode: 'na', recognized: false });
    expect(normalizeTransportMode('teleport')).toBe('na');
    expect(normalizeTransportMode('CAR')).toBe('car');
  });

  it('builds strict prompt guidance including allowed values', () => {
    const guidance = buildTransportModePromptGuidance();
    expect(guidance).toContain('Transport mode contract');
    expect(guidance).toContain('plane');
    expect(guidance).toContain('train');
    expect(guidance).not.toContain('na]');
  });
});
