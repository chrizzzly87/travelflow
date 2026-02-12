import React from 'react';
import { useTranslation } from 'react-i18next';
import { MarketingLayout } from '../components/marketing/MarketingLayout';

export const ImprintPage: React.FC = () => {
    const { t } = useTranslation('legal');

    return (
        <MarketingLayout>
            <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
                <h1 className="text-3xl font-black tracking-tight text-slate-900 md:text-4xl">{t('imprint.title')}</h1>
                <p className="mt-4 text-sm leading-6 text-slate-600">
                    {t('imprint.intro')}
                </p>
                <div className="mt-6 space-y-4 text-sm text-slate-700">
                    <p><strong>{t('imprint.company')}</strong> {t('imprint.companyValue')}</p>
                    <p><strong>{t('imprint.address')}</strong> {t('imprint.addressValue')}</p>
                    <p><strong>{t('imprint.email')}</strong> {t('imprint.emailValue')}</p>
                    <p><strong>{t('imprint.responsible')}</strong> {t('imprint.responsibleValue')}</p>
                    <p><strong>{t('imprint.vat')}</strong> {t('imprint.vatValue')}</p>
                </div>
            </section>
        </MarketingLayout>
    );
};
