import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import { MarketingLayout } from '../../components/marketing/MarketingLayout';
import { APP_NAME } from '../../config/appGlobals';
import { DEFAULT_LOCALE } from '../../config/locales';
import { LEGAL_PROFILE } from '../../config/legalProfile';
import { buildLocalizedMarketingPath, extractLocaleFromPath } from '../../config/routes';
import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <h2 className="text-xl font-semibold text-slate-900 md:text-2xl">{title}</h2>
        <div className="mt-4 text-sm leading-6 text-slate-700">
            {children}
        </div>
    </section>
);

export const ImprintPage: React.FC = () => {
    const location = useLocation();
    const activeLocale = extractLocaleFromPath(location.pathname) ?? DEFAULT_LOCALE;
    const { t } = useTranslation('legal');
    const { entity, supervision, hosting, dispute } = LEGAL_PROFILE;
    const contactPath = buildLocalizedMarketingPath('contact', activeLocale);
    const shouldShowPhone = Boolean(entity.phone && entity.phone.trim().length > 0);
    const shouldShowVat = Boolean(entity.vatId && entity.vatId.trim().length > 0);
    const shouldShowRegisterCourt = Boolean(entity.registerCourt && entity.registerCourt.trim().length > 0);
    const shouldShowRegisterNumber = Boolean(entity.registerNumber && entity.registerNumber.trim().length > 0);
    const shouldShowSupervisoryAuthority = Boolean(entity.supervisoryAuthority && entity.supervisoryAuthority.trim().length > 0);
    const additionalContactEmails = (entity.additionalContactEmails || [])
        .map((email) => email.trim())
        .filter(Boolean);
    const handleContactFormClick = () => {
        trackEvent('imprint__contact--form');
    };
    const odrDateClause = dispute.odrPlatformDiscontinuedAt
        ? t('imprint.odrDateClauseWithDate', { date: dispute.odrPlatformDiscontinuedAt })
        : '';

    return (
        <MarketingLayout>
            <div className="space-y-6">
                <section className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-6 shadow-sm md:p-10">
                    <p className="text-xs font-semibold uppercase tracking-widest text-accent-600">{t('imprint.heroEyebrow')}</p>
                    <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900 md:text-4xl">
                        {t('imprint.title')}
                    </h1>
                    <p className="mt-4 text-base text-slate-700 md:text-lg">
                        {t('imprint.heroIntro', {
                            appName: APP_NAME,
                            representativeName: entity.representativeName,
                            businessName: entity.businessName,
                        })}
                    </p>
                </section>

                <Section title={t('imprint.providerSectionTitle')}>
                    <dl className="grid gap-4 md:grid-cols-2">
                        <div>
                            <dt className="font-semibold text-slate-900">{t('imprint.providerNameLabel')}</dt>
                            <dd>{entity.representativeName}</dd>
                        </div>
                        <div>
                            <dt className="font-semibold text-slate-900">{t('imprint.businessDesignationLabel')}</dt>
                            <dd translate="no">{entity.businessName}</dd>
                        </div>
                        <div className="md:col-span-2">
                            <dt className="font-semibold text-slate-900">{t('imprint.addressLabel')}</dt>
                            <dd>
                                <address className="not-italic">
                                    {entity.addressLines.map((line) => (
                                        <span key={line} className="block">{line}</span>
                                    ))}
                                </address>
                            </dd>
                        </div>
                        <div>
                            <dt className="font-semibold text-slate-900">{t('imprint.contactLabel')}</dt>
                            <dd className="space-y-1">
                                <div>
                                    <span className="font-semibold text-slate-900">{t('imprint.emailLabel')}</span>{' '}
                                    <a className="text-accent-700 hover:underline" href={`mailto:${entity.contactEmail}`}>
                                        {entity.contactEmail}
                                    </a>
                                </div>
                                {additionalContactEmails.map((email) => (
                                    <div key={email}>
                                        <a className="text-accent-700 hover:underline" href={`mailto:${email}`}>
                                            {email}
                                        </a>
                                    </div>
                                ))}
                                <div>
                                    <span className="font-semibold text-slate-900">{t('imprint.contactFormLabel')}</span>{' '}
                                    <Link
                                        className="text-accent-700 hover:underline"
                                        to={contactPath}
                                        onClick={handleContactFormClick}
                                        {...getAnalyticsDebugAttributes('imprint__contact--form')}
                                    >
                                        {t('imprint.contactFormCta')}
                                    </Link>
                                </div>
                                {shouldShowPhone && (
                                    <div>
                                        <span className="font-semibold text-slate-900">{t('imprint.phoneLabel')}</span>{' '}
                                        <span>{entity.phone}</span>
                                    </div>
                                )}
                            </dd>
                        </div>
                        {shouldShowVat && (
                            <div>
                                <dt className="font-semibold text-slate-900">{t('imprint.vatLabel')}</dt>
                                <dd translate="no">{entity.vatId}</dd>
                            </div>
                        )}
                        {shouldShowRegisterCourt && (
                            <div>
                                <dt className="font-semibold text-slate-900">{t('imprint.registerCourtLabel')}</dt>
                                <dd>{entity.registerCourt}</dd>
                            </div>
                        )}
                        {shouldShowRegisterNumber && (
                            <div>
                                <dt className="font-semibold text-slate-900">{t('imprint.registerNumberLabel')}</dt>
                                <dd>{entity.registerNumber}</dd>
                            </div>
                        )}
                        {shouldShowSupervisoryAuthority && (
                            <div className="md:col-span-2">
                                <dt className="font-semibold text-slate-900">{t('imprint.additionalSupervisoryAuthorityLabel')}</dt>
                                <dd>{entity.supervisoryAuthority}</dd>
                            </div>
                        )}
                    </dl>
                </Section>

                <Section title={t('imprint.contentResponsibleSectionTitle')}>
                    <p className="font-semibold text-slate-900">{entity.responsibleForContent}</p>
                    <div className="mt-2 text-slate-700">
                        <address className="not-italic">
                            {entity.addressLines.map((line) => (
                                <span key={line} className="block">{line}</span>
                            ))}
                        </address>
                    </div>
                </Section>

                <Section title={t('imprint.hostingSectionTitle')}>
                    <p>
                        {t('imprint.hostingBody', {
                            appName: APP_NAME,
                            provider: hosting.provider,
                            dataRegion: hosting.dataRegion,
                        })}
                    </p>
                </Section>

                <Section title={t('imprint.supervisionSectionTitle')}>
                    <p>{t('imprint.supervisionLead')}</p>
                    <p className="mt-2 font-semibold">{supervision.authorityName}</p>
                    <p>
                        {t('imprint.supervisionWebsiteLabel')}{' '}
                        <a className="text-accent-700 hover:underline" href={supervision.authorityWebsite} target="_blank" rel="noreferrer">
                            {supervision.authorityWebsite}
                        </a>
                    </p>
                    <p className="mt-4">
                        {t('imprint.odrDiscontinued', { dateClause: odrDateClause })}
                    </p>
                    <p className="mt-2">
                        {dispute.participatesInConsumerArbitration
                            ? t('imprint.arbitrationParticipates', { appName: APP_NAME })
                            : t('imprint.arbitrationDeclines', { appName: APP_NAME })}
                    </p>
                </Section>

                <Section title={t('imprint.liabilitySectionTitle')}>
                    <p>
                        {t('imprint.liabilityBody')}
                    </p>
                </Section>
            </div>
        </MarketingLayout>
    );
};
