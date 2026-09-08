import { BedDouble, ExternalLink, Route, Star } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { TripAgentHotelOption, TripAgentRouteAlternative } from '../../shared/tripAgent';

const BUDGET_ORDER: Array<'low' | 'medium' | 'high'> = ['low', 'medium', 'high'];

/**
 * Stays from the grounded hotel specialist, as the three budget groups the
 * feature promises rather than a paragraph of prose.
 */
export const TripAgentHotelCards: React.FC<{
    groups: Record<'low' | 'medium' | 'high', TripAgentHotelOption[]>;
}> = ({ groups }) => {
    const { t } = useTranslation('common');
    const filled = BUDGET_ORDER.filter((group) => groups[group]?.length);
    if (filled.length === 0) return null;

    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-3" aria-label={t('tripAgent.staysTitle')}>
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                <BedDouble className="size-3.5" />{t('tripAgent.staysTitle')}
            </p>
            <div className="mt-2 space-y-2">
                {filled.map((group) => (
                    <div key={group}>
                        <p className="text-[11px] font-medium text-slate-600">{t(`tripAgent.budget.${group}`)}</p>
                        <ul className="mt-1 space-y-1">
                            {groups[group].map((option) => (
                                <li key={option.id} className="rounded-lg border border-slate-200 px-2.5 py-1.5">
                                    <div className="flex items-start gap-2">
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-[13px] font-medium text-slate-900">
                                                {option.name}
                                            </span>
                                            {option.address && (
                                                <span className="block truncate text-[11px] text-slate-500">{option.address}</span>
                                            )}
                                            <span className="block truncate text-[11px] text-slate-500">{option.budgetBasis}</span>
                                        </span>
                                        {typeof option.rating === 'number' && (
                                            <span className="flex shrink-0 items-center gap-0.5 text-[11px] text-slate-600">
                                                <Star className="size-3 fill-amber-400 text-amber-400" />
                                                {option.rating.toFixed(1)}
                                            </span>
                                        )}
                                        {option.placeUrl && (
                                            <a
                                                href={option.placeUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="shrink-0 text-slate-400 hover:text-slate-700"
                                                aria-label={t('tripAgent.openInMaps', { name: option.name })}
                                            >
                                                <ExternalLink className="size-3.5" />
                                            </a>
                                        )}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>
            <p className="mt-2 text-[11px] text-slate-500">{t('tripAgent.staysDisclaimer')}</p>
        </section>
    );
};

/** Route alternatives from the grounded route specialist. */
export const TripAgentRouteCards: React.FC<{
    alternatives: TripAgentRouteAlternative[];
    onAsk?: (prompt: string) => void;
}> = ({ alternatives, onAsk }) => {
    const { t } = useTranslation('common');
    if (alternatives.length === 0) return null;

    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-3" aria-label={t('tripAgent.routesTitle')}>
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                <Route className="size-3.5" />{t('tripAgent.routesTitle')}
            </p>
            <ul className="mt-2 space-y-1.5">
                {alternatives.map((alternative) => (
                    <li key={alternative.id} className="rounded-lg border border-slate-200 px-2.5 py-2">
                        <p className="text-[13px] font-medium text-slate-900">{alternative.title}</p>
                        <p className="mt-0.5 text-[11px] leading-4 text-slate-600">{alternative.summary}</p>
                        {(alternative.distanceKm || alternative.durationHours) && (
                            <p className="mt-1 text-[11px] text-slate-500">
                                {[
                                    alternative.distanceKm ? t('tripAgent.routeDistance', { km: Math.round(alternative.distanceKm) }) : null,
                                    alternative.durationHours ? t('tripAgent.routeDuration', { hours: alternative.durationHours.toFixed(1) }) : null,
                                ].filter(Boolean).join(' · ')}
                            </p>
                        )}
                        {onAsk && (
                            <button
                                type="button"
                                onClick={() => onAsk(t('tripAgent.routeAskPrompt', { title: alternative.title }))}
                                className="mt-1.5 text-[11px] font-medium text-accent-700 underline-offset-2 hover:underline"
                            >
                                {t('tripAgent.routeAsk')}
                            </button>
                        )}
                    </li>
                ))}
            </ul>
        </section>
    );
};
