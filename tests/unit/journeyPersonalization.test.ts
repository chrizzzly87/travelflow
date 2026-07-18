import { describe, expect, it } from 'vitest';
import { buildJourneyDestinationBriefs } from '../../services/journeyDestinationBriefService';
import { buildKnowledgeEnrichedTripFromTemplate } from '../../services/journeyKnowledgeEnrichmentService';
import { getBundledTravelDestinationPack } from '../../services/travelKnowledgeService';
import {
  JOURNEY_PERSONALIZATION_VERSION,
  applyJourneyPersonalizationProposal,
  buildJourneyPersonalizationContext,
  buildJourneyPersonalizationPrompt,
  normalizeJourneyPersonalizationProposalForContext,
  validateJourneyPersonalizationProposal,
  validateJourneyPersonalizationRequest,
  type JourneyPersonalizationProposalV1,
  type JourneyPersonalizationRequestV1,
} from '../../shared/journeyPersonalization';
import {
  buildJourneySpecFromShapeWizard,
  type JourneyShapeWizardDraft,
} from '../../shared/journeyShapeWizard';
import {
  buildTravelPlanningContext,
  TRAVEL_PLANNING_RETRIEVER_VERSION,
} from '../../shared/travelPlanningContext';
import { applyTravelTemplateToJourneySpec } from '../../shared/travelTemplateMatcher';

const fullPack = getBundledTravelDestinationPack('TH', 'en');
if (!fullPack) throw new Error('Thailand test pack is unavailable.');

const draft: JourneyShapeWizardDraft = {
  journeyType: 'city_break',
  dateMode: 'flexible',
  durationDays: 4,
  month: 12,
  pace: 'balanced',
  interestTags: ['food', 'culture'],
  maxBaseChanges: 0,
  selectedCitySlug: 'th-bangkok',
  selectedNeighborhoodSlugs: [],
  startDate: '2026-12-01',
  endDate: '2026-12-05',
};

const fixture = () => {
  const intent = buildJourneySpecFromShapeWizard(draft, fullPack);
  const comparison = buildTravelPlanningContext(fullPack, intent, { templateLimit: 3 });
  const template = comparison.pack.templates.find((candidate) => (
    candidate.templateKey === 'th-bangkok-long-weekend'
  ));
  if (!template) throw new Error('Bangkok long-weekend template is unavailable.');
  const applied = applyTravelTemplateToJourneySpec(intent, fullPack, template);
  const deep = buildTravelPlanningContext(fullPack, applied.spec, {
    templateKeys: [template.templateKey],
    templateLimit: 1,
    neighborhoodLimitPerCity: 4,
    poiLimitPerCity: 6,
  });
  const context = buildJourneyPersonalizationContext(
    applied.spec,
    deep.pack,
    deep.retrieverVersion,
  );
  return { applied, context, pack: deep.pack };
};

const proposalFor = (
  datasetVersion: string,
  templateKey: string,
  placeDecisions: JourneyPersonalizationProposalV1['placeDecisions'] = [],
): JourneyPersonalizationProposalV1 => ({
  version: JOURNEY_PERSONALIZATION_VERSION,
  datasetVersion,
  templateKey,
  summary: 'A slower Bangkok plan with food and selected source-backed highlights.',
  preferencePatch: {
    pace: 'relaxed',
    replaceInterestTags: true,
    interestTags: ['food', 'culture'],
    replaceVibeTags: false,
    vibeTags: [],
    replaceTransportPreferences: false,
    transportPreferences: [],
    setMaxTransferMinutes: true,
    maxTransferMinutes: 90,
  },
  placeDecisions,
  unresolved: [],
  cautions: ['Keep heat and walking distance in mind.'],
});

describe('JourneySpec personalization', () => {
  it('builds a compact, version-pinned request from only retrieved catalogue entities', () => {
    const { applied, context } = fixture();
    const request: JourneyPersonalizationRequestV1 = {
      version: JOURNEY_PERSONALIZATION_VERSION,
      locale: 'en',
      travelerRequest: 'Make this slower, prioritize food, and keep the Grand Palace.',
      journeySpec: applied.spec,
      context,
    };

    expect(validateJourneyPersonalizationRequest(request)).toEqual({ valid: true, errors: [] });
    expect(context.datasetVersion).toBe('2026.07.18-v11');
    expect(context.templateKey).toBe('th-bangkok-long-weekend');
    expect(context.retrieverVersion).toBe(TRAVEL_PLANNING_RETRIEVER_VERSION);
    expect(context.entities.length).toBeLessThanOrEqual(48);
    expect(context.entities.some((entity) => entity.canonicalSlug === 'th-bangkok')).toBe(true);
    expect(context.entities.every((entity) => Boolean(entity.entityId))).toBe(true);
    expect(buildJourneyPersonalizationPrompt(request).length).toBeLessThan(40_000);
  });

  it('applies only known POI roles and preferences while preserving route topology', () => {
    const { applied, context, pack } = fixture();
    const grandPalace = context.entities.find((entity) => entity.canonicalSlug === 'th-bangkok-grand-palace');
    const chatuchak = context.entities.find((entity) => entity.canonicalSlug === 'th-bangkok-chatuchak');
    if (!grandPalace || !chatuchak) throw new Error('Bangkok personalization POIs are unavailable.');
    const proposal = proposalFor(context.datasetVersion, context.templateKey, [
      { entityId: grandPalace.entityId, role: 'must_visit', reason: 'A requested cultural anchor.' },
      { entityId: chatuchak.entityId, role: 'avoid', reason: 'The traveler wants to avoid crowded markets.' },
    ]);

    const result = applyJourneyPersonalizationProposal(applied.spec, pack, context, proposal);
    const beforeBases = applied.spec.places.filter((place) => place.role === 'base');
    const afterBases = result.spec.places.filter((place) => place.role === 'base');

    expect(afterBases).toEqual(beforeBases);
    expect(result.spec.durationDays).toBe(applied.spec.durationDays);
    expect(result.spec.knowledgeContext).toEqual(applied.spec.knowledgeContext);
    expect(result.spec.preferences.pace).toBe('relaxed');
    expect(result.spec.constraints.maxTransferMinutes).toBe(90);
    expect(result.spec.places).toEqual(expect.arrayContaining([
      expect.objectContaining({ entity: expect.objectContaining({ entityId: grandPalace.entityId }), role: 'must_visit', locked: true }),
      expect.objectContaining({ entity: expect.objectContaining({ entityId: chatuchak.entityId }), role: 'avoid', locked: true }),
    ]));
    expect(result.changes).toHaveLength(5);

    const briefs = buildJourneyDestinationBriefs(result.spec, pack);
    expect(briefs[0]?.activities.some((activity) => (
      activity.entity.canonicalSlug === 'th-bangkok-chatuchak'
    ))).toBe(false);
    const trip = buildKnowledgeEnrichedTripFromTemplate(
      { ...applied, spec: result.spec },
      pack,
      { now: new Date('2026-07-17T09:00:00Z') },
    ).trip;
    expect(trip.items.some((item) => item.knowledgeMeta?.entity.entityId === grandPalace.entityId)).toBe(true);
    expect(trip.items.some((item) => item.knowledgeMeta?.entity.entityId === chatuchak.entityId)).toBe(false);
  });

  it('rejects invented tags, unknown IDs, and neighborhood-as-activity decisions', () => {
    const { context } = fixture();
    const neighborhood = context.entities.find((entity) => entity.entityType === 'neighborhood');
    if (!neighborhood) throw new Error('Bangkok neighborhood fixture is unavailable.');
    const proposal = proposalFor(context.datasetVersion, context.templateKey, [
      { entityId: neighborhood.entityId, role: 'must_visit', reason: 'Invalid activity conversion.' },
      { entityId: '00000000-0000-4000-8000-000000000000', role: 'avoid', reason: 'Unknown entity.' },
    ]);
    proposal.preferencePatch.interestTags = ['invented_private_beach'];

    const validation = validateJourneyPersonalizationProposal(proposal, context);

    expect(validation.valid).toBe(false);
    expect(validation.errors).toEqual(expect.arrayContaining([
      expect.stringContaining('outside the retrieved context'),
      expect.stringContaining('cannot be scheduled as a single activity'),
    ]));
  });

  it('repairs a known neighborhood must-visit decision without accepting invented catalogue data', () => {
    const { context } = fixture();
    const neighborhood = context.entities.find((entity) => entity.entityType === 'neighborhood');
    if (!neighborhood) throw new Error('Bangkok neighborhood fixture is unavailable.');
    const proposal = proposalFor(context.datasetVersion, context.templateKey, [
      { entityId: neighborhood.entityId, role: 'must_visit', reason: 'Explore this food area.' },
      { entityId: '00000000-0000-4000-8000-000000000000', role: 'avoid', reason: 'Unknown entity.' },
    ]);

    const normalized = normalizeJourneyPersonalizationProposalForContext(proposal, context);
    const normalizedProposal = normalized.value as JourneyPersonalizationProposalV1;

    expect(normalized.repairs).toEqual([
      `neighborhood_must_visit_to_consider:${neighborhood.entityId}`,
    ]);
    expect(normalizedProposal.placeDecisions[0]?.role).toBe('consider');
    expect(validateJourneyPersonalizationProposal(normalizedProposal, context)).toMatchObject({
      valid: false,
      errors: expect.arrayContaining([
        expect.stringContaining('outside the retrieved context'),
      ]),
    });
  });

  it('rejects conflicting duplicate decisions for the same catalogue entity', () => {
    const { context } = fixture();
    const poi = context.entities.find((entity) => entity.entityType === 'poi');
    if (!poi) throw new Error('Bangkok POI fixture is unavailable.');
    const proposal = proposalFor(context.datasetVersion, context.templateKey, [
      { entityId: poi.entityId, role: 'must_visit', reason: 'Keep this anchor.' },
      { entityId: poi.entityId, role: 'avoid', reason: 'Conflicting duplicate.' },
    ]);

    expect(validateJourneyPersonalizationProposal(proposal, context)).toMatchObject({
      valid: false,
      errors: expect.arrayContaining([
        `Personalization entity ${poi.entityId} has duplicate decisions.`,
      ]),
    });
  });

  it('requires the zero sentinel when the transfer-time constraint is unchanged', () => {
    const { context } = fixture();
    const proposal = proposalFor(context.datasetVersion, context.templateKey);
    proposal.preferencePatch.setMaxTransferMinutes = false;
    proposal.preferencePatch.maxTransferMinutes = 45;

    expect(validateJourneyPersonalizationProposal(proposal, context)).toMatchObject({
      valid: false,
      errors: expect.arrayContaining([
        'Personalization unchanged transfer time must use the zero sentinel.',
      ]),
    });
  });
});
