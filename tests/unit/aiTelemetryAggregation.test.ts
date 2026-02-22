import { describe, expect, it } from 'vitest';
import {
  buildAiTelemetrySeries,
  summarizeAiTelemetry,
  summarizeAiTelemetryByModel,
  summarizeAiTelemetryByProvider,
  topTelemetryModelsByCost,
  topTelemetryModelsByEfficiency,
  topTelemetryModelsBySpeed,
  type AiTelemetryRow,
} from '../../netlify/edge-lib/ai-telemetry-aggregation';

const FIXED_ROWS: AiTelemetryRow[] = [
  {
    id: '1',
    created_at: '2026-02-22T10:10:00.000Z',
    source: 'create_trip',
    provider: 'gemini',
    model: 'gemini-3-pro-preview',
    status: 'success',
    latency_ms: 1200,
    estimated_cost_usd: 0.021,
    error_code: null,
  },
  {
    id: '2',
    created_at: '2026-02-22T10:35:00.000Z',
    source: 'benchmark',
    provider: 'openai',
    model: 'gpt-5.2',
    status: 'failed',
    latency_ms: 2100,
    estimated_cost_usd: 0,
    error_code: 'OPENAI_REQUEST_FAILED',
  },
  {
    id: '3',
    created_at: '2026-02-22T11:05:00.000Z',
    source: 'benchmark',
    provider: 'gemini',
    model: 'gemini-3.1-pro-preview',
    status: 'success',
    latency_ms: 900,
    estimated_cost_usd: 0.013,
    error_code: null,
  },
  {
    id: '4',
    created_at: '2026-02-22T11:30:00.000Z',
    source: 'benchmark',
    provider: 'openrouter',
    model: 'deepseek/deepseek-v3.2',
    status: 'success',
    latency_ms: 700,
    estimated_cost_usd: 0.004,
    error_code: null,
  },
];

describe('netlify/edge-lib/ai-telemetry-aggregation', () => {
  it('builds summary metrics with success rate, average latency, and cost', () => {
    const summary = summarizeAiTelemetry(FIXED_ROWS);
    expect(summary.total).toBe(4);
    expect(summary.success).toBe(3);
    expect(summary.failed).toBe(1);
    expect(summary.successRate).toBeCloseTo(75, 2);
    expect(summary.averageLatencyMs).toBe(1225);
    expect(summary.totalCostUsd).toBe(0.038);
    expect(summary.averageCostUsd).toBeCloseTo(0.0095, 6);
  });

  it('groups rows into hourly buckets for chart rendering', () => {
    const series = buildAiTelemetrySeries(FIXED_ROWS, 60);
    expect(series).toHaveLength(2);

    expect(series[0]).toMatchObject({
      total: 2,
      success: 1,
      failed: 1,
    });
    expect(series[1]).toMatchObject({
      total: 2,
      success: 2,
      failed: 0,
    });
  });

  it('aggregates provider breakdown sorted by call volume', () => {
    const providers = summarizeAiTelemetryByProvider(FIXED_ROWS);
    expect(providers).toHaveLength(3);
    expect(providers[0].provider).toBe('gemini');
    expect(providers[0].total).toBe(2);
    expect(providers[0].failed).toBe(0);
    expect(providers[1].provider).toBe('openai');
    expect(providers[1].failed).toBe(1);
  });

  it('aggregates model-level telemetry and returns top rankings', () => {
    const models = summarizeAiTelemetryByModel(FIXED_ROWS);
    expect(models).toHaveLength(4);

    const fastest = topTelemetryModelsBySpeed(models, 3);
    expect(fastest[0]?.provider).toBe('openrouter');
    expect(fastest[0]?.model).toBe('deepseek/deepseek-v3.2');

    const cheapest = topTelemetryModelsByCost(models, 3);
    expect(cheapest[0]?.provider).toBe('openai');
    expect(cheapest[0]?.averageCostUsd).toBe(0);

    const efficient = topTelemetryModelsByEfficiency(models, 3);
    expect(efficient[0]?.provider).toBe('openai');
    expect(efficient[0]?.costPerSecondUsd).toBe(0);
  });
});
