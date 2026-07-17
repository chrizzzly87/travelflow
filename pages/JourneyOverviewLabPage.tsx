import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowsOutCardinal,
  Eye,
  MapTrifold,
  SidebarSimple,
  Sparkle,
} from '@phosphor-icons/react';
import { SiteFooter } from '../components/marketing/SiteFooter';
import { SiteHeader } from '../components/navigation/SiteHeader';
import {
  JourneyInspectorConcept,
  JourneyLensConcept,
  JourneyStoryboardConcept,
  type JourneyOverviewConceptId,
} from '../components/journey-overview/JourneyOverviewConcepts';
import { getAnalyticsDebugAttributes, trackEvent } from '../services/analyticsService';
import { buildKnowledgeEnrichedTripFromTemplate } from '../services/journeyKnowledgeEnrichmentService';
import {
  buildJourneyOverviewModel,
  type JourneyOverviewModel,
} from '../services/journeyOverviewService';
import { getBundledTravelDestinationPack } from '../services/travelKnowledgeService';
import { buildJourneySpecFromShapeWizard } from '../shared/journeyShapeWizard';
import {
  applyTravelTemplateToJourneySpec,
  matchTravelTemplates,
} from '../shared/travelTemplateMatcher';
import '../styles/journey-overview-lab.css';

const CONCEPTS: Array<{
  id: JourneyOverviewConceptId;
  icon: typeof SidebarSimple;
}> = [
  { id: 'lens', icon: SidebarSimple },
  { id: 'storyboard', icon: MapTrifold },
  { id: 'inspector', icon: ArrowsOutCardinal },
];

const buildLabModel = (locale: string): JourneyOverviewModel => {
  const pack = getBundledTravelDestinationPack('TH', locale);
  if (!pack) throw new Error('The bundled Thailand destination pack is unavailable.');
  const draft = {
    journeyType: 'single_country_circuit',
    dateMode: 'flexible',
    durationDays: 13,
    month: 11,
    pace: 'balanced',
    interestTags: ['food', 'culture', 'nature', 'beaches'],
    maxBaseChanges: 3,
    selectedCitySlug: 'th-bangkok',
  } as const;
  const rankingSpec = buildJourneySpecFromShapeWizard({
    ...draft,
    selectedNeighborhoodSlugs: [],
  }, pack);
  const spec = buildJourneySpecFromShapeWizard({
    ...draft,
    selectedNeighborhoodSlugs: ['th-bangkok-yaowarat'],
  }, pack);
  const template = pack.templates.find((candidate) => (
    candidate.templateKey === 'th-first-timer-bangkok-north-beach'
  ));
  if (!template) throw new Error('The Thailand overview template is unavailable.');
  const match = matchTravelTemplates(rankingSpec, pack, { limit: pack.templates.length })
    .find((candidate) => candidate.template.templateKey === template.templateKey);
  if (!match) throw new Error('The Thailand overview template does not match the lab brief.');
  const applied = applyTravelTemplateToJourneySpec(spec, pack, template);
  const trip = buildKnowledgeEnrichedTripFromTemplate(applied, pack, {
    tripId: 'journey-overview-lab-thailand',
    now: new Date('2026-07-17T10:00:00.000Z'),
    knowledgeSource: 'bundled',
    match,
  }).trip;
  return buildJourneyOverviewModel(trip);
};

export const JourneyOverviewLabPage: React.FC = () => {
  const { t, i18n } = useTranslation('createTrip');
  const model = useMemo(() => buildLabModel(i18n.language), [i18n.language]);
  const [concept, setConcept] = useState<JourneyOverviewConceptId>('lens');
  const [selectedChapterId, setSelectedChapterId] = useState(model.chapters[0]!.id);
  const [selectedLegId, setSelectedLegId] = useState<string>();

  const selectConcept = (next: JourneyOverviewConceptId) => {
    setConcept(next);
    trackEvent('journey_lab__concept--select', { concept: next });
  };

  const selectChapter = (chapterId: string, surface: string) => {
    setSelectedChapterId(chapterId);
    setSelectedLegId(undefined);
    const chapter = model.chapters.find((candidate) => candidate.id === chapterId);
    trackEvent('journey_lab__chapter--select', {
      chapter: chapter?.entity?.canonicalSlug ?? chapterId,
      concept,
      surface,
    });
  };

  const selectLeg = (legId: string, surface: string) => {
    setSelectedLegId(legId);
    const leg = model.legs.find((candidate) => candidate.id === legId);
    if (leg) setSelectedChapterId(leg.fromChapterId);
    trackEvent('journey_lab__transfer--select', { leg: legId, concept, surface });
  };

  const conceptProps = {
    model,
    selectedChapterId,
    selectedLegId,
    onSelectChapter: selectChapter,
    onSelectLeg: selectLeg,
  };

  return (
    <div className="journey-lab-page">
      <SiteHeader hideCreateTrip />
      <main id="main-content" className="journey-lab-main">
        <header className="journey-lab-hero">
          <div>
            <span><Sparkle size={15} weight="fill" /> {t('journeyLab.badge')}</span>
            <h1>{t('journeyLab.title')}</h1>
          </div>
          <div className="journey-lab-hero__intro">
            <p>{t('journeyLab.intro')}</p>
            <small><Eye size={15} weight="duotone" /> {t('journeyLab.prototypeNote')}</small>
          </div>
        </header>

        <section className="journey-concept-picker" aria-labelledby="journey-concept-picker-title">
          <div className="journey-concept-picker__intro">
            <span>{t('journeyLab.labels.compare')}</span>
            <h2 id="journey-concept-picker-title">{t('journeyLab.conceptsLabel')}</h2>
          </div>
          <div className="journey-concept-tabs" role="tablist" aria-label={t('journeyLab.conceptsLabel')}>
            {CONCEPTS.map(({ id, icon: Icon }, index) => (
              <button
                key={id}
                type="button"
                role="tab"
                id={`journey-concept-tab-${id}`}
                aria-controls={`journey-concept-panel-${id}`}
                aria-selected={concept === id}
                tabIndex={concept === id ? 0 : -1}
                data-selected={concept === id ? 'true' : 'false'}
                onClick={() => selectConcept(id)}
                {...getAnalyticsDebugAttributes('journey_lab__concept--select', { concept: id })}
              >
                <span>0{index + 1}</span>
                <Icon size={24} weight="duotone" aria-hidden="true" />
                <strong>{t(`journeyLab.concepts.${id}.title`)}</strong>
                <small>{t(`journeyLab.concepts.${id}.description`)}</small>
                <em>{t(`journeyLab.concepts.${id}.bestFor`)}</em>
              </button>
            ))}
          </div>
        </section>

        <section
          className="journey-concept-stage"
          role="tabpanel"
          id={`journey-concept-panel-${concept}`}
          aria-labelledby={`journey-concept-tab-${concept}`}
        >
          {concept === 'lens' ? <JourneyLensConcept {...conceptProps} /> : null}
          {concept === 'storyboard' ? <JourneyStoryboardConcept {...conceptProps} /> : null}
          {concept === 'inspector' ? <JourneyInspectorConcept {...conceptProps} /> : null}
        </section>

        <section className="journey-evidence" aria-labelledby="journey-evidence-title">
          <div>
            <span>{t('journeyLab.labels.evidence')}</span>
            <h2 id="journey-evidence-title">{t('journeyLab.evidence.title')}</h2>
            <p>{t('journeyLab.evidence.description')}</p>
          </div>
          <dl>
            <div><dt>{t('journeyLab.evidence.dataset')}</dt><dd>{model.provenance?.datasetVersion}</dd></div>
            <div><dt>{t('journeyLab.evidence.template')}</dt><dd>{model.provenance?.templateKey}</dd></div>
            <div><dt>{t('journeyLab.evidence.routeFit')}</dt><dd>{Math.round(model.provenance?.matchedTemplateScore ?? 0)}%</dd></div>
          </dl>
          <div className="journey-evidence__reasons">
            <strong>{t('journeyLab.labels.whyFits')}</strong>
            <ul>
              {model.provenance?.reasons.map((reason) => (
                <li key={reason}>{t(`shapeLab.reveal.reasons.${reason}`)}</li>
              ))}
            </ul>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
};
