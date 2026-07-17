import { describe, expect, it } from 'vitest';
import datasetJson from '../../data/travelKnowledge/thailand.v1.json';
import type { TravelKnowledgeDataset } from '../../scripts/travelKnowledgeDatasetUtils';
import {
  buildTravelKnowledgeArtifact,
  inspectTravelKnowledgeReviewedChanges,
  materializeTravelKnowledgeReviewedChanges,
  type TravelKnowledgeReviewedChange,
} from '../../scripts/travelKnowledgeArtifactUtils';

const dataset = datasetJson as TravelKnowledgeDataset;
const reviewedChange: TravelKnowledgeReviewedChange = {
  candidateId: '11111111-1111-4111-8111-111111111111',
  decisionId: '22222222-2222-4222-8222-222222222222',
  targetKind: 'entity',
  targetKey: 'th-bangkok',
  fieldPath: 'attributes.externalIds.wikidata',
  changeKind: 'add',
  acceptedValue: 'Q1861',
};

describe('travel knowledge artifact tooling', () => {
  it('materializes reviewed external identities without mutating the source dataset', () => {
    const result = materializeTravelKnowledgeReviewedChanges(
      dataset,
      [reviewedChange],
      '2026.07.17-v7',
      '2026-07-17T10:00:00Z',
    );

    expect(result.applied).toEqual([reviewedChange]);
    expect(result.dataset.manifest.version).toBe('2026.07.17-v7');
    expect(result.dataset.entities.find((entity) => entity.canonicalSlug === 'th-bangkok')?.attributes)
      .toMatchObject({ externalIds: { wikidata: 'Q1861' } });
    expect(dataset.entities.find((entity) => entity.canonicalSlug === 'th-bangkok')?.attributes)
      .not.toHaveProperty('externalIds');
  });

  it('distinguishes already materialized reviews from unpublished accepted changes', () => {
    const first = inspectTravelKnowledgeReviewedChanges(dataset, [reviewedChange]);
    const second = inspectTravelKnowledgeReviewedChanges(first.dataset, [reviewedChange]);

    expect(first.applied).toHaveLength(1);
    expect(second.applied).toHaveLength(0);
    expect(second.alreadyMaterialized).toEqual([reviewedChange]);
  });

  it('rejects unsupported candidate paths instead of silently changing arbitrary JSON', () => {
    expect(() => materializeTravelKnowledgeReviewedChanges(
      dataset,
      [{ ...reviewedChange, fieldPath: 'attributes.safety.universal' }],
      '2026.07.17-v7',
      '2026-07-17T10:00:00Z',
    )).toThrow('outside the reviewed v1 materializer');
  });

  it('builds reproducible immutable pack, seed, and bundle checksums', () => {
    const input = {
      dataset,
      repositoryCommit: 'abcdef0123456789',
      sourceRunIds: [
        'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      ],
      reviewedChanges: [],
    };
    const first = buildTravelKnowledgeArtifact(input);
    const second = buildTravelKnowledgeArtifact({
      ...input,
      sourceRunIds: [...input.sourceRunIds].reverse(),
    });

    expect(first.artifactChecksum).toBe(second.artifactChecksum);
    expect(first.validationReport).toMatchObject({
      passed: true,
      reviewedCandidateCount: 0,
      sourceRunCount: 2,
      counts: { entities: 84, facts: 321, templates: 15 },
    });
    expect(first.storageObjectKey).toContain(first.artifactChecksum);
    expect(first.bundle.packPayload.dataset?.checksum).toBe(first.datasetChecksum);
  });

  it('binds the artifact checksum to the reviewed repository commit', () => {
    const first = buildTravelKnowledgeArtifact({
      dataset,
      repositoryCommit: 'abcdef0123456789',
      sourceRunIds: [],
      reviewedChanges: [],
    });
    const second = buildTravelKnowledgeArtifact({
      dataset,
      repositoryCommit: '1234567890abcdef',
      sourceRunIds: [],
      reviewedChanges: [],
    });

    expect(first.artifactChecksum).not.toBe(second.artifactChecksum);
  });
});
