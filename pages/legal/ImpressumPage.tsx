import React from 'react';
import { MarketingLayout } from '../../components/marketing/MarketingLayout';
import {
    formatMultilineAddress,
    getHostingInfo,
    getLegalContactInfo,
    getLegalSupervisionInfo,
} from '../../lib/legal/legalEnv';

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <h2 className="text-xl font-semibold text-slate-900 md:text-2xl">{title}</h2>
        <div className="mt-4 text-sm leading-6 text-slate-700">
            {children}
        </div>
    </section>
);

export const ImprintPage: React.FC = () => {
    const contact = getLegalContactInfo();
    const supervision = getLegalSupervisionInfo();
    const hosting = getHostingInfo();
    const addressLines = formatMultilineAddress(contact.address);

    return (
        <MarketingLayout>
            <div className="space-y-6">
                <section className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-6 shadow-sm md:p-10">
                    <p className="text-xs font-semibold uppercase tracking-widest text-accent-600">§5 TMG · §18 Abs. 2 MStV</p>
                    <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900 md:text-4xl">
                        Impressum (Legal Notice)
                    </h1>
                    <p className="mt-4 text-base text-slate-700 md:text-lg">
                        This page provides all mandatory provider and contact information for Travelflow in accordance with
                        German Telemedia Act (Telemediengesetz) and the Interstate Media Treaty (Medienstaatsvertrag).
                        Personal details below are injected via environment variables so production deployments can stay
                        compliant without exposing sensitive data in source control.
                    </p>
                </section>

                <Section title="Responsible entity / Diensteanbieter">
                    <dl className="grid gap-4 md:grid-cols-2">
                        <div>
                            <dt className="font-semibold text-slate-900">Business name</dt>
                            <dd>{contact.businessName}</dd>
                        </div>
                        <div>
                            <dt className="font-semibold text-slate-900">Legal form</dt>
                            <dd>{contact.legalForm}</dd>
                        </div>
                        <div>
                            <dt className="font-semibold text-slate-900">Legal representative</dt>
                            <dd>{contact.representative}</dd>
                        </div>
                        <div>
                            <dt className="font-semibold text-slate-900">Responsible (§ 18 Abs. 2 MStV)</dt>
                            <dd>{contact.responsible}</dd>
                        </div>
                        <div className="md:col-span-2">
                            <dt className="font-semibold text-slate-900">Address</dt>
                            <dd>
                                <address className="not-italic">
                                    {addressLines.map((line) => (
                                        <span key={line} className="block">{line}</span>
                                    ))}
                                </address>
                            </dd>
                        </div>
                        <div>
                            <dt className="font-semibold text-slate-900">Email</dt>
                            <dd>
                                <a className="text-accent-700 hover:underline" href={`mailto:${contact.email}`}>
                                    {contact.email}
                                </a>
                            </dd>
                        </div>
                        <div>
                            <dt className="font-semibold text-slate-900">Phone</dt>
                            <dd>{contact.phone}</dd>
                        </div>
                        <div>
                            <dt className="font-semibold text-slate-900">VAT ID</dt>
                            <dd>{contact.vatId}</dd>
                        </div>
                        <div>
                            <dt className="font-semibold text-slate-900">Register court</dt>
                            <dd>{contact.registerCourt}</dd>
                        </div>
                        <div>
                            <dt className="font-semibold text-slate-900">Register number</dt>
                            <dd>{contact.registerNumber}</dd>
                        </div>
                        <div>
                            <dt className="font-semibold text-slate-900">Supervisory authority</dt>
                            <dd>{contact.supervisoryAuthority}</dd>
                        </div>
                    </dl>
                </Section>

                <Section title="Hosting & technical contact">
                    <p>
                        Travelflow is hosted with {hosting.provider}. Primary data processing takes place in {hosting.dataRegion}.
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
                        <a className="text-accent-700 hover:underline" href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noreferrer">
                            https://ec.europa.eu/consumers/odr
                        </a>.
                        Travelflow is not obligated and currently not willing to participate in dispute resolution procedures
                        before a consumer arbitration board.
                    </p>
                </Section>

                <Section title="Content accountability">
                    <p>
                        All content on this website was created with great care. Nevertheless, no liability is assumed for the
                        accuracy, completeness, or timeliness of the information. As a service provider, Travelflow is
                        responsible for its own content on these pages according to § 7 Abs.1 TMG. Under §§ 8 to 10 TMG,
                        Travelflow is not obligated to monitor transmitted or stored external information.
                    </p>
                </Section>
            </div>
        </MarketingLayout>
    );
};
