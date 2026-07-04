import React from 'react';
import { Link } from 'react-router-dom';
import { AirplaneTilt } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';
import { buildPath } from '../../config/routes';

const MARQUEE_KEYS = ['plan', 'travel', 'seconds', 'tabs', 'link'] as const;

const MarqueeBand: React.FC = () => {
    const { t } = useTranslation('home');
    const phrases = MARQUEE_KEYS.map((key) => t(`marquee.${key}`));

    return (
        <div
            aria-hidden="true"
            className="relative left-1/2 w-screen -translate-x-1/2 overflow-hidden border-y border-slate-200 bg-white py-5"
        >
            <div className="animate-marquee flex w-max items-center" style={{ '--marquee-duration': '32s' } as React.CSSProperties}>
                {[0, 1].map((copy) => (
                    <div key={copy} className="flex items-center">
                        {phrases.map((phrase) => (
                            <span
                                key={`${copy}-${phrase}`}
                                className="flex items-center gap-6 pe-6 text-2xl font-semibold tracking-tight text-slate-300 md:text-3xl"
                                style={{ fontFamily: 'var(--tf-font-heading)' }}
                            >
                                {phrase}
                                <AirplaneTilt size={20} weight="duotone" className="shrink-0 text-accent-300" />
                            </span>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
};

const PassDetail: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div>
        <dt className="font-mono text-[10px] font-semibold uppercase tracking-[0.25em] text-accent-200">
            {label}
        </dt>
        <dd className="mt-1 font-mono text-sm font-bold uppercase tracking-widest text-white">
            {value}
        </dd>
    </div>
);

export const CtaBanner: React.FC = () => {
    const { t } = useTranslation(['home', 'common']);

    return (
        <section className="pb-16 md:pb-24 lazy-cta-banner">
            <MarqueeBand />

            <div className="animate-scroll-scale-in mx-auto mt-16 max-w-4xl md:mt-24">
                <div className="grid overflow-hidden rounded-[2rem] bg-gradient-to-br from-accent-600 via-accent-700 to-accent-900 shadow-2xl shadow-accent-200 md:grid-cols-[1fr_220px]">
                    {/* Main panel */}
                    <div className="relative px-8 py-12 md:px-12 md:py-14">
                        <div className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.3em] text-accent-200">
                            <AirplaneTilt size={14} weight="duotone" aria-hidden="true" />
                            {t('home:cta.pass.label')} · {t('home:cta.pass.airline')}
                        </div>
                        <h2
                            className="mt-5 text-balance text-3xl font-semibold text-white md:text-4xl"
                            style={{ fontFamily: 'var(--tf-font-heading)' }}
                        >
                            {t('home:cta.title')}
                        </h2>
                        <p className="mt-3 max-w-lg text-pretty text-base text-accent-100">
                            {t('home:cta.subtitle')}
                        </p>
                        <dl className="mt-7 flex flex-wrap gap-x-10 gap-y-4">
                            <PassDetail label={t('home:cta.pass.gateLabel')} value={t('home:cta.pass.gateValue')} />
                            <PassDetail label={t('home:cta.pass.seatLabel')} value={t('home:cta.pass.seatValue')} />
                            <PassDetail label={t('home:cta.pass.classLabel')} value={t('home:cta.pass.classValue')} />
                        </dl>
                        <Link
                            to={buildPath('createTrip')}
                            onClick={() => trackEvent('home__bottom_cta')}
                            className="mt-9 inline-block rounded-2xl bg-white px-8 py-3.5 text-base font-bold text-accent-700 shadow-lg transition-[scale,background-color,box-shadow] duration-150 ease-out hover:scale-[1.03] hover:bg-accent-50 hover:shadow-xl active:scale-[0.96]"
                            {...getAnalyticsDebugAttributes('home__bottom_cta')}
                        >
                            {t('common:buttons.startPlanningFree')}
                        </Link>
                    </div>

                    {/* Tear-off stub */}
                    <div className="tf-pass-perforation hidden flex-col items-center justify-between px-6 py-10 md:flex">
                        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.3em] text-accent-200 [writing-mode:vertical-rl]">
                            {t('home:cta.pass.airline')}
                        </span>
                        <div aria-hidden="true" className="h-24 w-full text-white/70 tf-barcode" />
                    </div>
                </div>
            </div>
        </section>
    );
};
