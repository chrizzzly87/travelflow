import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Confetti, ArrowLeft } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { MarketingLayout } from '../../components/marketing/MarketingLayout';
import { buildLocalizedMarketingPath, extractLocaleFromPath } from '../../config/routes';
import { DEFAULT_LOCALE } from '../../config/locales';

export const FestivalsPage: React.FC = () => {
    const { t } = useTranslation('pages');
    const location = useLocation();
    const locale = extractLocaleFromPath(location.pathname) ?? DEFAULT_LOCALE;

    return (
        <MarketingLayout>
            <section className="pt-8 pb-8 md:pt-14 md:pb-12 animate-hero-entrance">
                <Link
                    to={buildLocalizedMarketingPath('inspirations', locale)}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-accent-700 transition-colors mb-6"
                >
                    <ArrowLeft size={14} weight="bold" />
                    {t('inspirations.subpages.backToInspirations')}
                </Link>
                <span className="flex items-center gap-1.5 rounded-full border border-accent-200 bg-accent-50 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-accent-700 w-fit">
                    <Confetti size={14} weight="duotone" />
                    {t('inspirations.subpages.festivals.pill')}
                </span>
                <h1
                    className="mt-5 text-4xl font-black tracking-tight text-slate-900 md:text-6xl"
                    style={{ fontFamily: "var(--tf-font-heading)" }}
                >
                    {t('inspirations.subpages.festivals.title')}
                </h1>
                <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-600">
                    {t('inspirations.subpages.festivals.description')}
                </p>
            </section>

            <section className="pb-16 md:pb-24">
                <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
                    <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-900">
                        {t('inspirations.subpages.comingSoon')}
                    </span>
                    <p className="mt-4 text-sm text-slate-500">
                        {t('inspirations.subpages.festivals.comingSoonDescription')}
                    </p>
                </div>
            </section>
        </MarketingLayout>
    );
};
