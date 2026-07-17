import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Bus,
  Compass,
  ForkKnife,
  MapPin,
  Mountains,
  Sparkle,
  Warning,
  X,
} from '@phosphor-icons/react';

import type { ITrip } from '../../types';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';
import {
  buildJourneyOverviewModel,
  type JourneyOverviewChapter,
  type JourneyOverviewLeg,
  type JourneyOverviewModel,
} from '../../services/journeyOverviewService';
import '../../styles/trip-journey-overview.css';

interface TripJourneyOverviewRailProps {
  trip: ITrip;
  selectedItemId: string | null;
  onSelectItem: (itemId: string, isCity: boolean) => void;
}

type ChapterTone = 'mango' | 'lagoon' | 'hibiscus' | 'orchid';

const CHAPTER_TONES: readonly ChapterTone[] = ['mango', 'lagoon', 'hibiscus', 'orchid'];

const chapterTone = (order: number): ChapterTone => CHAPTER_TONES[order % CHAPTER_TONES.length]!;

const humanizeTag = (tag: string): string => tag
  .replaceAll('_', ' ')
  .replace(/\b\w/g, (letter) => letter.toUpperCase());

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

const chapterName = (model: JourneyOverviewModel, chapterId: string): string => (
  model.chapters.find((chapter) => chapter.id === chapterId)?.title ?? ''
);

const resolveSelectedChapter = (
  model: JourneyOverviewModel,
  selectedItemId: string | null,
  selectedLeg: JourneyOverviewLeg | undefined,
): JourneyOverviewChapter => {
  const directChapter = model.chapters.find((chapter) => chapter.sourceItemId === selectedItemId);
  if (directChapter) return directChapter;

  const activityChapter = model.chapters.find((chapter) => (
    chapter.activities.some((activity) => activity.sourceItemId === selectedItemId)
  ));
  if (activityChapter) return activityChapter;

  if (selectedLeg) {
    const originChapter = model.chapters.find((chapter) => chapter.id === selectedLeg.fromChapterId);
    if (originChapter) return originChapter;
  }

  return model.chapters[0]!;
};

const JourneySummary: React.FC<{ model: JourneyOverviewModel }> = ({ model }) => {
  const { t } = useTranslation('createTrip');
  return (
    <dl className="tf-trip-journey-summary">
      <div><dt>{t('journeyLab.summary.bases')}</dt><dd>{model.summary.baseCount}</dd></div>
      <div><dt>{t('journeyLab.summary.transfers')}</dt><dd>{model.summary.transferCount}</dd></div>
      <div><dt>{t('journeyLab.summary.transferTime')}</dt><dd>{formatDuration(model.summary.totalTransferMinutes)}</dd></div>
    </dl>
  );
};

interface JourneyRouteListProps {
  model: JourneyOverviewModel;
  selectedChapterId: string;
  selectedLegId?: string;
  surface: string;
  onSelectChapter: (chapter: JourneyOverviewChapter, surface: string) => void;
  onSelectLeg: (leg: JourneyOverviewLeg, surface: string) => void;
}

const JourneyRouteList: React.FC<JourneyRouteListProps> = ({
  model,
  selectedChapterId,
  selectedLegId,
  surface,
  onSelectChapter,
  onSelectLeg,
}) => {
  const { t } = useTranslation('createTrip');
  return (
    <ol className="tf-trip-journey-route" aria-label={t('journeyLab.labels.chapters')}>
      {model.chapters.map((chapter, index) => {
        const incomingLeg = index > 0 ? model.legs[index - 1] : undefined;
        return (
          <React.Fragment key={chapter.id}>
            {incomingLeg ? (
              <li className="tf-trip-journey-route__transfer">
                <button
                  type="button"
                  data-selected={selectedLegId === incomingLeg.id ? 'true' : 'false'}
                  data-load={incomingLeg.load}
                  disabled={!incomingLeg.sourceItemId}
                  onClick={() => onSelectLeg(incomingLeg, surface)}
                  aria-pressed={selectedLegId === incomingLeg.id}
                  aria-label={t('journeyLab.transfer.ariaLabel', {
                    from: chapterName(model, incomingLeg.fromChapterId),
                    to: chapterName(model, incomingLeg.toChapterId),
                    duration: formatDuration(incomingLeg.durationMinutes),
                  })}
                  {...getAnalyticsDebugAttributes('trip_view__journey_overview--transfer_select', {
                    surface,
                    leg: incomingLeg.id,
                  })}
                >
                  <span aria-hidden="true" />
                  <Bus size={15} weight="duotone" aria-hidden="true" />
                  <strong>{formatDuration(incomingLeg.durationMinutes)}</strong>
                  <small>{t(`journeyLab.transfer.${incomingLeg.load}`)}</small>
                </button>
              </li>
            ) : null}
            <li>
              <button
                type="button"
                className="tf-trip-journey-route__chapter"
                data-tone={chapterTone(chapter.order)}
                data-selected={selectedChapterId === chapter.id && !selectedLegId ? 'true' : 'false'}
                onClick={() => onSelectChapter(chapter, surface)}
                aria-pressed={selectedChapterId === chapter.id && !selectedLegId}
                aria-label={`${chapter.title}, ${t('journeyLab.chapter.nights', { count: chapter.nights })}`}
                {...getAnalyticsDebugAttributes('trip_view__journey_overview--chapter_select', {
                  surface,
                  chapter: chapter.entity?.canonicalSlug ?? chapter.id,
                })}
              >
                <span>{String(chapter.order + 1).padStart(2, '0')}</span>
                <strong dir="auto">{chapter.title}</strong>
                <small>{t('journeyLab.chapter.nights', { count: chapter.nights })}</small>
                {chapter.dayTrips.length > 0 ? <em>{chapter.dayTrips.length} ↗</em> : null}
              </button>
            </li>
          </React.Fragment>
        );
      })}
    </ol>
  );
};

const SelectedContext: React.FC<{
  model: JourneyOverviewModel;
  chapter: JourneyOverviewChapter;
  leg?: JourneyOverviewLeg;
}> = ({ model, chapter, leg }) => {
  const { t } = useTranslation('createTrip');
  if (leg) {
    return (
      <section className="tf-trip-journey-context" data-tone={chapterTone(chapter.order)} aria-live="polite">
        <span>{t('journeyLab.labels.transfer')}</span>
        <h3>{chapterName(model, leg.fromChapterId)} → {chapterName(model, leg.toChapterId)}</h3>
        <dl>
          <div><dt>{t('journeyLab.transfer.duration')}</dt><dd>{formatDuration(leg.durationMinutes)}</dd></div>
          <div><dt>{t('journeyLab.transfer.distance')}</dt><dd>{leg.distanceKm ? `${Math.round(leg.distanceKm)} km` : '—'}</dd></div>
        </dl>
        {leg.exceedsTolerance ? (
          <p><Warning size={15} weight="fill" aria-hidden="true" /> {t('journeyLab.transfer.toleranceWarning')}</p>
        ) : null}
      </section>
    );
  }

  const topAudienceSignal = chapter.audienceSignals
    .slice()
    .sort((left, right) => right.relevance - left.relevance)[0];
  return (
    <section className="tf-trip-journey-context" data-tone={chapterTone(chapter.order)} aria-live="polite">
      <span>{t('journeyLab.labels.selected')}</span>
      <h3>{chapter.title}</h3>
      {topAudienceSignal ? (
        <p className="tf-trip-journey-context__fit">
          <Sparkle size={14} weight="fill" aria-hidden="true" />
          {t(`shapeLab.reveal.brief.audienceSignals.${topAudienceSignal.tagKey}`, {
            defaultValue: humanizeTag(topAudienceSignal.tagKey),
          })}
        </p>
      ) : null}
      <div className="tf-trip-journey-context__columns">
        <div>
          <h4><MapPin size={14} weight="fill" /> {t('journeyLab.labels.neighborhoods')}</h4>
          <p>{chapter.neighborhoods.slice(0, 2).map((item) => item.title).join(' · ') || t('journeyLab.empty.neighborhoods')}</p>
        </div>
        <div>
          <h4><ForkKnife size={14} weight="fill" /> {t('journeyLab.labels.dishes')}</h4>
          <p>{chapter.signatureDishes.slice(0, 2).join(' · ') || t('journeyLab.empty.dishes')}</p>
        </div>
        <div>
          <h4><Mountains size={14} weight="fill" /> {t('journeyLab.labels.activities')}</h4>
          <p>{chapter.activities.slice(0, 2).map((item) => item.title).join(' · ') || t('journeyLab.empty.activities')}</p>
        </div>
      </div>
    </section>
  );
};

export const TripJourneyOverviewRail: React.FC<TripJourneyOverviewRailProps> = ({
  trip,
  selectedItemId,
  onSelectItem,
}) => {
  const { t, i18n } = useTranslation('createTrip');
  const dialogTitleId = useId();
  const mobileDialogRef = useRef<HTMLElement | null>(null);
  const mobileCloseRef = useRef<HTMLButtonElement | null>(null);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const model = useMemo(() => buildJourneyOverviewModel(trip), [trip]);
  const selectedLeg = model.legs.find((leg) => leg.sourceItemId === selectedItemId);
  const activeChapter = resolveSelectedChapter(model, selectedItemId, selectedLeg);
  const selectedChapterId = activeChapter.id;

  const closeMobileSheet = useCallback((surface: 'backdrop' | 'close_button' | 'escape') => {
    setIsMobileOpen(false);
    trackEvent('trip_view__journey_overview--toggle', {
      trip_id: trip.id,
      state: 'closed',
      surface,
    });
  }, [trip.id]);

  useFocusTrap({
    isActive: isMobileOpen,
    containerRef: mobileDialogRef,
    initialFocusRef: mobileCloseRef,
  });

  useEffect(() => {
    trackEvent('trip_view__journey_overview--view', {
      trip_id: trip.id,
      model_version: model.version,
      model_source: model.source,
      dataset_version: model.provenance?.datasetVersion,
    });
  }, [model.provenance?.datasetVersion, model.source, model.version, trip.id]);

  useEffect(() => {
    if (!isMobileOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      closeMobileSheet('escape');
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [closeMobileSheet, isMobileOpen]);

  const selectChapter = (chapter: JourneyOverviewChapter, surface: string) => {
    trackEvent('trip_view__journey_overview--chapter_select', {
      trip_id: trip.id,
      surface,
      item_id: chapter.sourceItemId,
      chapter: chapter.entity?.canonicalSlug ?? chapter.id,
    });
    onSelectItem(chapter.sourceItemId, true);
    setIsMobileOpen(false);
  };

  const selectLeg = (leg: JourneyOverviewLeg, surface: string) => {
    if (!leg.sourceItemId) return;
    trackEvent('trip_view__journey_overview--transfer_select', {
      trip_id: trip.id,
      surface,
      item_id: leg.sourceItemId,
      leg: leg.id,
      load: leg.load,
    });
    onSelectItem(leg.sourceItemId, false);
    setIsMobileOpen(false);
  };

  const routeListProps = {
    model,
    selectedChapterId,
    selectedLegId: selectedLeg?.id,
    onSelectChapter: selectChapter,
    onSelectLeg: selectLeg,
  };

  return (
    <div className="tf-trip-journey-rail" data-testid="trip-journey-overview">
      <button
        type="button"
        className="tf-trip-journey-mobile-trigger"
        onClick={() => {
          setIsMobileOpen(true);
          trackEvent('trip_view__journey_overview--toggle', { trip_id: trip.id, state: 'open', surface: 'mobile_trigger' });
        }}
        aria-haspopup="dialog"
        aria-expanded={isMobileOpen}
        {...getAnalyticsDebugAttributes('trip_view__journey_overview--toggle', {
          state: 'open',
          surface: 'mobile_trigger',
        })}
      >
        <Compass size={19} weight="fill" aria-hidden="true" />
        <span><strong>{t('journeyLab.concepts.lens.title')}</strong><small>{activeChapter.title} · {t('journeyLab.chapter.nights', { count: activeChapter.nights })}</small></span>
        <em>{model.summary.baseCount}</em>
      </button>

      <div className="tf-trip-journey-expanded">
        <header>
          <span><Compass size={15} weight="fill" aria-hidden="true" /> {t('journeyLab.concepts.lens.title')}</span>
          <h2>{model.identity.title}</h2>
          <p>{formatDate(model.identity.startDate, i18n.language)} — {formatDate(model.identity.endDate, i18n.language)}</p>
        </header>
        <JourneySummary model={model} />
        <JourneyRouteList {...routeListProps} surface="tripview_expanded" />
        <SelectedContext model={model} chapter={activeChapter} leg={selectedLeg} />
        {model.provenance ? (
          <footer>
            <Sparkle size={13} weight="fill" aria-hidden="true" />
            <span>{t('journeyLab.labels.evidence')}</span>
            <code>{model.provenance.datasetVersion}</code>
          </footer>
        ) : null}
      </div>

      <nav className="tf-trip-journey-compact" aria-label={t('journeyLab.labels.compactIndex')}>
        <Compass size={22} weight="duotone" aria-hidden="true" />
        {model.chapters.map((chapter) => (
          <button
            key={chapter.id}
            type="button"
            data-tone={chapterTone(chapter.order)}
            data-selected={selectedChapterId === chapter.id && !selectedLeg ? 'true' : 'false'}
            onClick={() => selectChapter(chapter, 'tripview_compact')}
            aria-label={chapter.title}
            aria-pressed={selectedChapterId === chapter.id && !selectedLeg}
            {...getAnalyticsDebugAttributes('trip_view__journey_overview--chapter_select', {
              surface: 'tripview_compact',
              chapter: chapter.entity?.canonicalSlug ?? chapter.id,
            })}
          >
            {String(chapter.order + 1).padStart(2, '0')}
          </button>
        ))}
      </nav>

      {isMobileOpen ? (
        <div className="tf-trip-journey-mobile-layer">
          <button
            type="button"
            className="tf-trip-journey-mobile-backdrop"
            onClick={() => closeMobileSheet('backdrop')}
            aria-hidden="true"
            tabIndex={-1}
          />
          <section
            ref={mobileDialogRef}
            className="tf-trip-journey-mobile-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby={dialogTitleId}
          >
            <header>
              <div>
                <span>{t('journeyLab.concepts.lens.title')}</span>
                <h2 id={dialogTitleId}>{model.identity.title}</h2>
              </div>
              <button
                ref={mobileCloseRef}
                type="button"
                onClick={() => closeMobileSheet('close_button')}
                aria-label={t('journeyLab.live.close')}
                {...getAnalyticsDebugAttributes('trip_view__journey_overview--toggle', {
                  state: 'closed',
                  surface: 'mobile_sheet',
                })}
              >
                <X size={20} weight="bold" aria-hidden="true" />
              </button>
            </header>
            <JourneySummary model={model} />
            <JourneyRouteList {...routeListProps} surface="tripview_mobile_sheet" />
            <SelectedContext model={model} chapter={activeChapter} leg={selectedLeg} />
          </section>
        </div>
      ) : null}
    </div>
  );
};
