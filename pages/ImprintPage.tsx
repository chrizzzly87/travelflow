import React from 'react';
import { useTranslation } from 'react-i18next';
import { MarketingLayout } from '../components/marketing/MarketingLayout';

// Environment-based legal data with fallbacks
const LEGAL_DATA = {
    name: import.meta.env.VITE_LEGAL_NAME || '[Name - Please set VITE_LEGAL_NAME]',
    businessName: import.meta.env.VITE_LEGAL_BUSINESS_NAME || null,
    address: import.meta.env.VITE_LEGAL_ADDRESS || '[Address - Please set VITE_LEGAL_ADDRESS]',
    email: import.meta.env.VITE_LEGAL_EMAIL || '[Email - Please set VITE_LEGAL_EMAIL]',
    phone: import.meta.env.VITE_LEGAL_PHONE || null,
    responsible: import.meta.env.VITE_LEGAL_RESPONSIBLE || import.meta.env.VITE_LEGAL_NAME || '[Responsible person - Please set VITE_LEGAL_RESPONSIBLE]',
    vatId: import.meta.env.VITE_LEGAL_VAT_ID || null,
};

// Log warning in development if env vars are missing
if (import.meta.env.DEV) {
    const missing = Object.entries({
        VITE_LEGAL_NAME: LEGAL_DATA.name,
        VITE_LEGAL_ADDRESS: LEGAL_DATA.address,
        VITE_LEGAL_EMAIL: LEGAL_DATA.email,
        VITE_LEGAL_RESPONSIBLE: LEGAL_DATA.responsible,
    }).filter(([_, value]) => value.includes('Please set'));
    
    if (missing.length > 0) {
        console.warn(
            '[Legal Pages] Missing environment variables:\n' +
            missing.map(([key]) => `  - ${key}`).join('\n') +
            '\nSee .env.example for setup instructions.'
        );
    }
}

export const ImprintPage: React.FC = () => {
    const { t } = useTranslation('legal');
    const displayName = LEGAL_DATA.businessName 
        ? `${LEGAL_DATA.businessName} (operated by ${LEGAL_DATA.name})`
        : LEGAL_DATA.name;

    return (
        <MarketingLayout>
            <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
                <h1 className="text-3xl font-black tracking-tight text-slate-900 md:text-4xl">
                    {t('imprint.title')}
                </h1>
                <p className="mt-4 text-sm leading-6 text-slate-600">
                    {t('imprint.intro')}
                </p>
                
                <div className="mt-6 space-y-4 text-sm text-slate-700">
                    {/* §5 TMG - Required information */}
                    <div>
                        <strong className="text-slate-900">{t('imprint.operator')}</strong>
                        <p>{displayName}</p>
                        {LEGAL_DATA.businessName && (
                            <p className="mt-1 text-xs text-slate-500">{t('imprint.businessType')}</p>
                        )}
                    </div>

                    <div>
                        <strong className="text-slate-900">{t('imprint.address')}</strong>
                        <p className="whitespace-pre-line">{LEGAL_DATA.address}</p>
                    </div>

                    <div>
                        <strong className="text-slate-900">{t('imprint.contact')}</strong>
                        <p>
                            <a href={`mailto:${LEGAL_DATA.email}`} className="text-accent-600 hover:underline">
                                {LEGAL_DATA.email}
                            </a>
                        </p>
                        {LEGAL_DATA.phone && (
                            <p className="mt-1">
                                <a href={`tel:${LEGAL_DATA.phone}`} className="text-accent-600 hover:underline">
                                    {LEGAL_DATA.phone}
                                </a>
                            </p>
                        )}
                    </div>

                    {/* §18 Abs. 2 MStV - Responsible for content */}
                    <div>
                        <strong className="text-slate-900">{t('imprint.responsibleContent')}</strong>
                        <p>{LEGAL_DATA.responsible}</p>
                        <p className="mt-1 text-xs text-slate-500">{t('imprint.responsibleNote')}</p>
                    </div>

                    {/* VAT ID (optional for Kleingewerbe) */}
                    {LEGAL_DATA.vatId && (
                        <div>
                            <strong className="text-slate-900">{t('imprint.vat')}</strong>
                            <p>{LEGAL_DATA.vatId}</p>
                        </div>
                    )}

                    {/* EU Online Dispute Resolution */}
                    <div className="mt-8 rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
                        <strong className="text-slate-900">{t('imprint.euOdrTitle')}</strong>
                        <p className="mt-2">{t('imprint.euOdrText')}</p>
                        <p className="mt-2">
                            <a 
                                href="https://ec.europa.eu/consumers/odr" 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-accent-600 hover:underline"
                            >
                                https://ec.europa.eu/consumers/odr
                            </a>
                        </p>
                    </div>

                    {/* Consumer dispute resolution */}
                    <div className="mt-4 text-xs text-slate-600">
                        <strong className="text-slate-900">{t('imprint.consumerDisputeTitle')}</strong>
                        <p className="mt-2">{t('imprint.consumerDisputeText')}</p>
                    </div>
                </div>
            </section>
        </MarketingLayout>
    );
};
