import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  ArrowRight,
  Buildings,
  CalendarBlank,
  Check,
  CircleNotch,
  Compass,
  Database,
  ForkKnife,
  MapPin,
  MagnifyingGlass,
  Minus,
  MoonStars,
  Mountains,
  Plus,
  Sparkle,
  SunHorizon,
} from '@phosphor-icons/react';
import { SiteFooter } from '../components/marketing/SiteFooter';
import { SiteHeader } from '../components/navigation/SiteHeader';
import { JourneyDestinationBriefPreview } from '../components/create-trip/JourneyDestinationBriefPreview';
import { JourneyPersonalizationCard } from '../components/create-trip/JourneyPersonalizationCard';
import {
  PlayfulDecisionButton,
  PlayfulDecisionSurface,
} from '../components/ui/playful-decision-card';
import { getAnalyticsDebugAttributes, trackEvent } from '../services/analyticsService';
import { buildJourneyDestinationBriefs } from '../services/journeyDestinationBriefService';
import {
  JourneyPersonalizationError,
  requestJourneyPersonalization,
  type JourneyPersonalizationResult,
} from '../services/journeyPersonalizationService';
import { buildKnowledgeEnrichedTripFromTemplate } from '../services/journeyKnowledgeEnrichmentService';
import {
  buildJourneyRouteConcepts,
  type JourneyRouteConcept,
} from '../services/journeyRouteConceptService';
import {
  loadTravelPlanningContext,
  type TravelPlanningContextLoadResult,
} from '../services/travelPlanningContextService';
import {
  getBundledTravelDestinationPack,
  loadTravelDestinationPack,
  type TravelKnowledgeLoadSource,
} from '../services/travelKnowledgeService';
import {
  buildJourneySpecFromShapeWizard,
  getJourneyShapeAnchorCities,
  getJourneyShapeNeighborhoods,
  searchJourneyShapePlaces,
  type JourneyShapeWizardDraft,
  type JourneyShapeWizardType,
} from '../shared/journeyShapeWizard';
import {
  type AppliedTravelTemplate,
  type TravelTemplateMatch,
} from '../shared/travelTemplateMatcher';
import type { JourneyPace, JourneySpec } from '../shared/journeySpec';
import type { TravelDestinationPack, TravelEntityCatalogItem } from '../shared/travelKnowledge';
import type { ITrip } from '../types';
import '../styles/create-trip-shape-lab.css';

interface CreateTripShapeLabPageProps {
  onTripGenerated: (trip: ITrip) => void;
  onOpenManager: () => void;
}

interface PreparedRouteComparison {
  concepts: JourneyRouteConcept[];
  retrieval: TravelPlanningContextLoadResult;
  rawBytes: number;
  cataloguePack: TravelDestinationPack;
}

type WizardStep = 'shape' | 'place' | 'timing' | 'style' | 'reveal';

const STEPS: WizardStep[] = ['shape', 'place', 'timing', 'style', 'reveal'];
const EMPTY_ROUTE_CONCEPTS: JourneyRouteConcept[] = [];

const SHAPE_OPTIONS: Array<{
  id: JourneyShapeWizardType;
  icon: typeof Buildings;
  durationDays: number;
  maxBaseChanges: number;
  tone: 'mango' | 'lagoon' | 'hibiscus';
}> = [
  { id: 'city_break', icon: Buildings, durationDays: 4, maxBaseChanges: 0, tone: 'mango' },
  { id: 'hub_and_day_trips', icon: MapPin, durationDays: 5, maxBaseChanges: 0, tone: 'lagoon' },
  { id: 'single_country_circuit', icon: Compass, durationDays: 10, maxBaseChanges: 3, tone: 'hibiscus' },
];

const INTEREST_OPTIONS = [
  { id: 'food', icon: ForkKnife, labelKey: 'wizard.vibes.options.food' },
  { id: 'culture', icon: Buildings, labelKey: 'wizard.vibes.options.culture' },
  { id: 'nature', icon: Mountains, labelKey: 'wizard.vibes.options.nature' },
  { id: 'beaches', icon: SunHorizon, labelKey: 'style.options.beaches' },
  { id: 'nightlife', icon: MoonStars, labelKey: 'wizard.vibes.options.nightlife' },
  { id: 'wellness', icon: Sparkle, labelKey: 'wizard.vibes.options.relaxation' },
] as const;

const PACE_OPTIONS: Array<{ id: JourneyPace; labelKey: string }> = [
  { id: 'relaxed', labelKey: 'wizard.paceOptions.relaxed' },
  { id: 'balanced', labelKey: 'wizard.paceOptions.balanced' },
  { id: 'full', labelKey: 'wizard.paceOptions.fast' },
];

const buildDefaultExactDates = (): Pick<JourneyShapeWizardDraft, 'startDate' | 'endDate'> => {
  const start = new Date();
  start.setDate(start.getDate() + 60);
  const end = new Date(start);
  end.setDate(end.getDate() + 4);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
};

const buildInitialDraft = (): JourneyShapeWizardDraft => ({
  journeyType: 'single_country_circuit',
  dateMode: 'flexible',
  durationDays: 10,
  month: 12,
  pace: 'balanced',
  interestTags: ['food', 'culture'],
  maxBaseChanges: 3,
  selectedNeighborhoodSlugs: [],
  ...buildDefaultExactDates(),
});

const monthLabels = (locale: string): string[] => Array.from({ length: 12 }, (_, index) => (
  new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' })
    .format(new Date(Date.UTC(2026, index, 1)))
));

const templateCardTone = (index: number): 'mango' | 'lagoon' | 'hibiscus' => (
  (['mango', 'lagoon', 'hibiscus'] as const)[index % 3]!
);

const measureNow = (): number => (
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now()
);

const roundDurationMs = (durationMs: number): number => Math.round(durationMs * 1_000) / 1_000;

const serializedByteLength = (value: unknown): number => {
  const serialized = JSON.stringify(value);
  return typeof TextEncoder !== 'undefined'
    ? new TextEncoder().encode(serialized).byteLength
    : serialized.length;
};

const formatContextKilobytes = (bytes: number): string => `${Math.round(bytes / 1_024)} KB`;

const TemplateRouteStrip: React.FC<{ applied: AppliedTravelTemplate }> = ({ applied }) => {
  const { t } = useTranslation('createTrip');
  const stops = applied.spec.places.filter((place) => place.role === 'base' || place.role === 'day_trip');
  return (
    <div className="shape-route-strip" aria-label={stops.map((stop) => stop.entity.name).join(', ')}>
      {stops.map((stop, index) => (
        <React.Fragment key={`${stop.entity.canonicalSlug}:${stop.role}`}>
          {index > 0 ? <span className="shape-route-strip__line" aria-hidden="true" /> : null}
          <span className={`shape-route-strip__stop shape-route-strip__stop--${stop.role}`}>
            <span className="shape-route-strip__dot" aria-hidden="true" />
            <span>
              <strong>{stop.entity.name}</strong>
              <small>
                {stop.role === 'day_trip'
                  ? t('shapeLab.reveal.dayTripShort')
                  : t('shapeLab.reveal.nightsShort', { count: stop.nights ?? 0 })}
              </small>
            </span>
          </span>
        </React.Fragment>
      ))}
    </div>
  );
};

export const CreateTripShapeLabPage: React.FC<CreateTripShapeLabPageProps> = ({
  onTripGenerated,
  onOpenManager,
}) => {
  const { t, i18n } = useTranslation('createTrip');
  const bundledPack = getBundledTravelDestinationPack('TH', i18n.language);
  if (!bundledPack) throw new Error('The bundled Thailand destination pack is unavailable.');

  const [pack, setPack] = useState(bundledPack);
  const [loadSource, setLoadSource] = useState<TravelKnowledgeLoadSource>('bundled');
  const [loadWarning, setLoadWarning] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [draft, setDraft] = useState<JourneyShapeWizardDraft>(buildInitialDraft);
  const [placeQuery, setPlaceQuery] = useState('');
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<string>();
  const [routeComparison, setRouteComparison] = useState<PreparedRouteComparison>();
  const [selectedRouteContext, setSelectedRouteContext] = useState<TravelPlanningContextLoadResult>();
  const [selectedRouteContextBytes, setSelectedRouteContextBytes] = useState(0);
  const [isPreparingComparison, setIsPreparingComparison] = useState(false);
  const [isPreparingSelectedRoute, setIsPreparingSelectedRoute] = useState(false);
  const [personalizationRequest, setPersonalizationRequest] = useState('');
  const [personalizationResult, setPersonalizationResult] = useState<JourneyPersonalizationResult>();
  const [personalizedSpec, setPersonalizedSpec] = useState<JourneySpec>();
  const [personalizationErrorCode, setPersonalizationErrorCode] = useState<string>();
  const [isPersonalizing, setIsPersonalizing] = useState(false);
  const progressRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const comparisonRequestRef = useRef(0);
  const selectedRouteRequestRef = useRef(0);
  const personalizationAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let active = true;
    loadTravelDestinationPack({
      countryCode: 'TH',
      locale: i18n.language,
      networkPolicy: 'network-first',
    }).then((result) => {
      if (!active) return;
      setPack(result.pack);
      setLoadSource(result.source);
      setLoadWarning(false);
      trackEvent('create_trip_shape__knowledge--load', {
        source: result.source,
        load_duration_ms: roundDurationMs(result.loadDurationMs),
        dataset_version: result.pack.dataset?.version,
        entity_count: result.pack.entities.length,
        template_count: result.pack.templates.length,
      });
    }).catch(() => {
      if (!active) return;
      setLoadWarning(true);
    });
    return () => {
      active = false;
    };
  }, [i18n.language]);

  useEffect(() => () => personalizationAbortRef.current?.abort('unmounted'), []);

  const currentStep = STEPS[stepIndex] ?? 'shape';
  const labels = useMemo(() => monthLabels(i18n.language), [i18n.language]);
  const anchorCities = useMemo(
    () => getJourneyShapeAnchorCities(pack, draft.journeyType),
    [draft.journeyType, pack],
  );
  const neighborhoods = useMemo(
    () => getJourneyShapeNeighborhoods(pack, draft.selectedCitySlug),
    [draft.selectedCitySlug, pack],
  );
  const placeSearch = useMemo(() => {
    const results = searchJourneyShapePlaces(pack, draft.journeyType, placeQuery, 10);
    return {
      cities: results.filter((result) => result.matchKind === 'city'),
      neighborhoods: results.filter((result) => result.matchKind === 'neighborhood'),
    };
  }, [draft.journeyType, pack, placeQuery]);

  const journeyResult = useMemo(() => {
    try {
      const spec = buildJourneySpecFromShapeWizard(draft, pack);
      return { spec, error: null as string | null };
    } catch (error) {
      return { spec: null, error: error instanceof Error ? error.message : String(error) };
    }
  }, [draft, pack]);

  const routeConcepts = routeComparison?.concepts ?? EMPTY_ROUTE_CONCEPTS;
  const routePack = routeComparison?.retrieval.context.pack ?? pack;
  const routeLoadSource = routeComparison?.retrieval.source ?? loadSource;
  const selectedRoute = routeConcepts.find(({ match }) => match.template.templateKey === selectedTemplateKey);
  const activeAppliedRoute = useMemo(() => (
    selectedRoute
      ? (personalizedSpec ? { ...selectedRoute.applied, spec: personalizedSpec } : selectedRoute.applied)
      : undefined
  ), [personalizedSpec, selectedRoute]);
  const selectedRoutePack = selectedRouteContext?.context.pack ?? routePack;
  const selectedRouteCataloguePack = routeComparison?.cataloguePack ?? selectedRoutePack;
  const selectedRouteLoadSource = selectedRouteContext?.source ?? routeLoadSource;
  const selectedDestinationBriefs = useMemo(
    () => activeAppliedRoute ? buildJourneyDestinationBriefs(activeAppliedRoute.spec, selectedRouteCataloguePack) : [],
    [activeAppliedRoute, selectedRouteCataloguePack],
  );
  const cityRequired = draft.journeyType !== 'single_country_circuit';
  const exactDatesValid = draft.dateMode !== 'exact' || journeyResult.error === null;
  const canContinue = currentStep === 'place'
    ? (!cityRequired || Boolean(draft.selectedCitySlug))
    : currentStep === 'timing'
      ? exactDatesValid
      : true;

  const updateDraft = (update: Partial<JourneyShapeWizardDraft>) => {
    comparisonRequestRef.current += 1;
    selectedRouteRequestRef.current += 1;
    setDraft((current) => ({ ...current, ...update }));
    setSelectedTemplateKey(undefined);
    setRouteComparison(undefined);
    setSelectedRouteContext(undefined);
    setSelectedRouteContextBytes(0);
    setIsPreparingComparison(false);
    setIsPreparingSelectedRoute(false);
    personalizationAbortRef.current?.abort('draft_changed');
    setPersonalizationRequest('');
    setPersonalizationResult(undefined);
    setPersonalizedSpec(undefined);
    setPersonalizationErrorCode(undefined);
    setIsPersonalizing(false);
  };

  const moveToStep = (nextIndex: number, afterPaint?: () => void) => {
    setStepIndex(Math.max(0, Math.min(STEPS.length - 1, nextIndex)));
    window.requestAnimationFrame(() => {
      const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
      if (progressRef.current && typeof progressRef.current.scrollIntoView === 'function') {
        progressRef.current.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
      }
      contentRef.current?.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true });
      if (afterPaint) window.requestAnimationFrame(afterPaint);
    });
  };

  const chooseShape = (shape: typeof SHAPE_OPTIONS[number]) => {
    updateDraft({
      journeyType: shape.id,
      durationDays: shape.durationDays,
      maxBaseChanges: shape.maxBaseChanges,
      selectedCitySlug: undefined,
      selectedNeighborhoodSlugs: [],
    });
    setPlaceQuery('');
    trackEvent('create_trip_shape__shape--select', { journey_type: shape.id });
    moveToStep(1);
  };

  const chooseAnchorCity = (
    city: TravelEntityCatalogItem,
    source: 'curated' | 'search',
  ) => {
    const selected = draft.selectedCitySlug === city.canonicalSlug;
    updateDraft({
      selectedCitySlug: selected && !cityRequired ? undefined : city.canonicalSlug,
      selectedNeighborhoodSlugs: [],
    });
    setPlaceQuery('');
    trackEvent('create_trip_shape__city--select', {
      city: city.canonicalSlug,
      journey_type: draft.journeyType,
      source,
    });
  };

  const chooseSearchedNeighborhood = (
    neighborhood: TravelEntityCatalogItem,
    city: TravelEntityCatalogItem,
  ) => {
    updateDraft({
      selectedCitySlug: city.canonicalSlug,
      selectedNeighborhoodSlugs: [neighborhood.canonicalSlug],
    });
    setPlaceQuery('');
    trackEvent('create_trip_shape__neighborhood--select_search', {
      neighborhood: neighborhood.canonicalSlug,
      city: city.canonicalSlug,
      journey_type: draft.journeyType,
    });
  };

  const goBack = () => {
    const nextIndex = Math.max(0, stepIndex - 1);
    trackEvent('create_trip_shape__step--back', { from: currentStep, to: STEPS[nextIndex] });
    moveToStep(nextIndex);
  };

  const goForward = async () => {
    if (!canContinue || isPreparingComparison) return;
    const nextIndex = Math.min(STEPS.length - 1, stepIndex + 1);
    trackEvent('create_trip_shape__step--continue', { from: currentStep, to: STEPS[nextIndex] });
    const spec = journeyResult.spec;
    if (currentStep !== 'style' || !spec) {
      moveToStep(nextIndex);
      return;
    }

    const revealStartedAt = measureNow();
    const requestId = comparisonRequestRef.current + 1;
    comparisonRequestRef.current = requestId;
    setIsPreparingComparison(true);
    try {
      const retrieval = await loadTravelPlanningContext({
        spec,
        locale: i18n.language,
        networkPolicy: 'network-first',
        templateLimit: 3,
        neighborhoodLimitPerCity: 2,
        poiLimitPerCity: 2,
      });
      if (comparisonRequestRef.current !== requestId) return;
      const contextPack = retrieval.context.pack;
      const rawBytes = serializedByteLength(retrieval.context);
      const prepared = buildJourneyRouteConcepts(spec, contextPack, { limit: 3 });
      const cataloguePack = pack.dataset?.version === contextPack.dataset?.version
        ? pack
        : contextPack;
      setRouteComparison({ concepts: prepared.concepts, retrieval, rawBytes, cataloguePack });
      trackEvent('create_trip_shape__concepts--prepare', {
        journey_type: spec.journeyType,
        concept_count: prepared.concepts.length,
        attempted_template_count: prepared.attemptedTemplateCount,
        failed_template_count: prepared.failedTemplateCount,
        rank_duration_ms: roundDurationMs(prepared.rankDurationMs),
        apply_duration_ms: roundDurationMs(prepared.applyDurationMs),
        total_duration_ms: roundDurationMs(prepared.totalDurationMs),
        context_load_duration_ms: roundDurationMs(retrieval.loadDurationMs),
        context_bytes: rawBytes,
        retrieved_entity_count: retrieval.context.stats.selectedEntityCount,
        retrieved_template_count: retrieval.context.stats.selectedTemplateCount,
        retriever_version: retrieval.context.retrieverVersion,
        knowledge_source: retrieval.source,
        dataset_version: contextPack.dataset?.version,
      });
      moveToStep(nextIndex, () => {
        trackEvent('create_trip_shape__reveal--ready', {
          journey_type: spec.journeyType,
          concept_count: prepared.concepts.length,
          duration_ms: roundDurationMs(measureNow() - revealStartedAt),
          context_load_duration_ms: roundDurationMs(retrieval.loadDurationMs),
          context_bytes: rawBytes,
          retriever_version: retrieval.context.retrieverVersion,
          knowledge_source: retrieval.source,
          dataset_version: contextPack.dataset?.version,
        });
      });
    } finally {
      if (comparisonRequestRef.current === requestId) setIsPreparingComparison(false);
    }
  };

  const toggleNeighborhood = (slug: string) => {
    const selected = draft.selectedNeighborhoodSlugs.includes(slug);
    const next = selected
      ? draft.selectedNeighborhoodSlugs.filter((candidate) => candidate !== slug)
      : [...draft.selectedNeighborhoodSlugs, slug].slice(-3);
    updateDraft({ selectedNeighborhoodSlugs: next });
    trackEvent('create_trip_shape__neighborhood--toggle', { neighborhood: slug, enabled: !selected });
  };

  const toggleInterest = (tagKey: string) => {
    const selected = draft.interestTags.includes(tagKey);
    updateDraft({
      interestTags: selected
        ? draft.interestTags.filter((candidate) => candidate !== tagKey)
        : [...draft.interestTags, tagKey],
    });
    trackEvent('create_trip_shape__interest--toggle', { tag: tagKey, enabled: !selected });
  };

  const chooseTemplate = (match: TravelTemplateMatch) => {
    const route = routeConcepts.find((concept) => concept.match.template.templateKey === match.template.templateKey);
    if (!route) return;
    setSelectedTemplateKey(match.template.templateKey);
    setSelectedRouteContext(undefined);
    setSelectedRouteContextBytes(0);
    personalizationAbortRef.current?.abort('route_changed');
    setPersonalizationResult(undefined);
    setPersonalizedSpec(undefined);
    setPersonalizationErrorCode(undefined);
    setIsPersonalizing(false);
    trackEvent('create_trip_shape__template--select', {
      template: match.template.templateKey,
      score: match.score,
      dataset_version: routePack.dataset?.version,
    });

    const requestId = selectedRouteRequestRef.current + 1;
    selectedRouteRequestRef.current = requestId;
    setIsPreparingSelectedRoute(true);
    void loadTravelPlanningContext({
      spec: route.applied.spec,
      locale: i18n.language,
      networkPolicy: 'network-first',
      templateKeys: [match.template.templateKey],
      templateLimit: 1,
      neighborhoodLimitPerCity: 4,
      poiLimitPerCity: 6,
    }).then((retrieval) => {
      if (selectedRouteRequestRef.current !== requestId) return;
      const rawBytes = serializedByteLength(retrieval.context);
      setSelectedRouteContext(retrieval);
      setSelectedRouteContextBytes(rawBytes);
      trackEvent('create_trip_shape__selected_context--load', {
        template: match.template.templateKey,
        context_load_duration_ms: roundDurationMs(retrieval.loadDurationMs),
        context_bytes: rawBytes,
        retrieved_entity_count: retrieval.context.stats.selectedEntityCount,
        retrieved_neighborhood_count: retrieval.context.stats.selectedNeighborhoodCount,
        retrieved_poi_count: retrieval.context.stats.selectedPoiCount,
        retriever_version: retrieval.context.retrieverVersion,
        knowledge_source: retrieval.source,
        dataset_version: retrieval.context.pack.dataset?.version,
      });
    }).catch(() => {
      if (selectedRouteRequestRef.current !== requestId || !routeComparison) return;
      setSelectedRouteContext(routeComparison.retrieval);
      setSelectedRouteContextBytes(routeComparison.rawBytes);
    }).finally(() => {
      if (selectedRouteRequestRef.current === requestId) setIsPreparingSelectedRoute(false);
    });
  };

  const personalizeSelectedRoute = async () => {
    if (!selectedRoute || !personalizationRequest.trim() || isPersonalizing) return;
    const retrieval = selectedRouteContext ?? routeComparison?.retrieval;
    if (!retrieval) return;
    personalizationAbortRef.current?.abort('superseded');
    const controller = new AbortController();
    personalizationAbortRef.current = controller;
    setIsPersonalizing(true);
    setPersonalizationErrorCode(undefined);
    setPersonalizationResult(undefined);
    setPersonalizedSpec(undefined);
    trackEvent('create_trip_shape__personalization--request', {
      template: selectedRoute.match.template.templateKey,
      request_length: personalizationRequest.trim().length,
      dataset_version: retrieval.context.pack.dataset?.version,
      retriever_version: retrieval.context.retrieverVersion,
      context_entity_count: retrieval.context.stats.selectedEntityCount,
    });
    try {
      const result = await requestJourneyPersonalization({
        spec: selectedRoute.applied.spec,
        pack: retrieval.context.pack,
        retrieverVersion: retrieval.context.retrieverVersion,
        locale: i18n.resolvedLanguage ?? i18n.language,
        travelerRequest: personalizationRequest,
        signal: controller.signal,
      });
      if (personalizationAbortRef.current !== controller) return;
      setPersonalizationResult(result);
      trackEvent('create_trip_shape__personalization--ready', {
        template: selectedRoute.match.template.templateKey,
        request_id: result.meta.requestId,
        provider: result.meta.provider,
        model: result.meta.model,
        duration_ms: result.meta.durationMs,
        change_count: result.applied.changes.length,
        unresolved_count: result.proposal.unresolved.length,
        dataset_version: result.request.context.datasetVersion,
      });
    } catch (error) {
      if (personalizationAbortRef.current !== controller) return;
      const code = error instanceof JourneyPersonalizationError
        ? error.code
        : 'PERSONALIZATION_UNKNOWN_ERROR';
      setPersonalizationErrorCode(code);
      trackEvent('create_trip_shape__personalization--fail', {
        template: selectedRoute.match.template.templateKey,
        error_code: code,
      });
    } finally {
      if (personalizationAbortRef.current === controller) setIsPersonalizing(false);
    }
  };

  const applyPersonalization = () => {
    if (!personalizationResult) return;
    setPersonalizedSpec(personalizationResult.applied.spec);
    trackEvent('create_trip_shape__personalization--apply', {
      template: personalizationResult.request.context.templateKey,
      request_id: personalizationResult.meta.requestId,
      change_count: personalizationResult.applied.changes.length,
      dataset_version: personalizationResult.request.context.datasetVersion,
    });
  };

  const undoPersonalization = () => {
    if (!personalizationResult) return;
    setPersonalizedSpec(undefined);
    trackEvent('create_trip_shape__personalization--undo', {
      template: personalizationResult.request.context.templateKey,
      request_id: personalizationResult.meta.requestId,
    });
  };

  const clearPersonalizationProposal = () => {
    setPersonalizationResult(undefined);
    setPersonalizedSpec(undefined);
    setPersonalizationErrorCode(undefined);
    trackEvent('create_trip_shape__personalization--clear', {
      template: selectedRoute?.match.template.templateKey,
    });
  };

  const openSelectedSkeleton = () => {
    if (!selectedRoute || !activeAppliedRoute || isPreparingSelectedRoute) return;
    const planningContext = selectedRouteContext ?? routeComparison?.retrieval;
    const planningContextBytes = selectedRouteContext ? selectedRouteContextBytes : routeComparison?.rawBytes;
    const {
      trip,
      addedActivityCount,
      skeletonDurationMs,
      enrichmentDurationMs,
      compileDurationMs,
    } = buildKnowledgeEnrichedTripFromTemplate(
      activeAppliedRoute,
      selectedRouteCataloguePack,
      {
        knowledgeSource: selectedRouteLoadSource,
        match: selectedRoute.match,
        planningContext: planningContext ? {
          version: planningContext.context.version,
          retrieverVersion: planningContext.context.retrieverVersion,
          source: planningContext.source,
          loadDurationMs: roundDurationMs(planningContext.loadDurationMs),
          rawBytes: planningContextBytes ?? 0,
          selectedEntityCount: planningContext.context.stats.selectedEntityCount,
          selectedTemplateCount: planningContext.context.stats.selectedTemplateCount,
          selectedNeighborhoodCount: planningContext.context.stats.selectedNeighborhoodCount,
          selectedPoiCount: planningContext.context.stats.selectedPoiCount,
          aiCallCount: personalizationResult ? 1 : 0,
        } : undefined,
        personalization: personalizationResult ? {
          version: personalizationResult.proposal.version,
          requestId: personalizationResult.meta.requestId,
          provider: personalizationResult.meta.provider,
          model: personalizationResult.meta.model,
          durationMs: roundDurationMs(personalizationResult.meta.durationMs),
          operationCount: personalizationResult.applied.changes.length,
          unresolvedCount: personalizationResult.proposal.unresolved.length,
          applied: Boolean(personalizedSpec),
          datasetVersion: personalizationResult.request.context.datasetVersion,
          createdAt: new Date().toISOString(),
        } : undefined,
      },
    );
    trackEvent('create_trip_shape__skeleton--open', {
      template: selectedRoute.match.template.templateKey,
      city_count: trip.items.filter((item) => item.type === 'city').length,
      activity_count: trip.items.filter((item) => item.type === 'activity').length,
      knowledge_activity_count: addedActivityCount,
      skeleton_duration_ms: roundDurationMs(skeletonDurationMs),
      enrichment_duration_ms: roundDurationMs(enrichmentDurationMs),
      compile_duration_ms: roundDurationMs(compileDurationMs),
      planning_context_source: planningContext?.source,
      planning_context_bytes: planningContextBytes,
      ai_call_count: personalizationResult ? 1 : 0,
      personalization_applied: Boolean(personalizedSpec),
      personalization_change_count: personalizationResult?.applied.changes.length ?? 0,
      route_stage: trip.planningMeta?.routeStage,
      dataset_version: trip.planningMeta?.datasetVersion,
    });
    onTripGenerated(trip);
  };

  const renderShapeStep = () => (
    <section className="shape-step" aria-labelledby="shape-step-title">
      <div className="shape-step__intro">
        <span>{t('shapeLab.shape.eyebrow')}</span>
        <h2 id="shape-step-title" tabIndex={-1}>{t('shapeLab.shape.title')}</h2>
        <p>{t('shapeLab.shape.description')}</p>
      </div>
      <div className="shape-choice-grid">
        {SHAPE_OPTIONS.map((shape, index) => {
          const Icon = shape.icon;
          const selected = draft.journeyType === shape.id;
          return (
            <PlayfulDecisionButton
              key={shape.id}
              className="shape-choice"
              tone={shape.tone}
              rotation={(index - 1) * 1.25}
              selected={selected}
              scribble
              onClick={() => chooseShape(shape)}
              aria-pressed={selected}
              {...getAnalyticsDebugAttributes('create_trip_shape__shape--select', { journey_type: shape.id })}
            >
              <span className="shape-choice__number">0{index + 1}</span>
              <Icon size={34} weight="duotone" aria-hidden="true" />
              <strong>{t(`shapeLab.shape.options.${shape.id}.title`)}</strong>
              <span>{t(`shapeLab.shape.options.${shape.id}.description`)}</span>
              <ArrowRight className="shape-next-icon" size={20} weight="bold" aria-hidden="true" />
            </PlayfulDecisionButton>
          );
        })}
      </div>
    </section>
  );

  const renderPlaceStep = () => (
    <section className="shape-step" aria-labelledby="place-step-title">
      <div className="shape-step__intro">
        <span>{t('shapeLab.place.eyebrow')}</span>
        <h2 id="place-step-title" tabIndex={-1}>{t('shapeLab.place.title')}</h2>
        <p>{t(cityRequired ? 'shapeLab.place.requiredDescription' : 'shapeLab.place.optionalDescription')}</p>
      </div>

      <div className="shape-place-search">
        <label htmlFor="shape-place-search">{t('shapeLab.place.searchLabel')}</label>
        <div>
          <MagnifyingGlass size={20} weight="bold" aria-hidden="true" />
          <input
            id="shape-place-search"
            type="search"
            value={placeQuery}
            placeholder={t('shapeLab.place.searchPlaceholder')}
            aria-describedby="shape-place-search-hint"
            aria-controls="shape-place-results"
            onChange={(event) => setPlaceQuery(event.currentTarget.value)}
          />
        </div>
        <small id="shape-place-search-hint">{t('shapeLab.place.searchHint')}</small>
      </div>

      <div id="shape-place-results" className="shape-city-list">
        {(placeQuery.trim() ? placeSearch.cities.map((result) => result.city) : anchorCities).map((city) => {
          const selected = draft.selectedCitySlug === city.canonicalSlug;
          return (
            <button
              key={city.entityId}
              type="button"
              className="shape-city-option"
              data-selected={selected ? 'true' : 'false'}
              aria-pressed={selected}
              onClick={() => chooseAnchorCity(city, placeQuery.trim() ? 'search' : 'curated')}
              {...getAnalyticsDebugAttributes('create_trip_shape__city--select', { city: city.canonicalSlug })}
            >
              <span className="shape-city-option__pin"><MapPin size={20} weight="fill" /></span>
              <span className="shape-city-option__copy">
                <strong>{city.name}</strong>
                <small>{t('shapeLab.place.stayRange', { min: city.typicalMinDays ?? 1, max: city.typicalMaxDays ?? 4 })}</small>
              </span>
              <span className="shape-city-option__tags" aria-hidden="true">
                <small>{t('shapeLab.place.popularity', { score: city.popularityScore })}</small>
                <small>{t('shapeLab.place.hiddenGem', { score: city.hiddenGemScore })}</small>
              </span>
              {selected ? <Check className="shape-city-option__check" size={20} weight="bold" /> : null}
            </button>
          );
        })}
        {placeQuery.trim() ? placeSearch.neighborhoods.map((result) => {
          const selected = draft.selectedNeighborhoodSlugs.includes(result.entity.canonicalSlug);
          return (
            <button
              key={result.entity.entityId}
              type="button"
              className="shape-city-option shape-city-option--neighborhood"
              data-selected={selected ? 'true' : 'false'}
              aria-pressed={selected}
              onClick={() => chooseSearchedNeighborhood(result.entity, result.city)}
              {...getAnalyticsDebugAttributes('create_trip_shape__neighborhood--select_search', {
                neighborhood: result.entity.canonicalSlug,
                city: result.city.canonicalSlug,
              })}
            >
              <span className="shape-city-option__pin"><Buildings size={20} weight="duotone" /></span>
              <span className="shape-city-option__copy">
                <strong>{result.entity.name}</strong>
                <small>{t('shapeLab.place.neighborhoodResult', { city: result.city.name })}</small>
              </span>
              <span className="shape-city-option__tags" aria-hidden="true">
                <small>{t('shapeLab.place.popularity', { score: result.entity.popularityScore })}</small>
                <small>{t('shapeLab.place.hiddenGem', { score: result.entity.hiddenGemScore })}</small>
              </span>
              {selected ? <Check className="shape-city-option__check" size={20} weight="bold" /> : null}
            </button>
          );
        }) : null}
      </div>

      {placeQuery.trim() && placeSearch.cities.length === 0 && placeSearch.neighborhoods.length === 0 ? (
        <p className="shape-place-search__empty" role="status">{t('shapeLab.place.noSearchResults')}</p>
      ) : null}

      {draft.selectedCitySlug && neighborhoods.length > 0 ? (
        <div className="shape-neighborhoods">
          <div>
            <strong>{t('shapeLab.place.neighborhoodTitle')}</strong>
            <span>{t('shapeLab.place.neighborhoodHint')}</span>
          </div>
          <div className="shape-chip-row">
            {neighborhoods.map((neighborhood) => {
              const selected = draft.selectedNeighborhoodSlugs.includes(neighborhood.canonicalSlug);
              return (
                <button
                  key={neighborhood.entityId}
                  type="button"
                  className="shape-chip"
                  data-selected={selected ? 'true' : 'false'}
                  aria-pressed={selected}
                  onClick={() => toggleNeighborhood(neighborhood.canonicalSlug)}
                >
                  {selected ? <Check size={14} weight="bold" /> : null}
                  {neighborhood.name}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );

  const renderTimingStep = () => (
    <section className="shape-step" aria-labelledby="timing-step-title">
      <div className="shape-step__intro">
        <span>{t('shapeLab.timing.eyebrow')}</span>
        <h2 id="timing-step-title" tabIndex={-1}>{t('shapeLab.timing.title')}</h2>
        <p>{t('shapeLab.timing.description')}</p>
      </div>

      <div className="shape-segmented" role="group" aria-label={t('shapeLab.timing.modeLabel')}>
        {(['flexible', 'exact'] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            data-selected={draft.dateMode === mode ? 'true' : 'false'}
            aria-pressed={draft.dateMode === mode}
            onClick={() => updateDraft({ dateMode: mode })}
          >
            {t(`shapeLab.timing.modes.${mode}`)}
          </button>
        ))}
      </div>

      {draft.dateMode === 'flexible' ? (
        <div className="shape-timing-grid">
          <div className="shape-duration-control">
            <span>{t('shapeLab.timing.durationLabel')}</span>
            <div>
              <button
                type="button"
                onClick={() => updateDraft({ durationDays: Math.max(2, draft.durationDays - 1) })}
                disabled={draft.durationDays <= 2}
                aria-label={t('shapeLab.timing.decreaseDuration')}
              ><Minus size={18} weight="bold" /></button>
              <strong>{draft.durationDays}</strong>
              <small>{t('shapeLab.timing.nights')}</small>
              <button
                type="button"
                onClick={() => updateDraft({ durationDays: Math.min(28, draft.durationDays + 1) })}
                disabled={draft.durationDays >= 28}
                aria-label={t('shapeLab.timing.increaseDuration')}
              ><Plus size={18} weight="bold" /></button>
            </div>
          </div>
          <div className="shape-month-control">
            <span>{t('shapeLab.timing.monthLabel')}</span>
            <div>
              {labels.map((label, index) => (
                <button
                  key={label}
                  type="button"
                  data-selected={draft.month === index + 1 ? 'true' : 'false'}
                  aria-pressed={draft.month === index + 1}
                  onClick={() => updateDraft({ month: index + 1 })}
                >{label}</button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="shape-exact-dates">
          <label>
            <span>{t('shapeLab.timing.startDate')}</span>
            <input type="date" value={draft.startDate} onChange={(event) => updateDraft({ startDate: event.target.value })} />
          </label>
          <label>
            <span>{t('shapeLab.timing.endDate')}</span>
            <input type="date" value={draft.endDate} onChange={(event) => updateDraft({ endDate: event.target.value })} />
          </label>
          {journeyResult.error ? <p role="alert">{t('shapeLab.timing.dateError')}</p> : null}
        </div>
      )}
    </section>
  );

  const renderStyleStep = () => (
    <section className="shape-step" aria-labelledby="style-step-title">
      <div className="shape-step__intro">
        <span>{t('shapeLab.style.eyebrow')}</span>
        <h2 id="style-step-title" tabIndex={-1}>{t('shapeLab.style.title')}</h2>
        <p>{t('shapeLab.style.description')}</p>
      </div>

      <div className="shape-field-group">
        <strong>{t('shapeLab.style.paceLabel')}</strong>
        <div className="shape-pace-grid">
          {PACE_OPTIONS.map((pace) => (
            <button
              key={pace.id}
              type="button"
              data-selected={draft.pace === pace.id ? 'true' : 'false'}
              aria-pressed={draft.pace === pace.id}
              onClick={() => updateDraft({ pace: pace.id })}
            >{t(pace.labelKey)}</button>
          ))}
        </div>
      </div>

      <div className="shape-field-group">
        <strong>{t('shapeLab.style.interestsLabel')}</strong>
        <div className="shape-interest-grid">
          {INTEREST_OPTIONS.map((interest) => {
            const Icon = interest.icon;
            const selected = draft.interestTags.includes(interest.id);
            return (
              <button
                key={interest.id}
                type="button"
                data-selected={selected ? 'true' : 'false'}
                aria-pressed={selected}
                onClick={() => toggleInterest(interest.id)}
              >
                <Icon size={20} weight={selected ? 'fill' : 'duotone'} />
                {t(interest.labelKey)}
              </button>
            );
          })}
        </div>
      </div>

      {draft.journeyType === 'single_country_circuit' ? (
        <details className="shape-advanced">
          <summary>{t('shapeLab.style.advancedLabel')}</summary>
          <div>
            <label htmlFor="shape-max-base-changes">{t('shapeLab.style.maxChanges')}</label>
            <input
              id="shape-max-base-changes"
              type="range"
              min="1"
              max="5"
              value={draft.maxBaseChanges}
              onChange={(event) => updateDraft({ maxBaseChanges: Number(event.target.value) })}
            />
            <output htmlFor="shape-max-base-changes">{draft.maxBaseChanges}</output>
          </div>
        </details>
      ) : null}
    </section>
  );

  const renderRevealStep = () => (
    <section className="shape-step shape-step--reveal" aria-labelledby="reveal-step-title">
      <div className="shape-step__intro">
        <span>{t('shapeLab.reveal.eyebrow')}</span>
        <h2 id="reveal-step-title" tabIndex={-1}>
          {routeConcepts.length === 1
            ? t('shapeLab.reveal.titleOne')
            : t('shapeLab.reveal.titleMany', { count: routeConcepts.length })}
        </h2>
        <p>{t('shapeLab.reveal.description')}</p>
      </div>

      {routeComparison ? (
        <aside className="shape-engine-proof" aria-label={t('shapeLab.reveal.engine.label')}>
          <div className="shape-engine-proof__header">
            <span className="shape-engine-proof__icon"><Database size={21} weight="duotone" /></span>
            <span>
              <strong>{t('shapeLab.reveal.engine.title')}</strong>
              <small>{t('shapeLab.reveal.engine.description')}</small>
            </span>
            <span className="shape-engine-proof__ai">{t('shapeLab.reveal.engine.noAi')}</span>
          </div>
          <dl className="shape-engine-proof__metrics">
            <div>
              <dt>{t('shapeLab.reveal.engine.retrieval')}</dt>
              <dd>{t('shapeLab.reveal.engine.milliseconds', {
                value: routeComparison.retrieval.loadDurationMs < 1
                  ? '<1'
                  : Math.round(routeComparison.retrieval.loadDurationMs),
              })}</dd>
            </div>
            <div>
              <dt>{t('shapeLab.reveal.engine.places')}</dt>
              <dd>{routeComparison.retrieval.context.stats.selectedEntityCount} / {routeComparison.retrieval.context.stats.sourceEntityCount}</dd>
            </div>
            <div>
              <dt>{t('shapeLab.reveal.engine.templates')}</dt>
              <dd>{routeComparison.retrieval.context.stats.selectedTemplateCount} / {routeComparison.retrieval.context.stats.sourceTemplateCount}</dd>
            </div>
            <div>
              <dt>{t('shapeLab.reveal.engine.payload')}</dt>
              <dd>{formatContextKilobytes(routeComparison.rawBytes)}</dd>
            </div>
          </dl>
          <div className="shape-engine-proof__provenance">
            <span>{loadWarning ? t('shapeLab.reveal.fallback') : t(`shapeLab.reveal.sources.${routeLoadSource}`)}</span>
            <span>{routePack.dataset?.version ?? 'local'}</span>
            <span>{routeComparison.retrieval.context.retrieverVersion}</span>
          </div>
          {selectedRoute ? (
            <div className="shape-engine-proof__selected" aria-live="polite">
              {isPreparingSelectedRoute ? (
                <>
                  <CircleNotch size={17} className="shape-engine-proof__spinner" aria-hidden="true" />
                  <span>{t('shapeLab.reveal.engine.loadingSelected')}</span>
                </>
              ) : selectedRouteContext ? (
                <>
                  <Check size={17} weight="bold" aria-hidden="true" />
                  <span>{t('shapeLab.reveal.engine.selectedReady', {
                    neighborhoods: selectedRouteContext.context.stats.selectedNeighborhoodCount,
                    pois: selectedRouteContext.context.stats.selectedPoiCount,
                    size: formatContextKilobytes(selectedRouteContextBytes),
                  })}</span>
                </>
              ) : null}
            </div>
          ) : null}
        </aside>
      ) : null}

      {routeConcepts.length === 0 ? (
        <div className="shape-empty-route">
          <Compass size={36} weight="duotone" />
          <strong>{t('shapeLab.reveal.noMatchesTitle')}</strong>
          <span>{t('shapeLab.reveal.noMatchesDescription')}</span>
          <button type="button" onClick={() => moveToStep(1)}>{t('shapeLab.reveal.adjustRoute')}</button>
        </div>
      ) : (
        <div className="shape-template-grid">
          {routeConcepts.map(({ match, applied }, index) => {
            const selected = selectedTemplateKey === match.template.templateKey;
            return (
              <PlayfulDecisionSurface
                key={match.template.id}
                className="shape-template-card"
                tone={templateCardTone(index)}
                rotation={(index - 1) * 0.9}
                selected={selected}
              >
                <div className="shape-template-card__topline">
                  <span>{t('shapeLab.reveal.match', { score: Math.round(match.score) })}</span>
                  {selected ? <span><Check size={14} weight="bold" /> {t('shapeLab.reveal.selected')}</span> : null}
                </div>
                <h3>{match.template.copy.title}</h3>
                <p>{match.template.copy.summary}</p>
                <TemplateRouteStrip applied={applied} />
                <div className="shape-template-card__reasons">
                  {match.reasons.slice(0, 3).map((reason) => (
                    <span key={reason}>{t(`shapeLab.reveal.reasons.${reason}`)}</span>
                  ))}
                </div>
                {match.template.copy.tradeoffs[0] ? (
                  <p className="shape-template-card__tradeoff">
                    <strong>{t('shapeLab.reveal.tradeoff')}</strong>
                    {match.template.copy.tradeoffs[0]}
                  </p>
                ) : null}
                <button
                  type="button"
                  className="shape-template-card__select"
                  onClick={() => chooseTemplate(match)}
                  aria-pressed={selected}
                  {...getAnalyticsDebugAttributes('create_trip_shape__template--select', { template: match.template.templateKey })}
                >
                  {selected ? t('shapeLab.reveal.keepSelected') : t('shapeLab.reveal.chooseRoute')}
                </button>
              </PlayfulDecisionSurface>
            );
          })}
        </div>
      )}

      {selectedRoute ? (
        <>
          {!isPreparingSelectedRoute ? (
            <JourneyPersonalizationCard
              value={personalizationRequest}
              result={personalizationResult}
              errorCode={personalizationErrorCode}
              isLoading={isPersonalizing}
              isApplied={Boolean(personalizedSpec)}
              onChange={(value) => {
                setPersonalizationRequest(value);
                setPersonalizationErrorCode(undefined);
              }}
              onSubmit={() => void personalizeSelectedRoute()}
              onApply={applyPersonalization}
              onUndo={undoPersonalization}
              onClear={clearPersonalizationProposal}
              onExampleSelect={(value, index) => {
                setPersonalizationRequest(value);
                setPersonalizationErrorCode(undefined);
                trackEvent('create_trip_shape__personalization_example--select', {
                  template: selectedRoute.match.template.templateKey,
                  example_index: index,
                });
              }}
            />
          ) : null}
          <JourneyDestinationBriefPreview
            briefs={selectedDestinationBriefs}
            monthLabels={labels}
            showDatasetNarrative={(i18n.resolvedLanguage ?? i18n.language).startsWith('en')}
            labels={{
              title: t('shapeLab.reveal.brief.title'),
              description: t('shapeLab.reveal.brief.description'),
              bestMonths: t('shapeLab.reveal.brief.bestMonths'),
              dishes: t('shapeLab.reveal.brief.dishes'),
              neighborhoods: t('shapeLab.reveal.brief.neighborhoods'),
              activities: t('shapeLab.reveal.brief.activities'),
              stayRange: (min, max) => t('shapeLab.reveal.brief.stayRange', { min, max }),
              source: t('shapeLab.reveal.brief.source'),
              selected: t('shapeLab.reveal.selected'),
              audienceContext: t('shapeLab.reveal.brief.audienceContext'),
              audienceSignals: {
                family_activity_supply: t('shapeLab.reveal.brief.audienceSignals.family_activity_supply'),
                lgbtq_scene: t('shapeLab.reveal.brief.audienceSignals.lgbtq_scene'),
                solo_travel_interest: t('shapeLab.reveal.brief.audienceSignals.solo_travel_interest'),
              },
            }}
            onSourceOpen={(brief) => trackEvent('create_trip_shape__brief_source--open', {
              city: brief.city.canonicalSlug,
              dataset_version: brief.datasetVersion,
            })}
            getSourceDebugAttributes={(brief) => getAnalyticsDebugAttributes(
              'create_trip_shape__brief_source--open',
              { city: brief.city.canonicalSlug, dataset_version: brief.datasetVersion },
            )}
          />
          <div className="shape-open-route">
            <div>
              <Sparkle size={22} weight="fill" />
              <span>
                <strong>{t(personalizedSpec
                  ? 'shapeLab.reveal.readyAdaptedTitle'
                  : 'shapeLab.reveal.readyTitle')}</strong>
                <small>{t(personalizedSpec
                  ? 'shapeLab.reveal.readyAdaptedDescription'
                  : 'shapeLab.reveal.readyDescription')}</small>
              </span>
            </div>
            <button type="button" onClick={openSelectedSkeleton} disabled={isPreparingSelectedRoute}>
              {t(personalizedSpec
                ? 'shapeLab.actions.openAdaptedPlan'
                : 'shapeLab.actions.openPlan')}
              <ArrowRight className="shape-next-icon" size={18} weight="bold" />
            </button>
          </div>
        </>
      ) : null}
    </section>
  );

  const stepContent = currentStep === 'shape'
    ? renderShapeStep()
    : currentStep === 'place'
      ? renderPlaceStep()
      : currentStep === 'timing'
        ? renderTimingStep()
        : currentStep === 'style'
          ? renderStyleStep()
          : renderRevealStep();

  return (
    <div className="shape-lab-page tf-travel-experience">
      <SiteHeader hideCreateTrip onMyTripsClick={onOpenManager} />
      <main id="main-content" className="shape-lab-main">
        <header className="shape-lab-hero">
          <div>
            <span><Sparkle size={15} weight="fill" /> {t('shapeLab.badge')}</span>
            <h1>{t('shapeLab.title')}</h1>
          </div>
          <p>{t('shapeLab.intro')}</p>
        </header>

        <nav ref={progressRef} className="shape-progress" aria-label={t('shapeLab.progressLabel')}>
          {STEPS.map((step, index) => (
            <button
              key={step}
              type="button"
              data-current={index === stepIndex ? 'true' : 'false'}
              data-complete={index < stepIndex ? 'true' : 'false'}
              disabled={index > stepIndex}
              onClick={() => index < stepIndex && moveToStep(index)}
              aria-current={index === stepIndex ? 'step' : undefined}
            >
              <span>{index < stepIndex ? <Check size={13} weight="bold" /> : index + 1}</span>
              {t(`shapeLab.steps.${step}`)}
            </button>
          ))}
        </nav>

        <div ref={contentRef} className="shape-lab-content">{stepContent}</div>

        {currentStep !== 'shape' ? (
          <footer className="shape-lab-actions">
            <button type="button" className="shape-lab-actions__back" onClick={goBack}>
              <ArrowLeft className="shape-back-icon" size={18} weight="bold" />
              {t('wizard.actions.back')}
            </button>
            {currentStep !== 'reveal' ? (
              <button
                type="button"
                className="shape-lab-actions__next"
                onClick={() => void goForward()}
                disabled={!canContinue || isPreparingComparison}
                aria-busy={isPreparingComparison || undefined}
              >
                {currentStep === 'style' && isPreparingComparison
                  ? t('shapeLab.actions.preparing')
                  : currentStep === 'style'
                    ? t('shapeLab.actions.compare')
                    : t('wizard.actions.continue')}
                {isPreparingComparison ? (
                  <CircleNotch size={18} className="shape-engine-proof__spinner" aria-hidden="true" />
                ) : (
                  <ArrowRight className="shape-next-icon" size={18} weight="bold" />
                )}
              </button>
            ) : null}
          </footer>
        ) : null}
      </main>
      <SiteFooter />
    </div>
  );
};
