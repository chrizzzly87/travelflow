import React from 'react';
import { useTranslation } from 'react-i18next';
import { MarketingLayout } from '../components/marketing/MarketingLayout';

// Environment-based legal contact with fallback
const LEGAL_EMAIL = import.meta.env.VITE_LEGAL_EMAIL || 'privacy@example.com';
const LEGAL_NAME = import.meta.env.VITE_LEGAL_NAME || '[Data Controller Name]';

export const PrivacyPage: React.FC = () => {
    const { t } = useTranslation('legal');
    
    const sections = t('privacy.sections', { returnObjects: true }) as Array<{
        title: string;
        content: string[];
    }>;

    return (
        <MarketingLayout>
            <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
                <h1 className="text-3xl font-black tracking-tight text-slate-900 md:text-4xl">
                    {t('privacy.title')}
                </h1>
                
                <p className="mt-4 text-sm leading-6 text-slate-600">
                    {t('privacy.intro')}
                </p>
                
                {/* Data Controller Information (Art. 13 GDPR) */}
                <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
                    <h2 className="font-bold text-slate-900">{t('privacy.controllerTitle')}</h2>
                    <p className="mt-2 text-slate-700">
                        <strong>{t('privacy.controllerLabel')}</strong> {LEGAL_NAME}
                    </p>
                    <p className="mt-1 text-slate-700">
                        <strong>{t('privacy.contactLabel')}</strong>{' '}
                        <a href={`mailto:${LEGAL_EMAIL}`} className="text-accent-600 hover:underline">
                            {LEGAL_EMAIL}
                        </a>
                    </p>
                </div>

                {/* GDPR Sections */}
                <div className="mt-8 space-y-8">
                    {sections.map((section, index) => (
                        <div key={index}>
                            <h2 className="text-lg font-bold text-slate-900">{section.title}</h2>
                            <div className="mt-3 space-y-3 text-sm text-slate-700">
                                {section.content.map((paragraph, pIndex) => (
                                    <p key={pIndex}>{paragraph}</p>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                {/* User Rights (Art. 15-22 GDPR) */}
                <div className="mt-8 rounded-lg border border-accent-200 bg-accent-50 p-4">
                    <h2 className="text-base font-bold text-slate-900">{t('privacy.rightsTitle')}</h2>
                    <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-700">
                        {(t('privacy.rights', { returnObjects: true }) as string[]).map((right, index) => (
                            <li key={index}>{right}</li>
                        ))}
                    </ul>
                    <p className="mt-4 text-xs text-slate-600">
                        {t('privacy.rightsExercise')}{' '}
                        <a href={`mailto:${LEGAL_EMAIL}`} className="text-accent-600 hover:underline">
                            {LEGAL_EMAIL}
                        </a>
                    </p>
                </div>

                {/* Data Protection Authority */}
                <div className="mt-6 text-xs text-slate-600">
                    <strong className="text-slate-900">{t('privacy.authorityTitle')}</strong>
                    <p className="mt-2">{t('privacy.authorityText')}</p>
                </div>

                <p className="mt-8 text-xs text-slate-500">
                    {t('privacy.lastUpdated', { date: new Date().toLocaleDateString() })}
                </p>
            </section>
        </MarketingLayout>
    );
};
