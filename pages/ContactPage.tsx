import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { EnvelopeSimple, WarningCircle, ArrowLeft } from '@phosphor-icons/react';
import { MarketingLayout } from '../components/marketing/MarketingLayout';
import { buildLocalizedMarketingPath, extractLocaleFromPath } from '../config/routes';
import { DEFAULT_LOCALE } from '../config/locales';

export const ContactPage: React.FC = () => {
    const { t } = useTranslation('common');
    const location = useLocation();
    const locale = extractLocaleFromPath(location.pathname) ?? DEFAULT_LOCALE;

    return (
        <MarketingLayout>
            <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
                <h1 className="text-3xl font-black tracking-tight text-slate-900 md:text-4xl">
                    {t('contact.title')}
                </h1>
                <p className="mt-4 text-sm leading-6 text-slate-600">
                    {t('contact.description')}
                </p>

                <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    <div className="flex items-start gap-2">
                        <WarningCircle size={18} weight="duotone" className="mt-0.5 shrink-0 text-amber-700" />
                        <div>
                            <p className="font-semibold">{t('contact.formStatusTitle')}</p>
                            <p className="mt-1 text-amber-800">{t('contact.formStatusBody')}</p>
                        </div>
                    </div>
                </div>

                <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                    <p className="font-semibold text-slate-900">{t('contact.emailLabel')}</p>
                    <a
                        href={`mailto:${t('contact.emailValue')}`}
                        className="mt-2 inline-flex items-center gap-2 font-semibold text-accent-700 hover:text-accent-800"
                    >
                        <EnvelopeSimple size={16} weight="duotone" />
                        {t('contact.emailValue')}
                    </a>
                    <p className="mt-3 text-slate-500">{t('contact.responseNote')}</p>
                </div>

                <Link
                    to={buildLocalizedMarketingPath('home', locale)}
                    className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 transition-colors hover:text-accent-700"
                >
                    <ArrowLeft size={14} weight="bold" />
                    {t('contact.backHome')}
                </Link>
            </section>
        </MarketingLayout>
    );
};
