import { deterministicTravelUuid, type TravelKnowledgeDataset } from './travelKnowledgeDatasetUtils';

export const TRAVEL_SOURCE_INGESTION_MODES = [
  'automated_bulk',
  'automated_api',
  'manual_reference',
  'licensed_runtime',
  'editorial',
] as const;

export const TRAVEL_SOURCE_AUTOMATION_STATUSES = [
  'active',
  'planned',
  'blocked_license',
  'manual_only',
  'runtime_only',
] as const;

export const TRAVEL_SOURCE_RAW_STORAGE_POLICIES = [
  'private_snapshot',
  'metadata_only',
  'prohibited',
  'runtime_cache',
] as const;

export type TravelSourceIngestionMode = (typeof TRAVEL_SOURCE_INGESTION_MODES)[number];
export type TravelSourceAutomationStatus = (typeof TRAVEL_SOURCE_AUTOMATION_STATUSES)[number];
export type TravelSourceRawStoragePolicy = (typeof TRAVEL_SOURCE_RAW_STORAGE_POLICIES)[number];

export interface TravelKnowledgeSourceRegistryEntry {
  sourceKey: string;
  name: string;
  sourceKind: 'official' | 'open_data' | 'commercial' | 'editorial' | 'community';
  baseUrl: string;
  termsUrl?: string;
  licenseKey?: string;
  attributionText?: string;
  commercialUseAllowed: boolean;
  redistributionAllowed: boolean;
  ingestionMode: TravelSourceIngestionMode;
  automationStatus: TravelSourceAutomationStatus;
  licenseReviewedAt: string;
  licenseReviewIntervalDays: number;
  contentRefreshIntervalDays?: number;
  rawStoragePolicy: TravelSourceRawStoragePolicy;
  allowLlmProcessing: boolean;
  countryCodes: string[];
  metadata?: Record<string, unknown>;
}

export interface TravelKnowledgeSourceRegistry {
  manifest: {
    registryKey: string;
    version: string;
    generatedAt: string;
    defaultCountryCodes: string[];
  };
  sources: TravelKnowledgeSourceRegistryEntry[];
}

export interface TravelKnowledgeSourceRegistryValidationResult {
  valid: boolean;
  errors: string[];
  counts: {
    sources: number;
    automated: number;
    manualOnly: number;
    blocked: number;
  };
}

export type TravelKnowledgeAuditSeverity = 'error' | 'warning' | 'info';

export interface TravelKnowledgeAuditIssue {
  severity: TravelKnowledgeAuditSeverity;
  code: string;
  message: string;
  sourceKey?: string;
  target?: string;
  dueAt?: string;
}

export interface TravelKnowledgeFreshnessAuditResult {
  valid: boolean;
  asOf: string;
  issues: TravelKnowledgeAuditIssue[];
  counts: {
    errors: number;
    warnings: number;
    info: number;
    registeredSources: number;
    datasetSources: number;
    observations: number;
    expiringItems: number;
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;
const SOURCE_KEY_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;
const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/;

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const isValidDate = (value: string): boolean => Number.isFinite(Date.parse(value));

const isHttpsUrl = (value: string): boolean => {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
};

const addDays = (value: string, days: number): Date => new Date(Date.parse(value) + days * DAY_MS);

const toIso = (value: Date): string => value.toISOString();

export const validateTravelKnowledgeSourceRegistry = (
  registry: TravelKnowledgeSourceRegistry,
): TravelKnowledgeSourceRegistryValidationResult => {
  const errors: string[] = [];
  const sourceKeys = new Set<string>();

  if (!registry.manifest?.registryKey || !SOURCE_KEY_PATTERN.test(registry.manifest.registryKey)) {
    errors.push('Source registry manifest has an invalid registryKey.');
  }
  if (!registry.manifest?.version?.trim()) errors.push('Source registry manifest is missing a version.');
  if (!registry.manifest?.generatedAt || !isValidDate(registry.manifest.generatedAt)) {
    errors.push('Source registry manifest has an invalid generatedAt timestamp.');
  }
  for (const countryCode of registry.manifest?.defaultCountryCodes ?? []) {
    if (!COUNTRY_CODE_PATTERN.test(countryCode)) {
      errors.push(`Source registry manifest has invalid country code ${countryCode}.`);
    }
  }

  for (const source of registry.sources ?? []) {
    const label = source.sourceKey || '(missing source key)';
    if (!SOURCE_KEY_PATTERN.test(source.sourceKey)) errors.push(`Source ${label} has an invalid sourceKey.`);
    if (sourceKeys.has(source.sourceKey)) errors.push(`Source registry contains duplicate source ${source.sourceKey}.`);
    sourceKeys.add(source.sourceKey);
    if (!source.name?.trim()) errors.push(`Source ${label} is missing a name.`);
    if (!isHttpsUrl(source.baseUrl)) errors.push(`Source ${label} must use an HTTPS baseUrl.`);
    if (source.sourceKind !== 'editorial' && (!source.termsUrl || !isHttpsUrl(source.termsUrl))) {
      errors.push(`Source ${label} must have an HTTPS termsUrl.`);
    }
    if (!TRAVEL_SOURCE_INGESTION_MODES.includes(source.ingestionMode)) {
      errors.push(`Source ${label} has invalid ingestionMode ${String(source.ingestionMode)}.`);
    }
    if (!TRAVEL_SOURCE_AUTOMATION_STATUSES.includes(source.automationStatus)) {
      errors.push(`Source ${label} has invalid automationStatus ${String(source.automationStatus)}.`);
    }
    if (!TRAVEL_SOURCE_RAW_STORAGE_POLICIES.includes(source.rawStoragePolicy)) {
      errors.push(`Source ${label} has invalid rawStoragePolicy ${String(source.rawStoragePolicy)}.`);
    }
    if (!isValidDate(source.licenseReviewedAt)) errors.push(`Source ${label} has an invalid licenseReviewedAt.`);
    if (!Number.isInteger(source.licenseReviewIntervalDays) || source.licenseReviewIntervalDays <= 0) {
      errors.push(`Source ${label} must have a positive licenseReviewIntervalDays.`);
    }
    if (
      source.contentRefreshIntervalDays !== undefined
      && (!Number.isInteger(source.contentRefreshIntervalDays) || source.contentRefreshIntervalDays <= 0)
    ) {
      errors.push(`Source ${label} must have a positive contentRefreshIntervalDays when configured.`);
    }
    if (!source.countryCodes.length || source.countryCodes.some((code) => !COUNTRY_CODE_PATTERN.test(code))) {
      errors.push(`Source ${label} must have at least one valid country code.`);
    }
    if (source.metadata !== undefined && !isRecord(source.metadata)) {
      errors.push(`Source ${label} metadata must be an object.`);
    }
    if (
      source.automationStatus === 'active'
      && !['automated_api', 'automated_bulk'].includes(source.ingestionMode)
    ) {
      errors.push(`Source ${label} cannot be active automation with ingestionMode ${source.ingestionMode}.`);
    }
    if (
      source.automationStatus === 'active'
      && (!source.commercialUseAllowed || !source.redistributionAllowed)
    ) {
      errors.push(`Source ${label} cannot be active automation without commercial-use and redistribution approval.`);
    }
    if (source.automationStatus === 'blocked_license' && source.rawStoragePolicy === 'private_snapshot') {
      errors.push(`Source ${label} cannot retain private snapshots while license automation is blocked.`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    counts: {
      sources: registry.sources.length,
      automated: registry.sources.filter((source) => source.ingestionMode.startsWith('automated_')).length,
      manualOnly: registry.sources.filter((source) => source.automationStatus === 'manual_only').length,
      blocked: registry.sources.filter((source) => source.automationStatus === 'blocked_license').length,
    },
  };
};

interface FreshnessObservation {
  sourceKey: string;
  target: string;
  kind: 'fact' | 'evidence_tag' | 'route_leg';
  observedAt: string;
  validUntil?: string;
}

const collectFreshnessObservations = (dataset: TravelKnowledgeDataset): FreshnessObservation[] => {
  const observations: FreshnessObservation[] = [];
  const fallbackObservedAt = dataset.manifest.generatedAt;

  for (const entity of dataset.entities) {
    for (const fact of entity.facts ?? []) {
      observations.push({
        sourceKey: fact.sourceKey,
        target: `${entity.canonicalSlug}:${fact.factKey}`,
        kind: 'fact',
        observedAt: fact.observedAt ?? fallbackObservedAt,
        validUntil: fact.validUntil,
      });
    }
    for (const tag of entity.evidenceTags ?? []) {
      observations.push({
        sourceKey: tag.sourceKey,
        target: `${entity.canonicalSlug}:${tag.tagKey}`,
        kind: 'evidence_tag',
        observedAt: fallbackObservedAt,
        validUntil: tag.validUntil,
      });
    }
  }

  for (const template of dataset.templates) {
    for (const leg of template.legs ?? []) {
      observations.push({
        sourceKey: leg.sourceKey,
        target: `${template.templateKey}:${leg.fromEntitySlug}->${leg.toEntitySlug}`,
        kind: 'route_leg',
        observedAt: leg.observedAt ?? fallbackObservedAt,
        validUntil: leg.validUntil,
      });
    }
  }

  return observations;
};

export const auditTravelKnowledgeFreshness = (
  dataset: TravelKnowledgeDataset,
  registry: TravelKnowledgeSourceRegistry,
  options: { asOf?: string | Date; warningWindowDays?: number } = {},
): TravelKnowledgeFreshnessAuditResult => {
  const issues: TravelKnowledgeAuditIssue[] = [];
  const asOfDate = options.asOf instanceof Date
    ? options.asOf
    : new Date(options.asOf ?? Date.now());
  const asOfMs = asOfDate.getTime();
  const warningWindowDays = options.warningWindowDays ?? 30;
  const warningCutoffMs = asOfMs + warningWindowDays * DAY_MS;
  const validation = validateTravelKnowledgeSourceRegistry(registry);
  const registryByKey = new Map(registry.sources.map((source) => [source.sourceKey, source]));
  const datasetByKey = new Map(dataset.sources.map((source) => [source.sourceKey, source]));
  const observations = collectFreshnessObservations(dataset);
  const observationsBySource = new Map<string, FreshnessObservation[]>();

  for (const error of validation.errors) {
    issues.push({ severity: 'error', code: 'invalid_source_registry', message: error });
  }

  if (!Number.isFinite(asOfMs)) {
    issues.push({ severity: 'error', code: 'invalid_audit_time', message: 'Freshness audit has an invalid asOf timestamp.' });
  }

  for (const datasetSource of dataset.sources) {
    const registered = registryByKey.get(datasetSource.sourceKey);
    if (!registered) {
      issues.push({
        severity: 'error',
        code: 'unregistered_dataset_source',
        sourceKey: datasetSource.sourceKey,
        message: `Dataset source ${datasetSource.sourceKey} is not present in the operational source registry.`,
      });
      continue;
    }
    if (registered.baseUrl !== datasetSource.baseUrl) {
      issues.push({
        severity: 'error',
        code: 'source_base_url_mismatch',
        sourceKey: datasetSource.sourceKey,
        message: `Dataset and registry base URLs differ for ${datasetSource.sourceKey}.`,
      });
    }
    if ((registered.licenseKey ?? null) !== (datasetSource.licenseKey ?? null)) {
      issues.push({
        severity: 'error',
        code: 'source_license_mismatch',
        sourceKey: datasetSource.sourceKey,
        message: `Dataset and registry license keys differ for ${datasetSource.sourceKey}.`,
      });
    }
  }

  for (const source of registry.sources) {
    const dueAt = addDays(source.licenseReviewedAt, source.licenseReviewIntervalDays);
    if (dueAt.getTime() <= asOfMs) {
      issues.push({
        severity: 'error',
        code: 'license_review_overdue',
        sourceKey: source.sourceKey,
        dueAt: toIso(dueAt),
        message: `License/terms review is overdue for ${source.sourceKey}.`,
      });
    } else if (dueAt.getTime() <= warningCutoffMs) {
      issues.push({
        severity: 'warning',
        code: 'license_review_due_soon',
        sourceKey: source.sourceKey,
        dueAt: toIso(dueAt),
        message: `License/terms review is due within ${warningWindowDays} days for ${source.sourceKey}.`,
      });
    }
  }

  for (const observation of observations) {
    const list = observationsBySource.get(observation.sourceKey) ?? [];
    list.push(observation);
    observationsBySource.set(observation.sourceKey, list);

    if (!registryByKey.has(observation.sourceKey)) {
      issues.push({
        severity: 'error',
        code: 'unregistered_observation_source',
        sourceKey: observation.sourceKey,
        target: observation.target,
        message: `${observation.kind} ${observation.target} uses an unregistered source.`,
      });
    }
    if (!isValidDate(observation.observedAt)) {
      issues.push({
        severity: 'error',
        code: 'invalid_observed_at',
        sourceKey: observation.sourceKey,
        target: observation.target,
        message: `${observation.kind} ${observation.target} has an invalid observedAt timestamp.`,
      });
    }
    if (observation.validUntil) {
      if (!isValidDate(observation.validUntil)) {
        issues.push({
          severity: 'error',
          code: 'invalid_valid_until',
          sourceKey: observation.sourceKey,
          target: observation.target,
          message: `${observation.kind} ${observation.target} has an invalid validUntil timestamp.`,
        });
      } else {
        const validUntilMs = Date.parse(observation.validUntil);
        if (validUntilMs <= asOfMs) {
          issues.push({
            severity: 'error',
            code: 'evidence_expired',
            sourceKey: observation.sourceKey,
            target: observation.target,
            dueAt: new Date(validUntilMs).toISOString(),
            message: `${observation.kind} ${observation.target} has expired evidence.`,
          });
        } else if (validUntilMs <= warningCutoffMs) {
          issues.push({
            severity: 'warning',
            code: 'evidence_expiring_soon',
            sourceKey: observation.sourceKey,
            target: observation.target,
            dueAt: new Date(validUntilMs).toISOString(),
            message: `${observation.kind} ${observation.target} expires within ${warningWindowDays} days.`,
          });
        }
      }
    }
  }

  for (const [sourceKey, datasetSource] of datasetByKey) {
    const registrySource = registryByKey.get(sourceKey);
    if (!registrySource?.contentRefreshIntervalDays) continue;
    const sourceObservations = observationsBySource.get(sourceKey) ?? [];
    if (!sourceObservations.length) {
      issues.push({
        severity: 'warning',
        code: 'source_without_dated_evidence',
        sourceKey,
        message: `Dataset source ${datasetSource.name} has no directly dated fact, evidence tag, or route leg.`,
      });
      continue;
    }
    const newestObservation = sourceObservations.reduce((newest, observation) => (
      Date.parse(observation.observedAt) > Date.parse(newest.observedAt) ? observation : newest
    ));
    if (!isValidDate(newestObservation.observedAt)) continue;
    const dueAt = addDays(newestObservation.observedAt, registrySource.contentRefreshIntervalDays);
    if (dueAt.getTime() <= asOfMs) {
      issues.push({
        severity: 'error',
        code: 'source_content_overdue',
        sourceKey,
        dueAt: toIso(dueAt),
        message: `Published evidence sourced from ${sourceKey} is past its refresh interval.`,
      });
    } else if (dueAt.getTime() <= warningCutoffMs) {
      issues.push({
        severity: 'warning',
        code: 'source_content_due_soon',
        sourceKey,
        dueAt: toIso(dueAt),
        message: `Published evidence sourced from ${sourceKey} is due for refresh within ${warningWindowDays} days.`,
      });
    }
  }

  const counts = {
    errors: issues.filter((issue) => issue.severity === 'error').length,
    warnings: issues.filter((issue) => issue.severity === 'warning').length,
    info: issues.filter((issue) => issue.severity === 'info').length,
    registeredSources: registry.sources.length,
    datasetSources: dataset.sources.length,
    observations: observations.length,
    expiringItems: observations.filter((observation) => Boolean(observation.validUntil)).length,
  };

  return {
    valid: counts.errors === 0,
    asOf: Number.isFinite(asOfMs) ? asOfDate.toISOString() : String(options.asOf ?? ''),
    issues: issues.sort((left, right) => (
      left.severity.localeCompare(right.severity)
      || (left.dueAt ?? '').localeCompare(right.dueAt ?? '')
      || (left.sourceKey ?? '').localeCompare(right.sourceKey ?? '')
      || (left.target ?? '').localeCompare(right.target ?? '')
    )),
    counts,
  };
};

const sqlString = (value: string | undefined): string => (
  value === undefined ? 'null' : `'${value.replaceAll("'", "''")}'`
);

const sqlJson = (value: unknown): string => `${sqlString(JSON.stringify(value))}::jsonb`;

export const generateTravelKnowledgeSourceRegistrySeedSql = (
  registry: TravelKnowledgeSourceRegistry,
): string => {
  const validation = validateTravelKnowledgeSourceRegistry(registry);
  if (!validation.valid) throw new Error(validation.errors.join('\n'));

  const lines = [
    '-- Generated by scripts/generate-travel-knowledge-source-registry.ts. Do not edit manually.',
    `-- Registry: ${registry.manifest.registryKey} ${registry.manifest.version}`,
    'begin;',
    '',
  ];

  for (const source of [...registry.sources].sort((left, right) => left.sourceKey.localeCompare(right.sourceKey))) {
    const sourceId = deterministicTravelUuid(`source:${source.sourceKey}`);
    const status = source.automationStatus === 'blocked_license' ? 'restricted' : 'active';
    const metadata = {
      ...(source.metadata ?? {}),
      registryVersion: registry.manifest.version,
      countryCodes: source.countryCodes,
    };
    lines.push('insert into public.travel_sources (id, source_key, name, source_kind, base_url, terms_url, license_key, attribution_text, commercial_use_allowed, redistribution_allowed, refresh_interval_days, status, ingestion_mode, automation_status, license_reviewed_at, license_review_interval_days, raw_storage_policy, allow_llm_processing, metadata)');
    lines.push(`values (${sqlString(sourceId)}::uuid, ${sqlString(source.sourceKey)}, ${sqlString(source.name)}, ${sqlString(source.sourceKind)}, ${sqlString(source.baseUrl)}, ${sqlString(source.termsUrl)}, ${sqlString(source.licenseKey)}, ${sqlString(source.attributionText)}, ${source.commercialUseAllowed}, ${source.redistributionAllowed}, ${source.contentRefreshIntervalDays ?? 'null'}, ${sqlString(status)}, ${sqlString(source.ingestionMode)}, ${sqlString(source.automationStatus)}, ${sqlString(source.licenseReviewedAt)}::timestamptz, ${source.licenseReviewIntervalDays}, ${sqlString(source.rawStoragePolicy)}, ${source.allowLlmProcessing}, ${sqlJson(metadata)})`);
    lines.push('on conflict (source_key) do update set name = excluded.name, source_kind = excluded.source_kind, base_url = excluded.base_url, terms_url = excluded.terms_url, license_key = excluded.license_key, attribution_text = excluded.attribution_text, commercial_use_allowed = excluded.commercial_use_allowed, redistribution_allowed = excluded.redistribution_allowed, refresh_interval_days = excluded.refresh_interval_days, status = excluded.status, ingestion_mode = excluded.ingestion_mode, automation_status = excluded.automation_status, license_reviewed_at = excluded.license_reviewed_at, license_review_interval_days = excluded.license_review_interval_days, raw_storage_policy = excluded.raw_storage_policy, allow_llm_processing = excluded.allow_llm_processing, metadata = public.travel_sources.metadata || excluded.metadata;');
    lines.push('');
  }

  lines.push('commit;', '');
  return lines.join('\n');
};
