import React from 'react';
import { ChatCircleText, MagicWand, PaperPlaneTilt } from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';

interface Step {
    icon: Icon;
    tag: string;
    title: string;
    description: string;
}

export const HowItWorksSection: React.FC = () => {
    const { t } = useTranslation('home');

    const steps: Step[] = [
        {
            icon: ChatCircleText,
            tag: t('howItWorks.steps.describe.tag'),
            title: t('howItWorks.steps.describe.title'),
            description: t('howItWorks.steps.describe.description'),
        },
        {
            icon: MagicWand,
            tag: t('howItWorks.steps.generate.tag'),
            title: t('howItWorks.steps.generate.title'),
            description: t('howItWorks.steps.generate.description'),
        },
        {
            icon: PaperPlaneTilt,
            tag: t('howItWorks.steps.refine.tag'),
            title: t('howItWorks.steps.refine.title'),
            description: t('howItWorks.steps.refine.description'),
        },
    ];

    return (
        <section className="py-16 md:py-24">
            <div className="animate-scroll-blur-in text-center">
                <span className="inline-flex items-center rounded-full border border-accent-200 bg-accent-50 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-accent-700">
                    {t('howItWorks.eyebrow')}
                </span>
                <h2 className="mt-5 text-balance text-3xl font-semibold tracking-tight text-slate-900 md:text-5xl">
                    {t('howItWorks.title')}
                </h2>
                <p className="mx-auto mt-4 max-w-xl text-pretty text-base text-slate-600 md:text-lg">
                    {t('howItWorks.subtitle')}
                </p>
            </div>

            <div className="relative mt-14">
                {/* Dashed flight path behind the ticket row (desktop only) */}
                <div
                    aria-hidden="true"
                    className="absolute inset-x-12 top-1/2 hidden border-t-2 border-dashed border-accent-200 md:block"
                />
                <div className="relative grid gap-6 md:grid-cols-3 md:gap-8">
                    {steps.map((step, index) => {
                        const IconComponent = step.icon;
                        return (
                            <div
                                key={step.tag}
                                className="animate-scroll-fade-up tf-stagger-range overflow-hidden rounded-3xl border border-slate-200 bg-white p-7 shadow-sm transition-shadow duration-200 hover:shadow-lg"
                                style={{ '--wi': index } as React.CSSProperties}
                            >
                                <div className="flex items-center justify-between">
                                    <span className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-accent-600">
                                        {step.tag}
                                    </span>
                                    <span className="flex size-11 items-center justify-center rounded-xl bg-accent-50 text-accent-600 ring-1 ring-accent-100">
                                        <IconComponent size={24} weight="duotone" />
                                    </span>
                                </div>
                                <div className="tf-ticket-divider" aria-hidden="true" />
                                <h3 className="text-lg font-semibold text-slate-900">{step.title}</h3>
                                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                                    {step.description}
                                </p>
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
};
