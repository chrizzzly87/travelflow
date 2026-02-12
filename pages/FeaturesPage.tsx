import React from 'react';
import { Link } from 'react-router-dom';
import {
    Sparkle,
    MapTrifold,
    SlidersHorizontal,
    UsersThree,
    ShareNetwork,
    LinkSimple,
    Timer,
    DeviceMobile,
    Printer,
    Globe,
    ArrowsClockwise,
    ShieldCheck,
} from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { MarketingLayout } from '../components/marketing/MarketingLayout';
import { getAnalyticsDebugAttributes, trackEvent } from '../services/analyticsService';
import { buildPath } from '../config/routes';

interface Feature {
    icon: Icon;
    title: string;
    description: string;
    color: string;
}

const ComparisonCell: React.FC<{ value: boolean | string; yesLabel: string }> = ({ value, yesLabel }) => {
    if (value === true) return <span className="text-emerald-600 font-bold">{yesLabel}</span>;
    if (value === false) return <span className="text-slate-300">-</span>;
    return <span className="text-amber-600 text-xs font-medium">{value}</span>;
};

export const FeaturesPage: React.FC = () => {
    const { t } = useTranslation('features');

    const heroFeatures: Feature[] = [
        {
            icon: Sparkle,
            title: t('heroCards.ai.title'),
            description: t('heroCards.ai.description'),
            color: 'bg-violet-50 text-violet-600 ring-violet-100',
        },
        {
            icon: MapTrifold,
            title: t('heroCards.map.title'),
            description: t('heroCards.map.description'),
            color: 'bg-sky-50 text-sky-600 ring-sky-100',
        },
        {
            icon: SlidersHorizontal,
            title: t('heroCards.editing.title'),
            description: t('heroCards.editing.description'),
            color: 'bg-amber-50 text-amber-600 ring-amber-100',
        },
    ];

    const secondaryFeatures: { icon: Icon; title: string; description: string }[] = [
        {
            icon: ShareNetwork,
            title: t('secondary.sharing.title'),
            description: t('secondary.sharing.description'),
        },
        {
            icon: UsersThree,
            title: t('secondary.community.title'),
            description: t('secondary.community.description'),
        },
        {
            icon: LinkSimple,
            title: t('secondary.booking.title'),
            description: t('secondary.booking.description'),
        },
        {
            icon: Timer,
            title: t('secondary.duration.title'),
            description: t('secondary.duration.description'),
        },
        {
            icon: DeviceMobile,
            title: t('secondary.mobile.title'),
            description: t('secondary.mobile.description'),
        },
        {
            icon: Printer,
            title: t('secondary.print.title'),
            description: t('secondary.print.description'),
        },
        {
            icon: Globe,
            title: t('secondary.routing.title'),
            description: t('secondary.routing.description'),
        },
        {
            icon: ArrowsClockwise,
            title: t('secondary.history.title'),
            description: t('secondary.history.description'),
        },
        {
            icon: ShieldCheck,
            title: t('secondary.privacy.title'),
            description: t('secondary.privacy.description'),
        },
    ];

    const comparisonRows = [
        { feature: t('comparison.rows.ai'), travelflow: true, spreadsheet: false, other: t('comparison.partial') },
        { feature: t('comparison.rows.interactiveMap'), travelflow: true, spreadsheet: false, other: true },
        { feature: t('comparison.rows.dragDrop'), travelflow: true, spreadsheet: false, other: false },
        { feature: t('comparison.rows.oneClickSharing'), travelflow: true, spreadsheet: t('comparison.manual'), other: true },
        { feature: t('comparison.rows.bookingLinks'), travelflow: true, spreadsheet: false, other: t('comparison.partial') },
        { feature: t('comparison.rows.offlineFirst'), travelflow: true, spreadsheet: false, other: false },
        { feature: t('comparison.rows.freeToUse'), travelflow: true, spreadsheet: true, other: t('comparison.freemium') },
    ];

    return (
        <MarketingLayout>
            <section className="pt-8 pb-16 md:pt-14 md:pb-24 animate-hero-entrance">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-200 bg-accent-50 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-accent-700">
                    {t('hero.pill')}
                </span>
                <h1 className="mt-5 text-4xl font-black tracking-tight text-slate-900 md:text-6xl" style={{ fontFamily: 'var(--tf-font-heading)' }}>
                    {t('hero.title')}
                </h1>
                <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-600">
                    {t('hero.description')}
                </p>
            </section>

            <section className="grid gap-6 md:grid-cols-3 pb-20">
                {heroFeatures.map((feature, index) => {
                    const IconComponent = feature.icon;
                    return (
                        <article
                            key={feature.title}
                            className="animate-scroll-blur-in rounded-3xl border border-slate-200 bg-white p-7 shadow-sm transition-all hover:shadow-lg hover:-translate-y-1"
                            style={{ animationDelay: `${index * 80}ms` }}
                        >
                            <div className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ring-1 ${feature.color}`}>
                                <IconComponent size={24} weight="duotone" />
                            </div>
                            <h2 className="mt-5 text-lg font-bold text-slate-900">{feature.title}</h2>
                            <p className="mt-2 text-sm leading-relaxed text-slate-600">{feature.description}</p>
                        </article>
                    );
                })}
            </section>

            <section className="py-16 md:py-24 border-t border-slate-200">
                <div className="animate-scroll-blur-in text-center">
                    <h2 className="text-3xl font-black tracking-tight text-slate-900 md:text-4xl">{t('workflow.title')}</h2>
                    <p className="mx-auto mt-3 max-w-lg text-base text-slate-600">{t('workflow.subtitle')}</p>
                </div>

                <div className="mt-14 grid gap-8 md:grid-cols-3">
                    {[
                        { step: '01', title: t('workflow.step1Title'), description: t('workflow.step1Description') },
                        { step: '02', title: t('workflow.step2Title'), description: t('workflow.step2Description') },
                        { step: '03', title: t('workflow.step3Title'), description: t('workflow.step3Description') },
                    ].map((item, index) => (
                        <div key={item.step} className="animate-scroll-fade-up text-center" style={{ animationDelay: `${index * 100}ms` }}>
                            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent-600 text-white text-lg font-black">
                                {item.step}
                            </div>
                            <h3 className="mt-4 text-base font-bold text-slate-900">{item.title}</h3>
                            <p className="mt-2 text-sm leading-relaxed text-slate-500">{item.description}</p>
                        </div>
                    ))}
                </div>
            </section>

            <section className="py-16 md:py-24 border-t border-slate-200">
                <div className="animate-scroll-blur-in">
                    <h2 className="text-3xl font-black tracking-tight text-slate-900 md:text-4xl">{t('more.title')}</h2>
                    <p className="mt-3 max-w-xl text-base text-slate-600">{t('more.subtitle')}</p>
                </div>

                <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {secondaryFeatures.map((feature) => {
                        const IconComponent = feature.icon;
                        return (
                            <div
                                key={feature.title}
                                className="animate-scroll-fade-up rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:shadow-md"
                            >
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-50 text-accent-600">
                                    <IconComponent size={22} weight="duotone" />
                                </div>
                                <h3 className="mt-4 text-sm font-bold text-slate-900">{feature.title}</h3>
                                <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{feature.description}</p>
                            </div>
                        );
                    })}
                </div>
            </section>

            <section className="py-16 md:py-24 border-t border-slate-200">
                <div className="animate-scroll-blur-in">
                    <h2 className="text-3xl font-black tracking-tight text-slate-900 md:text-4xl">{t('comparison.title')}</h2>
                    <p className="mt-3 max-w-xl text-base text-slate-600">{t('comparison.subtitle')}</p>
                </div>

                <div className="mt-10 overflow-x-auto animate-scroll-fade-up">
                    <table className="w-full min-w-[540px] text-sm">
                        <thead>
                            <tr className="border-b border-slate-200 text-left">
                                <th className="py-3 pr-4 font-semibold text-slate-500">{t('comparison.featureHeader')}</th>
                                <th className="py-3 px-4 font-bold text-accent-700">{t('comparison.travelflowHeader')}</th>
                                <th className="py-3 px-4 font-semibold text-slate-500">{t('comparison.spreadsheetHeader')}</th>
                                <th className="py-3 px-4 font-semibold text-slate-500">{t('comparison.otherHeader')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {comparisonRows.map((row) => (
                                <tr key={row.feature} className="border-b border-slate-100">
                                    <td className="py-3 pr-4 text-slate-700">{row.feature}</td>
                                    <td className="py-3 px-4"><ComparisonCell value={row.travelflow} yesLabel={t('comparison.yes')} /></td>
                                    <td className="py-3 px-4"><ComparisonCell value={row.spreadsheet} yesLabel={t('comparison.yes')} /></td>
                                    <td className="py-3 px-4"><ComparisonCell value={row.other} yesLabel={t('comparison.yes')} /></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            <section className="pb-16 md:pb-24 animate-scroll-scale-in">
                <div className="relative rounded-3xl bg-gradient-to-br from-accent-600 to-accent-800 px-8 py-14 text-center md:px-16 md:py-20 overflow-hidden">
                    <div className="pointer-events-none absolute -top-20 -right-20 h-60 w-60 rounded-full bg-white/10 blur-[60px]" />
                    <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-accent-400/20 blur-[50px]" />

                    <h2 className="relative text-3xl font-black tracking-tight text-white md:text-5xl" style={{ fontFamily: 'var(--tf-font-heading)' }}>
                        {t('cta.title')}
                    </h2>
                    <p className="relative mx-auto mt-4 max-w-xl text-base text-accent-100 md:text-lg">
                        {t('cta.subtitle')}
                    </p>
                    <Link
                        to={buildPath('createTrip')}
                        onClick={() => trackEvent('features__bottom_cta')}
                        className="relative mt-8 inline-block rounded-2xl bg-white px-8 py-3.5 text-base font-bold text-accent-700 shadow-lg transition-all hover:shadow-xl hover:bg-accent-50 hover:scale-[1.03] active:scale-[0.98]"
                        {...getAnalyticsDebugAttributes('features__bottom_cta')}
                    >
                        {t('cta.button')}
                    </Link>
                </div>
            </section>
        </MarketingLayout>
    );
};
