import React from 'react';
import {
  ArrowSquareOut,
  CalendarBlank,
  Check,
  ForkKnife,
  MapPin,
  Sparkle,
  UsersThree,
} from '@phosphor-icons/react';
import type {
  JourneyAudienceSignalTag,
  JourneyDestinationBrief,
} from '../../shared/journeyDestinationBrief';

export interface JourneyDestinationBriefPreviewLabels {
  title: string;
  description: string;
  bestMonths: string;
  dishes: string;
  neighborhoods: string;
  activities: string;
  stayRange: (min: number, max: number) => string;
  source: string;
  selected: string;
  audienceContext: string;
  audienceSignals: Record<JourneyAudienceSignalTag, string>;
}

interface JourneyDestinationBriefPreviewProps {
  briefs: JourneyDestinationBrief[];
  monthLabels: string[];
  labels: JourneyDestinationBriefPreviewLabels;
  showDatasetNarrative?: boolean;
  onSourceOpen?: (brief: JourneyDestinationBrief, sourceUrl: string) => void;
  getSourceDebugAttributes?: (brief: JourneyDestinationBrief) => Record<string, string>;
}

const joinList = (values: string[]): string => values.join(' · ');

export const JourneyDestinationBriefPreview: React.FC<JourneyDestinationBriefPreviewProps> = ({
  briefs,
  monthLabels,
  labels,
  showDatasetNarrative = true,
  onSourceOpen,
  getSourceDebugAttributes,
}) => {
  if (briefs.length === 0) return null;

  return (
    <section className="shape-brief-preview" aria-labelledby="shape-brief-preview-title">
      <header className="shape-brief-preview__header">
        <span><Sparkle size={16} weight="fill" aria-hidden="true" /></span>
        <div>
          <h3 id="shape-brief-preview-title">{labels.title}</h3>
          <p>{labels.description}</p>
        </div>
      </header>

      <div className="shape-brief-preview__grid">
        {briefs.map((brief, index) => {
          const sourceUrl = brief.summary?.support.sourceUrl;
          const bestMonths = brief.bestMonths?.value
            .map((month) => monthLabels[month - 1])
            .filter((label): label is string => Boolean(label));
          return (
            <article
              key={brief.city.entityId ?? brief.city.canonicalSlug}
              className={`shape-brief-card shape-brief-card--tone-${(index % 3) + 1}`}
            >
              <header>
                <div>
                  <MapPin size={18} weight="fill" aria-hidden="true" />
                  <h4>{brief.city.name}</h4>
                </div>
                {brief.recommendedStay ? (
                  <span>{labels.stayRange(
                    brief.recommendedStay.value.min,
                    brief.recommendedStay.value.max,
                  )}</span>
                ) : null}
              </header>

              {showDatasetNarrative && brief.summary ? (
                <p className="shape-brief-card__summary">{brief.summary.value}</p>
              ) : null}

              <dl className="shape-brief-card__facts">
                {bestMonths && bestMonths.length > 0 ? (
                  <div>
                    <dt><CalendarBlank size={16} weight="duotone" aria-hidden="true" /> {labels.bestMonths}</dt>
                    <dd>{joinList(bestMonths)}</dd>
                  </div>
                ) : null}
                {brief.signatureDishes && brief.signatureDishes.value.length > 0 ? (
                  <div>
                    <dt><ForkKnife size={16} weight="duotone" aria-hidden="true" /> {labels.dishes}</dt>
                    <dd>{joinList(brief.signatureDishes.value)}</dd>
                  </div>
                ) : null}
              </dl>

              {brief.neighborhoods.length > 0 ? (
                <div className="shape-brief-card__cluster">
                  <strong>{labels.neighborhoods}</strong>
                  <div>
                    {brief.neighborhoods.slice(0, 4).map((neighborhood) => (
                      <span
                        key={neighborhood.entity.entityId ?? neighborhood.entity.canonicalSlug}
                        data-selected={neighborhood.selectedByTraveler ? 'true' : 'false'}
                        title={neighborhood.selectedByTraveler ? labels.selected : undefined}
                      >
                        {neighborhood.selectedByTraveler ? <Check size={12} weight="bold" aria-hidden="true" /> : null}
                        {neighborhood.entity.name}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              {brief.activities.length > 0 ? (
                <div className="shape-brief-card__cluster">
                  <strong>{labels.activities}</strong>
                  <div>
                    {brief.activities.slice(0, 4).map((activity) => (
                      <span key={activity.entity.entityId ?? activity.entity.canonicalSlug}>
                        {activity.entity.name}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              {brief.audienceSignals.length > 0 ? (
                <details className="shape-brief-card__audience">
                  <summary><UsersThree size={16} weight="duotone" aria-hidden="true" /> {labels.audienceContext}</summary>
                  <div>
                    {brief.audienceSignals.map((signal) => (
                      <p key={`${signal.tagKey}:${signal.sourceKey}`}>
                        <strong>{labels.audienceSignals[signal.tagKey]}</strong>
                        {showDatasetNarrative && signal.evidenceNote ? <span>{signal.evidenceNote}</span> : null}
                        {signal.sourceUrl ? (
                          <a
                            href={signal.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            onClick={() => onSourceOpen?.(brief, signal.sourceUrl!)}
                            {...getSourceDebugAttributes?.(brief)}
                          >
                            {labels.source}
                            <ArrowSquareOut size={12} weight="bold" aria-hidden="true" />
                          </a>
                        ) : null}
                      </p>
                    ))}
                  </div>
                </details>
              ) : null}

              {sourceUrl ? (
                <a
                  className="shape-brief-card__source"
                  href={sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => onSourceOpen?.(brief, sourceUrl)}
                  {...getSourceDebugAttributes?.(brief)}
                >
                  {labels.source}
                  <ArrowSquareOut size={14} weight="bold" aria-hidden="true" />
                </a>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
};
