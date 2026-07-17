import type { JourneySpec } from '../shared/journeySpec';
import type { TravelDestinationPack } from '../shared/travelKnowledge';
import {
  applyTravelTemplateToJourneySpec,
  matchTravelTemplates,
  type AppliedTravelTemplate,
  type TravelTemplateMatch,
} from '../shared/travelTemplateMatcher';

export interface JourneyRouteConcept {
  match: TravelTemplateMatch;
  applied: AppliedTravelTemplate;
}

export interface JourneyRouteConceptPreparationOptions {
  limit?: number;
  measureNow?: () => number;
}

export interface JourneyRouteConceptPreparationResult {
  concepts: JourneyRouteConcept[];
  attemptedTemplateCount: number;
  failedTemplateCount: number;
  rankDurationMs: number;
  applyDurationMs: number;
  totalDurationMs: number;
}

const defaultMeasureNow = (): number => (
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now()
);

export const buildJourneyRouteConcepts = (
  spec: JourneySpec,
  pack: TravelDestinationPack,
  options: JourneyRouteConceptPreparationOptions = {},
): JourneyRouteConceptPreparationResult => {
  const measureNow = options.measureNow ?? defaultMeasureNow;
  const startedAt = measureNow();
  const matches = matchTravelTemplates(spec, pack, { limit: options.limit });
  const rankedAt = measureNow();
  let failedTemplateCount = 0;
  const concepts = matches.flatMap((match): JourneyRouteConcept[] => {
    try {
      return [{
        match,
        applied: applyTravelTemplateToJourneySpec(spec, pack, match.template),
      }];
    } catch {
      failedTemplateCount += 1;
      return [];
    }
  });
  const completedAt = measureNow();

  return {
    concepts,
    attemptedTemplateCount: matches.length,
    failedTemplateCount,
    rankDurationMs: Math.max(0, rankedAt - startedAt),
    applyDurationMs: Math.max(0, completedAt - rankedAt),
    totalDurationMs: Math.max(0, completedAt - startedAt),
  };
};
