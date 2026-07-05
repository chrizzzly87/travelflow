import React from 'react';
import { MarketingHomePage } from '../../../views/MarketingHomePage';
import { AuthenticatedMarketingHomeRoute } from '../../../appCore/routes/guards';
import { I18nProvider } from '../../../components/providers/I18nProvider';
import { loadLocaleResources } from '../../../lib/i18n/resources';

interface PageProps {
    params: Promise<{ locale: string }>;
}

export default async function HomePage({ params }: PageProps) {
    const { locale } = await params;
    const resources = await loadLocaleResources(locale, ['home']);

    return (
        <I18nProvider locale={locale} resources={resources}>
            <AuthenticatedMarketingHomeRoute>
                <MarketingHomePage />
            </AuthenticatedMarketingHomeRoute>
        </I18nProvider>
    );
}
