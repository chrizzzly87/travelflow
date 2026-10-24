import { describe, expect, it } from 'vitest';
import {
  buildCurrentMonthDailyCostHistory,
  buildFailureCodeBarListData,
  buildProviderTableRows,
  formatTelemetryUsd,
  pickTelemetryLeaders,
  sortTelemetryModels,
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
  it('builds provider table rows busiest first with share and cost per success', () => {
    const rows = buildProviderTableRows([
      ...PROVIDER_ROWS,
      { provider: 'idle', total: 0, success: 0, failed: 0, averageLatencyMs: null, totalCostUsd: 0 },
    ]);
    expect(rows.map((row) => row.provider)).toEqual(['openrouter', 'gemini', 'openai', 'anthropic']);
    expect(rows[0]).toMatchObject({ sharePercent: 43.5, successRate: 70, costPerSuccessUsd: Number((0.12 / 14).toFixed(6)) });
    expect(rows.reduce((sum, row) => sum + row.sharePercent, 0)).toBeCloseTo(100, 0);
  });

  it('gives a provider with no successful call no cost per success', () => {
    const [row] = buildProviderTableRows([
      { provider: 'broken', total: 3, success: 0, failed: 3, averageLatencyMs: 400, totalCostUsd: 0.01 },
    ]);
    expect(row).toMatchObject({ successRate: 0, costPerSuccessUsd: null });
    expect(buildProviderTableRows([])).toEqual([]);
  });

  it('sorts models by a column in either direction and sinks missing values', () => {
    const withMissing: ModelTelemetryChartPoint[] = [
      ...MODEL_ROWS,
      { ...MODEL_ROWS[0], key: 'x:none', model: 'none', success: 0, averageLatencyMs: null, total: 50 },
    ];
    const ascending = sortTelemetryModels(withMissing, 'averageLatencyMs', 'asc');
    expect(ascending.map((row) => row.averageLatencyMs)).toEqual([540, 720, 980, 1900, null]);
    const descending = sortTelemetryModels(withMissing, 'averageLatencyMs', 'desc');
    expect(descending.map((row) => row.averageLatencyMs)).toEqual([1900, 980, 720, 540, null]);
    expect(sortTelemetryModels(MODEL_ROWS, 'model', 'asc')[0]?.model).toBe('deepseek/deepseek-v3.2');
    expect(sortTelemetryModels(MODEL_ROWS, 'total', 'desc').map((row) => row.total)).toEqual([10, 8, 4, 3]);
  });

  it('picks the same leaders the old leaderboards ranked first', () => {
    const leaders = pickTelemetryLeaders(MODEL_ROWS);
    expect(leaders.map((leader) => [leader.kind, leader.model.model])).toEqual([
      ['fastest', 'deepseek/deepseek-v3.2'],
      ['cheapest', 'x-ai/grok-4.1-fast'],
      ['bestValue', 'deepseek/deepseek-v3.2'],
      ['mostReliable', 'deepseek/deepseek-v3.2'],
    ]);
    expect(leaders[0]).toMatchObject({ sortColumn: 'averageLatencyMs', sortDirection: 'asc' });
    expect(leaders[3]).toMatchObject({ sortColumn: 'successRate', sortDirection: 'desc' });
  });

  it('ignores models without a successful call when picking leaders', () => {
    const failedOnly: ModelTelemetryChartPoint = {
      ...MODEL_ROWS[0], key: 'x:fail', model: 'fail', success: 0, successRate: 0, averageLatencyMs: 10, averageCostUsd: 0.000001, costPerSecondUsd: 0.0000001,
    };
    const leaders = pickTelemetryLeaders([failedOnly, MODEL_ROWS[1]]);
    expect(leaders.every((leader) => leader.model.model === 'z-ai/glm-5')).toBe(true);
    expect(pickTelemetryLeaders([failedOnly])).toEqual([]);
  });

  it('formats USD readably at every magnitude', () => {
    expect(formatTelemetryUsd(12.4)).toBe('$12.40');
    expect(formatTelemetryUsd(0.034)).toBe('$0.0340');
    expect(formatTelemetryUsd(0.000123456)).toBe('$0.000123');
    expect(formatTelemetryUsd(0)).toBe('$0.00');
    expect(formatTelemetryUsd(null)).toBe('—');
    expect(formatTelemetryUsd(Number.NaN)).toBe('—');
  });

  it('groups failed recent rows by error code with UNKNOWN_ERROR fallback', () => {
    const rows = [
      { status: 'failed', error_code: 'OPENAI_REQUEST_FAILED' },
      { status: 'failed', error_code: null },
      { status: 'failed', error_code: '' },
      { status: 'success', error_code: 'IGNORED' },
      { status: 'failed', error_code: 'OPENAI_REQUEST_FAILED' },
    ] as const;

    const barListRows = buildFailureCodeBarListData([...rows], 5);
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
