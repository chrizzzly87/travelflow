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

const roundPercent = (value: number): number => Number(value.toFixed(1));

/**
 * USD for telemetry, readable at every magnitude: "$12.40", "$0.0340", "$0.000123".
 * Sub-cent model costs keep three significant digits instead of six fixed decimals.
 */
export const formatTelemetryUsd = (value: number | null | undefined): string => {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const amount = Number(value);
  if (amount === 0) return "$0.00";
  const abs = Math.abs(amount);
  if (abs >= 1) return `$${amount.toFixed(2)}`;
  if (abs >= 0.01) return `$${amount.toFixed(4)}`;
  return `$${Number(amount.toPrecision(3))}`;
};

export interface ProviderTelemetryTableRow {
  provider: string;
  total: number;
  failed: number;
  sharePercent: number;
  successRate: number | null;
  averageLatencyMs: number | null;
  totalCostUsd: number;
  costPerSuccessUsd: number | null;
}

/** One row per provider, busiest first, with call share and cost per successful call. */
export const buildProviderTableRows = (
  providers: ProviderTelemetryChartPoint[],
): ProviderTelemetryTableRow[] => {
  const rows = providers.filter((row) => row.total > 0);
  const totalCalls = rows.reduce((sum, row) => sum + row.total, 0);
  if (totalCalls === 0) return [];
  return [...rows]
    .sort((left, right) => right.total - left.total || left.provider.localeCompare(right.provider))
    .map((row) => ({
      provider: row.provider,
      total: row.total,
      failed: row.failed,
      sharePercent: roundPercent((row.total / totalCalls) * 100),
      successRate: roundPercent((row.success / row.total) * 100),
      averageLatencyMs: Number.isFinite(row.averageLatencyMs) ? Number(row.averageLatencyMs) : null,
      totalCostUsd: row.totalCostUsd,
      costPerSuccessUsd: row.success > 0 ? Number((row.totalCostUsd / row.success).toFixed(6)) : null,
    }));
};

export type TelemetryModelSortColumn =
  | "model"
  | "total"
  | "successRate"
  | "averageLatencyMs"
  | "averageCostUsd"
  | "costPerSecondUsd"
  | "totalCostUsd";

export type TelemetrySortDirection = "asc" | "desc";

const modelSortValue = (row: ModelTelemetryChartPoint, column: TelemetryModelSortColumn): number | string | null => {
  if (column === "model") return `${row.provider}/${row.model}`.toLowerCase();
  const value = row[column];
  return Number.isFinite(value) ? Number(value) : null;
};

/** Sorts the model table; rows without a value for the column always sink to the end. */
export const sortTelemetryModels = (
  rows: ModelTelemetryChartPoint[],
  column: TelemetryModelSortColumn,
  direction: TelemetrySortDirection,
): ModelTelemetryChartPoint[] => {
  const factor = direction === "asc" ? 1 : -1;
  return [...rows].sort((left, right) => {
    const leftValue = modelSortValue(left, column);
    const rightValue = modelSortValue(right, column);
    if (leftValue === null && rightValue === null) return right.total - left.total || left.key.localeCompare(right.key);
    if (leftValue === null) return 1;
    if (rightValue === null) return -1;
    const delta = typeof leftValue === "string" && typeof rightValue === "string"
      ? leftValue.localeCompare(rightValue)
      : Number(leftValue) - Number(rightValue);
    if (delta !== 0) return delta * factor;
    return right.total - left.total || left.key.localeCompare(right.key);
  });
};

export type TelemetryLeaderKind = "fastest" | "cheapest" | "bestValue" | "mostReliable";

export interface TelemetryLeader {
  kind: TelemetryLeaderKind;
  model: ModelTelemetryChartPoint;
  /** The model-table sort that ranks this leader first. */
  sortColumn: TelemetryModelSortColumn;
  sortDirection: TelemetrySortDirection;
}

const LEADER_RULES: Array<{
  kind: TelemetryLeaderKind;
  column: Exclude<TelemetryModelSortColumn, "model">;
  direction: TelemetrySortDirection;
}> = [
  { kind: "fastest", column: "averageLatencyMs", direction: "asc" },
  { kind: "cheapest", column: "averageCostUsd", direction: "asc" },
  { kind: "bestValue", column: "costPerSecondUsd", direction: "asc" },
  { kind: "mostReliable", column: "successRate", direction: "desc" },
];

/**
 * The leader for each ranking the old leaderboards showed. Same rules as the server's
 * `topTelemetryModelsBy*`: only models with a successful call and a value, ties broken
 * by success rate and then call volume.
 */
export const pickTelemetryLeaders = (models: ModelTelemetryChartPoint[]): TelemetryLeader[] => {
  const eligible = models.filter((row) => row.success > 0);
  return LEADER_RULES.flatMap(({ kind, column, direction }) => {
    const candidates = eligible.filter((row) => Number.isFinite(row[column]));
    if (candidates.length === 0) return [];
    const factor = direction === "asc" ? 1 : -1;
    const [best] = [...candidates].sort((left, right) => {
      const delta = (Number(left[column]) - Number(right[column])) * factor;
      if (delta !== 0) return delta;
      if (right.successRate !== left.successRate) return right.successRate - left.successRate;
      return right.total - left.total || left.key.localeCompare(right.key);
    });
    return [{ kind, model: best, sortColumn: column, sortDirection: direction }];
  });
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

const DATE_TOKEN_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const toDateToken = (value: Date): string => value.toISOString().slice(0, 10);

const clampCurrency = (value: number): number => Number(value.toFixed(6));

export const buildCurrentMonthDailyCostHistory = (
  rows: Array<{ date: string; cost: number }>,
  referenceDate = new Date(),
): Array<{ date: string; cost: number }> => {
  const year = referenceDate.getUTCFullYear();
  const month = referenceDate.getUTCMonth();

  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month, referenceDate.getUTCDate()));

  const costByDay = new Map<string, number>();
  rows.forEach((row) => {
    if (!DATE_TOKEN_REGEX.test(row.date)) return;
    if (!Number.isFinite(row.cost)) return;
    const dayTs = Date.parse(`${row.date}T00:00:00Z`);
    if (!Number.isFinite(dayTs)) return;
    const day = new Date(dayTs);
    if (day.getUTCFullYear() !== year || day.getUTCMonth() !== month) return;

    const current = costByDay.get(row.date) || 0;
    costByDay.set(row.date, current + row.cost);
  });

  const output: Array<{ date: string; cost: number }> = [];
  for (let cursor = new Date(start); cursor <= end; cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000)) {
    const token = toDateToken(cursor);
    output.push({
      date: token,
      cost: clampCurrency(costByDay.get(token) || 0),
    });
  }

  return output;
};
