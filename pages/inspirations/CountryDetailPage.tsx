import React, { useMemo } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { ArrowLeft, Globe, ArrowRight } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { MarketingLayout } from '../../components/marketing/MarketingLayout';
import { countryGroups } from '../../data/inspirationsData';
import { buildLocalizedMarketingPath, extractLocaleFromPath } from '../../config/routes';
import { DEFAULT_LOCALE } from '../../config/locales';

export const CountryDetailPage: React.FC = () => {
    const { t } = useTranslation('pages');
    const location = useLocation();
    const locale = extractLocaleFromPath(location.pathname) ?? DEFAULT_LOCALE;
    const inspirationsPath = buildLocalizedMarketingPath('inspirations', locale);
    const { countryName } = useParams<{ countryName: string }>();
    const decoded = countryName ? decodeURIComponent(countryName) : '';

    const country = useMemo(
        () => countryGroups.find((g) => g.country.toLowerCase() === decoded.toLowerCase()),
        [decoded],
    );

    if (!country) {
        return (
            <MarketingLayout>
                <section className="py-20 text-center">
                    <h1
                        className="text-3xl font-black text-slate-900"
                        style={{ fontFamily: "var(--tf-font-heading)" }}
                    >
                        {t('inspirations.subpages.country.notFoundTitle')}
                    </h1>
                    <p className="mt-4 text-slate-500">
                        {t('inspirations.subpages.country.notFoundDescription', { country: decoded })}
                    </p>
                    <Link
                        to={inspirationsPath}
                        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-accent-600 px-6 py-3 text-sm font-bold text-white shadow-lg transition-all hover:bg-accent-700"
                    >
                        <ArrowLeft size={16} weight="bold" />
                        {t('inspirations.subpages.backToInspirations')}
                    </Link>
                </section>
            </MarketingLayout>
        );
    }

    return (
        <MarketingLayout>
            <section className="pt-8 pb-8 md:pt-14 md:pb-12 animate-hero-entrance">
                <Link
                    to={`${inspirationsPath}#countries`}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-accent-700 transition-colors mb-6"
                >
                    <ArrowLeft size={14} weight="bold" />
                    {t('inspirations.subpages.backToInspirations')}
                </Link>
                <span className="flex items-center gap-1.5 rounded-full border border-accent-200 bg-accent-50 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-accent-700 w-fit">
                    <Globe size={14} weight="duotone" />
                    {t('inspirations.subpages.country.pill')}
                </span>
                <h1
                    className="mt-5 text-4xl font-black tracking-tight text-slate-900 md:text-6xl"
                    style={{ fontFamily: "var(--tf-font-heading)" }}
                >
                    {country.flag} {t('inspirations.subpages.country.title', { country: country.country })}
                </h1>
                <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-600">
                    {t('inspirations.subpages.country.description', { country: country.country })}
                </p>
            </section>

            {/* Quick facts */}
            <section className="pb-10 animate-hero-stagger" style={{ '--stagger': '100ms' } as React.CSSProperties}>
                <div className="flex flex-wrap gap-4">
                    <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Best time</p>
                        <p className="mt-1 text-sm font-semibold text-slate-800">{country.bestMonths}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Trip ideas</p>
                        <p className="mt-1 text-sm font-semibold text-slate-800">{country.tripCount} itineraries</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Tags</p>
                        <div className="mt-1 flex flex-wrap gap-1">
                            {country.tags.map((tag) => (
                                <span key={tag} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                                    {tag}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* Placeholder content */}
            <section className="pb-16 md:pb-24 animate-hero-stagger" style={{ '--stagger': '200ms' } as React.CSSProperties}>
                <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
                    <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-900">
                        {t('inspirations.subpages.comingSoon')}
                    </span>
                    <p className="mt-4 text-sm text-slate-500">
                        {t('inspirations.subpages.country.comingSoonDescription', { country: country.country })}
                    </p>
                    <Link
                        to="/create-trip"
                        className="mt-6 inline-flex items-center gap-1.5 rounded-xl bg-accent-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-accent-700"
                    >
                        {t('inspirations.subpages.country.cta', { country: country.country })}
                        <ArrowRight size={14} weight="bold" />
                    </Link>
                </div>
            </section>
        </MarketingLayout>
    );
};
