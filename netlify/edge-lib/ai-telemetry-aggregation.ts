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

export interface AiTelemetryModelPoint {
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

export const summarizeAiTelemetryByModel = (rows: AiTelemetryRow[]): AiTelemetryModelPoint[] => {
  const modelMap = new Map<string, {
    provider: string;
    model: string;
    total: number;
    success: number;
    failed: number;
    successLatencySum: number;
    successLatencyCount: number;
    totalCost: number;
    successCostSum: number;
    successCostCount: number;
  }>();

  rows.forEach((row) => {
    const provider = row.provider || "unknown";
    const model = row.model || "unknown";
    const key = `${provider}:${model}`;
    const current = modelMap.get(key) || {
      provider,
      model,
      total: 0,
      success: 0,
      failed: 0,
      successLatencySum: 0,
      successLatencyCount: 0,
      totalCost: 0,
      successCostSum: 0,
      successCostCount: 0,
    };

    current.total += 1;
    const isSuccess = row.status === "success";
    if (isSuccess) current.success += 1;
    if (row.status === "failed") current.failed += 1;

    const latency = toFiniteNumber(row.latency_ms);
    if (isSuccess && latency !== null && latency >= 0) {
      current.successLatencySum += latency;
      current.successLatencyCount += 1;
    }

    const cost = toFiniteNumber(row.estimated_cost_usd);
    if (cost !== null) {
      current.totalCost += cost;
      if (isSuccess) {
        current.successCostSum += cost;
        current.successCostCount += 1;
      }
    }

    modelMap.set(key, current);
  });

  return Array.from(modelMap.entries())
    .map(([key, value]) => {
      const averageLatencyMs = value.successLatencyCount > 0
        ? Math.round(value.successLatencySum / value.successLatencyCount)
        : null;
      const averageCostUsd = value.successCostCount > 0
        ? roundMoney(value.successCostSum / value.successCostCount)
        : null;
      const costPerSecondUsd = averageLatencyMs && averageLatencyMs > 0 && averageCostUsd !== null
        ? roundMoney(averageCostUsd / (averageLatencyMs / 1000))
        : null;
      return {
        provider: value.provider,
        model: value.model,
        key,
        total: value.total,
        success: value.success,
        failed: value.failed,
        successRate: Number(((value.success / Math.max(1, value.total)) * 100).toFixed(2)),
        averageLatencyMs,
        totalCostUsd: roundMoney(value.totalCost),
        averageCostUsd,
        costPerSecondUsd,
      } satisfies AiTelemetryModelPoint;
    })
    .sort((left, right) => right.total - left.total || left.key.localeCompare(right.key));
};

export const topTelemetryModelsBySpeed = (
  rows: AiTelemetryModelPoint[],
  limit = 5,
): AiTelemetryModelPoint[] => {
  const safeLimit = Math.max(1, Math.round(limit));
  return rows
    .filter((row) => row.success > 0 && row.averageLatencyMs !== null)
    .sort((left, right) => {
      const leftLatency = left.averageLatencyMs ?? Number.MAX_SAFE_INTEGER;
      const rightLatency = right.averageLatencyMs ?? Number.MAX_SAFE_INTEGER;
      if (leftLatency !== rightLatency) return leftLatency - rightLatency;
      if (right.successRate !== left.successRate) return right.successRate - left.successRate;
      return right.total - left.total;
    })
    .slice(0, safeLimit);
};

export const topTelemetryModelsByCost = (
  rows: AiTelemetryModelPoint[],
  limit = 5,
): AiTelemetryModelPoint[] => {
  const safeLimit = Math.max(1, Math.round(limit));
  return rows
    .filter((row) => row.success > 0 && row.averageCostUsd !== null)
    .sort((left, right) => {
      const leftCost = left.averageCostUsd ?? Number.MAX_SAFE_INTEGER;
      const rightCost = right.averageCostUsd ?? Number.MAX_SAFE_INTEGER;
      if (leftCost !== rightCost) return leftCost - rightCost;
      if (right.successRate !== left.successRate) return right.successRate - left.successRate;
      return right.total - left.total;
    })
    .slice(0, safeLimit);
};

export const topTelemetryModelsByEfficiency = (
  rows: AiTelemetryModelPoint[],
  limit = 5,
): AiTelemetryModelPoint[] => {
  const safeLimit = Math.max(1, Math.round(limit));
  return rows
    .filter((row) => row.success > 0 && row.costPerSecondUsd !== null)
    .sort((left, right) => {
      const leftValue = left.costPerSecondUsd ?? Number.MAX_SAFE_INTEGER;
      const rightValue = right.costPerSecondUsd ?? Number.MAX_SAFE_INTEGER;
      if (leftValue !== rightValue) return leftValue - rightValue;
      if (right.successRate !== left.successRate) return right.successRate - left.successRate;
      return right.total - left.total;
    })
    .slice(0, safeLimit);
};
