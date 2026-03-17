import { describe, expect, it } from 'vitest';
import { __benchmarkTelemetryInternals } from '../../netlify/edge-functions/ai-benchmark';

describe('ai-benchmark telemetry internals', () => {
  it('normalizes telemetry security filters and attack categories', () => {
    expect(__benchmarkTelemetryInternals.normalizeTelemetrySecurityFilter('blocked')).toBe('blocked');
    expect(__benchmarkTelemetryInternals.normalizeTelemetrySecurityFilter('Suspicious')).toBe('suspicious');
    expect(__benchmarkTelemetryInternals.normalizeTelemetrySecurityFilter('weird')).toBe('all');

    expect(__benchmarkTelemetryInternals.normalizeTelemetryAttackCategory('prompt_exfiltration')).toBe('prompt_exfiltration');
    expect(__benchmarkTelemetryInternals.normalizeTelemetryAttackCategory('not-real')).toBeNull();
  });

  it('parses telemetry rows including nested security metadata', () => {
    const rows = __benchmarkTelemetryInternals.toTelemetryRows([
      {
        id: 'evt-1',
        created_at: '2026-03-17T10:00:00.000Z',
        source: 'create_trip',
        provider: 'openai',
        model: 'gpt-5.4',
        status: 'failed',
        latency_ms: 1234,
        estimated_cost_usd: 0.04,
        error_code: 'AI_RUNTIME_SECURITY_BLOCKED',
        guard_decision: 'block',
        risk_score: 92,
        blocked: true,
        metadata: {
          security: {
            stage: 'output_postflight',
            guardDecision: 'block',
            riskScore: 92,
            blocked: true,
            suspicious: true,
            attackCategories: ['schema_bypass', 'constraint_override'],
            matchedRules: ['schema_validation_failed', 'missing_required_cities'],
            promptFingerprintSha256: 'abc123',
            redactedExcerpt: 'missing required cities: kyoto',
            tripId: 'trip-1',
            attemptId: 'attempt-1',
          },
        },
      },
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: 'evt-1',
      guard_decision: 'block',
      risk_score: 92,
      blocked: true,
      suspicious: true,
      attack_categories: ['schema_bypass', 'constraint_override'],
      redacted_excerpt: 'missing required cities: kyoto',
      trip_id: 'trip-1',
      attempt_id: 'attempt-1',
      security_stage: 'output_postflight',
    });
  });
});
