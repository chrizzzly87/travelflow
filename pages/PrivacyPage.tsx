import React from 'react';
import { useTranslation } from 'react-i18next';
import { MarketingLayout } from '../components/marketing/MarketingLayout';

export const PrivacyPage: React.FC = () => {
    const { t } = useTranslation('legal');
    const items = t('privacy.items', { returnObjects: true }) as string[];

    return (
        <MarketingLayout>
            <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
                <h1 className="text-3xl font-black tracking-tight text-slate-900 md:text-4xl">{t('privacy.title')}</h1>
                <p className="mt-4 text-sm leading-6 text-slate-600">
                    {t('privacy.intro')}
                </p>
                <ul className="mt-6 list-disc space-y-2 pl-5 text-sm text-slate-700">
                    {items.map((item, index) => (
                        <li key={`${index}-${item}`}>{item}</li>
                    ))}
                </ul>
            </section>
        </MarketingLayout>
    );
};
