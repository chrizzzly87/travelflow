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
            <div className="relative overflow-hidden rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-600 via-indigo-700 to-indigo-900 px-5 py-5 text-white shadow-lg">
                <div className="pointer-events-none absolute -right-14 -top-16 h-40 w-40 rounded-full bg-white/15 blur-2xl" />
                <div className="pointer-events-none absolute -bottom-12 -left-12 h-36 w-36 rounded-full bg-indigo-200/20 blur-2xl" />

                <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                        <p className="text-base font-semibold sm:text-lg">{title}</p>
                        <p className="mt-1 text-sm text-indigo-100">{description}</p>
                    </div>
                    <Link
                        to={buildPath('createTripWizard')}
                        onClick={() => trackEvent(WIZARD_CTA_EVENT, { source: 'create_trip_page' })}
                        className="inline-flex shrink-0 items-center justify-center rounded-xl border border-white/30 bg-white px-4 py-2 text-sm font-semibold text-indigo-800 transition hover:bg-indigo-50"
                        {...getAnalyticsDebugAttributes(WIZARD_CTA_EVENT, { source: 'create_trip_page' })}
                    >
                        {ctaLabel}
                    </Link>
                </div>
            </div>
        </section>
    );
};
