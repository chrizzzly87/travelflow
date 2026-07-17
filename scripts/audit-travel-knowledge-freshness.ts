import { readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import type { TravelKnowledgeDataset } from './travelKnowledgeDatasetUtils';
import {
  auditTravelKnowledgeFreshness,
  type TravelKnowledgeSourceRegistry,
} from './travelKnowledgeSourceRegistryUtils';

const datasetPath = path.resolve(process.cwd(), 'data/travelKnowledge/thailand.v1.json');
const registryPath = path.resolve(process.cwd(), 'data/travelKnowledge/source-registry.v1.json');
const dataset = JSON.parse(readFileSync(datasetPath, 'utf8')) as TravelKnowledgeDataset;
const registry = JSON.parse(readFileSync(registryPath, 'utf8')) as TravelKnowledgeSourceRegistry;
const configuredAsOf = process.env.TRAVEL_KNOWLEDGE_AUDIT_AT?.trim();
const result = auditTravelKnowledgeFreshness(dataset, registry, {
  asOf: configuredAsOf || new Date(),
  warningWindowDays: 30,
});

for (const issue of result.issues) {
  const scope = [issue.sourceKey, issue.target].filter(Boolean).join(' · ');
  const due = issue.dueAt ? ` · due ${issue.dueAt}` : '';
  console[issue.severity === 'error' ? 'error' : 'warn'](
    `[travel-knowledge:audit] ${issue.severity.toUpperCase()} ${issue.code}${scope ? ` · ${scope}` : ''}${due}: ${issue.message}`,
  );
}

const summary = `${result.counts.registeredSources} registered sources, ${result.counts.datasetSources} dataset sources, ${result.counts.observations} dated observations, ${result.counts.expiringItems} expiring items, ${result.counts.errors} errors, ${result.counts.warnings} warnings`;

if (!result.valid) {
  console.error(`[travel-knowledge:audit] Freshness audit failed as of ${result.asOf} (${summary}).`);
  process.exit(1);
}

console.log(`[travel-knowledge:audit] Freshness audit passed as of ${result.asOf} (${summary}).`);
