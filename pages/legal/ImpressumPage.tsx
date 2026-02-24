import React from 'react';
import { MarketingLayout } from '../../components/marketing/MarketingLayout';
import { APP_NAME } from '../../config/appGlobals';
import { LEGAL_PROFILE } from '../../config/legalProfile';

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <h2 className="text-xl font-semibold text-slate-900 md:text-2xl">{title}</h2>
        <div className="mt-4 text-sm leading-6 text-slate-700">
            {children}
        </div>
    </section>
);

export const ImprintPage: React.FC = () => {
    const { entity, supervision, hosting, dispute } = LEGAL_PROFILE;
    const shouldShowPhone = Boolean(entity.phone && entity.phone.trim().length > 0);
    const shouldShowVat = Boolean(entity.vatId && entity.vatId.trim().length > 0);
    const shouldShowRegisterCourt = Boolean(entity.registerCourt && entity.registerCourt.trim().length > 0);
    const shouldShowRegisterNumber = Boolean(entity.registerNumber && entity.registerNumber.trim().length > 0);
    const shouldShowSupervisoryAuthority = Boolean(entity.supervisoryAuthority && entity.supervisoryAuthority.trim().length > 0);

    return (
        <MarketingLayout>
            <div className="space-y-6">
                <section className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-6 shadow-sm md:p-10">
                    <p className="text-xs font-semibold uppercase tracking-widest text-accent-600">§5 TMG · §18 Abs. 2 MStV</p>
                    <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900 md:text-4xl">
                        Impressum (Legal Notice)
                    </h1>
                    <p className="mt-4 text-base text-slate-700 md:text-lg">
                        This page provides all mandatory provider and contact information for {APP_NAME} in accordance with
                        German Telemedia Act (Telemediengesetz) and the Interstate Media Treaty (Medienstaatsvertrag).
                        Personal details below are loaded from a dedicated typed legal profile module.
                    </p>
                </section>

                <Section title="Responsible entity / Diensteanbieter">
                    <dl className="grid gap-4 md:grid-cols-2">
                        <div>
                            <dt className="font-semibold text-slate-900">Business name</dt>
                            <dd>{entity.businessName}</dd>
                        </div>
                        <div>
                            <dt className="font-semibold text-slate-900">Legal form</dt>
                            <dd>{entity.legalForm}</dd>
                        </div>
                        <div>
                            <dt className="font-semibold text-slate-900">Legal representative</dt>
                            <dd>{entity.representativeName}</dd>
                        </div>
                        <div>
                            <dt className="font-semibold text-slate-900">Responsible (§ 18 Abs. 2 MStV)</dt>
                            <dd>{entity.responsibleForContent}</dd>
                        </div>
                        <div className="md:col-span-2">
                            <dt className="font-semibold text-slate-900">Address</dt>
                            <dd>
                                <address className="not-italic">
                                    {entity.addressLines.map((line) => (
                                        <span key={line} className="block">{line}</span>
                                    ))}
                                </address>
                            </dd>
                        </div>
                        <div>
                            <dt className="font-semibold text-slate-900">Email</dt>
                            <dd>
                                <a className="text-accent-700 hover:underline" href={`mailto:${entity.contactEmail}`}>
                                    {entity.contactEmail}
                                </a>
                            </dd>
                        </div>
                        {shouldShowPhone && (
                            <div>
                                <dt className="font-semibold text-slate-900">Phone</dt>
                                <dd>{entity.phone}</dd>
                            </div>
                        )}
                        {shouldShowVat && (
                            <div>
                                <dt className="font-semibold text-slate-900">VAT ID</dt>
                                <dd>{entity.vatId}</dd>
                            </div>
                        )}
                        {shouldShowRegisterCourt && (
                            <div>
                                <dt className="font-semibold text-slate-900">Register court</dt>
                                <dd>{entity.registerCourt}</dd>
                            </div>
                        )}
                        {shouldShowRegisterNumber && (
                            <div>
                                <dt className="font-semibold text-slate-900">Register number</dt>
                                <dd>{entity.registerNumber}</dd>
                            </div>
                        )}
                        {shouldShowSupervisoryAuthority && (
                            <div>
                                <dt className="font-semibold text-slate-900">Supervisory authority</dt>
                                <dd>{entity.supervisoryAuthority}</dd>
                            </div>
                        )}
                    </dl>
                </Section>

                <Section title="Hosting & technical contact">
                    <p>
                        {APP_NAME} is hosted with {hosting.provider}. Primary data processing takes place in {hosting.dataRegion}.
                        All infrastructure partners are selected with GDPR compliance and data minimization in mind.
                    </p>
                </Section>

                <Section title="Supervisory authority & dispute resolution">
                    <p>
                        Supervisory authority responsible for media and telecommunication matters:
                    </p>
                    <p className="mt-2 font-semibold">{supervision.authorityName}</p>
                    <p>
                        Website:{' '}
                        <a className="text-accent-700 hover:underline" href={supervision.authorityWebsite} target="_blank" rel="noreferrer">
                            {supervision.authorityWebsite}
                        </a>
                    </p>
                    <p className="mt-4">
                        The European Commission provides a platform for Online Dispute Resolution (ODR):{' '}
                        <a className="text-accent-700 hover:underline" href={dispute.odrUrl} target="_blank" rel="noreferrer">
                            {dispute.odrUrl}
                        </a>.
                        {dispute.participatesInConsumerArbitration
                            ? ` ${APP_NAME} participates in dispute resolution procedures before a consumer arbitration board.`
                            : ` ${APP_NAME} is not obligated and currently not willing to participate in dispute resolution procedures before a consumer arbitration board.`}
                    </p>
                </Section>

                <Section title="Content accountability">
                    <p>
                        All content on this website was created with great care. Nevertheless, no liability is assumed for the
                        accuracy, completeness, or timeliness of the information. As a service provider, {APP_NAME} is
                        responsible for its own content on these pages according to § 7 Abs.1 TMG. Under §§ 8 to 10 TMG,
                        {APP_NAME} is not obligated to monitor transmitted or stored external information.
                    </p>
                </Section>
            </div>
        </MarketingLayout>
    );
};
