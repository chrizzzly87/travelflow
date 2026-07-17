import React from 'react';
import { ExternalLink, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';
import type {
  TravelActivityAudienceFit,
  TravelActivityKnowledge,
  TravelKnowledgeSupport,
} from '../../shared/travelActivityKnowledge';

interface ActivityKnowledgeCardProps {
  knowledge: TravelActivityKnowledge;
}

const formatMinutes = (min: number, max: number): string => (
  min === max ? `${min} min` : `${min}–${max} min`
);

const supportRows = (knowledge: TravelActivityKnowledge): TravelKnowledgeSupport[] => {
  const supported = [
    knowledge.summary,
    knowledge.recommendedDuration,
    knowledge.bestTime,
    knowledge.openingHours,
    knowledge.admission,
    knowledge.booking,
    knowledge.dressCode,
    knowledge.accessibility,
    knowledge.practicalNotes,
    ...knowledge.audience,
  ].flatMap((field) => field ? [field.support] : []);
  return Array.from(new Map(supported.map((support) => [
    `${support.sourceKey}:${support.sourceUrl ?? ''}`,
    support,
  ])).values());
};

const joinSchedule = (knowledge: TravelActivityKnowledge): string | undefined => {
  const openingHours = knowledge.openingHours?.value;
  if (!openingHours) return undefined;
  return openingHours.schedule.map((entry) => (
    `${entry.days.join(', ')} · ${entry.opens}–${entry.closes}`
  )).join(' · ');
};

const admissionText = (knowledge: TravelActivityKnowledge, freeLabel: string): string | undefined => {
  const admission = knowledge.admission?.value;
  if (!admission) return undefined;
  if (admission.free) return freeLabel;
  if (admission.adultForeign !== undefined) {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: admission.currency,
      maximumFractionDigits: 0,
    }).format(admission.adultForeign);
  }
  return admission.currency;
};

const audienceKey = (audience: TravelActivityAudienceFit['audience']): string => (
  `tripActivityKnowledge.audienceLabels.${audience}`
);

export const ActivityKnowledgeCard: React.FC<ActivityKnowledgeCardProps> = ({ knowledge }) => {
  const { t, i18n } = useTranslation('common');
  const sources = supportRows(knowledge);
  const openingHours = joinSchedule(knowledge);
  const admission = admissionText(knowledge, t('tripActivityKnowledge.free'));
  const freshnessDate = knowledge.freshness.earliestValidUntil
    ? new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' })
      .format(new Date(knowledge.freshness.earliestValidUntil))
    : undefined;

  return (
    <section className="border border-slate-200 bg-white p-5" aria-labelledby="activity-knowledge-title">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
            <ShieldCheck size={17} aria-hidden="true" />
          </span>
          <div>
            <h3 id="activity-knowledge-title" className="text-sm font-semibold text-slate-900">
              {t('tripActivityKnowledge.title')}
            </h3>
            <p className="mt-0.5 text-xs leading-5 text-slate-500">
              {t('tripActivityKnowledge.description')}
            </p>
          </div>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
          knowledge.freshness.status === 'expired'
            ? 'bg-amber-50 text-amber-800'
            : knowledge.freshness.status === 'current'
              ? 'bg-emerald-50 text-emerald-800'
              : 'bg-slate-100 text-slate-600'
        }`}>
          {knowledge.freshness.status === 'current' && freshnessDate
            ? t('tripActivityKnowledge.currentUntil', { date: freshnessDate })
            : t(`tripActivityKnowledge.freshness.${knowledge.freshness.status}`)}
        </span>
      </div>

      <dl className="grid gap-x-5 gap-y-4 py-4 sm:grid-cols-2">
        {knowledge.recommendedDuration ? (
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{t('tripActivityKnowledge.duration')}</dt>
            <dd className="mt-1 text-sm font-medium text-slate-800">
              {formatMinutes(knowledge.recommendedDuration.value.min, knowledge.recommendedDuration.value.max)}
            </dd>
          </div>
        ) : null}
        {knowledge.bestTime ? (
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{t('tripActivityKnowledge.bestTime')}</dt>
            <dd className="mt-1 text-sm font-medium text-slate-800">{knowledge.bestTime.value.join(' · ')}</dd>
          </div>
        ) : null}
        {openingHours ? (
          <div className="sm:col-span-2">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{t('tripActivityKnowledge.hours')}</dt>
            <dd className="mt-1 text-sm font-medium text-slate-800">
              {openingHours}
              {knowledge.openingHours?.value.lastEntry
                ? ` · ${t('tripActivityKnowledge.lastEntry', { time: knowledge.openingHours.value.lastEntry })}`
                : ''}
            </dd>
          </div>
        ) : null}
        {admission ? (
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{t('tripActivityKnowledge.admission')}</dt>
            <dd className="mt-1 text-sm font-medium text-slate-800">{admission}</dd>
          </div>
        ) : null}
        {knowledge.booking ? (
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{t('tripActivityKnowledge.booking')}</dt>
            <dd className="mt-1 text-sm font-medium text-slate-800">
              {t(`tripActivityKnowledge.bookingModes.${knowledge.booking.value.mode}`)}
            </dd>
          </div>
        ) : null}
      </dl>

      {knowledge.audience.length > 0 ? (
        <div className="border-t border-slate-100 py-4">
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{t('tripActivityKnowledge.audience')}</h4>
          <div className="mt-2 flex flex-wrap gap-2">
            {knowledge.audience.map(({ value }) => (
              <span key={value.audience} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700">
                <strong>{t(audienceKey(value.audience))}</strong>
                {' · '}
                {t(`tripActivityKnowledge.fitLabels.${value.fit}`)}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {knowledge.dressCode || knowledge.accessibility || knowledge.practicalNotes ? (
        <div className="grid gap-4 border-t border-slate-100 py-4 sm:grid-cols-2">
          {knowledge.dressCode ? (
            <div>
              <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{t('tripActivityKnowledge.dressCode')}</h4>
              <p className="mt-1 text-xs leading-5 text-slate-700">{knowledge.dressCode.value.join(' · ')}</p>
            </div>
          ) : null}
          {knowledge.accessibility ? (
            <div>
              <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{t('tripActivityKnowledge.accessibility')}</h4>
              <p className="mt-1 text-xs leading-5 text-slate-700">{knowledge.accessibility.value.join(' · ')}</p>
            </div>
          ) : null}
          {knowledge.practicalNotes ? (
            <div className="sm:col-span-2">
              <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{t('tripActivityKnowledge.practicalNotes')}</h4>
              <ul className="mt-1 space-y-1 text-xs leading-5 text-slate-700">
                {knowledge.practicalNotes.value.map((note) => <li key={note}>— {note}</li>)}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      <footer className="border-t border-slate-100 pt-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{t('tripActivityKnowledge.sources')}</span>
          {sources.map((source) => source.sourceUrl ? (
            <a
              key={`${source.sourceKey}:${source.sourceUrl}`}
              href={source.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-accent-700 hover:text-accent-900"
              onClick={() => trackEvent('trip_view__knowledge_source--open', {
                entity: knowledge.entity.canonicalSlug,
                source_key: source.sourceKey,
              })}
              {...getAnalyticsDebugAttributes('trip_view__knowledge_source--open', {
                entity: knowledge.entity.canonicalSlug,
                source_key: source.sourceKey,
              })}
            >
              {source.sourceKey.replaceAll('_', ' ')} <ExternalLink size={11} aria-hidden="true" />
            </a>
          ) : (
            <span key={source.sourceKey} className="text-xs text-slate-600">{source.sourceKey.replaceAll('_', ' ')}</span>
          ))}
        </div>
        {(knowledge.openingHours?.value.checkBeforeVisit || knowledge.admission?.value.checkBeforeVisit) ? (
          <p className="mt-2 text-[11px] leading-5 text-slate-500">{t('tripActivityKnowledge.verifyLive')}</p>
        ) : null}
      </footer>
    </section>
  );
};
