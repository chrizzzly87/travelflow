import { describe, expect, it } from 'vitest';
import {
  buildBenchmarkMaskScenarioFromGenerationSnapshot,
  buildBenchmarkMaskScenarioFromImportedJson,
  buildBenchmarkScenarioImportUrl,
  decodeBenchmarkScenarioImportPayload,
} from '../../services/tripGenerationBenchmarkBridge';

const CLASSIC_SNAPSHOT = {
  flow: 'classic' as const,
  destinationLabel: 'Berlin, Germany',
  startDate: '2026-04-10',
  endDate: '2026-04-14',
  createdAt: '2026-03-04T09:00:00.000Z',
  payload: {
    destinationPrompt: 'Berlin, Germany',
    options: {
      budget: 'Medium',
      pace: 'Balanced',
      notes: 'Museums and coffee',
      numCities: 1,
      roundTrip: true,
    },
  },
};

describe('services/tripGenerationBenchmarkBridge', () => {
  it('builds a benchmark mask scenario from a generation snapshot', () => {
    const scenario = buildBenchmarkMaskScenarioFromGenerationSnapshot(CLASSIC_SNAPSHOT);

    expect(scenario).not.toBeNull();
    expect(scenario?.destinations).toBe('Berlin, Germany');
    expect(scenario?.startDate).toBe('2026-04-10');
    expect(scenario?.endDate).toBe('2026-04-14');
    expect(scenario?.budget).toBe('Medium');
  });

  it('encodes and decodes import payload URLs', () => {
    const importUrl = buildBenchmarkScenarioImportUrl({
      snapshot: CLASSIC_SNAPSHOT,
      source: 'trip_info',
      tripId: 'trip-123',
      basePath: '/admin/ai-benchmark',
    });

    expect(importUrl).toContain('/admin/ai-benchmark?import=');

    const encoded = new URL(importUrl || '/', 'http://localhost').searchParams.get('import');
    expect(encoded).toBeTruthy();

    const decoded = decodeBenchmarkScenarioImportPayload(encoded || '');
    expect(decoded).not.toBeNull();
    expect(decoded?.source).toBe('trip_info');
    expect(decoded?.flow).toBe('classic');
    expect(decoded?.tripId).toBe('trip-123');
    expect(decoded?.scenario.destinations).toBe('Berlin, Germany');
    expect(decoded?.inputPayload).toEqual(CLASSIC_SNAPSHOT.payload);
    expect(decoded?.inputSnapshot).toEqual(CLASSIC_SNAPSHOT);
  });

  it('rejects invalid import payload tokens', () => {
    expect(decodeBenchmarkScenarioImportPayload('not-valid')).toBeNull();
  });

  it('maps imported generation payload JSON to a benchmark scenario', () => {
    const mapped = buildBenchmarkMaskScenarioFromImportedJson(CLASSIC_SNAPSHOT.payload, {
      flowHint: 'classic',
      defaultStartDate: '2026-04-10',
      defaultEndDate: '2026-04-14',
    });

    expect(mapped.flow).toBe('classic');
    expect(mapped.scenario).not.toBeNull();
    expect(mapped.scenario?.destinations).toBe('Berlin, Germany');
    expect(mapped.scenario?.budget).toBe('Medium');
  });

  it('maps wrapper JSON with a scenario payload directly', () => {
    const mapped = buildBenchmarkMaskScenarioFromImportedJson({
      flow: 'wizard',
      scenario: {
        destinations: 'Hamburg, Berlin',
        budget: 'Low',
      },
    }, {
      defaultStartDate: '2026-05-01',
      defaultEndDate: '2026-05-08',
    });

    expect(mapped.flow).toBe('wizard');
    expect(mapped.scenario).not.toBeNull();
    expect(mapped.scenario?.destinations).toBe('Hamburg, Berlin');
    expect(mapped.scenario?.budget).toBe('Low');
  });
});
