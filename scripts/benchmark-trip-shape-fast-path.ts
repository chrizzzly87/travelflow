import { readFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import {
  buildJourneySpecFromShapeWizard,
  type JourneyShapeWizardDraft,
} from '../shared/journeyShapeWizard';
import type { TravelDestinationPack } from '../shared/travelKnowledge';
import { buildTravelPlanningContext } from '../shared/travelPlanningContext';
import { buildJourneyRouteConcepts } from '../services/journeyRouteConceptService';
import { buildTripSkeletonFromTemplate } from '../services/journeySkeletonService';
import { enrichTripSkeletonFromKnowledge } from '../services/journeyKnowledgeEnrichmentService';

const rootDir = resolve(import.meta.dirname, '..');
const packPath = resolve(rootDir, 'data/travelKnowledge/thailand.v1.pack.generated.json');
const fixedNow = new Date('2026-07-17T00:00:00.000Z');

const METRIC_KEYS = [
  'spec_build',
  'comparison_context',
  'template_rank',
  'template_apply',
  'route_concept',
  'selected_context',
  'skeleton_compile',
  'knowledge_enrichment',
  'trip_compile',
  'end_to_end',
] as const;

type MetricKey = (typeof METRIC_KEYS)[number];
type MetricSamples = Record<MetricKey, number[]>;

export interface TripShapeBenchmarkArgs {
  iterations: number;
  warmupIterations: number;
  enforceBudgets: boolean;
}

export interface DurationSummary {
  samples: number;
  min: number;
  p50: number;
  p95: number;
  max: number;
  mean: number;
}

interface BenchmarkScenario {
  key: string;
  label: string;
  draft: JourneyShapeWizardDraft;
}

interface ScenarioBenchmarkResult {
  scenario: BenchmarkScenario;
  metrics: Record<MetricKey, DurationSummary>;
  templateKey: string;
  cityCount: number;
  activityCount: number;
  comparisonContextBytes: number;
  selectedContextBytes: number;
}

const scenarios: BenchmarkScenario[] = [
  {
    key: 'bangkok_city_break',
    label: 'Bangkok 4-day city break',
    draft: {
      journeyType: 'city_break',
      dateMode: 'flexible',
      durationDays: 4,
      month: 12,
      pace: 'balanced',
      interestTags: ['food', 'culture'],
      maxBaseChanges: 0,
      selectedCitySlug: 'th-bangkok',
      selectedNeighborhoodSlugs: [],
    },
  },
  {
    key: 'bangkok_day_trip_hub',
    label: 'Bangkok 5-day hub and day trips',
    draft: {
      journeyType: 'hub_and_day_trips',
      dateMode: 'flexible',
      durationDays: 5,
      month: 12,
      pace: 'balanced',
      interestTags: ['culture', 'history', 'food'],
      maxBaseChanges: 0,
      selectedCitySlug: 'th-bangkok',
      selectedNeighborhoodSlugs: [],
    },
  },
  {
    key: 'chiang_rai_city_break',
    label: 'Chiang Rai 3-day culture break',
    draft: {
      journeyType: 'city_break',
      dateMode: 'flexible',
      durationDays: 3,
      month: 12,
      pace: 'balanced',
      interestTags: ['culture', 'temples'],
      maxBaseChanges: 0,
      selectedCitySlug: 'th-chiang-rai',
      selectedNeighborhoodSlugs: [],
    },
  },
  {
    key: 'krabi_city_break',
    label: 'Krabi 5-day coast break',
    draft: {
      journeyType: 'city_break',
      dateMode: 'flexible',
      durationDays: 5,
      month: 2,
      pace: 'balanced',
      interestTags: ['beaches', 'nature'],
      maxBaseChanges: 0,
      selectedCitySlug: 'th-krabi',
      selectedNeighborhoodSlugs: ['th-krabi-ao-nang'],
    },
  },
  {
    key: 'thailand_country_circuit',
    label: 'Thailand 12-day country circuit',
    draft: {
      journeyType: 'single_country_circuit',
      dateMode: 'flexible',
      durationDays: 12,
      month: 11,
      pace: 'balanced',
      interestTags: ['culture', 'food', 'nature'],
      maxBaseChanges: 4,
      selectedNeighborhoodSlugs: [],
    },
  },
];

const numberArgument = (
  args: readonly string[],
  name: string,
  fallback: number,
  minimum: number,
  maximum: number,
): number => {
  const inline = args.find((arg) => arg.startsWith(`${name}=`));
  const separateIndex = args.indexOf(name);
  const raw = inline?.slice(name.length + 1)
    ?? (separateIndex >= 0 ? args[separateIndex + 1] : undefined);
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}.`);
  }
  return parsed;
};

export const parseTripShapeBenchmarkArgs = (
  args: readonly string[],
): TripShapeBenchmarkArgs => ({
  iterations: numberArgument(args, '--iterations', 300, 10, 10_000),
  warmupIterations: numberArgument(args, '--warmup', 30, 0, 1_000),
  enforceBudgets: !args.includes('--skip-budgets'),
});

export const percentile = (values: readonly number[], fraction: number): number => {
  if (values.length === 0) return 0;
  if (!Number.isFinite(fraction) || fraction < 0 || fraction > 1) {
    throw new Error('Percentile fraction must be between 0 and 1.');
  }
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.max(0, Math.ceil(fraction * sorted.length) - 1);
  return sorted[index]!;
};

export const summarizeDurations = (values: readonly number[]): DurationSummary => {
  if (values.length === 0) {
    return { samples: 0, min: 0, p50: 0, p95: 0, max: 0, mean: 0 };
  }
  const total = values.reduce((sum, value) => sum + value, 0);
  return {
    samples: values.length,
    min: Math.min(...values),
    p50: percentile(values, 0.5),
    p95: percentile(values, 0.95),
    max: Math.max(...values),
    mean: total / values.length,
  };
};

const emptyMetricSamples = (): MetricSamples => Object.fromEntries(
  METRIC_KEYS.map((key) => [key, []]),
) as MetricSamples;

const runScenarioOnce = (
  pack: TravelDestinationPack,
  scenario: BenchmarkScenario,
  iteration: number,
): {
  durations: Record<MetricKey, number>;
  templateKey: string;
  cityCount: number;
  activityCount: number;
  comparisonContextBytes: number;
  selectedContextBytes: number;
} => {
  const startedAt = performance.now();
  const spec = buildJourneySpecFromShapeWizard(scenario.draft, pack);
  const specCompletedAt = performance.now();

  const comparisonContext = buildTravelPlanningContext(pack, spec);
  const comparisonContextCompletedAt = performance.now();
  const prepared = buildJourneyRouteConcepts(spec, comparisonContext.pack, { limit: 3 });
  const applyCompletedAt = performance.now();
  const concept = prepared.concepts[0];
  if (!concept) throw new Error(`${scenario.label} did not match a published route template.`);
  const { applied, match } = concept;
  const selectedContext = buildTravelPlanningContext(pack, spec, {
    templateKeys: [match.template.templateKey],
    neighborhoodLimitPerCity: 4,
    poiLimitPerCity: 6,
  });
  const selectedContextCompletedAt = performance.now();
  const skeleton = buildTripSkeletonFromTemplate(applied, selectedContext.pack, {
    now: fixedNow,
    tripId: `benchmark-${scenario.key}-${iteration}`,
    knowledgeSource: 'bundled',
    match,
  });
  const skeletonCompletedAt = performance.now();
  const trip = enrichTripSkeletonFromKnowledge(skeleton, selectedContext.pack, { now: fixedNow });
  const completedAt = performance.now();

  if (trip.planningMeta?.routeStage !== 'enriched') {
    throw new Error(`${scenario.label} did not produce a knowledge-enriched trip.`);
  }
  const cityCount = trip.items.filter((item) => item.type === 'city').length;
  const activityCount = trip.items.filter((item) => item.type === 'activity').length;
  if (cityCount === 0 || activityCount === 0) {
    throw new Error(`${scenario.label} produced an incomplete editable trip.`);
  }

  return {
    durations: {
      spec_build: specCompletedAt - startedAt,
      comparison_context: comparisonContextCompletedAt - specCompletedAt,
      template_rank: prepared.rankDurationMs,
      template_apply: prepared.applyDurationMs,
      route_concept: applyCompletedAt - startedAt,
      selected_context: selectedContextCompletedAt - applyCompletedAt,
      skeleton_compile: skeletonCompletedAt - selectedContextCompletedAt,
      knowledge_enrichment: completedAt - skeletonCompletedAt,
      trip_compile: completedAt - selectedContextCompletedAt,
      end_to_end: completedAt - startedAt,
    },
    templateKey: match.template.templateKey,
    cityCount,
    activityCount,
    comparisonContextBytes: new TextEncoder().encode(JSON.stringify(comparisonContext)).byteLength,
    selectedContextBytes: new TextEncoder().encode(JSON.stringify(selectedContext)).byteLength,
  };
};

const benchmarkScenario = (
  pack: TravelDestinationPack,
  scenario: BenchmarkScenario,
  options: TripShapeBenchmarkArgs,
): ScenarioBenchmarkResult => {
  for (let iteration = 0; iteration < options.warmupIterations; iteration += 1) {
    runScenarioOnce(pack, scenario, -iteration - 1);
  }

  const samples = emptyMetricSamples();
  let latestResult = runScenarioOnce(pack, scenario, 0);
  for (let iteration = 0; iteration < options.iterations; iteration += 1) {
    const result = iteration === 0 ? latestResult : runScenarioOnce(pack, scenario, iteration);
    latestResult = result;
    for (const key of METRIC_KEYS) samples[key].push(result.durations[key]);
  }

  return {
    scenario,
    metrics: Object.fromEntries(
      METRIC_KEYS.map((key) => [key, summarizeDurations(samples[key])]),
    ) as Record<MetricKey, DurationSummary>,
    templateKey: latestResult.templateKey,
    cityCount: latestResult.cityCount,
    activityCount: latestResult.activityCount,
    comparisonContextBytes: latestResult.comparisonContextBytes,
    selectedContextBytes: latestResult.selectedContextBytes,
  };
};

const formatMs = (value: number): string => value.toFixed(value < 1 ? 3 : 2).padStart(8);

const printScenario = (result: ScenarioBenchmarkResult): void => {
  process.stdout.write(`\n${result.scenario.label}\n`);
  process.stdout.write(`  template: ${result.templateKey}; ${result.cityCount} cities; ${result.activityCount} activities\n`);
  process.stdout.write(`  contexts: ${result.comparisonContextBytes.toLocaleString('en-US')} B comparison; ${result.selectedContextBytes.toLocaleString('en-US')} B selected-route\n`);
  process.stdout.write('  stage                    p50 (ms)  p95 (ms)  mean (ms)\n');
  for (const key of METRIC_KEYS) {
    const summary = result.metrics[key];
    process.stdout.write(
      `  ${key.padEnd(23)} ${formatMs(summary.p50)}  ${formatMs(summary.p95)}  ${formatMs(summary.mean)}\n`,
    );
  }
};

const run = async (): Promise<void> => {
  const options = parseTripShapeBenchmarkArgs(process.argv.slice(2));
  const rawPack = await readFile(packPath, 'utf8');
  const parseIterations = Math.max(10, Math.min(50, Math.ceil(options.iterations / 10)));
  const parseSamples: number[] = [];
  for (let iteration = 0; iteration < parseIterations; iteration += 1) {
    const startedAt = performance.now();
    JSON.parse(rawPack) as TravelDestinationPack;
    parseSamples.push(performance.now() - startedAt);
  }
  const parseSummary = summarizeDurations(parseSamples);
  const pack = JSON.parse(rawPack) as TravelDestinationPack;
  if (pack.countryCode !== 'TH' || !pack.dataset?.version) {
    throw new Error('The Thailand benchmark requires a versioned TH destination pack.');
  }

  process.stdout.write('Trip-shape deterministic engine benchmark\n');
  process.stdout.write(`Dataset ${pack.dataset.version}; ${pack.entities.length} entities; ${pack.templates.length} templates\n`);
  process.stdout.write(`${options.iterations} measured iterations and ${options.warmupIterations} warmup iterations per scenario\n`);
  process.stdout.write('CPU-only benchmark: excludes network, browser rendering, persistence, and optional AI enrichment.\n');
  process.stdout.write(`Pack JSON parse (${parseIterations} samples): p50 ${formatMs(parseSummary.p50)} ms; p95 ${formatMs(parseSummary.p95)} ms\n`);

  const results = scenarios.map((scenario) => benchmarkScenario(pack, scenario, options));
  for (const result of results) printScenario(result);

  const budgets = [
    { label: 'pack parse p95', measured: parseSummary.p95, maximum: 50 },
    ...results.flatMap((result) => [
      {
        label: `${result.scenario.key} route concept p95`,
        measured: result.metrics.route_concept.p95,
        maximum: 100,
      },
      {
        label: `${result.scenario.key} comparison context p95`,
        measured: result.metrics.comparison_context.p95,
        maximum: 50,
      },
      {
        label: `${result.scenario.key} selected context p95`,
        measured: result.metrics.selected_context.p95,
        maximum: 50,
      },
      {
        label: `${result.scenario.key} end-to-end p95`,
        measured: result.metrics.end_to_end.p95,
        maximum: 250,
      },
    ]),
  ];

  process.stdout.write('\nLocal CPU guardrails\n');
  const failures = budgets.filter((budget) => budget.measured > budget.maximum);
  for (const budget of budgets) {
    const status = budget.measured <= budget.maximum ? 'PASS' : 'FAIL';
    process.stdout.write(
      `  ${status} ${budget.label}: ${formatMs(budget.measured)} ms <= ${budget.maximum} ms\n`,
    );
  }
  const payloadFailures = results.flatMap((result) => [
    { label: `${result.scenario.key} comparison context`, bytes: result.comparisonContextBytes },
    { label: `${result.scenario.key} selected context`, bytes: result.selectedContextBytes },
  ]).filter((budget) => budget.bytes >= 100_000);
  for (const payload of results.flatMap((result) => [
    { label: `${result.scenario.key} comparison context`, bytes: result.comparisonContextBytes },
    { label: `${result.scenario.key} selected context`, bytes: result.selectedContextBytes },
  ])) {
    const status = payload.bytes < 100_000 ? 'PASS' : 'FAIL';
    process.stdout.write(`  ${status} ${payload.label}: ${payload.bytes.toLocaleString('en-US')} B < 100,000 B\n`);
  }
  if (options.enforceBudgets && (failures.length > 0 || payloadFailures.length > 0)) {
    const failureCount = failures.length + payloadFailures.length;
    throw new Error(`${failureCount} deterministic trip-shape performance budget${failureCount === 1 ? '' : 's'} failed.`);
  }
};

const isDirectExecution = Boolean(
  process.argv[1]
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url),
);

if (isDirectExecution) {
  void run().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
