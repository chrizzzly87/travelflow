export interface ProviderTelemetryChartPoint {
  provider: string;
  total: number;
  success: number;
  failed: number;
  averageLatencyMs: number | null;
  totalCostUsd: number;
}

export interface ModelTelemetryChartPoint {
  provider: string;
  model: string;
  key: string;
  total: number;
  success: number;
  failed: number;
  successRate: number;
  averageLatencyMs: number | null;
  totalCostUsd: number;
  averageCostUsd: number | null;
  costPerSecondUsd: number | null;
}

export interface RecentTelemetryChartRow {
  status: "success" | "failed";
  error_code: string | null;
}

export const TELEMETRY_DONUT_COLORS = [
  "blue",
  "cyan",
  "indigo",
  "violet",
  "fuchsia",
  "rose",
  "emerald",
  "amber",
] as const;

export type TelemetryDonutColor = (typeof TELEMETRY_DONUT_COLORS)[number];

export interface TelemetryDonutEntry {
  key: string;
  label: string;
  provider: string;
  model: string | null;
  calls: number;
  sharePercent: number;
  successRate: number | null;
  averageLatencyMs: number | null;
  totalCostUsd: number;
  color: TelemetryDonutColor;
  isOtherBucket: boolean;
}

const roundPercent = (value: number): number => Number(value.toFixed(1));

const toFiniteOrNull = (value: number | null | undefined): number | null => {
  return Number.isFinite(value) ? Number(value) : null;
};

const withOtherBucket = <T>(
  rows: T[],
  maxSegments: number,
  buildOther: (rest: T[]) => T,
): T[] => {
  if (rows.length <= maxSegments) return rows;
  const visibleCount = Math.max(1, maxSegments - 1);
  const visible = rows.slice(0, visibleCount);
  const rest = rows.slice(visibleCount);
  return [...visible, buildOther(rest)];
};

const assignDonutColor = (index: number): TelemetryDonutColor => {
  return TELEMETRY_DONUT_COLORS[index % TELEMETRY_DONUT_COLORS.length];
};

export const buildProviderDonutEntries = (
  providers: ProviderTelemetryChartPoint[],
  maxSegments = 8,
): TelemetryDonutEntry[] => {
  const sorted = [...providers]
    .filter((row) => row.total > 0)
    .sort((left, right) => right.total - left.total || left.provider.localeCompare(right.provider));

  const totalCalls = sorted.reduce((sum, row) => sum + row.total, 0);
  if (totalCalls === 0) return [];

  const withGrouping = withOtherBucket(sorted, maxSegments, (rest) => ({
    provider: "other",
    total: rest.reduce((sum, row) => sum + row.total, 0),
    success: rest.reduce((sum, row) => sum + row.success, 0),
    failed: rest.reduce((sum, row) => sum + row.failed, 0),
    averageLatencyMs: null,
    totalCostUsd: rest.reduce((sum, row) => sum + row.totalCostUsd, 0),
  }));

  return withGrouping.map((row, index) => ({
    key: row.provider === "other" ? "other-providers" : row.provider,
    label: row.provider === "other" ? "Other providers" : row.provider,
    provider: row.provider,
    model: null,
    calls: row.total,
    sharePercent: roundPercent((row.total / totalCalls) * 100),
    successRate: row.total > 0 ? roundPercent((row.success / row.total) * 100) : null,
    averageLatencyMs: toFiniteOrNull(row.averageLatencyMs),
    totalCostUsd: row.totalCostUsd,
    color: assignDonutColor(index),
    isOtherBucket: row.provider === "other",
  }));
};

export const buildProviderModelDonutEntries = (
  models: ModelTelemetryChartPoint[],
  provider: string,
  maxSegments = 10,
): TelemetryDonutEntry[] => {
  const sorted = [...models]
    .filter((row) => row.provider === provider && row.total > 0)
    .sort((left, right) => right.total - left.total || left.model.localeCompare(right.model));

  const totalCalls = sorted.reduce((sum, row) => sum + row.total, 0);
  if (totalCalls === 0) return [];

  const withGrouping = withOtherBucket(sorted, maxSegments, (rest) => ({
    provider,
    model: "other-models",
    key: `${provider}:other-models`,
    total: rest.reduce((sum, row) => sum + row.total, 0),
    success: rest.reduce((sum, row) => sum + row.success, 0),
    failed: rest.reduce((sum, row) => sum + row.failed, 0),
    successRate: 0,
    averageLatencyMs: null,
    totalCostUsd: rest.reduce((sum, row) => sum + row.totalCostUsd, 0),
    averageCostUsd: null,
    costPerSecondUsd: null,
  }));

  return withGrouping.map((row, index) => {
    const isOtherBucket = row.model === "other-models";
    const successRate = row.total > 0 ? roundPercent((row.success / row.total) * 100) : null;
    return {
      key: isOtherBucket ? `${provider}:other-models` : row.key,
      label: isOtherBucket ? "Other models" : row.model,
      provider,
      model: isOtherBucket ? null : row.model,
      calls: row.total,
      sharePercent: roundPercent((row.total / totalCalls) * 100),
      successRate,
      averageLatencyMs: toFiniteOrNull(row.averageLatencyMs),
      totalCostUsd: row.totalCostUsd,
      color: assignDonutColor(index),
      isOtherBucket,
    };
  });
};

export const buildProviderSuccessRateChartData = (
  providers: ProviderTelemetryChartPoint[],
  limit = 8,
): Array<{ Provider: string; "Success rate": number }> => {
  return [...providers]
    .filter((row) => row.total > 0)
    .map((row) => ({
      Provider: row.provider,
      "Success rate": roundPercent((row.success / row.total) * 100),
      calls: row.total,
    }))
    .sort((left, right) => right["Success rate"] - left["Success rate"] || right.calls - left.calls)
    .slice(0, limit)
    .map(({ calls: _calls, ...rest }) => rest);
};

export const buildProviderCostPerSuccessChartData = (
  providers: ProviderTelemetryChartPoint[],
  limit = 8,
): Array<{ Provider: string; "Avg cost / success (USD)": number }> => {
  return [...providers]
    .filter((row) => row.success > 0)
    .map((row) => ({
      Provider: row.provider,
      "Avg cost / success (USD)": Number((row.totalCostUsd / row.success).toFixed(6)),
    }))
    .sort((left, right) => left["Avg cost / success (USD)"] - right["Avg cost / success (USD)"])
    .slice(0, limit);
};

export const buildFailureCodeBarListData = (
  recentRows: RecentTelemetryChartRow[],
  limit = 8,
): Array<{ key: string; name: string; value: number }> => {
  const counts = new Map<string, number>();
  recentRows.forEach((row) => {
    if (row.status !== "failed") return;
    const code = (row.error_code || "UNKNOWN_ERROR").trim() || "UNKNOWN_ERROR";
    counts.set(code, (counts.get(code) || 0) + 1);
  });

  return Array.from(counts.entries())
    .map(([code, count]) => ({ key: code, name: code, value: count }))
    .sort((left, right) => right.value - left.value || left.name.localeCompare(right.name))
    .slice(0, limit);
};
