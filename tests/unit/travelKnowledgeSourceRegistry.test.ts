import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { TravelKnowledgeDataset } from '../../scripts/travelKnowledgeDatasetUtils';
import {
  auditTravelKnowledgeFreshness,
  generateTravelKnowledgeSourceRegistrySeedSql,
  validateTravelKnowledgeSourceRegistry,
  type TravelKnowledgeSourceRegistry,
} from '../../scripts/travelKnowledgeSourceRegistryUtils';

const dataset = JSON.parse(readFileSync(
  path.resolve(process.cwd(), 'data/travelKnowledge/thailand.v1.json'),
  'utf8',
)) as TravelKnowledgeDataset;

const registry = JSON.parse(readFileSync(
  path.resolve(process.cwd(), 'data/travelKnowledge/source-registry.v1.json'),
  'utf8',
)) as TravelKnowledgeSourceRegistry;

describe('travel knowledge source registry and freshness audit', () => {
  it('validates the reviewed source policy registry', () => {
    const result = validateTravelKnowledgeSourceRegistry(registry);

    expect(result.valid).toBe(true);
    expect(result.counts).toMatchObject({
      sources: 19,
      automated: 7,
      blocked: 2,
    });
  });

  it('keeps the current Thailand pack publishable at its review date', () => {
    const result = auditTravelKnowledgeFreshness(dataset, registry, {
      asOf: '2026-07-18T12:00:00Z',
      warningWindowDays: 30,
    });

    expect(result.valid).toBe(true);
    expect(result.counts.errors).toBe(0);
    expect(result.counts.registeredSources).toBe(19);
    expect(result.counts.datasetSources).toBe(13);
    expect(result.counts.observations).toBeGreaterThan(20);
  });

  it('blocks publishing when scoped audience evidence has expired', () => {
    const expiredDataset = structuredClone(dataset);
    const evidence = expiredDataset.entities
      .flatMap((entity) => entity.evidenceTags ?? [])
      .find((tag) => tag.validUntil);
    expect(evidence).toBeDefined();
    evidence!.validUntil = '2026-07-18T00:00:00Z';

    const result = auditTravelKnowledgeFreshness(expiredDataset, registry, {
      asOf: '2026-07-19T00:00:00Z',
    });

    expect(result.valid).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'evidence_expired', severity: 'error' }),
    ]));
  });

  it('blocks publishing when a license review is overdue', () => {
    const staleRegistry = structuredClone(registry);
    staleRegistry.sources[0]!.licenseReviewedAt = '2025-01-01T00:00:00Z';

    const result = auditTravelKnowledgeFreshness(dataset, staleRegistry, {
      asOf: '2026-07-17T08:00:00Z',
    });

    expect(result.valid).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'license_review_overdue',
        sourceKey: staleRegistry.sources[0]!.sourceKey,
      }),
    ]));
  });

  it('requires every published dataset source to match the registry', () => {
    const incompleteRegistry = structuredClone(registry);
    incompleteRegistry.sources = incompleteRegistry.sources.filter((source) => source.sourceKey !== 'geonames');

    const result = auditTravelKnowledgeFreshness(dataset, incompleteRegistry, {
      asOf: '2026-07-17T08:00:00Z',
    });

    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual(expect.objectContaining({
      code: 'unregistered_dataset_source',
      sourceKey: 'geonames',
    }));
  });

  it('generates an idempotent operational source-registry seed', () => {
    const sql = generateTravelKnowledgeSourceRegistrySeedSql(registry);

    expect(sql).toContain('insert into public.travel_sources');
    expect(sql).toContain('ingestion_mode, automation_status, license_reviewed_at');
    expect(sql).toContain("on conflict (source_key) do update");
    expect(sql).toContain("'osm_geofabrik'");
    expect(sql).toContain("'blocked_license'");
  });
});
