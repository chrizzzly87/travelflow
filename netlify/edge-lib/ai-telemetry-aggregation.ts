export type AiTelemetrySource = "create_trip" | "benchmark";
export type AiTelemetryStatus = "success" | "failed";

export interface AiTelemetryRow {
  id: string;
  created_at: string;
  source: AiTelemetrySource;
  provider: string;
  model: string;
  status: AiTelemetryStatus;
  latency_ms: number | null;
  estimated_cost_usd: number | null;
  error_code?: string | null;
}

export interface AiTelemetrySummary {
  total: number;
  success: number;
  failed: number;
  successRate: number;
  averageLatencyMs: number | null;
  totalCostUsd: number;
  averageCostUsd: number | null;
}

export interface AiTelemetrySeriesPoint {
  bucketStart: string;
  total: number;
  success: number;
  failed: number;
  averageLatencyMs: number | null;
  totalCostUsd: number;
}

export interface AiTelemetryProviderPoint {
  provider: string;
  total: number;
  success: number;
  failed: number;
  averageLatencyMs: number | null;
  totalCostUsd: number;
}

const toFiniteNumber = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const roundMoney = (value: number): number => Number(value.toFixed(6));

const toBucketIso = (isoTs: string, bucketMs: number): string => {
  const ts = Date.parse(isoTs);
  const safeTs = Number.isFinite(ts) ? ts : 0;
  const bucketStart = Math.floor(safeTs / bucketMs) * bucketMs;
  return new Date(bucketStart).toISOString();
};

export const summarizeAiTelemetry = (rows: AiTelemetryRow[]): AiTelemetrySummary => {
  const total = rows.length;
  const success = rows.filter((row) => row.status === "success").length;
  const failed = rows.filter((row) => row.status === "failed").length;

  const latencyValues = rows
    .map((row) => toFiniteNumber(row.latency_ms))
    .filter((value): value is number => value !== null && value >= 0);

  const totalCost = rows.reduce((sum, row) => {
    const cost = toFiniteNumber(row.estimated_cost_usd);
    return sum + (cost ?? 0);
  }, 0);

  const avgLatency = latencyValues.length > 0
    ? Math.round(latencyValues.reduce((sum, value) => sum + value, 0) / latencyValues.length)
    : null;

  const avgCost = total > 0 ? totalCost / total : null;

  return {
    total,
    success,
    failed,
    successRate: total > 0 ? Number(((success / total) * 100).toFixed(2)) : 0,
    averageLatencyMs: avgLatency,
    totalCostUsd: roundMoney(totalCost),
    averageCostUsd: avgCost === null ? null : roundMoney(avgCost),
  };
};

export const buildAiTelemetrySeries = (
  rows: AiTelemetryRow[],
  bucketMinutes = 60,
): AiTelemetrySeriesPoint[] => {
  const safeBucketMinutes = Math.max(1, Math.round(bucketMinutes));
  const bucketMs = safeBucketMinutes * 60 * 1000;
  const bucketMap = new Map<string, {
    total: number;
    success: number;
    failed: number;
    latencySum: number;
    latencyCount: number;
    totalCost: number;
  }>();

  rows.forEach((row) => {
    const bucket = toBucketIso(row.created_at, bucketMs);
    const current = bucketMap.get(bucket) || {
      total: 0,
      success: 0,
      failed: 0,
      latencySum: 0,
      latencyCount: 0,
      totalCost: 0,
    };

    current.total += 1;
    if (row.status === "success") current.success += 1;
    if (row.status === "failed") current.failed += 1;

    const latency = toFiniteNumber(row.latency_ms);
    if (latency !== null && latency >= 0) {
      current.latencySum += latency;
      current.latencyCount += 1;
    }

    const cost = toFiniteNumber(row.estimated_cost_usd);
    if (cost !== null) {
      current.totalCost += cost;
    }

    bucketMap.set(bucket, current);
  });

  return Array.from(bucketMap.entries())
    .map(([bucketStart, value]) => ({
      bucketStart,
      total: value.total,
      success: value.success,
      failed: value.failed,
      averageLatencyMs: value.latencyCount > 0
        ? Math.round(value.latencySum / value.latencyCount)
        : null,
      totalCostUsd: roundMoney(value.totalCost),
    }))
    .sort((left, right) => Date.parse(left.bucketStart) - Date.parse(right.bucketStart));
};

export const summarizeAiTelemetryByProvider = (rows: AiTelemetryRow[]): AiTelemetryProviderPoint[] => {
  const providerMap = new Map<string, {
    total: number;
    success: number;
    failed: number;
    latencySum: number;
    latencyCount: number;
    totalCost: number;
  }>();

  rows.forEach((row) => {
    const key = row.provider || "unknown";
    const current = providerMap.get(key) || {
      total: 0,
      success: 0,
      failed: 0,
      latencySum: 0,
      latencyCount: 0,
      totalCost: 0,
    };

    current.total += 1;
    if (row.status === "success") current.success += 1;
    if (row.status === "failed") current.failed += 1;

    const latency = toFiniteNumber(row.latency_ms);
    if (latency !== null && latency >= 0) {
      current.latencySum += latency;
      current.latencyCount += 1;
    }

    const cost = toFiniteNumber(row.estimated_cost_usd);
    if (cost !== null) {
      current.totalCost += cost;
    }

    providerMap.set(key, current);
  });

  return Array.from(providerMap.entries())
    .map(([provider, value]) => ({
      provider,
      total: value.total,
      success: value.success,
      failed: value.failed,
      averageLatencyMs: value.latencyCount > 0
        ? Math.round(value.latencySum / value.latencyCount)
        : null,
      totalCostUsd: roundMoney(value.totalCost),
    }))
    .sort((left, right) => right.total - left.total || left.provider.localeCompare(right.provider));
};
