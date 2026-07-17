import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  Bus,
  Compass,
  ForkKnife,
  MapPin,
  Mountains,
  Sparkle,
  Warning,
} from '@phosphor-icons/react';
import { getAnalyticsDebugAttributes } from '../../services/analyticsService';
import type {
  JourneyOverviewChapter,
  JourneyOverviewLeg,
  JourneyOverviewModel,
} from '../../services/journeyOverviewService';

export type JourneyOverviewConceptId = 'lens' | 'storyboard' | 'inspector';

interface JourneyOverviewConceptProps {
  model: JourneyOverviewModel;
  selectedChapterId: string;
  selectedLegId?: string;
  onSelectChapter: (chapterId: string, surface: string) => void;
  onSelectLeg: (legId: string, surface: string) => void;
}

const chapterTone = (order: number): 'mango' | 'lagoon' | 'hibiscus' => (
  (['mango', 'lagoon', 'hibiscus'] as const)[order % 3]!
);

const humanizeTag = (tag: string): string => tag
  .replaceAll('_', ' ')
  .replace(/\b\w/g, (letter) => letter.toUpperCase());

const INTEREST_LABEL_KEYS: Record<string, string> = {
  food: 'wizard.vibes.options.food',
  culture: 'wizard.vibes.options.culture',
  nature: 'wizard.vibes.options.nature',
  beaches: 'style.options.beaches',
  nightlife: 'wizard.vibes.options.nightlife',
  wellness: 'wizard.vibes.options.relaxation',
};

const formatDuration = (minutes: number | undefined): string => {
  if (minutes === undefined) return '—';
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours === 0) return `${remainder}m`;
  return remainder === 0 ? `${hours}h` : `${hours}h ${remainder}m`;
};

const formatDate = (value: string, locale: string): string => {
  const parsed = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed)) return value;
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(parsed));
};

const chapterDayLabel = (chapter: JourneyOverviewChapter): string => {
  const start = Math.round(chapter.startDay) + 1;
  const end = start + Math.max(0, chapter.nights - 1);
  return start === end ? `${start}` : `${start}–${end}`;
};

const selectedChapter = (
  model: JourneyOverviewModel,
  selectedChapterId: string,
): JourneyOverviewChapter => model.chapters.find((chapter) => chapter.id === selectedChapterId)
  ?? model.chapters[0]!;

const selectedLeg = (
  model: JourneyOverviewModel,
  selectedLegId: string | undefined,
): JourneyOverviewLeg | undefined => model.legs.find((leg) => leg.id === selectedLegId);

const chapterName = (model: JourneyOverviewModel, chapterId: string): string => (
  model.chapters.find((chapter) => chapter.id === chapterId)?.title ?? ''
);

const TripSignature: React.FC<{ model: JourneyOverviewModel; compact?: boolean }> = ({
  model,
  compact = false,
}) => {
  const { t, i18n } = useTranslation('createTrip');
  return (
    <header className="journey-signature" data-compact={compact ? 'true' : 'false'}>
      <span className="journey-kicker"><Compass size={15} weight="fill" /> {t('journeyLab.labels.tripExample')}</span>
      <h2>{model.identity.title}</h2>
      <p>
        {formatDate(model.identity.startDate, i18n.language)} — {formatDate(model.identity.endDate, i18n.language)}
        <span aria-hidden="true"> · </span>
        {t('journeyLab.summary.days', { count: model.identity.durationDays })}
      </p>
      {!compact ? (
        <div className="journey-signature__tags" aria-label={t('journeyLab.labels.tripCharacter')}>
          {model.identity.interestTags.slice(0, 4).map((tag) => (
            <span key={tag}>{t(INTEREST_LABEL_KEYS[tag] ?? tag, { defaultValue: humanizeTag(tag) })}</span>
          ))}
        </div>
      ) : null}
    </header>
  );
};

const SummaryStrip: React.FC<{ model: JourneyOverviewModel; compact?: boolean }> = ({
  model,
  compact = false,
}) => {
  const { t } = useTranslation('createTrip');
  const items = [
    { value: model.summary.baseCount, label: t('journeyLab.summary.bases') },
    { value: model.summary.transferCount, label: t('journeyLab.summary.transfers') },
    { value: formatDuration(model.summary.totalTransferMinutes), label: t('journeyLab.summary.transferTime') },
    { value: model.summary.plannedActivityCount, label: t('journeyLab.summary.activities') },
  ];
  return (
    <dl className="journey-summary-strip" data-compact={compact ? 'true' : 'false'}>
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
};

interface RouteCanvasProps extends JourneyOverviewConceptProps {
  surface: string;
  compact?: boolean;
}

const JourneyRouteCanvas: React.FC<RouteCanvasProps> = ({
  model,
  selectedChapterId,
  selectedLegId,
  onSelectChapter,
  onSelectLeg,
  surface,
  compact = false,
}) => {
  const { t } = useTranslation('createTrip');
  const latitudes = model.chapters.map((chapter) => chapter.coordinates?.lat).filter((value): value is number => value !== undefined);
  const minimumLatitude = latitudes.length > 0 ? Math.min(...latitudes) : 0;
  const maximumLatitude = latitudes.length > 0 ? Math.max(...latitudes) : 1;
  const latitudeRange = Math.max(1, maximumLatitude - minimumLatitude);
  const points = model.chapters.map((chapter, index) => ({
    chapter,
    x: model.chapters.length === 1 ? 360 : 96 + (index * (528 / (model.chapters.length - 1))),
    y: 236 - ((((chapter.coordinates?.lat ?? minimumLatitude) - minimumLatitude) / latitudeRange) * 142),
  }));
  const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');

  return (
    <section className="journey-route-canvas" data-compact={compact ? 'true' : 'false'} aria-label={t('journeyLab.labels.routeOverview')}>
      <div className="journey-route-canvas__texture" aria-hidden="true" />
      <svg viewBox="0 0 720 320" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <path className="journey-route-canvas__shadow-path" d={path} />
        <path className="journey-route-canvas__path" d={path} />
      </svg>
      <div className="journey-route-canvas__nodes" dir="ltr">
        {points.map(({ chapter, x, y }) => (
          <button
            key={chapter.id}
            type="button"
            className={`journey-route-node journey-route-node--${chapterTone(chapter.order)}`}
            data-selected={selectedChapterId === chapter.id && !selectedLegId ? 'true' : 'false'}
            style={{ insetInlineStart: `${(x / 720) * 100}%`, insetBlockStart: `${(y / 320) * 100}%` }}
            onClick={() => onSelectChapter(chapter.id, surface)}
            aria-pressed={selectedChapterId === chapter.id && !selectedLegId}
            aria-label={`${chapter.title}, ${t('journeyLab.chapter.nights', { count: chapter.nights })}`}
            {...getAnalyticsDebugAttributes('journey_lab__chapter--select', {
              chapter: chapter.entity?.canonicalSlug ?? chapter.id,
              surface,
            })}
          >
            <span>{String(chapter.order + 1).padStart(2, '0')}</span>
            <strong dir="auto">{chapter.title}</strong>
            <small dir="auto">{t('journeyLab.chapter.nights', { count: chapter.nights })}</small>
          </button>
        ))}
        {model.legs.map((leg) => {
          const from = points[leg.order];
          const to = points[leg.order + 1];
          if (!from || !to) return null;
          return (
            <button
              key={leg.id}
              type="button"
              className="journey-route-leg"
              data-load={leg.load}
              data-selected={selectedLegId === leg.id ? 'true' : 'false'}
              style={{
                insetInlineStart: `${(((from.x + to.x) / 2) / 720) * 100}%`,
                insetBlockStart: `${(((from.y + to.y) / 2) / 320) * 100}%`,
              }}
              onClick={() => onSelectLeg(leg.id, surface)}
              aria-pressed={selectedLegId === leg.id}
              aria-label={t('journeyLab.transfer.ariaLabel', {
                from: from.chapter.title,
                to: to.chapter.title,
                duration: formatDuration(leg.durationMinutes),
              })}
              {...getAnalyticsDebugAttributes('journey_lab__transfer--select', { leg: leg.id, surface })}
            >
              <Bus size={14} weight="bold" aria-hidden="true" />
              <span>{formatDuration(leg.durationMinutes)}</span>
            </button>
          );
        })}
      </div>
      <span className="journey-route-canvas__caption">{t('journeyLab.labels.focusHint')}</span>
    </section>
  );
};

const TransferBridge: React.FC<{
  model: JourneyOverviewModel;
  leg: JourneyOverviewLeg;
  selected: boolean;
  surface: string;
  onSelect: (legId: string, surface: string) => void;
}> = ({ model, leg, selected, surface, onSelect }) => {
  const { t } = useTranslation('createTrip');
  return (
    <button
      type="button"
      className="journey-transfer-bridge"
      data-load={leg.load}
      data-selected={selected ? 'true' : 'false'}
      onClick={() => onSelect(leg.id, surface)}
      aria-pressed={selected}
      {...getAnalyticsDebugAttributes('journey_lab__transfer--select', { leg: leg.id, surface })}
    >
      <span className="journey-transfer-bridge__line" aria-hidden="true" />
      <span className="journey-transfer-bridge__content">
        <Bus size={16} weight="duotone" aria-hidden="true" />
        <span>{chapterName(model, leg.fromChapterId)} → {chapterName(model, leg.toChapterId)}</span>
        <strong>{formatDuration(leg.durationMinutes)}</strong>
        <small>{t(`journeyLab.transfer.${leg.load}`)}</small>
      </span>
    </button>
  );
};

const ChapterDetails: React.FC<{ chapter: JourneyOverviewChapter; condensed?: boolean }> = ({
  chapter,
  condensed = false,
}) => {
  const { t } = useTranslation('createTrip');
  const topSignal = chapter.audienceSignals.slice().sort((left, right) => right.relevance - left.relevance)[0];
  return (
    <div className="journey-chapter-details" data-condensed={condensed ? 'true' : 'false'}>
      <div className="journey-chapter-details__headline">
        <span>{t('journeyLab.labels.chapter')} {String(chapter.order + 1).padStart(2, '0')}</span>
        <h3>{chapter.title}</h3>
        <p>
          {t('journeyLab.chapter.days', { range: chapterDayLabel(chapter) })}
          <span aria-hidden="true"> · </span>
          {t('journeyLab.chapter.nights', { count: chapter.nights })}
        </p>
      </div>
      {topSignal ? (
        <p className="journey-fit-signal">
          <Sparkle size={15} weight="fill" aria-hidden="true" />
          <span>{t(
            `shapeLab.reveal.brief.audienceSignals.${topSignal.tagKey}`,
            { defaultValue: humanizeTag(topSignal.tagKey) },
          )}</span>
          <strong>{Math.round(topSignal.relevance * 100)}%</strong>
        </p>
      ) : null}
      <div className="journey-chapter-details__columns">
        <section>
          <h4><MapPin size={15} weight="fill" /> {t('journeyLab.labels.neighborhoods')}</h4>
          <ul>
            {chapter.neighborhoods.slice(0, condensed ? 2 : 3).map((item) => (
              <li key={item.id}>{item.title}{item.selectedByTraveler ? <Sparkle size={12} weight="fill" /> : null}</li>
            ))}
            {chapter.neighborhoods.length === 0 ? <li>{t('journeyLab.empty.neighborhoods')}</li> : null}
          </ul>
        </section>
        <section>
          <h4><ForkKnife size={15} weight="fill" /> {t('journeyLab.labels.dishes')}</h4>
          <ul>
            {chapter.signatureDishes.slice(0, condensed ? 2 : 3).map((dish) => <li key={dish}>{dish}</li>)}
            {chapter.signatureDishes.length === 0 ? <li>{t('journeyLab.empty.dishes')}</li> : null}
          </ul>
        </section>
        {!condensed ? (
          <section>
            <h4><Mountains size={15} weight="fill" /> {t('journeyLab.labels.activities')}</h4>
            <ul>
              {chapter.activities.slice(0, 4).map((activity) => (
                <li key={activity.id} data-recommended={activity.kind === 'recommended' ? 'true' : 'false'}>
                  {activity.title}
                </li>
              ))}
              {chapter.activities.length === 0 ? <li>{t('journeyLab.empty.activities')}</li> : null}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
};

const LegDetails: React.FC<{ model: JourneyOverviewModel; leg: JourneyOverviewLeg }> = ({ model, leg }) => {
  const { t } = useTranslation('createTrip');
  return (
    <div className="journey-leg-details">
      <span>{t('journeyLab.labels.transfer')}</span>
      <h3>{chapterName(model, leg.fromChapterId)} <ArrowRight size={22} /> {chapterName(model, leg.toChapterId)}</h3>
      <dl>
        <div><dt>{t('journeyLab.transfer.duration')}</dt><dd>{formatDuration(leg.durationMinutes)}</dd></div>
        <div><dt>{t('journeyLab.transfer.distance')}</dt><dd>{leg.distanceKm ? `${Math.round(leg.distanceKm)} km` : '—'}</dd></div>
        <div><dt>{t('journeyLab.transfer.load')}</dt><dd>{t(`journeyLab.transfer.${leg.load}`)}</dd></div>
      </dl>
      {leg.exceedsTolerance ? (
        <p className="journey-leg-details__warning"><Warning size={17} weight="fill" /> {t('journeyLab.transfer.toleranceWarning')}</p>
      ) : null}
    </div>
  );
};

export const JourneyLensConcept: React.FC<JourneyOverviewConceptProps> = (props) => {
  const { model, selectedChapterId, selectedLegId, onSelectChapter, onSelectLeg } = props;
  const { t } = useTranslation('createTrip');
  const activeChapter = selectedChapter(model, selectedChapterId);
  const activeLeg = selectedLeg(model, selectedLegId);
  return (
    <div className="journey-concept journey-concept--lens" data-testid="journey-concept-lens">
      <aside className="journey-lens-rail">
        <TripSignature model={model} />
        <SummaryStrip model={model} compact />
        <div className="journey-ribbon" aria-label={t('journeyLab.labels.chapters')}>
          {model.chapters.map((chapter, index) => (
            <React.Fragment key={chapter.id}>
              {index > 0 && model.legs[index - 1] ? (
                <TransferBridge
                  model={model}
                  leg={model.legs[index - 1]!}
                  selected={selectedLegId === model.legs[index - 1]!.id}
                  surface="lens_ribbon"
                  onSelect={onSelectLeg}
                />
              ) : null}
              <button
                type="button"
                className={`journey-ribbon-chapter journey-ribbon-chapter--${chapterTone(chapter.order)}`}
                data-selected={selectedChapterId === chapter.id && !selectedLegId ? 'true' : 'false'}
                onClick={() => onSelectChapter(chapter.id, 'lens_ribbon')}
                aria-pressed={selectedChapterId === chapter.id && !selectedLegId}
                {...getAnalyticsDebugAttributes('journey_lab__chapter--select', {
                  chapter: chapter.entity?.canonicalSlug ?? chapter.id,
                  surface: 'lens_ribbon',
                })}
              >
                <span>{String(chapter.order + 1).padStart(2, '0')}</span>
                <strong>{chapter.title}</strong>
                <small>{t('journeyLab.chapter.nights', { count: chapter.nights })}</small>
              </button>
            </React.Fragment>
          ))}
        </div>
      </aside>
      <div className="journey-lens-canvas">
        <JourneyRouteCanvas {...props} surface="lens_canvas" />
        <section className={`journey-focus-sheet journey-focus-sheet--${chapterTone(activeChapter.order)}`} aria-live="polite">
          {activeLeg ? <LegDetails model={model} leg={activeLeg} /> : <ChapterDetails chapter={activeChapter} />}
        </section>
      </div>
    </div>
  );
};

export const JourneyStoryboardConcept: React.FC<JourneyOverviewConceptProps> = (props) => {
  const { model, selectedChapterId, selectedLegId, onSelectChapter, onSelectLeg } = props;
  const { t } = useTranslation('createTrip');
  return (
    <div className="journey-concept journey-concept--storyboard" data-testid="journey-concept-storyboard">
      <div className="journey-storyboard__map">
        <TripSignature model={model} compact />
        <JourneyRouteCanvas {...props} surface="storyboard_canvas" compact />
        <SummaryStrip model={model} />
      </div>
      <div className="journey-storyboard__chapters">
        <span className="journey-section-label">{t('journeyLab.labels.routeStory')}</span>
        {model.chapters.map((chapter, index) => (
          <React.Fragment key={chapter.id}>
            {index > 0 && model.legs[index - 1] ? (
              <TransferBridge
                model={model}
                leg={model.legs[index - 1]!}
                selected={selectedLegId === model.legs[index - 1]!.id}
                surface="storyboard_spine"
                onSelect={onSelectLeg}
              />
            ) : null}
            <article
              className={`journey-story-chapter journey-story-chapter--${chapterTone(chapter.order)}`}
              data-selected={selectedChapterId === chapter.id && !selectedLegId ? 'true' : 'false'}
            >
              <button
                type="button"
                className="journey-story-chapter__select"
                onClick={() => onSelectChapter(chapter.id, 'storyboard_chapter')}
                aria-pressed={selectedChapterId === chapter.id && !selectedLegId}
                aria-label={`${chapter.title}, ${t('journeyLab.chapter.nights', { count: chapter.nights })}`}
                {...getAnalyticsDebugAttributes('journey_lab__chapter--select', {
                  chapter: chapter.entity?.canonicalSlug ?? chapter.id,
                  surface: 'storyboard_chapter',
                })}
              />
              <ChapterDetails chapter={chapter} condensed={selectedChapterId !== chapter.id || Boolean(selectedLegId)} />
            </article>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export const JourneyInspectorConcept: React.FC<JourneyOverviewConceptProps> = (props) => {
  const { model, selectedChapterId, selectedLegId, onSelectChapter, onSelectLeg } = props;
  const { t } = useTranslation('createTrip');
  const activeChapter = selectedChapter(model, selectedChapterId);
  const activeLeg = selectedLeg(model, selectedLegId);
  return (
    <div className="journey-concept journey-concept--inspector" data-testid="journey-concept-inspector">
      <nav className="journey-index" aria-label={t('journeyLab.labels.compactIndex')}>
        <Compass size={22} weight="duotone" aria-hidden="true" />
        {model.chapters.map((chapter) => (
          <button
            key={chapter.id}
            type="button"
            className={`journey-index__chapter journey-index__chapter--${chapterTone(chapter.order)}`}
            data-selected={selectedChapterId === chapter.id && !selectedLegId ? 'true' : 'false'}
            onClick={() => onSelectChapter(chapter.id, 'inspector_index')}
            aria-label={chapter.title}
            aria-pressed={selectedChapterId === chapter.id && !selectedLegId}
            {...getAnalyticsDebugAttributes('journey_lab__chapter--select', {
              chapter: chapter.entity?.canonicalSlug ?? chapter.id,
              surface: 'inspector_index',
            })}
          >
            {String(chapter.order + 1).padStart(2, '0')}
          </button>
        ))}
      </nav>
      <div className="journey-inspector__canvas">
        <TripSignature model={model} compact />
        <JourneyRouteCanvas {...props} surface="inspector_canvas" />
        <SummaryStrip model={model} />
      </div>
      <aside className={`journey-inspector-panel journey-inspector-panel--${chapterTone(activeChapter.order)}`} aria-live="polite">
        <span className="journey-section-label">{t('journeyLab.labels.selected')}</span>
        {activeLeg ? <LegDetails model={model} leg={activeLeg} /> : <ChapterDetails chapter={activeChapter} />}
        {!activeLeg && model.legs[activeChapter.order] ? (
          <TransferBridge
            model={model}
            leg={model.legs[activeChapter.order]!}
            selected={false}
            surface="inspector_panel"
            onSelect={onSelectLeg}
          />
        ) : null}
      </aside>
    </div>
  );
};
