import React from 'react';
import { MarketingLayout } from '../../components/marketing/MarketingLayout';
import { APP_NAME } from '../../config/appGlobals';
import { LEGAL_PROFILE } from '../../config/legalProfile';
import { COOKIE_CATEGORY_COPY, getCookieTableRows } from '../../lib/legal/cookies';

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <h2 className="text-xl font-semibold text-slate-900 md:text-2xl">{title}</h2>
        <div className="mt-4 text-sm leading-6 text-slate-700">
            {children}
        </div>
    </section>
);

export const PrivacyPolicyPage: React.FC = () => {
    const { entity, hosting, reviewDates, supervision } = LEGAL_PROFILE;
    const cookieRows = getCookieTableRows();
    const analyticsCookies = cookieRows.filter((row) => row.category === 'analytics');

    return (
        <MarketingLayout>
            <div className="space-y-6">
                <section className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-6 shadow-sm md:p-10">
                    <p className="text-xs font-semibold uppercase tracking-widest text-accent-600">GDPR · DSGVO</p>
                    <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900 md:text-4xl">
                        Privacy Policy
                    </h1>
                    <p className="mt-4 text-base text-slate-700 md:text-lg">
                        This privacy policy explains which personal data {APP_NAME} processes when you visit our website or
                        use the planning tools, why we process it, and which rights you can exercise under Articles 13-22
                        GDPR. We only collect the data that is necessary to operate the product and continuously reduce the
                        amount of personal information we store.
                    </p>
                    <p className="mt-4 text-sm text-slate-600">
                        Last updated: {reviewDates.privacyLastUpdated}
                    </p>
                </section>

                <Section title="1. Controller & contact">
                    <p>The controller within the meaning of Art. 4(7) GDPR is:</p>
                    <p className="mt-2 font-semibold text-slate-900">{entity.businessName}</p>
                    <p className="text-slate-700">{entity.legalForm}</p>
                    <div className="mt-2 text-slate-700">
                        <address className="not-italic">
                            {entity.addressLines.map((line) => (
                                <span key={line} className="block">{line}</span>
                            ))}
                        </address>
                    </div>
                    <p className="mt-2">
                        Email:{' '}
                        <a href={`mailto:${entity.contactEmail}`} className="text-accent-700 hover:underline">{entity.contactEmail}</a>
                    </p>
                    <p>
                        Privacy inquiries:{' '}
                        <a href={`mailto:${entity.privacyEmail}`} className="text-accent-700 hover:underline">{entity.privacyEmail}</a>
                    </p>
                </Section>

                <Section title="2. Categories of data we process">
                    <ul className="list-disc space-y-2 pl-5">
                        <li><strong>Server logs:</strong> IP address (shortened/anonymised), referrer, device metadata, timestamp.</li>
                        <li><strong>Account data:</strong> Email address, encrypted password or OAuth identifier, profile preferences.</li>
                        <li><strong>Product telemetry:</strong> Aggregated feature events and consent state (opt-in only).</li>
                        <li><strong>Support communication:</strong> Messages you send to us via email or contact form.</li>
                    </ul>
                </Section>

                <Section title="3. Purposes & legal bases">
                    <ul className="list-disc space-y-2 pl-5">
                        <li>Provide and improve the {APP_NAME} planning experience (Art. 6(1)(b) GDPR – performance of a contract).</li>
                        <li>Secure the service, prevent abuse, and debug incidents (Art. 6(1)(f) GDPR – legitimate interest in security).</li>
                        <li>Comply with legal retention requirements (Art. 6(1)(c) GDPR).
                        </li>
                        <li>Send essential product updates or respond to support requests (Art. 6(1)(b) GDPR).
                        </li>
                    </ul>
                </Section>

                <Section title="4. Storage, hosting & retention">
                    <p>
                        {APP_NAME} is hosted on {hosting.provider}. Application data is stored primarily in {hosting.dataRegion}. We
                        retain server logs for a maximum of 30 days unless needed for incident investigations. Account data is
                        stored until you request deletion or your account becomes inactive for more than 24 months.
                    </p>
                </Section>

                <Section title="5. Analytics (Umami)">
                    <p>
                        We use Umami Analytics, a privacy-friendly, cookieless analytics platform. Umami does not collect personal
                        data, stores measurements in our own infrastructure, and anonymises IP addresses. We only record
                        aggregate metrics (page views, conversion funnels) to understand product demand.
                    </p>
                    {analyticsCookies.length > 0 && (
                        <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                            <p className="text-sm font-semibold text-slate-900">
                                {COOKIE_CATEGORY_COPY.analytics.title}
                            </p>
                            <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-slate-700">
                                {analyticsCookies.map((cookie) => (
                                    <li key={cookie.name}>
                                        <strong>{cookie.name}</strong> – {cookie.purpose} (storage: {cookie.storage ?? 'cookie'}, duration: {cookie.duration})
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </Section>

                <Section title="6. Cookies & consent">
                    <p>
                        Essential cookies are required to provide secure logins and prevent fraud; they are always active. Optional
                        cookies (analytics or future marketing tags) are only loaded after you click “Accept all” in the cookie
                        banner. You can change your decision at any time via the Cookie Policy page.
                    </p>
                </Section>

                <Section title="7. Your rights">
                    <p>You have the following rights under Articles 15-22 GDPR:</p>
                    <ul className="mt-2 list-disc space-y-2 pl-5">
                        <li>Access to the data we store about you.</li>
                        <li>Rectification of inaccurate data.</li>
                        <li>Erasure (“right to be forgotten”) where legally permissible.</li>
                        <li>Restriction of processing.</li>
                        <li>Data portability.</li>
                        <li>Objection to processing based on legitimate interests or direct marketing.</li>
                        <li>Right to withdraw consent at any time.</li>
                    </ul>
                    <p className="mt-2">
                        To exercise these rights, email{' '}
                        <a href={`mailto:${entity.privacyEmail}`} className="text-accent-700 hover:underline">{entity.privacyEmail}</a>.
                        We respond within one month as required by Art. 12(3) GDPR.
                    </p>
                </Section>

                <Section title="8. Complaints">
                    <p>
                        If you believe that the processing of your personal data infringes GDPR, you have the right to lodge a
                        complaint with the supervisory authority responsible for your habitual residence. You can also contact
                        our local authority:
                    </p>
                    <p className="mt-2 font-semibold">{supervision.authorityName}</p>
                    <a href={supervision.authorityWebsite} target="_blank" rel="noreferrer" className="text-accent-700 hover:underline">
                        {supervision.authorityWebsite}
                    </a>
                </Section>
            </div>
        </MarketingLayout>
    );
};
