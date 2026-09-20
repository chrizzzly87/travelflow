import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { WarningCircle } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { MarketingLayout } from '../components/marketing/MarketingLayout';
import { buildLocalizedMarketingPath, extractLocaleFromPath } from '../config/routes';
import { DEFAULT_LOCALE } from '../config/locales';

export const ShareUnavailablePage: React.FC = () => {
    const { t } = useTranslation('pages');
    const location = useLocation();
    const locale = extractLocaleFromPath(location.pathname) ?? DEFAULT_LOCALE;
    const reason = new URLSearchParams(location.search).get('reason');
    const description = reason === 'offline'
        ? t('shareUnavailable.offlineDescription')
        : t('shareUnavailable.description');

    return (
        <MarketingLayout>
            <section className="mx-auto max-w-2xl rounded-3xl border border-border bg-card p-8 shadow-sm">
                <div className="inline-flex size-10 items-center justify-center rounded-md border border-accent-200 bg-accent-50 text-accent-700">
                    <WarningCircle size={20} weight="duotone" />
                </div>
                <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground">{t('shareUnavailable.title')}</h1>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    {description}
                </p>
                <div className="mt-6 flex flex-wrap gap-2">
                    <Link
                        to={buildLocalizedMarketingPath('home', locale)}
                        className="inline-flex h-10 items-center rounded-md border border-accent-200 bg-card px-4 text-sm font-semibold text-accent-700 hover:bg-accent-50"
                    >
                        {t('shareUnavailable.backToHomepage')}
                    </Link>
                    <Link
                        to="/create-trip"
                        className="inline-flex h-10 items-center rounded-md bg-accent-600 px-4 text-sm font-semibold text-white hover:bg-accent-700"
                    >
                        {t('shareUnavailable.createNewTrip')}
                    </Link>
                </div>
            </section>
        </MarketingLayout>
    );
};
