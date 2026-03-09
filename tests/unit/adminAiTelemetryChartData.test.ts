import { describe, expect, it } from 'vitest';
import {
  buildCurrentMonthDailyCostHistory,
  buildFailureCodeBarListData,
  buildProviderCostPerSuccessChartData,
  buildProviderDonutEntries,
  buildProviderModelDonutEntries,
  buildProviderSuccessRateChartData,
  type ModelTelemetryChartPoint,
  type ProviderTelemetryChartPoint,
} from '../../services/adminAiTelemetryChartData';

const PROVIDER_ROWS: ProviderTelemetryChartPoint[] = [
  {
    provider: 'openrouter',
    total: 20,
    success: 14,
    failed: 6,
    averageLatencyMs: 900,
    totalCostUsd: 0.12,
  },
  {
    provider: 'gemini',
    total: 12,
    success: 11,
    failed: 1,
    averageLatencyMs: 700,
    totalCostUsd: 0.08,
  },
  {
    provider: 'openai',
    total: 8,
    success: 6,
    failed: 2,
    averageLatencyMs: 840,
    totalCostUsd: 0.1,
  },
  {
    provider: 'anthropic',
    total: 6,
    success: 4,
    failed: 2,
    averageLatencyMs: 980,
    totalCostUsd: 0.11,
  },
];

const MODEL_ROWS: ModelTelemetryChartPoint[] = [
  {
    provider: 'openrouter',
    model: 'x-ai/grok-4.1-fast',
    key: 'openrouter:x-ai/grok-4.1-fast',
    total: 10,
    success: 8,
    failed: 2,
    successRate: 80,
    averageLatencyMs: 720,
    totalCostUsd: 0.03,
    averageCostUsd: 0.003,
    costPerSecondUsd: 0.000004,
  },
  {
    provider: 'openrouter',
    model: 'z-ai/glm-5',
    key: 'openrouter:z-ai/glm-5',
    total: 8,
    success: 5,
    failed: 3,
    successRate: 62.5,
    averageLatencyMs: 980,
    totalCostUsd: 0.045,
    averageCostUsd: 0.005625,
    costPerSecondUsd: 0.000006,
  },
  {
    provider: 'openrouter',
    model: 'moonshotai/kimi-k2.5',
    key: 'openrouter:moonshotai/kimi-k2.5',
    total: 4,
    success: 1,
    failed: 3,
    successRate: 25,
    averageLatencyMs: 1900,
    totalCostUsd: 0.06,
    averageCostUsd: 0.015,
    costPerSecondUsd: 0.000008,
  },
  {
    provider: 'openrouter',
    model: 'deepseek/deepseek-v3.2',
    key: 'openrouter:deepseek/deepseek-v3.2',
    total: 3,
    success: 3,
    failed: 0,
    successRate: 100,
    averageLatencyMs: 540,
    totalCostUsd: 0.012,
    averageCostUsd: 0.004,
    costPerSecondUsd: 0.000003,
  },
];

describe('services/adminAiTelemetryChartData', () => {
  it('groups provider donut rows into an Other providers bucket when limit is exceeded', () => {
    const entries = buildProviderDonutEntries(PROVIDER_ROWS, 3);
    expect(entries).toHaveLength(3);
    expect(entries[0]?.label).toBe('openrouter');
    expect(entries[1]?.label).toBe('gemini');
    expect(entries[2]?.label).toBe('Other providers');
    expect(entries[2]?.calls).toBe(14);
    expect(entries[2]?.isOtherBucket).toBe(true);
  });

  it('builds provider model donut rows and groups overflow into Other models', () => {
    const entries = buildProviderModelDonutEntries(MODEL_ROWS, 'openrouter', 3);
    expect(entries).toHaveLength(3);
    expect(entries[0]?.label).toBe('x-ai/grok-4.1-fast');
    expect(entries[1]?.label).toBe('z-ai/glm-5');
    expect(entries[2]?.label).toBe('Other models');
    expect(entries[2]?.calls).toBe(7);
  });

  it('sorts provider success-rate chart rows in descending order', () => {
    const chartRows = buildProviderSuccessRateChartData(PROVIDER_ROWS, 3);
    expect(chartRows).toHaveLength(3);
    expect(chartRows[0]?.Provider).toBe('gemini');
    expect(chartRows[0]?.['Success rate']).toBeCloseTo(91.7, 1);
  });

  it('returns provider cost-per-success chart rows for successful providers only', () => {
    const withZeroSuccess = [
      ...PROVIDER_ROWS,
      {
        provider: 'broken-provider',
        total: 3,
        success: 0,
        failed: 3,
        averageLatencyMs: null,
        totalCostUsd: 0.2,
      },
    ];
    const chartRows = buildProviderCostPerSuccessChartData(withZeroSuccess, 10);
    expect(chartRows.some((row) => row.Provider === 'broken-provider')).toBe(false);
    expect(chartRows[0]?.Provider).toBe('gemini');
  });

  it('groups failed recent rows by error code with UNKNOWN_ERROR fallback', () => {
    const rows = [
      { status: 'failed', error_code: 'OPENAI_REQUEST_FAILED' },
      { status: 'failed', error_code: null },
      { status: 'failed', error_code: '' },
      { status: 'success', error_code: 'IGNORED' },
      { status: 'failed', error_code: 'OPENAI_REQUEST_FAILED' },
    ] as const;

    const barListRows = buildFailureCodeBarListData(rows, 5);
    expect(barListRows).toHaveLength(2);
    expect(barListRows[0]).toMatchObject({ key: 'OPENAI_REQUEST_FAILED', value: 2 });
    expect(barListRows[1]).toMatchObject({ key: 'UNKNOWN_ERROR', value: 2 });
  });

  it('builds current-month daily cost history with missing days filled as zero', () => {
    const rows = [
      { date: '2026-02-01', cost: 0.5 },
      { date: '2026-02-03', cost: 0.2 },
      { date: '2026-02-03', cost: 0.1 },
      { date: '2026-01-31', cost: 9.99 },
      { date: 'invalid', cost: 3 },
    ];

    const series = buildCurrentMonthDailyCostHistory(rows, new Date('2026-02-05T11:30:00Z'));
    expect(series).toEqual([
      { date: '2026-02-01', cost: 0.5 },
      { date: '2026-02-02', cost: 0 },
      { date: '2026-02-03', cost: 0.3 },
      { date: '2026-02-04', cost: 0 },
      { date: '2026-02-05', cost: 0 },
    ]);
  });
});
