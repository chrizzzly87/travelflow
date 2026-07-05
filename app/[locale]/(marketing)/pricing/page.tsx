import type { Metadata } from 'next';
import React from 'react';
import { PricingPage } from '../../../../views/PricingPage';
import { I18nProvider } from '../../../../components/providers/I18nProvider';
import { loadLocaleResources } from '../../../../lib/i18n/resources';
import { buildPageTitle, getServerT } from '../../../../lib/i18n/server';

interface PageProps {
    params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { locale } = await params;
    const t = await getServerT(locale, ['common']);
    return { title: buildPageTitle(t('nav.pricing')) };
}

export default async function Page({ params }: PageProps) {
    const { locale } = await params;
    const resources = await loadLocaleResources(locale, ['pricing']);

    return (
        <I18nProvider locale={locale} resources={resources}>
            <PricingPage />
        </I18nProvider>
    );
}
