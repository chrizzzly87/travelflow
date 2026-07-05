import type { Metadata } from 'next';
import React from 'react';
import { CountryDetailPage } from '../../../../../../views/inspirations/CountryDetailPage';
import { buildPageTitle, getServerT } from '../../../../../../lib/i18n/server';

interface PageProps {
    params: Promise<{ locale: string; countryName: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { locale } = await params;
    const t = await getServerT(locale, ['common']);
    return { title: buildPageTitle(t('nav.inspirations')) };
}

export default function Page() {
    return <CountryDetailPage />;
}
