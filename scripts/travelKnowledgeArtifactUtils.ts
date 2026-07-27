import { createHash } from 'node:crypto';
import {
  calculateTravelKnowledgeChecksum,
  compileTravelDestinationPack,
  generateTravelKnowledgeSeedSql,
  validateTravelKnowledgeDataset,
  type TravelKnowledgeDataset,
} from './travelKnowledgeDatasetUtils';

export interface TravelKnowledgeReviewedChange {
  candidateId: string;
  decisionId: string;
  targetKind: string;
  targetKey: string;
  fieldPath: string;
  changeKind: 'add' | 'update' | 'remove';
  acceptedValue: unknown;
}

export interface TravelKnowledgeReviewMaterializationResult {
  dataset: TravelKnowledgeDataset;
  applied: TravelKnowledgeReviewedChange[];
  alreadyMaterialized: TravelKnowledgeReviewedChange[];
  unsupported: Array<{ change: TravelKnowledgeReviewedChange; reason: string }>;
}

export interface TravelKnowledgeArtifactInput {
  dataset: TravelKnowledgeDataset;
  repositoryCommit: string;
  sourceRunIds: string[];
  reviewedChanges: TravelKnowledgeReviewedChange[];
}

export interface TravelKnowledgeArtifactValidationReport {
  passed: true;
  counts: ReturnType<typeof validateTravelKnowledgeDataset>['counts'];
  datasetChecksum: string;
  packChecksum: string;
  seedChecksum: string;
  reviewedCandidateCount: number;
  sourceRunCount: number;
}

export interface TravelKnowledgeArtifact {
  datasetChecksum: string;
  packChecksum: string;
  seedChecksum: string;
  artifactChecksum: string;
  storageObjectKey: string;
  packByteSize: number;
  packPayload: ReturnType<typeof compileTravelDestinationPack>;
  templateCopyPayload: {
    datasetVersion: string;
    templates: Record<string, Record<string, TravelKnowledgeDataset['templates'][number]['copy'][number]>>;
  };
  seedSql: string;
  validationReport: TravelKnowledgeArtifactValidationReport;
  bundle: {
    artifactFormatVersion: 1;
    datasetKey: string;
    countryCode: string;
    version: string;
    repositoryCommit: string;
    sourceRunIds: string[];
    reviewCandidateIds: string[];
    reviewDecisionIds: string[];
    datasetChecksum: string;
    packChecksum: string;
    seedChecksum: string;
    artifactChecksum: string;
    validationReport: TravelKnowledgeArtifactValidationReport;
    datasetSource: TravelKnowledgeDataset;
    packPayload: TravelKnowledgeArtifact['packPayload'];
    templateCopyPayload: TravelKnowledgeArtifact['templateCopyPayload'];
    seedSql: string;
  };
}

const SUPPORTED_ENTITY_ATTRIBUTE_PATH = /^attributes\.externalIds\.([A-Za-z0-9_-]+)$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

export const sha256ArtifactContent = (value: string | Buffer): string =>
  createHash('sha256').update(value).digest('hex');

const valuesEqual = (left: unknown, right: unknown): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

const readEntityField = (
  dataset: TravelKnowledgeDataset,
  change: TravelKnowledgeReviewedChange,
): { supported: true; value: unknown } | { supported: false; reason: string } => {
  if (change.targetKind !== 'entity') {
    return { supported: false, reason: `Target kind ${change.targetKind} is not materializable yet.` };
  }
  const externalIdMatch = SUPPORTED_ENTITY_ATTRIBUTE_PATH.exec(change.fieldPath);
  if (!externalIdMatch) {
    return { supported: false, reason: `Field path ${change.fieldPath} is outside the reviewed v1 materializer.` };
  }
  const entity = dataset.entities.find((candidate) => candidate.canonicalSlug === change.targetKey);
  if (!entity) return { supported: false, reason: `Entity ${change.targetKey} does not exist.` };
  const externalIds = entity.attributes?.externalIds;
  const current = externalIds && typeof externalIds === 'object' && !Array.isArray(externalIds)
    ? (externalIds as Record<string, unknown>)[externalIdMatch[1]!]
    : undefined;
  return { supported: true, value: current };
};

const applyEntityField = (
  dataset: TravelKnowledgeDataset,
  change: TravelKnowledgeReviewedChange,
): void => {
  const externalIdKey = SUPPORTED_ENTITY_ATTRIBUTE_PATH.exec(change.fieldPath)?.[1];
  const entity = dataset.entities.find((candidate) => candidate.canonicalSlug === change.targetKey);
  if (!externalIdKey || !entity) throw new Error(`Unsupported reviewed change ${change.candidateId}.`);
  const attributes = { ...(entity.attributes ?? {}) };
  const priorExternalIds = attributes.externalIds;
  const externalIds = priorExternalIds && typeof priorExternalIds === 'object' && !Array.isArray(priorExternalIds)
    ? { ...(priorExternalIds as Record<string, unknown>) }
    : {};
  if (change.changeKind === 'remove') delete externalIds[externalIdKey];
  else externalIds[externalIdKey] = change.acceptedValue;
  attributes.externalIds = externalIds;
  entity.attributes = attributes;
};

export const inspectTravelKnowledgeReviewedChanges = (
  dataset: TravelKnowledgeDataset,
  reviewedChanges: TravelKnowledgeReviewedChange[],
): TravelKnowledgeReviewMaterializationResult => {
  const next = structuredClone(dataset);
  const applied: TravelKnowledgeReviewedChange[] = [];
  const alreadyMaterialized: TravelKnowledgeReviewedChange[] = [];
  const unsupported: TravelKnowledgeReviewMaterializationResult['unsupported'] = [];
  const seenCandidates = new Set<string>();
  for (const change of [...reviewedChanges].sort((left, right) => left.candidateId.localeCompare(right.candidateId))) {
    if (seenCandidates.has(change.candidateId)) {
      unsupported.push({ change, reason: 'A candidate may contribute only one terminal reviewed change.' });
      continue;
    }
    seenCandidates.add(change.candidateId);
    const current = readEntityField(next, change);
    if ('reason' in current) {
      unsupported.push({ change, reason: current.reason });
      continue;
    }
    const expected = change.changeKind === 'remove' ? undefined : change.acceptedValue;
    if (valuesEqual(current.value, expected)) {
      alreadyMaterialized.push(change);
      continue;
    }
    applyEntityField(next, change);
    applied.push(change);
  }
  return { dataset: next, applied, alreadyMaterialized, unsupported };
};

export const materializeTravelKnowledgeReviewedChanges = (
  dataset: TravelKnowledgeDataset,
  reviewedChanges: TravelKnowledgeReviewedChange[],
  version: string,
  generatedAt: string,
): TravelKnowledgeReviewMaterializationResult => {
  if (!version.trim()) throw new Error('A new dataset version is required.');
  if (!Number.isFinite(Date.parse(generatedAt))) throw new Error('generatedAt must be an ISO timestamp.');
  const result = inspectTravelKnowledgeReviewedChanges(dataset, reviewedChanges);
  if (result.unsupported.length > 0) {
    throw new Error(result.unsupported.map(({ change, reason }) => `${change.candidateId}: ${reason}`).join('\n'));
  }
  if (result.applied.length === 0) throw new Error('No reviewed changes need materialization.');
  result.dataset.manifest = {
    ...result.dataset.manifest,
    version: version.trim(),
    generatedAt,
  };
  const validation = validateTravelKnowledgeDataset(result.dataset);
  if (!validation.valid) throw new Error(validation.errors.join('\n'));
  return result;
};

const buildTemplateCopyPayload = (
  dataset: TravelKnowledgeDataset,
): TravelKnowledgeArtifact['templateCopyPayload'] => ({
  datasetVersion: dataset.manifest.version,
  templates: Object.fromEntries(dataset.templates.map((template) => [
    template.templateKey,
    Object.fromEntries(template.copy.map((copy) => [copy.locale, copy])),
  ])),
});

export const buildTravelKnowledgeArtifact = (
  input: TravelKnowledgeArtifactInput,
): TravelKnowledgeArtifact => {
  if (!/^[a-f0-9]{7,64}$/.test(input.repositoryCommit)) {
    throw new Error('repositoryCommit must be a lowercase Git commit hash.');
  }
  const validation = validateTravelKnowledgeDataset(input.dataset);
  if (!validation.valid) throw new Error(validation.errors.join('\n'));
  const datasetChecksum = calculateTravelKnowledgeChecksum(input.dataset);
  const packPayload = compileTravelDestinationPack(input.dataset);
  if (packPayload.dataset?.checksum !== datasetChecksum) {
    throw new Error('Compiled pack checksum does not match the dataset checksum.');
  }
  const packJson = `${JSON.stringify(packPayload, null, 2)}\n`;
  const seedSql = generateTravelKnowledgeSeedSql(input.dataset);
  const templateCopyPayload = buildTemplateCopyPayload(input.dataset);
  const packChecksum = sha256ArtifactContent(packJson);
  const seedChecksum = sha256ArtifactContent(seedSql);
  const sourceRunIds = [...new Set(input.sourceRunIds)].sort();
  const reviewedChanges = [...input.reviewedChanges].sort((left, right) => left.candidateId.localeCompare(right.candidateId));
  const reviewCandidateIds = reviewedChanges.map((change) => change.candidateId);
  const reviewDecisionIds = reviewedChanges.map((change) => change.decisionId);
  const checksumPayload = {
    artifactFormatVersion: 1 as const,
    datasetKey: input.dataset.manifest.datasetKey,
    countryCode: input.dataset.manifest.countryCode,
    version: input.dataset.manifest.version,
    repositoryCommit: input.repositoryCommit,
    sourceRunIds,
    reviewCandidateIds,
    reviewDecisionIds,
    datasetChecksum,
    packChecksum,
    seedChecksum,
    datasetSource: input.dataset,
    packPayload,
    templateCopyPayload,
    seedSql,
  };
  const artifactChecksum = sha256ArtifactContent(JSON.stringify(checksumPayload));
  if (!SHA256_PATTERN.test(artifactChecksum)) throw new Error('Artifact checksum generation failed.');
  const validationReport = {
    passed: true as const,
    counts: validation.counts,
    datasetChecksum,
    packChecksum,
    seedChecksum,
    reviewedCandidateCount: reviewedChanges.length,
    sourceRunCount: sourceRunIds.length,
  };
  const storageObjectKey = [
    'artifacts',
    input.dataset.manifest.countryCode.toLowerCase(),
    input.dataset.manifest.datasetKey,
    input.dataset.manifest.version,
    `${artifactChecksum}.json`,
  ].join('/');
  return {
    datasetChecksum,
    packChecksum,
    seedChecksum,
    artifactChecksum,
    storageObjectKey,
    packByteSize: Buffer.byteLength(packJson),
    packPayload,
    templateCopyPayload,
    seedSql,
    validationReport,
    bundle: {
      ...checksumPayload,
      artifactChecksum,
      validationReport,
    },
  };
};
