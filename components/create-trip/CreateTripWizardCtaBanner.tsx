import React from 'react';
import { Link } from 'react-router-dom';
import { buildPath } from '../../config/routes';
import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';

interface CreateTripWizardCtaBannerProps {
    title: string;
    description: string;
    ctaLabel: string;
    className?: string;
}

const WIZARD_CTA_EVENT = 'create_trip__cta--wizard_banner';

export const CreateTripWizardCtaBanner: React.FC<CreateTripWizardCtaBannerProps> = ({
    title,
    description,
    ctaLabel,
    className,
}) => {
    return (
        <section className={className}>
            <div className="border-y border-slate-200 py-8 text-slate-950">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                    <div className="min-w-0">
                        <p className="text-base font-semibold sm:text-lg">{title}</p>
                        <p className="mt-2 max-w-[64ch] text-sm leading-6 text-slate-600">{description}</p>
                    </div>
                    <Link
                        to={buildPath('createTripWizard')}
                        onClick={() => trackEvent(WIZARD_CTA_EVENT, { source: 'create_trip_page' })}
                        className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
                        {...getAnalyticsDebugAttributes(WIZARD_CTA_EVENT, { source: 'create_trip_page' })}
                    >
                        {ctaLabel}
                    </Link>
                </div>
            </div>
        </section>
    );
};
